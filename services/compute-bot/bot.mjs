// Local GPU worker. The site on the VPS queues a lesson; this process
// downloads the recording, runs Whisper and Ollama on this machine,
// then posts the report back and copies it into Telegram.
//
//   node services/compute-bot/bot.mjs
//
// Env file: services/compute-bot/.env

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));

const site = required('SITE_URL').replace(/\/$/, '');
const tokenHeader = required('COMPUTE_SECRET');
const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const transcriberUrl = (process.env.TRANSCRIBER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = process.env.TELEGRAM_CHAT_ID || '';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in services/compute-bot/.env`);
  return value;
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function telegram(text) {
  if (!botToken || !chatId) return;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
  if (!response.ok) {
    console.error('telegram', response.status, (await response.text()).slice(0, 300));
  }
}

async function api(pathname, options = {}) {
  const response = await fetch(`${site}${pathname}`, {
    ...options,
    headers: {
      'x-compute-token': tokenHeader,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

function serveFile(filePath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not bind a local file server'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/audio`,
        close: () => server.close(),
      });
    });
  });
}

async function downloadRecording(job) {
  const response = await api(job.recordingPath);
  if (!response.ok) {
    throw new Error(`Recording download failed (${response.status})`);
  }
  const filePath = path.join(os.tmpdir(), `lesson-${job.lessonId}.audio`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function transcribe(filePath) {
  const served = await serveFile(filePath);
  try {
    const response = await fetch(`${transcriberUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: served.url, language: 'ru' }),
    });
    if (!response.ok) {
      throw new Error(`Whisper ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }
    return response.json();
  } finally {
    served.close();
  }
}

function formatTranscript(transcript) {
  if (!transcript.segments?.length) return (transcript.text || '').trim();
  return transcript.segments
    .map((segment) => {
      const value = Math.max(0, Math.round(segment.start || 0));
      const h = String(Math.floor(value / 3600)).padStart(2, '0');
      const m = String(Math.floor((value % 3600) / 60)).padStart(2, '0');
      const s = String(value % 60).padStart(2, '0');
      return `[${h}:${m}:${s}] ${segment.text.trim()}`;
    })
    .join('\n');
}

async function ollama(prompt, json) {
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      format: json ? 'json' : undefined,
      think: false,
      options: { temperature: 0.2, num_ctx: 32768 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  const body = await response.json();
  if (!body.response?.trim()) throw new Error('Ollama вернула пустой ответ');
  return body.response.trim();
}

async function reportFromTranscript(transcript, lessonNote) {
  let source = formatTranscript(transcript);
  if (source.length > 70000) {
    const chunks = [];
    for (let i = 0; i < source.length; i += 24000) {
      chunks.push(
        await ollama(
          `Сделай подробный конспект части транскрипта урока. Сохрани темы, достижения, трудности, домашние задания и временные метки.\n\n${source.slice(i, i + 24000)}`,
          false,
        ),
      );
    }
    source = chunks.join('\n\n--- ЧАСТЬ ---\n\n');
  }
  const raw = await ollama(
    `Ты — методист онлайн-школы. На основе транскрипта подготовь объективный отчёт об уроке на русском языке.
Не выдумывай факты. Если информации нет, используй пустой массив.
Тема урока — то, что реально разбирали в транскрипте, одним названием. Домашние задания бери только из транскрипта и только по этой теме.
${lessonNote ? `Заметка преподавателя о слоте: ${lessonNote}` : ''}

Верни строго JSON:
{
  "summary": "краткое содержание урока",
  "topics": ["изученные темы"],
  "achievements": ["что получилось"],
  "difficulties": ["что вызвало сложности"],
  "homework": ["домашние задания, если были"],
  "recommendations": ["рекомендации для следующего занятия"],
  "keyMoments": [{"time": "HH:MM:SS", "description": "важный момент"}]
}

ТРАНСКРИПТ:
${source}`,
    true,
  );
  const parsed = JSON.parse(raw);
  return {
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : 'Отчёт сформирован без резюме',
    topics: asStrings(parsed.topics),
    achievements: asStrings(parsed.achievements),
    difficulties: asStrings(parsed.difficulties),
    homework: asStrings(parsed.homework),
    recommendations: asStrings(parsed.recommendations),
    keyMoments: Array.isArray(parsed.keyMoments)
      ? parsed.keyMoments
          .filter((item) => item && typeof item.description === 'string')
          .map((item) => ({
            time: typeof item.time === 'string' ? item.time : undefined,
            description: item.description,
          }))
      : [],
  };
}

function asStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

async function failJob(job, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(job.id, message);
  await api(`/api/compute/jobs/${job.id}/fail`, {
    method: 'POST',
    body: JSON.stringify({ error: message }),
  });
  await telegram(`Не удалось посчитать урок ${job.lessonId}: ${message}`);
}

async function processJob(job) {
  console.log('job', job.id, job.lessonId);
  await telegram(`Считаю отчёт по уроку ${job.lessonId} на локальной видеокарте.`);
  const filePath = await downloadRecording(job);
  try {
    const transcript = await transcribe(filePath);
    const report = await reportFromTranscript(transcript, job.lessonNote);
    const response = await api(`/api/compute/jobs/${job.id}/result`, {
      method: 'POST',
      body: JSON.stringify({ transcript, report }),
    });
    if (!response.ok) {
      throw new Error(`Сайт не принял отчёт (${response.status}): ${(await response.text()).slice(0, 400)}`);
    }
    await telegram(`Отчёт по уроку ${job.lessonId} отправлен на сайт.\n\n${report.summary}`);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

async function tick() {
  const response = await api('/api/compute/jobs/next', { method: 'POST' });
  if (response.status === 404) return;
  if (!response.ok) {
    console.error('claim', response.status, (await response.text()).slice(0, 300));
    return;
  }
  const job = await response.json();
  try {
    await processJob(job);
  } catch (error) {
    await failJob(job, error);
  }
}

console.log(`Compute bot watching ${site}`);
await telegram('Локальный бот отчётов запущен. Модель считается на этом компьютере.');
for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
  await new Promise((resolve) => setTimeout(resolve, 15000));
}

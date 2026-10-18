// Local GPU worker. The site on the VPS queues a lesson; this process
// downloads the recording, runs Whisper and Ollama on this machine,
// then posts the report back and copies it into Telegram.
//
//   node services/compute-bot/bot.mjs
//
// Env file: services/compute-bot/.env

import fs from 'fs';
import { createWriteStream } from 'fs';
import http from 'http';
import path from 'path';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'));

const site = required('SITE_URL').replace(/\/$/, '');
const tokenHeader = required('COMPUTE_SECRET');
const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const ollamaContextWindow = Math.max(4096, Number(process.env.OLLAMA_NUM_CTX || 16384));
const transcriberUrl = (process.env.TRANSCRIBER_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const transcriberFetchHost = process.env.TRANSCRIBER_FETCH_HOST || '127.0.0.1';
const transcriberFetchBind = process.env.TRANSCRIBER_FETCH_BIND || '127.0.0.1';
const localAudioDir = process.env.LOCAL_AUDIO_DIR || '/data/audio';
const pollIntervalMs = Math.max(1000, Number(process.env.POLL_INTERVAL_MS || 3000));
const heartbeatIntervalMs = Math.max(10000, Number(process.env.HEARTBEAT_INTERVAL_MS || 30000));
const heartbeatFailureLimit = Math.max(1, Number(process.env.HEARTBEAT_FAILURE_LIMIT || 2));
const apiTimeoutMs = Math.max(5000, Number(process.env.API_TIMEOUT_MS || 30000));
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
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('telegram', response.status, (await response.text()).slice(0, 300));
    }
  } catch (error) {
    console.error('telegram', error instanceof Error ? error.message : error);
  }
}

async function api(pathname, options = {}, leaseToken = '', signal, timeoutMs = apiTimeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(`${site}${pathname}`, {
    ...options,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      'x-compute-token': tokenHeader,
      ...(leaseToken ? { 'x-compute-lease': leaseToken } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

function serveFile(filePath) {
  const accessToken = randomBytes(24).toString('hex');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'GET' || req.url !== `/${accessToken}`) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      const file = fs.createReadStream(filePath);
      file.on('error', () => res.destroy());
      file.pipe(res);
    });
    server.listen(0, transcriberFetchBind, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not bind a local file server'));
        return;
      }
      resolve({
        url: `http://${transcriberFetchHost}:${address.port}/${accessToken}`,
        close: () => new Promise((resolve) => server.close(() => resolve())),
      });
    });
  });
}

async function downloadRecording(job, signal) {
  const safeLessonId = job.lessonId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(localAudioDir, `lesson-${safeLessonId}.ogg`);
  fs.mkdirSync(localAudioDir, { recursive: true });
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    console.log('using locally archived recording', filePath);
    return filePath;
  }

  const response = await api(job.recordingPath, {}, job.leaseToken, signal, 4 * 60 * 60 * 1000);
  if (!response.ok) {
    throw new Error(`Recording download failed (${response.status})`);
  }
  const partialPath = `${filePath}.part-${job.id}`;
  try {
    if (!response.body) throw new Error('Recording response was empty');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partialPath), { signal });
    fs.renameSync(partialPath, filePath);
    console.log('recording archived locally', filePath);
  } catch (error) {
    fs.rmSync(partialPath, { force: true });
    throw error;
  }
  return filePath;
}

async function loadTranscriptCheckpoint(job, signal) {
  const response = await api(job.transcriptPath || `/api/compute/jobs/${job.id}/transcript`, {}, job.leaseToken, signal);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Transcript checkpoint failed (${response.status})`);
  const checkpoint = await response.json();
  return checkpoint && typeof checkpoint.text === 'string' ? checkpoint : null;
}

async function saveTranscriptCheckpoint(job, transcript, signal) {
  const response = await api(job.transcriptPath || `/api/compute/jobs/${job.id}/transcript`, {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  }, job.leaseToken, signal);
  if (!response.ok) {
    throw new Error(`Сайт не сохранил транскрипт (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
}

async function transcribe(filePath, signal) {
  const served = await serveFile(filePath);
  try {
    const response = await fetch(`${transcriberUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: served.url, language: 'ru' }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Whisper ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }
    return response.json();
  } finally {
    await served.close();
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

async function ollama(prompt, json, signal) {
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      format: json ? 'json' : undefined,
      think: false,
      keep_alive: '30m',
      options: {
        temperature: 0.2,
        num_ctx: ollamaContextWindow,
        num_predict: json ? 1200 : 768,
      },
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  const body = await response.json();
  if (!body.response?.trim()) throw new Error('Ollama вернула пустой ответ');
  return body.response.trim();
}

async function reportFromTranscript(transcript, lessonNote, signal) {
  let source = formatTranscript(transcript);
  if (source.length > 50000) {
    const chunks = [];
    const sourceChunks = [];
    for (let i = 0; i < source.length; i += 30000) {
      sourceChunks.push(source.slice(i, i + 30000));
    }
    for (let i = 0; i < sourceChunks.length; i += 2) {
      chunks.push(
        ...(await Promise.all(
          sourceChunks.slice(i, i + 2).map((chunk) =>
            ollama(
              `Сделай подробный конспект части транскрипта урока. Сохрани темы, достижения, трудности, домашние задания и временные метки.\n\n${chunk}`,
              false,
              signal,
            ),
          ),
        )),
      );
    }
    source = chunks.join('\n\n--- ЧАСТЬ ---\n\n');
  }
  const raw = await ollama(
    `Ты — методист онлайн-школы. На основе транскрипта подготовь объективный отчёт об уроке на русском языке.
Не выдумывай факты. Если информации нет, используй пустой массив.
Тема урока — то, что реально разбирали в транскрипте, одним названием. Домашние задания бери только из транскрипта и только по этой теме.
Пиши кратко: summary — не более 3 предложений, не более 4 пунктов в каждом списке и не более 6 важных моментов.
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
    signal,
  );
  const parsed = parseJsonObject(raw);
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
  return Array.isArray(value)
    ? value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, 8)
    : [];
}

function parseJsonObject(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // Keep the original processing error concise and actionable.
      }
    }
    throw new Error('Локальная модель вернула некорректный JSON отчёта');
  }
}

async function failJob(job, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(job.id, message);
  await api(`/api/compute/jobs/${job.id}/fail`, {
    method: 'POST',
    body: JSON.stringify({ error: message }),
  }, job.leaseToken);
  await telegram(`Не удалось посчитать урок ${job.lessonId}: ${message}`);
}

class LeaseLostError extends Error {
  constructor(message = 'Срок обработки задания истёк или оно передано другому обработчику') {
    super(message);
    this.name = 'LeaseLostError';
  }
}

async function processJob(job) {
  console.log('job', job.id, job.lessonId);
  await telegram(`Считаю отчёт по уроку ${job.lessonId} на локальной видеокарте.`);
  const controller = new AbortController();
  let leaseLost = false;
  let heartbeatFailures = 0;
  let heartbeatBusy = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatBusy) return;
    heartbeatBusy = true;
    try {
      const response = await api(
        `/api/compute/jobs/${job.id}/heartbeat`,
        { method: 'POST' },
        job.leaseToken,
        controller.signal,
      );
      if (!response.ok) {
        console.error('heartbeat', response.status, (await response.text()).slice(0, 300));
        heartbeatFailures += 1;
        if ([401, 403, 409].includes(response.status) || heartbeatFailures >= heartbeatFailureLimit) {
          leaseLost = true;
          controller.abort(new LeaseLostError());
        }
      } else {
        heartbeatFailures = 0;
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('heartbeat', error instanceof Error ? error.message : error);
      heartbeatFailures += 1;
      if (heartbeatFailures >= heartbeatFailureLimit) {
        leaseLost = true;
        controller.abort(new LeaseLostError());
      }
    } finally {
      heartbeatBusy = false;
    }
  }, heartbeatIntervalMs);
  heartbeat.unref?.();
  let filePath;
  try {
    let transcript = await loadTranscriptCheckpoint(job, controller.signal);
    if (!transcript) {
      filePath = await downloadRecording(job, controller.signal);
      transcript = await transcribe(filePath, controller.signal);
      await saveTranscriptCheckpoint(job, transcript, controller.signal);
    }
    const report = await reportFromTranscript(transcript, job.lessonNote, controller.signal);
    if (leaseLost || controller.signal.aborted) throw new LeaseLostError();
    const response = await api(`/api/compute/jobs/${job.id}/result`, {
      method: 'POST',
      body: JSON.stringify({ transcript, report }),
    }, job.leaseToken, controller.signal);
    if (!response.ok) {
      throw new Error(`Сайт не принял отчёт (${response.status}): ${(await response.text()).slice(0, 400)}`);
    }
    await telegram(`Отчёт по уроку ${job.lessonId} отправлен на сайт.\n\n${report.summary}`);
  } finally {
    clearInterval(heartbeat);
  }
}

async function tick() {
  const response = await api('/api/compute/jobs/next', { method: 'POST' });
  if (response.status === 404) return;
  if (!response.ok) {
    console.error('claim', response.status, (await response.text()).slice(0, 300));
    return;
  }
  const body = await response.text();
  if (!body.trim()) return;
  let job;
  try {
    job = JSON.parse(body);
  } catch {
    console.error('claim returned invalid JSON; waiting for the next poll');
    return;
  }
  if (
    !job ||
    typeof job.id !== 'string' ||
    typeof job.lessonId !== 'string' ||
    typeof job.leaseToken !== 'string' ||
    !job.recordingPath
  ) {
    console.error('claim returned an invalid job; waiting for the next poll');
    return;
  }
  try {
    await processJob(job);
  } catch (error) {
    if (error instanceof LeaseLostError || error?.name === 'AbortError') {
      console.error(job.id, 'lease lost; the server will make the job available again');
      return;
    }
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
  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

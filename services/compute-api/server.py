"""HTTP API for lesson reports. The VPS posts audio here; Whisper and Ollama run on this machine."""

import json
import os
import threading
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("COMPUTE_SECRET", "")
OLLAMA = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
TRANSCRIBER = os.environ.get("TRANSCRIBER_URL", "http://transcriber:8000").rstrip("/")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
PUBLIC_BASE = os.environ.get("AUDIO_BASE_URL", "http://tutor_compute:8787").rstrip("/")

AUDIO = {}
AUDIO_LOCK = threading.Lock()


def post_json(url, payload, timeout):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def ollama(prompt, as_json):
    body = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {"temperature": 0.2, "num_ctx": 32768},
    }
    if as_json:
        body["format"] = "json"
    result = post_json(f"{OLLAMA}/api/generate", body, 30 * 60)
    text = (result.get("response") or "").strip()
    if not text:
        raise RuntimeError("Ollama вернула пустой ответ")
    return text


def as_strings(value):
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def report_from_transcript(transcript, lesson_note):
    segments = transcript.get("segments") or []
    if segments:
        lines = []
        for segment in segments:
            value = max(0, int(round(segment.get("start") or 0)))
            stamp = f"{value // 3600:02d}:{(value % 3600) // 60:02d}:{value % 60:02d}"
            lines.append(f"[{stamp}] {(segment.get('text') or '').strip()}")
        source = "\n".join(lines)
    else:
        source = (transcript.get("text") or "").strip()

    if len(source) > 70000:
        parts = []
        for index in range(0, len(source), 24000):
            parts.append(
                ollama(
                    "Сделай подробный конспект части транскрипта урока. Сохрани темы, достижения, трудности, домашние задания и временные метки.\n\n"
                    + source[index : index + 24000],
                    False,
                )
            )
        source = "\n\n--- ЧАСТЬ ---\n\n".join(parts)

    raw = ollama(
        f"""Ты — методист онлайн-школы. На основе транскрипта подготовь объективный отчёт об уроке на русском языке.
Не выдумывай факты. Если информации нет, используй пустой массив.
Тема урока — то, что реально разбирали в транскрипте, одним названием. Домашние задания бери только из транскрипта и только по этой теме.
{f"Заметка преподавателя о слоте: {lesson_note}" if lesson_note else ""}

Верни строго JSON:
{{
  "summary": "краткое содержание урока",
  "topics": ["изученные темы"],
  "achievements": ["что получилось"],
  "difficulties": ["что вызвало сложности"],
  "homework": ["домашние задания, если были"],
  "recommendations": ["рекомендации для следующего занятия"],
  "keyMoments": [{{"time": "HH:MM:SS", "description": "важный момент"}}]
}}

ТРАНСКРИПТ:
{source}""",
        True,
    )
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw.replace("json", "", 1).strip()
    parsed = json.loads(raw)
    moments = []
    for item in parsed.get("keyMoments") or []:
        if isinstance(item, dict) and isinstance(item.get("description"), str):
            moments.append(
                {
                    "time": item.get("time") if isinstance(item.get("time"), str) else None,
                    "description": item["description"],
                }
            )
    summary = parsed.get("summary")
    return {
        "summary": summary.strip() if isinstance(summary, str) and summary.strip() else "Отчёт сформирован без резюме",
        "topics": as_strings(parsed.get("topics")),
        "achievements": as_strings(parsed.get("achievements")),
        "difficulties": as_strings(parsed.get("difficulties")),
        "homework": as_strings(parsed.get("homework")),
        "recommendations": as_strings(parsed.get("recommendations")),
        "keyMoments": moments,
    }


def process_audio(audio, lesson_note):
    audio_id = uuid.uuid4().hex
    with AUDIO_LOCK:
        AUDIO[audio_id] = audio
    try:
        transcript = post_json(
            f"{TRANSCRIBER}/transcribe",
            {"url": f"{PUBLIC_BASE}/audio/{audio_id}", "language": "ru"},
            30 * 60,
        )
        report = report_from_transcript(transcript, lesson_note)
        return {"transcript": transcript, "report": report}
    finally:
        with AUDIO_LOCK:
            AUDIO.pop(audio_id, None)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path == "/health":
            self.respond(200, {"ok": True})
            return
        if self.path.startswith("/audio/"):
            audio_id = self.path.split("/")[-1]
            with AUDIO_LOCK:
                audio = AUDIO.get(audio_id)
            if audio is None:
                self.respond(404, {"error": "not found"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
            return
        self.respond(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/v1/lesson-report":
            self.respond(404, {"error": "not found"})
            return
        if not SECRET or self.headers.get("X-Compute-Token") != SECRET:
            self.respond(403, {"error": "forbidden"})
            return
        length = int(self.headers.get("Content-Length") or "0")
        audio = self.rfile.read(length) if length else b""
        if not audio:
            self.respond(400, {"error": "empty audio"})
            return
        note = self.headers.get("X-Lesson-Note") or ""
        try:
            note = urllib.parse.unquote(note)
        except Exception:
            pass
        try:
            result = process_audio(audio, note)
        except Exception as error:
            self.respond(500, {"error": str(error)})
            return
        self.respond(200, result)

    def respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8787), Handler)
    print("compute api on :8787", flush=True)
    server.serve_forever()

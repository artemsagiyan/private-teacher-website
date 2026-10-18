import asyncio
import os
import tempfile
from pathlib import Path

import httpx
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel, HttpUrl

@asynccontextmanager
async def lifespan(_app):
    # Load the model before reporting healthy/accepting jobs. Otherwise the
    # first lesson pays model initialization/download cost after the queue has
    # already leased it to the worker.
    await asyncio.to_thread(get_model)
    yield


app = FastAPI(title="TutorPlatform Transcriber", lifespan=lifespan)

MODEL_NAME = os.getenv("WHISPER_MODEL", "large-v3-turbo")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv(
    "WHISPER_COMPUTE_TYPE",
    "int8" if DEVICE == "cpu" else "float16",
)
BEAM_SIZE = max(1, int(os.getenv("WHISPER_BEAM_SIZE", "1")))
REALTIME_BEAM_SIZE = max(1, int(os.getenv("WHISPER_REALTIME_BEAM_SIZE", "1")))
MAX_AUDIO_BYTES = max(1, int(os.getenv("WHISPER_MAX_AUDIO_BYTES", str(2 * 1024 * 1024 * 1024))))
REALTIME_MAX_AUDIO_BYTES = max(1, int(os.getenv("WHISPER_REALTIME_MAX_AUDIO_BYTES", str(8 * 1024 * 1024))))
DOWNLOAD_TIMEOUT_SECONDS = max(30, int(os.getenv("WHISPER_DOWNLOAD_TIMEOUT_SECONDS", "7200")))

model: WhisperModel | None = None
inference_semaphore = asyncio.Semaphore(
    int(os.getenv("WHISPER_MAX_CONCURRENCY", "1"))
)


class TranscribeRequest(BaseModel):
    url: HttpUrl
    language: str | None = "ru"

class RealtimeTranscribeRequest(BaseModel):
    audio_base64: str
    language: str | None = "ru"


def get_model() -> WhisperModel:
    global model
    if model is None:
        model = WhisperModel(
            MODEL_NAME,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            download_root=os.getenv("HF_HOME", "/models"),
        )
    return model


def run_inference(path: str, language: str | None, realtime: bool = False):
    segments, info = get_model().transcribe(
        path,
        language=language or None,
        beam_size=REALTIME_BEAM_SIZE if realtime else BEAM_SIZE,
        vad_filter=True,
        vad_parameters={
            "min_silence_duration_ms": 500,
        },
        # Independent browser chunks must not inherit hallucinations from an
        # earlier chunk. The full recording still keeps the stronger context.
        condition_on_previous_text=not realtime,
        word_timestamps=False,
    )

    result_segments = []
    text_parts = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        text_parts.append(text)
        result_segments.append(
            {
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": text,
            }
        )

    return {
        "text": " ".join(text_parts),
        "language": info.language,
        "duration": info.duration,
        "segments": result_segments,
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "device": DEVICE,
        "loaded": model is not None,
    }


@app.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    suffix = Path(str(request.url).split("?", 1)[0]).suffix or ".ogg"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as target:
            temp_path = target.name
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(DOWNLOAD_TIMEOUT_SECONDS, connect=30),
                follow_redirects=True,
            ) as client:
                async with client.stream("GET", str(request.url)) as response:
                    response.raise_for_status()
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > MAX_AUDIO_BYTES:
                        raise ValueError("Audio recording is too large")
                    downloaded = 0
                    async for chunk in response.aiter_bytes():
                        downloaded += len(chunk)
                        if downloaded > MAX_AUDIO_BYTES:
                            raise ValueError("Audio recording is too large")
                        target.write(chunk)

        async with inference_semaphore:
            return await asyncio.to_thread(
                run_inference,
                temp_path,
                request.language,
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

@app.post("/transcribe/realtime")
async def transcribe_realtime(request: RealtimeTranscribeRequest):
    """Transcribe a short browser audio chunk for live lesson assistance."""
    import base64
    temp_path = None
    try:
        raw = base64.b64decode(request.audio_base64, validate=True)
        if not raw or len(raw) > REALTIME_MAX_AUDIO_BYTES:
            raise HTTPException(status_code=400, detail="Audio chunk is empty or too large")
        if inference_semaphore.locked():
            raise HTTPException(status_code=429, detail="Realtime transcription is busy")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as target:
            temp_path = target.name
            target.write(raw)
        async with inference_semaphore:
            result = await asyncio.to_thread(run_inference, temp_path, request.language, True)
        return {"text": result["text"], "segments": result["segments"], "language": result["language"]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

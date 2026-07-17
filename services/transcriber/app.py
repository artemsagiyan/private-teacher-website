import asyncio
import os
import tempfile
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="TutorPlatform Transcriber")

MODEL_NAME = os.getenv("WHISPER_MODEL", "large-v3-turbo")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv(
    "WHISPER_COMPUTE_TYPE",
    "int8" if DEVICE == "cpu" else "float16",
)

model: WhisperModel | None = None
inference_semaphore = asyncio.Semaphore(
    int(os.getenv("WHISPER_MAX_CONCURRENCY", "1"))
)


class TranscribeRequest(BaseModel):
    url: HttpUrl
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


def run_inference(path: str, language: str | None):
    segments, info = get_model().transcribe(
        path,
        language=language or None,
        beam_size=5,
        vad_filter=True,
        vad_parameters={
            "min_silence_duration_ms": 500,
        },
        condition_on_previous_text=True,
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
            async with httpx.AsyncClient(timeout=3600, follow_redirects=True) as client:
                async with client.stream("GET", str(request.url)) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
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

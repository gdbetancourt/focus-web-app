import asyncio
from types import SimpleNamespace
from typing import Any, Optional

from openai import OpenAI


class OpenAISpeechToText:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.client = OpenAI(api_key=api_key)

    def _sync_transcribe(
        self,
        *,
        file: Any,
        model: str = "whisper-1",
        response_format: str = "json",
        language: Optional[str] = None,
        timestamp_granularities: Optional[list[str]] = None,
    ):
        kwargs = {
            "file": file,
            "model": model,
            "response_format": response_format,
            "language": language,
        }
        if timestamp_granularities:
            kwargs["timestamp_granularities"] = timestamp_granularities

        result = self.client.audio.transcriptions.create(**kwargs)

        text = getattr(result, "text", "") if hasattr(result, "text") else ""
        if not text and isinstance(result, dict):
            text = result.get("text", "")

        segments_raw = getattr(result, "segments", None)
        if segments_raw is None and isinstance(result, dict):
            segments_raw = result.get("segments")
        segments = []
        if segments_raw:
            for seg in segments_raw:
                if isinstance(seg, dict):
                    segments.append(
                        SimpleNamespace(
                            start=seg.get("start"),
                            end=seg.get("end"),
                            text=seg.get("text", ""),
                        )
                    )
                else:
                    segments.append(
                        SimpleNamespace(
                            start=getattr(seg, "start", None),
                            end=getattr(seg, "end", None),
                            text=getattr(seg, "text", ""),
                        )
                    )

        return SimpleNamespace(text=text, segments=segments)

    async def transcribe(self, **kwargs):
        return await asyncio.to_thread(self._sync_transcribe, **kwargs)


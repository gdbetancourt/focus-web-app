import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import google.generativeai as genai


@dataclass
class ImageContent:
    data: str
    mime_type: str = "image/png"


@dataclass
class UserMessage:
    text: str
    image: Optional[ImageContent] = None


class LlmChat:
    def __init__(
        self,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        system_message: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.model = self._normalize_model(model or "gemini-2.0-flash")
        self.params: dict[str, Any] = {}
        if self.api_key:
            genai.configure(api_key=self.api_key)

    def _normalize_model(self, model: Optional[str]) -> str:
        if not model:
            return "gemini-2.0-flash"
        if "/" in model:
            return model.split("/", 1)[1]
        return model

    def with_model(self, provider_or_model: str, model: Optional[str] = None):
        self.model = self._normalize_model(model or provider_or_model)
        return self

    def with_params(self, **kwargs):
        self.params.update(kwargs or {})
        return self

    def _coerce_prompt(self, message: Any) -> str:
        if isinstance(message, UserMessage):
            return message.text or ""
        if isinstance(message, str):
            return message
        return str(message)

    def _sync_generate(self, prompt: str) -> str:
        model = genai.GenerativeModel(
            model_name=self.model,
            system_instruction=self.system_message,
        )
        response = model.generate_content(prompt)
        text = getattr(response, "text", None)
        if text:
            return text
        candidates = getattr(response, "candidates", None) or []
        if candidates:
            parts = getattr(candidates[0].content, "parts", None) or []
            joined = "".join(getattr(p, "text", "") for p in parts if getattr(p, "text", None))
            if joined:
                return joined
        return ""

    async def send_message(self, message: Any) -> str:
        prompt = self._coerce_prompt(message)
        return await asyncio.to_thread(self._sync_generate, prompt)

    async def send_async(self, message: Any) -> str:
        return await self.send_message(message)

    async def send_message_multimodal_response(self, message: Any):
        # Compatibility fallback: keep text generation stable even when image output is requested.
        text = await self.send_message(message)
        return text, []


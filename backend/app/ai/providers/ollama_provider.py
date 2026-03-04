"""Ollama LLM provider using instructor for structured output."""

import logging
from typing import Type, TypeVar

import httpx
import instructor
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T")


class OllamaProvider:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.default_model = "llama3.1:8b-instruct-q4_K_M"
        self.client = instructor.from_openai(
            AsyncOpenAI(
                base_url=f"{self.base_url}/v1",
                api_key="ollama",
                timeout=120.0,
            ),
            mode=instructor.Mode.JSON,
        )

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        response_model: Type[T],
        model: str | None = None,
        max_retries: int = 2,
    ) -> T:
        model_name = model or self.default_model
        logger.debug("Ollama request: model=%s, messages=%d", model_name, len(messages))
        result = await self.client.chat.completions.create(
            model=model_name,
            messages=messages,
            response_model=response_model,
            max_retries=max_retries,
        )
        logger.debug("Ollama response: %s", result)
        return result

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

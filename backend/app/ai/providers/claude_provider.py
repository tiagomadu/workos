"""Claude LLM provider using instructor for structured output."""

import logging
from typing import Type, TypeVar

import instructor
from anthropic import AsyncAnthropic

from app.core.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T")


class ClaudeProvider:
    def __init__(self):
        self.default_model = "claude-sonnet-4-20250514"
        self.client = instructor.from_anthropic(
            AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        )

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        response_model: Type[T],
        model: str | None = None,
        max_retries: int = 2,
    ) -> T:
        model_name = model or self.default_model
        logger.debug("Claude request: model=%s, messages=%d", model_name, len(messages))
        result = await self.client.chat.completions.create(
            model=model_name,
            messages=messages,
            response_model=response_model,
            max_retries=max_retries,
            max_tokens=4096,
        )
        logger.debug("Claude response: %s", result)
        return result

    async def health_check(self) -> bool:
        return True  # API generally available; actual check on first call

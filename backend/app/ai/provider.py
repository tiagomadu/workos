"""LLM Provider Protocol -- defines the interface for all LLM providers."""

from typing import Protocol, TypeVar, Type, runtime_checkable

T = TypeVar("T")


@runtime_checkable
class LLMProvider(Protocol):
    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        response_model: Type[T],
        model: str | None = None,
        max_retries: int = 2,
    ) -> T:
        """Generate a structured response matching the Pydantic model."""
        ...

    async def health_check(self) -> bool:
        """Check if the provider is available."""
        ...

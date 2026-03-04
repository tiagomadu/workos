"""Factory for creating LLM providers."""

import logging

from app.core.config import settings
from app.ai.provider import LLMProvider
from app.ai.providers.ollama_provider import OllamaProvider
from app.ai.providers.claude_provider import ClaudeProvider

logger = logging.getLogger(__name__)


def create_llm_provider() -> LLMProvider:
    provider_name = settings.LLM_PROVIDER.lower()
    if provider_name == "claude":
        logger.info("Using Claude LLM provider")
        return ClaudeProvider()
    else:
        logger.info("Using Ollama LLM provider")
        return OllamaProvider()


def get_llm_provider() -> LLMProvider:
    """FastAPI dependency for LLM provider."""
    return create_llm_provider()

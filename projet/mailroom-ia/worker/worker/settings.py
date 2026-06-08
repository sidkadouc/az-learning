from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration injectée via variables d'environnement (aucune clé secrète)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Storage
    storage_blob_url: str
    storage_queue_url: str
    storage_queue_name: str = "doc-to-classify"
    storage_container: str = "mailroom"

    # Cosmos
    cosmos_endpoint: str
    cosmos_database: str = "mailroom"
    cosmos_container_documents: str = "documents"
    cosmos_container_clients: str = "clients"

    # Document Intelligence
    doc_intelligence_endpoint: str

    # Foundry project (format SDK 2.x)
    foundry_project_endpoint: str
    foundry_model_deployment: str = "gpt-5-mini"

    # Pipeline
    confidence_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    max_text_chars: int = 8000

    # Observabilité
    appinsights_connection_string: str = ""
    service_name: str = "mailroom-worker"

    # Comportement worker
    queue_visibility_timeout_s: int = 600  # 10 min
    queue_poll_idle_sleep_s: float = 5.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

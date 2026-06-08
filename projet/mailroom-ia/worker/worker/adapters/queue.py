from __future__ import annotations

import json
from typing import AsyncIterator

from azure.identity.aio import DefaultAzureCredential
from azure.storage.queue.aio import QueueClient

from worker.domain.models import QueueMessage


class QueueListener:
    """Boucle de polling Storage Queue. Yields (message, on_complete) pour ack/release explicite."""

    def __init__(
        self,
        queue_url: str,
        queue_name: str,
        credential: DefaultAzureCredential,
        visibility_timeout_s: int = 600,
    ):
        self._client = QueueClient(account_url=queue_url, queue_name=queue_name, credential=credential)
        self._visibility = visibility_timeout_s

    async def close(self) -> None:
        await self._client.close()

    async def pop(self) -> tuple[QueueMessage, str, str] | None:
        """Récupère un message ou None si la queue est vide. Retourne (message, message_id, pop_receipt)."""
        async for raw in self._client.receive_messages(
            max_messages=1, visibility_timeout=self._visibility
        ):
            decoded = self._decode(raw.content)
            payload = QueueMessage.model_validate_json(decoded)
            assert raw.id is not None and raw.pop_receipt is not None
            return payload, raw.id, raw.pop_receipt
        return None

    async def ack(self, message_id: str, pop_receipt: str) -> None:
        await self._client.delete_message(message_id, pop_receipt)

    @staticmethod
    def _decode(content: str | bytes) -> str:
        if isinstance(content, bytes):
            content = content.decode("utf-8")
        # Azure Storage Queue côté Next.js encode en base64 ; ici on tente JSON direct puis fallback base64.
        try:
            json.loads(content)
            return content
        except json.JSONDecodeError:
            import base64
            return base64.b64decode(content).decode("utf-8")

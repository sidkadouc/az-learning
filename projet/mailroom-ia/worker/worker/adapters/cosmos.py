from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from worker.domain.models import ClientRecord, PipelineResult


class CosmosRepository:
    def __init__(
        self,
        endpoint: str,
        database: str,
        documents_container: str,
        clients_container: str,
        credential: DefaultAzureCredential,
    ):
        self._client = CosmosClient(url=endpoint, credential=credential)
        self._db = self._client.get_database_client(database)
        self._docs = self._db.get_container_client(documents_container)
        self._clients = self._db.get_container_client(clients_container)

    async def close(self) -> None:
        await self._client.close()

    async def list_clients(self, limit: int = 200) -> list[ClientRecord]:
        query = "SELECT TOP @limit c.id, c.displayName, c.email FROM c"
        params = [{"name": "@limit", "value": limit}]
        items: list[ClientRecord] = []
        async for it in self._clients.query_items(
            query=query, parameters=params
        ):
            items.append(ClientRecord.model_validate(it))
        return items

    async def upsert_classification(
        self,
        doc_id: str,
        original_name: str,
        mime_type: str,
        size_bytes: int,
        result: PipelineResult,
    ) -> None:
        client_id = result.classification.client_id or "_unassigned"
        item: dict[str, Any] = {
            "id": doc_id,
            "clientId": client_id,
            "blobPath": result.target_blob_path,
            "originalName": original_name,
            "mimeType": mime_type,
            "sizeBytes": size_bytes,
            "category": result.classification.category.value,
            "subCategory": result.classification.sub_category,
            "uploadedBy": "admin",
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "classifiedAt": result.classified_at.isoformat(),
            "classification": {
                "model": "gpt-5-mini",
                "confidence": result.classification.confidence,
                "needsReview": result.decision.value == "needs_review",
                "reasoning": result.classification.reasoning,
                "diUsed": result.di_models_used,
                "totalCostEur": result.total_cost_eur,
                "durationMs": result.duration_ms,
            },
        }
        await self._docs.upsert_item(item)

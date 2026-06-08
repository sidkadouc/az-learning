from __future__ import annotations

import structlog
from typing import Protocol

from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob.aio import BlobServiceClient

log = structlog.get_logger("blob")


class BlobRepository(Protocol):
    """Interface minimale dont la pipeline a besoin (testable en mémoire)."""

    async def get_sas_url(self, blob_name: str) -> str: ...
    async def move_blob(self, source: str, destination: str) -> None: ...
    async def download_bytes(self, blob_name: str) -> bytes: ...
    async def list_storage_tree(self, max_depth: int = 4, max_items: int = 200) -> str: ...


class AzureBlobRepository:
    """Implémentation Azure Blob — utilise Managed Identity en prod via DefaultAzureCredential."""

    def __init__(self, account_url: str, container: str, credential: DefaultAzureCredential):
        self._service = BlobServiceClient(account_url=account_url, credential=credential)
        self._container = self._service.get_container_client(container)
        self._account_url = account_url
        self._container_name = container

    async def close(self) -> None:
        await self._service.close()

    async def get_sas_url(self, blob_name: str) -> str:
        return f"{self._account_url.rstrip('/')}/{self._container_name}/{blob_name}"

    async def download_bytes(self, blob_name: str) -> bytes:
        blob = self._container.get_blob_client(blob_name)
        downloader = await blob.download_blob()
        return await downloader.readall()

    async def move_blob(self, source: str, destination: str) -> None:
        if source == destination:
            return
        src = self._container.get_blob_client(source)
        dst = self._container.get_blob_client(destination)
        try:
            # Download + reupload (start_copy_from_url requires public access or SAS,
            # which we don't have with MI-only private storage).
            downloader = await src.download_blob()
            data = await downloader.readall()
            props = await src.get_blob_properties()
            await dst.upload_blob(
                data,
                overwrite=True,
                content_settings=props.content_settings,
                metadata=props.metadata,
            )
            await src.delete_blob()
            log.info("move_blob_ok", source=source, destination=destination)
        except Exception:
            log.warning("move_blob_failed", source=source, destination=destination, exc_info=True)
            raise

    async def list_storage_tree(self, max_depth: int = 4, max_items: int = 200) -> str:
        """Renvoie l'arborescence complète du container `clients/` au format markdown.

        Exemple de sortie :
        ```
        clients/
          client1/
            contrats/
              assurance/
                doc1.pdf
            factures/
              2026/
          auto-jean-dupont/
            courriers/
              medical/
        ```
        """
        lines: list[str] = []
        count = 0
        try:
            async for blob in self._container.list_blobs(name_starts_with="clients/"):
                if count >= max_items:
                    lines.append("  ... (tronqué)")
                    break
                parts = blob.name.split("/")
                if len(parts) > max_depth + 1:
                    parts = parts[: max_depth + 1]
                # Ajoute chaque préfixe intermédiaire (dédupliqué par le set implicite via les lignes)
                for depth in range(len(parts)):
                    segment = "/".join(parts[: depth + 1])
                    is_leaf = depth == len(parts) - 1 and not blob.name.endswith("/")
                    line = "  " * depth + (parts[depth] + ("/" if not is_leaf else ""))
                    if line not in lines:
                        lines.append(line)
                count += 1
        except Exception:
            log.warning("list_storage_tree_failed", exc_info=True)
            return "(structure non disponible)"
        return "\n".join(lines) if lines else "(aucun dossier client existant)"

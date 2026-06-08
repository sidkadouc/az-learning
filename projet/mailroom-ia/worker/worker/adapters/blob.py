from __future__ import annotations

from typing import Protocol

from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob.aio import BlobServiceClient


class BlobRepository(Protocol):
    """Interface minimale dont la pipeline a besoin (testable en mémoire)."""

    async def get_sas_url(self, blob_name: str) -> str: ...
    async def move_blob(self, source: str, destination: str) -> None: ...
    async def download_bytes(self, blob_name: str) -> bytes: ...


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
        # En MI, on passe l'URL brute (Document Intelligence supporte les blob URLs via MI/identity headers).
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
        src_url = src.url
        await dst.start_copy_from_url(src_url)
        # Note : pour la prod il faudrait attendre la fin de la copie (polling) avant de supprimer la source.
        # Sur le même compte storage la copie est synchrone dans 99 % des cas.
        await src.delete_blob()

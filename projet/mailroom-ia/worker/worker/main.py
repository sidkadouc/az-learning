"""Entrypoint du worker : boucle de consommation de la Storage Queue."""

from __future__ import annotations

import asyncio
import signal
import sys
from contextlib import AsyncExitStack

import structlog
from azure.identity.aio import DefaultAzureCredential
from azure.monitor.opentelemetry import configure_azure_monitor

from worker.adapters.blob import AzureBlobRepository
from worker.adapters.cosmos import CosmosRepository
from worker.adapters.doc_intelligence import DocIntelligenceAdapter
from worker.adapters.foundry import FoundryClassifier
from worker.adapters.queue import QueueListener
from worker.services.pipeline import ClassificationPipeline
from worker.settings import get_settings

log = structlog.get_logger("worker")


def _configure_logging() -> None:
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ]
    )


async def run() -> int:
    _configure_logging()
    settings = get_settings()

    if settings.appinsights_connection_string:
        configure_azure_monitor(
            connection_string=settings.appinsights_connection_string,
            resource_attributes={"service.name": settings.service_name},
        )

    stop_event = asyncio.Event()

    def _on_signal(_sig: int, _frm: object) -> None:
        log.info("signal_received_stopping")
        stop_event.set()

    if sys.platform != "win32":
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda s=sig: _on_signal(s, None))

    async with AsyncExitStack() as stack:
        credential = await stack.enter_async_context(DefaultAzureCredential())

        blob = AzureBlobRepository(
            account_url=settings.storage_blob_url,
            container=settings.storage_container,
            credential=credential,
        )
        stack.push_async_callback(blob.close)

        queue = QueueListener(
            queue_url=settings.storage_queue_url,
            queue_name=settings.storage_queue_name,
            credential=credential,
            visibility_timeout_s=settings.queue_visibility_timeout_s,
        )
        stack.push_async_callback(queue.close)

        di = DocIntelligenceAdapter(
            endpoint=settings.doc_intelligence_endpoint, credential=credential
        )
        stack.push_async_callback(di.close)

        foundry = FoundryClassifier(
            project_endpoint=settings.foundry_project_endpoint,
            model_deployment=settings.foundry_model_deployment,
            credential=credential,
        )
        stack.push_async_callback(foundry.close)

        cosmos = CosmosRepository(
            endpoint=settings.cosmos_endpoint,
            database=settings.cosmos_database,
            documents_container=settings.cosmos_container_documents,
            clients_container=settings.cosmos_container_clients,
            credential=credential,
        )
        stack.push_async_callback(cosmos.close)

        pipeline = ClassificationPipeline(
            blob=blob,
            doc_intel=di,
            foundry=foundry,
            cosmos=cosmos,
            confidence_threshold=settings.confidence_threshold,
        )

        log.info("worker_started", service=settings.service_name)

        while not stop_event.is_set():
            popped = await queue.pop()
            if popped is None:
                await asyncio.wait(
                    [asyncio.create_task(asyncio.sleep(settings.queue_poll_idle_sleep_s))],
                    timeout=settings.queue_poll_idle_sleep_s,
                )
                continue
            msg, mid, receipt = popped
            try:
                await pipeline.process(msg)
                await queue.ack(mid, receipt)
            except Exception as exc:  # noqa: BLE001
                log.exception("processing_failed", doc_id=msg.id, error=str(exc))
                # On laisse expirer la visibilité timeout → message reviendra.

    log.info("worker_stopped")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()

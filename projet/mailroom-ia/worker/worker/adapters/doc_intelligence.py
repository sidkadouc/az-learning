from __future__ import annotations

from dataclasses import dataclass

from azure.ai.documentintelligence.aio import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.identity.aio import DefaultAzureCredential


@dataclass(frozen=True, slots=True)
class DiExtraction:
    text: str
    invoice_customer_name: str | None
    invoice_confidence: float | None
    models_used: list[str]


class DocIntelligenceAdapter:
    """Wrapper minimal pour prebuilt-layout + prebuilt-invoice."""

    def __init__(self, endpoint: str, credential: DefaultAzureCredential):
        self._client = DocumentIntelligenceClient(endpoint=endpoint, credential=credential)

    async def close(self) -> None:
        await self._client.close()

    async def extract(self, content: bytes, *, try_invoice: bool) -> DiExtraction:
        layout_poller = await self._client.begin_analyze_document(
            "prebuilt-layout",
            AnalyzeDocumentRequest(bytes_source=content),
        )
        layout = await layout_poller.result()
        text = layout.content or ""
        models = ["prebuilt-layout"]

        customer = None
        confidence: float | None = None
        if try_invoice:
            invoice_poller = await self._client.begin_analyze_document(
                "prebuilt-invoice",
                AnalyzeDocumentRequest(bytes_source=content),
            )
            invoice = await invoice_poller.result()
            models.append("prebuilt-invoice")
            doc = (invoice.documents or [None])[0]
            if doc and doc.fields:
                name_field = doc.fields.get("CustomerName") or doc.fields.get("BillingAddressRecipient")
                if name_field:
                    customer = name_field.value_string
                    confidence = name_field.confidence

        return DiExtraction(
            text=text,
            invoice_customer_name=customer,
            invoice_confidence=confidence,
            models_used=models,
        )

from __future__ import annotations

import time
from datetime import datetime, timezone

import structlog

from worker.adapters.blob import AzureBlobRepository
from worker.adapters.cosmos import CosmosRepository
from worker.adapters.doc_intelligence import DiExtraction, DocIntelligenceAdapter
from worker.adapters.foundry import FoundryClassifier
from worker.domain.models import (
    ALLOWED_SUBCATEGORIES,
    ClassificationOutput,
    ClientRecord,
    Decision,
    DocumentCategory,
    PipelineResult,
    QueueMessage,
)

log = structlog.get_logger("pipeline")

# Coûts estimés (€/page DI, €/1k tokens LLM). Sert à reporter dans Cosmos.
_DI_COST_PER_PAGE = 0.01
_LLM_COST_PER_1K_TOKENS = 0.001  # gpt-5-mini approx


class ClassificationPipeline:
    """Orchestrateur : DI (+ fast path éventuel) → LLM → décision → range."""

    def __init__(
        self,
        blob: AzureBlobRepository,
        doc_intel: DocIntelligenceAdapter,
        foundry: FoundryClassifier,
        cosmos: CosmosRepository,
        confidence_threshold: float,
    ):
        self._blob = blob
        self._di = doc_intel
        self._llm = foundry
        self._cosmos = cosmos
        self._threshold = confidence_threshold

    async def process(self, message: QueueMessage) -> PipelineResult:
        started = time.perf_counter()
        log.info("processing", doc_id=message.id, blob=message.blob_name)

        content = await self._blob.download_bytes(message.blob_name)
        try_invoice = _looks_like_invoice(message.original_name, message.mime_type)
        extraction = await self._di.extract(content, try_invoice=try_invoice)

        clients = await self._cosmos.list_clients()

        # Récupère l'arborescence existante pour la passer au LLM
        storage_tree = await self._blob.list_storage_tree()

        # Fast path : facture + nom destinataire matche un seul client
        fast = _try_fast_path(extraction, clients)
        if fast is not None:
            classification = fast
            log.info("fast_path_hit", client_id=fast.client_id)
        else:
            classification = await self._llm.classify(
                ocr_text=extraction.text,
                clients_list=_render_clients(clients),
                storage_tree=storage_tree,
            )
            log.info(
                "llm_classified",
                client_id=classification.client_id,
                category=classification.category.value,
                confidence=classification.confidence,
            )

        decision = self._decide(classification)

        # Auto-création client : si l'IA a détecté un destinataire mais qu'il n'est pas
        # dans la liste, on crée un client `auto-<slug>` à la volée pour pouvoir ranger
        # le doc sous son arborescence. L'admin pourra plus tard fusionner avec un client manuel.
        if (
            classification.client_id is None
            and classification.detected_recipient_name
            and classification.detected_recipient_name.strip()
        ):
            auto_id = _slugify_client_id(classification.detected_recipient_name)
            if auto_id:
                await self._cosmos.ensure_auto_client(
                    client_id=auto_id,
                    display_name=classification.detected_recipient_name.strip(),
                )
                classification.client_id = auto_id
                log.info("auto_created_client", client_id=auto_id, name=classification.detected_recipient_name)
                # Re-décider : un client identifié peut faire passer en AUTO_FILE
                # (mais on garde la confidence telle quelle pour le seuil).
                decision = self._decide(classification)

        target_path = _build_target_path(
            current_blob_name=message.blob_name,
            classification=classification,
        )

        # Toujours ranger le blob sous le dossier client si le client est identifié,
        # même si needs_review. Le flag needs_review est dans Cosmos pour l'admin.
        if classification.client_id is not None and target_path != message.blob_name:
            try:
                await self._blob.move_blob(message.blob_name, target_path)
            except Exception:
                log.warning("move_blob_failed_keeping_inbox", blob=message.blob_name, exc_info=True)
                target_path = message.blob_name  # fallback : reste dans _inbox

        duration_ms = int((time.perf_counter() - started) * 1000)
        cost = _estimate_cost(extraction, ocr_chars=len(extraction.text))

        result = PipelineResult(
            decision=decision,
            classification=classification,
            target_blob_path=target_path,
            di_models_used=extraction.models_used,
            total_cost_eur=cost,
            duration_ms=duration_ms,
            classified_at=datetime.now(timezone.utc),
        )

        await self._cosmos.upsert_classification(
            doc_id=message.id,
            original_name=message.original_name,
            mime_type=message.mime_type,
            size_bytes=message.size,
            result=result,
        )

        log.info(
            "processed",
            doc_id=message.id,
            decision=decision.value,
            cost_eur=round(cost, 4),
            duration_ms=duration_ms,
        )
        return result

    def _decide(self, c: ClassificationOutput) -> Decision:
        if c.client_id is None:
            return Decision.NEEDS_REVIEW
        if c.confidence < self._threshold:
            return Decision.NEEDS_REVIEW
        allowed = ALLOWED_SUBCATEGORIES.get(c.category)
        if (
            allowed is not None
            and len(allowed) > 0
            and (c.sub_category is None or c.sub_category not in allowed)
        ):
            # exception : factures → sous-catégorie = année 4 chiffres
            if c.category == DocumentCategory.FACTURES and _is_year(c.sub_category):
                return Decision.AUTO_FILE
            return Decision.NEEDS_REVIEW
        return Decision.AUTO_FILE


# ----------------------------- helpers purs -----------------------------


def _looks_like_invoice(name: str, mime: str) -> bool:
    lower = name.lower()
    keywords = ("facture", "invoice", "fac_", "fact_")
    return any(k in lower for k in keywords) or mime == "application/pdf"


def _render_clients(clients: list[ClientRecord]) -> str:
    if not clients:
        return "(aucun client en base — retourne null pour client_id)"
    return "\n".join(f"- {c.id} : {c.display_name}" for c in clients[:100])


def _try_fast_path(
    extraction: DiExtraction, clients: list[ClientRecord]
) -> ClassificationOutput | None:
    if not extraction.invoice_customer_name or (extraction.invoice_confidence or 0) < 0.95:
        return None
    name_norm = _normalize(extraction.invoice_customer_name)
    matches = [c for c in clients if _normalize(c.display_name) == name_norm]
    if len(matches) != 1:
        return None
    year = datetime.now(timezone.utc).strftime("%Y")
    return ClassificationOutput(
        client_id=matches[0].id,
        detected_recipient_name=extraction.invoice_customer_name,
        category=DocumentCategory.FACTURES,
        sub_category=year,
        target_folder=f"factures/{year}",
        confidence=min(0.99, extraction.invoice_confidence or 0.95),
        reasoning="Fast-path : prebuilt-invoice a identifié un client unique.",
    )


def _normalize(s: str) -> str:
    import unicodedata
    return "".join(
        ch for ch in unicodedata.normalize("NFD", s.casefold().strip()) if not unicodedata.combining(ch)
    )


def _slugify_client_id(name: str) -> str:
    """Transforme 'Jean Dupont' → 'auto-jean-dupont'. Ne garde que [a-z0-9-]."""
    import re
    slug = _normalize(name)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    slug = slug[:48]  # garde une marge sous la limite Cosmos
    return f"auto-{slug}" if slug else ""


def _is_year(s: str | None) -> bool:
    return s is not None and len(s) == 4 and s.isdigit() and 1900 <= int(s) <= 2100


def _build_target_path(
    *, current_blob_name: str, classification: ClassificationOutput
) -> str:
    if classification.client_id is None:
        return current_blob_name  # reste dans _inbox/
    filename = current_blob_name.rsplit("/", 1)[-1]
    parts = ["clients", classification.client_id]

    # Utilise target_folder du LLM s'il est renseigné (ex: "contrats/assurance")
    if classification.target_folder:
        folder = classification.target_folder.strip("/").strip()
        # Sécurité : pas de path traversal
        folder = "/".join(
            seg for seg in folder.split("/") if seg and seg != ".." and seg != "."
        )
        if folder:
            parts.extend(folder.split("/"))
        else:
            parts.append(classification.category.value)
            if classification.sub_category:
                parts.append(classification.sub_category)
    else:
        parts.append(classification.category.value)
        if classification.sub_category:
            parts.append(classification.sub_category)

    parts.append(filename)
    return "/".join(parts)


def _estimate_cost(extraction: DiExtraction, ocr_chars: int) -> float:
    di_pages = max(1, ocr_chars // 3000)  # estimation grossière
    di_cost = _DI_COST_PER_PAGE * di_pages
    llm_tokens = max(500, ocr_chars // 4)  # ~4 chars/token
    llm_cost = _LLM_COST_PER_1K_TOKENS * (llm_tokens / 1000)
    return round(di_cost + llm_cost, 4)

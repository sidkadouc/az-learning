from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class DocumentCategory(StrEnum):
    FACTURES = "factures"
    CONTRATS = "contrats"
    AVIS_OFFICIELS = "avis-officiels"
    COURRIERS = "courriers"
    AUTRES = "autres"


ALLOWED_SUBCATEGORIES: dict[DocumentCategory, set[str]] = {
    DocumentCategory.FACTURES: set(),  # année libre (4 chiffres)
    DocumentCategory.CONTRATS: {"assurance", "bancaire", "telecom", "autre"},
    DocumentCategory.AVIS_OFFICIELS: {"impots", "caf", "prefecture", "tribunal", "autre"},
    DocumentCategory.COURRIERS: {"medical", "professionnel", "autre"},
    DocumentCategory.AUTRES: set(),
}


class QueueMessage(BaseModel):
    """Message reçu de la Storage Queue après upload Blob."""

    id: str
    blob_name: str = Field(alias="blobName")
    original_name: str = Field(alias="originalName")
    mime_type: str = Field(alias="mimeType")
    size: int

    model_config = {"populate_by_name": True}


class ClassificationOutput(BaseModel):
    """Sortie structurée du LLM Foundry (forme stricte JSON)."""

    client_id: str | None = Field(
        default=None, description="ID du client matché, ou null si non présent dans la liste fournie"
    )
    detected_recipient_name: str | None = Field(
        default=None,
        max_length=200,
        description="Nom Prénom (ou raison sociale) du destinataire détecté dans le document, même si pas dans la liste",
    )
    category: DocumentCategory
    sub_category: str | None = Field(default=None, max_length=64)
    target_folder: str | None = Field(
        default=None,
        max_length=256,
        description="Chemin relatif du dossier cible sous clients/<clientId>/, ex: 'contrats/assurance' ou 'factures/2026'. Utilise un dossier existant si pertinent, sinon propose un nouveau.",
    )
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(max_length=500)


class Decision(StrEnum):
    AUTO_FILE = "auto_file"
    NEEDS_REVIEW = "needs_review"


class PipelineResult(BaseModel):
    """Résultat complet du pipeline pour un document."""

    decision: Decision
    classification: ClassificationOutput
    target_blob_path: str
    di_models_used: list[str]
    total_cost_eur: float
    duration_ms: int
    classified_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DocumentRecord(BaseModel):
    """Représentation persistée en Cosmos."""

    id: str
    client_id: str | None = Field(alias="clientId", default=None)
    blob_path: str = Field(alias="blobPath")
    original_name: str = Field(alias="originalName")
    mime_type: str = Field(alias="mimeType")
    size_bytes: int = Field(alias="sizeBytes")
    category: DocumentCategory | None = None
    sub_category: str | None = Field(alias="subCategory", default=None)
    uploaded_by: str = Field(alias="uploadedBy", default="admin")
    uploaded_at: datetime = Field(alias="uploadedAt")
    classified_at: datetime | None = Field(alias="classifiedAt", default=None)
    classification: dict | None = None

    model_config = {"populate_by_name": True}


class ClientRecord(BaseModel):
    id: str
    display_name: str = Field(alias="displayName")
    email: str
    entra_external_id: str | None = Field(alias="entraExternalId", default=None)
    model_config = {"populate_by_name": True}


CategoryDetection = Literal["di_invoice_fast_path", "llm_only", "llm_with_image"]

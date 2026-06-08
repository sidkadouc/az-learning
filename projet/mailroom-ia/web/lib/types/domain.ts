export type DocumentCategory =
  | "factures"
  | "contrats"
  | "avis-officiels"
  | "courriers"
  | "autres";

export interface ClassificationResult {
  model: string;
  confidence: number;
  needsReview: boolean;
  reasoning?: string;
  detectedRecipientName?: string | null;
  diUsed?: string[];
  totalCostEur?: number;
}

export interface DocumentRecord {
  id: string;
  clientId: string | null;
  blobPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: DocumentCategory | null;
  subCategory: string | null;
  uploadedBy: string;
  uploadedAt: string;
  classifiedAt?: string;
  classification?: ClassificationResult;
}

export interface ClientRecord {
  id: string;
  displayName: string;
  email: string;
  entraExternalId?: string;
  createdAt: string;
  createdBy: string;
}

export interface QueueMessage {
  id: string;
  blobName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

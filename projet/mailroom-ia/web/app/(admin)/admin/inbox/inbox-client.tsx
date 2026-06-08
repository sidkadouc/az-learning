"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import type { ClientRecord, DocumentRecord } from "@/lib/types/domain";

const CATEGORIES = ["factures", "contrats", "avis-officiels", "courriers", "autres"] as const;
type Category = (typeof CATEGORIES)[number];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function confidencePill(c: number): string {
  if (c >= 0.8) return "bg-green-100 text-green-800";
  if (c >= 0.5) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export function InboxClient({
  initialDocs,
  clients,
}: {
  initialDocs: DocumentRecord[] | null;
  clients: ClientRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setUploadStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { id } = (await res.json()) as { id: string };
      setUploadStatus(`✓ Uploadé (${id.slice(0, 8)}…). Classification ~25 s, ensuite clique sur Rafraîchir.`);
      form.reset();
    } catch (err) {
      setUploadStatus(`✗ Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadBusy(false);
    }
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function deleteDoc(doc: DocumentRecord) {
    if (!confirm(`Supprimer définitivement « ${doc.originalName} » ?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(`Erreur: ${await res.text()}`);
      return;
    }
    if (selected?.id === doc.id) setSelected(null);
    refresh();
  }

  async function validateDoc(doc: DocumentRecord, body: { clientId: string; category: Category; subCategory?: string }) {
    const res = await fetch(`/api/documents/${doc.id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      alert(`Erreur: ${await res.text()}`);
      return;
    }
    if (selected?.id === doc.id) setSelected(null);
    refresh();
  }

  if (initialDocs === null) {
    return (
      <p className="rounded-lg border bg-card p-6 text-sm text-red-700">
        ✗ Impossible de lire Cosmos DB. Vérifie les rôles RBAC data-plane (cf. notebook setup §7.5).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onUpload}
        className="flex flex-col gap-3 rounded-lg border border-dashed bg-card p-5 sm:flex-row sm:items-center"
      >
        <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
          <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Sélectionner un scan PDF / image</span>
          <input
            type="file"
            name="file"
            accept="application/pdf,image/png,image/jpeg"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground hover:file:opacity-90"
          />
        </label>
        <button
          type="submit"
          disabled={uploadBusy}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {uploadBusy ? "Envoi…" : "Uploader"}
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          title="Rafraîchir la liste"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border bg-card px-3 text-sm transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
          Rafraîchir
        </button>
      </form>
      {uploadStatus && <p role="status" className="text-sm">{uploadStatus}</p>}

      {initialDocs.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Aucun document en attente de validation. Upload un PDF pour démarrer.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Document</th>
                  <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                  <th className="px-3 py-2 text-left font-medium">Confiance</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialDocs.map((d) => {
                  const isSel = selected?.id === d.id;
                  return (
                    <tr
                      key={d.id}
                      className={`cursor-pointer border-t ${isSel ? "bg-muted/40" : "hover:bg-muted/20"}`}
                      onClick={() => setSelected(d)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs text-muted-foreground">{d.id.slice(0, 8)}…</div>
                        <div className="truncate" title={d.originalName}>{d.originalName}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(d.classifiedAt)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{d.category ?? "—"}</div>
                        {d.subCategory && (
                          <div className="text-xs text-muted-foreground">{d.subCategory}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {d.classification ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${confidencePill(d.classification.confidence)}`}
                          >
                            {(d.classification.confidence * 100).toFixed(0)} %
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <a
                            href={`/api/documents/${d.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Ouvrir le fichier"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border bg-card hover:bg-muted"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDoc(d); }}
                            title="Supprimer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border bg-card text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DetailPanel
            doc={selected}
            clients={clients}
            onClose={() => setSelected(null)}
            onValidate={validateDoc}
            onDelete={deleteDoc}
          />
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  doc,
  clients,
  onClose,
  onValidate,
  onDelete,
}: {
  doc: DocumentRecord | null;
  clients: ClientRecord[];
  onClose: () => void;
  onValidate: (d: DocumentRecord, body: { clientId: string; category: Category; subCategory?: string }) => Promise<void>;
  onDelete: (d: DocumentRecord) => Promise<void>;
}) {
  const [clientId, setClientId] = useState<string>("");
  const [category, setCategory] = useState<Category>("autres");
  const [subCategory, setSubCategory] = useState<string>("");
  const [busy, setBusy] = useState(false);

  if (!doc) {
    return (
      <div className="hidden rounded-lg border bg-card p-6 text-sm text-muted-foreground lg:block">
        Sélectionne un document à gauche pour voir l&rsquo;aperçu et valider.
      </div>
    );
  }

  // Reset form when doc changes
  if (doc && clientId === "" && doc.clientId && doc.clientId !== "_unassigned") {
    setClientId(doc.clientId);
  }
  if (doc && category === "autres" && doc.category) {
    setCategory(doc.category as Category);
  }

  async function submit() {
    if (!doc) return;
    if (!clientId) { alert("Choisis un client"); return; }
    setBusy(true);
    try {
      await onValidate(doc, { clientId, category, subCategory: subCategory || undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium" title={doc.originalName}>{doc.originalName}</div>
          <div className="font-mono text-xs text-muted-foreground">{doc.id}</div>
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Fermer">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="border-b">
        <iframe
          src={`/api/documents/${doc.id}/file`}
          title="Aperçu"
          className="h-[480px] w-full"
        />
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Si l&rsquo;aperçu ne s&rsquo;affiche pas :{" "}
          <a className="underline" href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">
            ouvrir dans un nouvel onglet
          </a>
        </div>
      </div>

      {doc.classification && (
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          Suggestion IA :{" "}
          <span className="text-foreground">{doc.category ?? "—"}{doc.subCategory ? ` / ${doc.subCategory}` : ""}</span>
          {" • confiance "}<span className="text-foreground">{(doc.classification.confidence * 100).toFixed(0)} %</span>
          {doc.classification.reasoning && (
            <p className="mt-1 italic">{doc.classification.reasoning}</p>
          )}
        </div>
      )}

      <div className="space-y-3 p-4 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="block w-full rounded-md border bg-card p-2"
          >
            <option value="">— choisir un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName} ({c.id})</option>
            ))}
          </select>
          {clients.length === 0 && (
            <span className="mt-1 block text-xs text-amber-700">
              Aucun client en base. Ajoute-en via la page « Clients ».
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Catégorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="block w-full rounded-md border bg-card p-2"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Sous-catégorie (optionnel)</span>
          <input
            type="text"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            placeholder="ex: 2026, assurance, impots…"
            className="block w-full rounded-md border bg-card p-2"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onDelete(doc)}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !clientId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {busy ? "Validation…" : "Valider et ranger"}
          </button>
        </div>
      </div>
    </div>
  );
}

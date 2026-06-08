"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";

export default function AdminInboxPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      setStatus(`✓ Uploadé. Classification en cours.`);
      form.reset();
    } catch (err) {
      setStatus(`✗ Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">À valider</h1>
        <p className="text-sm text-muted-foreground">
          Documents en attente de validation manuelle (confiance &lt; 0.8).
        </p>
      </header>

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
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Uploader"}
        </button>
      </form>

      {status && <p role="status" className="text-sm">{status}</p>}

      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Liste des documents à valider — à brancher sur Cosmos (where <code>needsReview = true</code>).
      </p>
    </section>
  );
}

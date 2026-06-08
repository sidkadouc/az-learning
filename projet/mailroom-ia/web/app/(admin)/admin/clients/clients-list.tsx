"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Trash2 } from "lucide-react";
import type { ClientRecord } from "@/lib/types/domain";

function isAuto(c: ClientRecord): boolean {
  return c.createdBy === "ai-auto" || c.id.startsWith("auto-");
}

export function ClientsList({ initial }: { initial: ClientRecord[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<ClientRecord | null>(null);

  useEffect(() => setList(initial), [initial]);

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      id: String(data.get("id")),
      displayName: String(data.get("displayName")),
      email: String(data.get("email")),
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      form.reset();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(c: ClientRecord) {
    if (!confirm(`Supprimer le client "${c.displayName}" (${c.id}) ?\n\nLe client doit n'avoir aucun document associé — sinon utilise "Fusionner" d'abord.`)) return;
    const res = await fetch(`/api/clients/${encodeURIComponent(c.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const txt = await res.text();
      alert(`Erreur : ${txt}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function doMerge(targetId: string) {
    if (!mergeSource) return;
    if (targetId === mergeSource.id) {
      alert("Source et cible identiques.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/clients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: mergeSource.id, targetId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(`Erreur fusion : ${JSON.stringify(json, null, 2)}`);
      } else {
        alert(`✓ Fusion terminée : ${json.moved} document(s) déplacé(s) de "${mergeSource.id}" vers "${targetId}".`);
      }
      setMergeSource(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_2fr_auto]"
      >
        <input
          name="id"
          required
          maxLength={64}
          pattern="[a-zA-Z0-9_-]+"
          placeholder="id (ex: client42)"
          className="rounded-md border bg-card p-2 text-sm"
        />
        <input
          name="displayName"
          required
          maxLength={120}
          placeholder="Nom affiché"
          className="rounded-md border bg-card p-2 text-sm"
        />
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder="email@client.tld"
          className="rounded-md border bg-card p-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || isPending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Création…" : "Ajouter"}
        </button>
      </form>
      {error && <p className="text-sm text-red-700">✗ {error}</p>}

      {list.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Aucun client. Ajoute-en au-dessus.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">id</th>
                <th className="px-3 py-2 text-left font-medium">Nom</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Origine</th>
                <th className="px-3 py-2 text-left font-medium">Créé</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const auto = isAuto(c);
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                    <td className="px-3 py-2">{c.displayName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-3 py-2">
                      {auto ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          🤖 auto
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          ✋ manuel
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.createdAt?.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setMergeSource(c)}
                          title="Fusionner ce client vers un autre"
                          className="inline-flex h-8 items-center gap-1 rounded border bg-card px-2 text-xs hover:bg-muted"
                        >
                          <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
                          Fusionner
                        </button>
                        <button
                          onClick={() => onDelete(c)}
                          title="Supprimer ce client (sans documents)"
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
      )}

      {mergeSource && (
        <MergeDialog
          source={mergeSource}
          others={list.filter((c) => c.id !== mergeSource.id)}
          onCancel={() => setMergeSource(null)}
          onConfirm={doMerge}
          busy={busy}
        />
      )}
    </div>
  );
}

function MergeDialog({
  source,
  others,
  onCancel,
  onConfirm,
  busy,
}: {
  source: ClientRecord;
  others: ClientRecord[];
  onCancel: () => void;
  onConfirm: (targetId: string) => void;
  busy: boolean;
}) {
  const [targetId, setTargetId] = useState<string>("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Fusionner un client</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tous les documents de{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">{source.id}</code>{" "}
          (<strong>{source.displayName}</strong>) seront réassignés au client cible, et leurs blobs
          déplacés vers <code className="rounded bg-muted px-1 text-xs">clients/&lt;cible&gt;/…</code>.
          Le client source sera ensuite supprimé.
        </p>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
            Client cible
          </span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="block w-full rounded-md border bg-card p-2"
          >
            <option value="">— choisir un client cible —</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} ({c.id}) {isAuto(c) ? "🤖" : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(targetId)}
            disabled={!targetId || busy}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Fusion…" : "Fusionner"}
          </button>
        </div>
      </div>
    </div>
  );
}

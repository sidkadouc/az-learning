"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/types/domain";

export function ClientsList({ initial }: { initial: ClientRecord[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                <th className="px-3 py-2 text-left font-medium">Créé</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{c.id}</td>
                  <td className="px-3 py-2">{c.displayName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.createdAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, ChevronRight, FileText, Folder, Home, RefreshCw, Trash2, User } from "lucide-react";
import type { ClientRecord } from "@/lib/types/domain";

interface BrowseEntry {
  type: "folder" | "blob";
  name: string;
  fullPath: string;
  size?: number;
  modified?: string;
  contentType?: string;
}

const ROOT_SHORTCUTS: { label: string; prefix: string }[] = [
  { label: "🗂  À traiter (_inbox)", prefix: "_inbox/" },
  { label: "📁  Tous les clients", prefix: "clients/" },
  { label: "📦  Archives", prefix: "archives/" },
];

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const PREVIEWABLE_EXTS = new Set([
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg",
  "txt", "json", "csv", "html", "htm", "log", "md", "xml",
]);

function fileExt(path: string): string {
  return path.toLowerCase().split(".").pop() ?? "";
}

function isPreviewable(entry: BrowseEntry): boolean {
  const ct = entry.contentType;
  if (ct && (ct.startsWith("image/") || ct === "application/pdf" || ct.startsWith("text/"))) {
    return true;
  }
  return PREVIEWABLE_EXTS.has(fileExt(entry.name));
}

export function StorageExplorer({
  clients,
  rootEntries,
}: {
  clients: ClientRecord[];
  rootEntries: BrowseEntry[];
}) {
  // Build a map clientId → displayName for folder name resolution
  const clientNameMap = new Map(clients.map((c) => [c.id, c.displayName]));

  // At root level, auto-expand the `clients/` folder into individual client
  // folders with display names, so the user sees:
  //   _inbox/  |  Amine Bouabdelli/  |  Saddek/  |  archives/
  // instead of:
  //   _inbox/  |  clients/  |  archives/
  const resolveDisplayEntries = useCallback(
    (rawEntries: BrowseEntry[], currentPrefix: string): BrowseEntry[] => {
      // Only at levels that contain `clients/xxx/` subfolders
      if (currentPrefix === "" || currentPrefix === "clients/") {
        return rawEntries.map((e) => {
          if (e.type === "folder" && e.fullPath.startsWith("clients/")) {
            // e.g. fullPath = "clients/auto-amine-bouabdelli/"
            const id = e.name; // "auto-amine-bouabdelli"
            const display = clientNameMap.get(id);
            if (display) return { ...e, name: `${display}` };
          }
          return e;
        });
      }
      return rawEntries;
    },
    [clientNameMap],
  );

  const [prefix, setPrefix] = useState<string>("");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<BrowseEntry | null>(null);

  // On mount, expand root: replace `clients/` folder by its children
  useEffect(() => {
    async function initRoot() {
      setLoading(true);
      try {
        // Fetch root entries
        const rootRes = await fetch("/api/storage/browse?prefix=");
        const rootJson = (await rootRes.json()) as { entries: BrowseEntry[] };
        const root = rootJson.entries;

        // Find the clients/ folder and expand it one level
        const hasClientsFolder = root.some((e) => e.fullPath === "clients/");
        if (hasClientsFolder) {
          const clientsRes = await fetch("/api/storage/browse?prefix=clients%2F");
          const clientsJson = (await clientsRes.json()) as { entries: BrowseEntry[] };
          // Replace `clients/` with its children (individual client folders)
          const expanded = [
            ...root.filter((e) => e.fullPath !== "clients/"),
            ...clientsJson.entries,
          ];
          // Sort: folders first (with _inbox first), then blobs
          expanded.sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            if (a.fullPath === "_inbox/") return -1;
            if (b.fullPath === "_inbox/") return 1;
            return a.name.localeCompare(b.name);
          });
          setEntries(resolveDisplayEntries(expanded, ""));
        } else {
          setEntries(resolveDisplayEntries(root, ""));
        }
      } catch {
        setEntries(resolveDisplayEntries(rootEntries, ""));
      } finally {
        setLoading(false);
      }
    }
    void initRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    setSelectedBlob(null);
    try {
      const res = await fetch(`/api/storage/browse?prefix=${encodeURIComponent(p)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { entries: BrowseEntry[] };
      setEntries(resolveDisplayEntries(json.entries, p));
      setPrefix(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [resolveDisplayEntries]);

  const archiveBlob = useCallback(async (entry: BrowseEntry) => {
    if (entry.fullPath.startsWith("archives/")) {
      alert("Ce fichier est déjà dans archives/.");
      return;
    }
    if (!confirm(`Archiver "${entry.name}" vers archives/${entry.fullPath} ?`)) return;
    const res = await fetch("/api/storage/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: entry.fullPath }),
    });
    if (!res.ok) { alert(`Erreur : ${await res.text()}`); return; }
    setSelectedBlob(null);
    await load(prefix);
  }, [load, prefix]);

  const deleteBlobAction = useCallback(async (entry: BrowseEntry) => {
    if (!confirm(`Supprimer définitivement le blob "${entry.fullPath}" ?\n\n⚠️  La métadonnée Cosmos n'est PAS supprimée — utilise l'inbox pour faire les deux ensemble.`)) return;
    const res = await fetch(`/api/storage/file?path=${encodeURIComponent(entry.fullPath)}`, {
      method: "DELETE",
    });
    if (!res.ok) { alert(`Erreur : ${await res.text()}`); return; }
    setSelectedBlob(null);
    await load(prefix);
  }, [load, prefix]);

  // Breadcrumb: resolve "clients/<id>" segments to display names
  const segments = prefix ? prefix.replace(/\/$/, "").split("/") : [];
  const resolveSegmentName = (seg: string, idx: number): string => {
    // If this segment is a client ID inside clients/ folder, show display name
    if (idx === 1 && segments[0] === "clients") {
      return clientNameMap.get(seg) ?? seg;
    }
    if (idx === 0 && seg.startsWith("auto-")) {
      // Root-level expanded client folder
      return clientNameMap.get(seg) ?? seg;
    }
    return seg;
  };

  const goRoot = useCallback(async () => {
    setPrefix("");
    setLoading(true);
    setError(null);
    setSelectedBlob(null);
    try {
      const rootRes = await fetch("/api/storage/browse?prefix=");
      const rootJson = (await rootRes.json()) as { entries: BrowseEntry[] };
      const root = rootJson.entries;
      const hasClientsFolder = root.some((e) => e.fullPath === "clients/");
      if (hasClientsFolder) {
        const clientsRes = await fetch("/api/storage/browse?prefix=clients%2F");
        const clientsJson = (await clientsRes.json()) as { entries: BrowseEntry[] };
        const expanded = [
          ...root.filter((e) => e.fullPath !== "clients/"),
          ...clientsJson.entries,
        ];
        expanded.sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          if (a.fullPath === "_inbox/") return -1;
          if (b.fullPath === "_inbox/") return 1;
          return a.name.localeCompare(b.name);
        });
        setEntries(resolveDisplayEntries(expanded, ""));
      } else {
        setEntries(resolveDisplayEntries(root, ""));
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [resolveDisplayEntries]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Sidebar : raccourcis + clients */}
      <aside className="space-y-4 rounded-lg border bg-card p-3 text-sm">
        <div>
          <button
            onClick={goRoot}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted ${
              prefix === "" ? "bg-muted font-medium" : ""
            }`}
          >
            <Home className="h-4 w-4" aria-hidden="true" /> Racine
          </button>
          <ul className="mt-1 space-y-0.5">
            {ROOT_SHORTCUTS.map((s) => (
              <li key={s.prefix}>
                <button
                  onClick={() => load(s.prefix)}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                    prefix === s.prefix ? "bg-muted font-medium" : ""
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-1 px-2 text-xs font-medium uppercase text-muted-foreground">
            Clients ({clients.length})
          </div>
          {clients.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">
              Aucun client. Crée-en via la page « Clients ».
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-0.5 overflow-y-auto">
              {clients.map((c) => {
                const p = `clients/${c.id}/`;
                const active = prefix === p || prefix.startsWith(p);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => load(p)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted ${
                        active ? "bg-muted font-medium" : ""
                      }`}
                      title={c.email}
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{c.displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main : breadcrumb + listing + preview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <button
            onClick={goRoot}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
            title="Racine"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" /> /
          </button>
          {segments.map((seg, i) => {
            const path = segments.slice(0, i + 1).join("/") + "/";
            const isLast = i === segments.length - 1;
            return (
              <span key={path} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <button
                  disabled={isLast}
                  onClick={() => load(path)}
                  className={`rounded px-1.5 py-0.5 ${
                    isLast ? "font-medium" : "hover:bg-muted"
                  }`}
                >
                  {resolveSegmentName(seg, i)}
                </button>
              </span>
            );
          })}
          <button
            onClick={() => prefix === "" ? goRoot() : load(prefix)}
            title="Rafraîchir"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            ✗ {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="overflow-x-auto rounded-lg border bg-card">
            {entries.length === 0 && !loading ? (
              <p className="p-6 text-sm text-muted-foreground">Ce dossier est vide.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Nom</th>
                    <th className="px-3 py-2 text-right font-medium">Taille</th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">
                      Modifié
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.fullPath}
                      onClick={() => {
                        if (e.type === "folder") void load(e.fullPath);
                        else setSelectedBlob(e);
                      }}
                      className={`cursor-pointer border-t hover:bg-muted/20 ${
                        selectedBlob?.fullPath === e.fullPath ? "bg-muted/40" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          {e.type === "folder" ? (
                            <Folder className="h-4 w-4 text-blue-600" aria-hidden="true" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="truncate" title={e.fullPath}>
                            {e.name}
                            {e.type === "folder" && "/"}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {e.type === "blob" ? formatSize(e.size) : "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-right text-xs text-muted-foreground md:table-cell">
                        {e.type === "blob" ? formatDate(e.modified) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Preview pane */}
          <div className="rounded-lg border bg-card">
            {selectedBlob ? (
              <>
                <header className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium" title={selectedBlob.fullPath}>
                      {selectedBlob.name}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {selectedBlob.fullPath} • {formatSize(selectedBlob.size)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={`/api/storage/file?path=${encodeURIComponent(selectedBlob.fullPath)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Ouvrir dans un nouvel onglet"
                      className="inline-flex h-8 items-center rounded border bg-card px-2 text-xs hover:bg-muted"
                    >
                      Ouvrir
                    </a>
                    <button
                      onClick={() => archiveBlob(selectedBlob)}
                      disabled={selectedBlob.fullPath.startsWith("archives/")}
                      title={selectedBlob.fullPath.startsWith("archives/") ? "Déjà dans archives/" : "Archiver"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border bg-card hover:bg-muted disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => deleteBlobAction(selectedBlob)}
                      title="Supprimer le blob"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border bg-card text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </header>
                {isPreviewable(selectedBlob) ? (
                  <BlobPreview blobPath={selectedBlob.fullPath} name={selectedBlob.name} />
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">
                    Aperçu non disponible pour ce type (
                    <code className="rounded bg-muted px-1">
                      {selectedBlob.contentType ?? (fileExt(selectedBlob.name) || "?")}
                    </code>
                    ). Utilise le bouton « Ouvrir » pour télécharger.
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                Sélectionne un fichier pour l&rsquo;aperçu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Fetches a blob via the API (carries the auth cookie) then displays it
 * via an Object URL in an iframe/embed. Avoids the Easy Auth X-Frame-Options issue.
 */
function BlobPreview({ blobPath, name }: { blobPath: string; name: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    setObjectUrl(null);
    setErr(null);

    fetch(`/api/storage/file?path=${encodeURIComponent(blobPath)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoke = url;
        setObjectUrl(url);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [blobPath]);

  if (err) {
    return (
      <div className="p-6 text-sm text-red-700">
        Erreur de chargement : {err}
      </div>
    );
  }
  if (!objectUrl) {
    return (
      <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  return (
    <iframe
      src={objectUrl}
      title={name}
      className="h-[520px] w-full"
    />
  );
}

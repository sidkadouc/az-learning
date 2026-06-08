import { listBlobsAsTree } from "@/lib/azure/blob";

export default async function AdminStoragePage() {
  const tree = await listBlobsAsTree("").catch(() => null);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground">
          Arborescence complète du conteneur Blob (admin uniquement).
        </p>
      </header>
      {tree ? (
        <pre className="overflow-x-auto rounded-lg border bg-card p-4 text-xs">{tree}</pre>
      ) : (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Aucun document indexé pour l&rsquo;instant — ou le storage n&rsquo;est pas accessible.
        </p>
      )}
    </section>
  );
}

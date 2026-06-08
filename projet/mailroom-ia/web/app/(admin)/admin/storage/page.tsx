import { listClients } from "@/lib/azure/cosmos";
import { listBlobLevel } from "@/lib/azure/blob";
import { StorageExplorer } from "./storage-explorer";

export const dynamic = "force-dynamic";

export default async function AdminStoragePage() {
  const [clients, rootEntries] = await Promise.all([
    listClients(500).catch(() => []),
    listBlobLevel("").catch(() => []),
  ]);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground">
          Explorateur du conteneur Blob — navigue par client, par catégorie, ou dans la racine.
        </p>
      </header>

      <StorageExplorer clients={clients} rootEntries={rootEntries} />
    </section>
  );
}


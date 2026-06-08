import { listClients, listInboxDocuments } from "@/lib/azure/cosmos";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  const [docs, clients] = await Promise.all([
    listInboxDocuments(50).catch((err) => {
      console.error("listInboxDocuments failed", err);
      return null;
    }),
    listClients(200).catch((err) => {
      console.error("listClients failed", err);
      return [];
    }),
  ]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">À valider</h1>
        <p className="text-sm text-muted-foreground">
          Documents en attente de validation manuelle (confiance &lt; 0.8 ou client non identifié).
        </p>
      </header>

      <InboxClient initialDocs={docs} clients={clients} />
    </section>
  );
}

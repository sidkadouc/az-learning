import { listClients } from "@/lib/azure/cosmos";
import { ClientsList } from "./clients-list";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const clients = await listClients(200).catch((err) => {
    console.error("listClients failed", err);
    return [];
  });

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Liste des clients connus du système. Ajoute un client pour pouvoir lui assigner des documents depuis l&rsquo;inbox.
        </p>
      </header>
      <ClientsList initial={clients} />
    </section>
  );
}

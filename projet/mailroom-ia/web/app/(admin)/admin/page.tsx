import { listInboxDocuments } from "@/lib/azure/cosmos";

export default async function AdminDashboardPage() {
  const inbox = await listInboxDocuments(5).catch(() => []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d&rsquo;ensemble de l&rsquo;activité de la mailroom.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="À valider" value={inbox.length.toString()} hint="documents en attente" />
        <Card label="Aujourd'hui" value="—" hint="docs classés (à brancher)" />
        <Card label="Coût IA mois" value="—" hint="€ (à brancher)" />
        <Card label="Précision" value="—" hint="% (à brancher)" />
      </div>

      <section aria-labelledby="inbox-recent">
        <h2 id="inbox-recent" className="mb-3 text-lg font-semibold">Derniers documents à valider</h2>
        {inbox.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Rien en attente. Tous les documents ont été classés.
          </p>
        ) : (
          <ul className="space-y-2">
            {inbox.map((doc) => (
              <li key={doc.id} className="rounded-md border bg-card p-3 text-sm">
                <span className="font-medium">{doc.originalName}</span>
                <span className="ml-2 text-muted-foreground">
                  · confiance {(doc.classification?.confidence ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function AdminClientsPage() {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">CRUD clients — à implémenter.</p>
      </header>
      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Liste + formulaire d&rsquo;ajout : utiliser <code>GET /api/clients</code> et <code>POST /api/clients</code> (à brancher).
      </p>
    </section>
  );
}

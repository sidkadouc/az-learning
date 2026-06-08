import { Mail } from "lucide-react";

export default function ClientPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <header className="mb-6 flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">Mes documents</h1>
      </header>
      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Cette page affichera l&rsquo;arborescence des documents de l&rsquo;utilisateur authentifié
        (auth Entra External ID à brancher dans le jalon 3).
      </p>
    </main>
  );
}

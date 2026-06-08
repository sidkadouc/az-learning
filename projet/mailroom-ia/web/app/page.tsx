import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Mail className="h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Mailroom IA</h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Tri automatique de vos courriers physiques scannés grâce à l&rsquo;IA.
        </p>
      </header>

      <section className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <Link
          href="/admin"
          className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-5 transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Back-office admin</h2>
          <p className="text-sm text-muted-foreground">
            Uploader les scans, valider la classification, gérer les clients.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Accéder <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/client"
          className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-5 transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Front-office client</h2>
          <p className="text-sm text-muted-foreground">
            Consulter vos courriers numérisés, organisés par catégorie.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Accéder <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>
    </main>
  );
}

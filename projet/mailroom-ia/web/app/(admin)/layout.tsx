import type { ReactNode } from "react";
import Link from "next/link";
import { FolderTree, Inbox, Mail, Users } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Tableau de bord", Icon: Inbox },
  { href: "/admin/clients", label: "Clients", Icon: Users },
  { href: "/admin/inbox", label: "À valider", Icon: Inbox },
  { href: "/admin/storage", label: "Storage", Icon: FolderTree },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-card md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Mailroom · Admin</span>
        </div>
        <nav aria-label="Navigation admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-0">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

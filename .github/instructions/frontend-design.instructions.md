---
description: Bonnes pratiques frontend & design (Next.js 15, React 19, TypeScript, Tailwind, shadcn, mobile-first, accessibilité).
applyTo: "**/*.{ts,tsx,jsx,js,css,html}"
---

# Frontend & design — règles

## Stack imposée pour ce repo
- **Next.js 15 (App Router)** + **React 19** + **TypeScript strict** (`"strict": true` dans `tsconfig.json`).
- **Tailwind CSS** + **shadcn/ui** pour les composants. Pas de Material-UI, pas de Chakra, pas de styled-components.
- **NextAuth.js** (ou Auth.js) pour wrapper l'OIDC Entra.
- Gestion de state serveur : **TanStack Query** + RSC. Pas de Redux sauf besoin avéré.

## Mobile-first, toujours
1. Tester chaque layout d'abord en viewport **375×812** (iPhone 14 mini), puis breakpoints `sm md lg xl`.
2. Cible tactile minimum **44×44 px** (boutons, icônes interactives).
3. Navigation au pouce : actions primaires en bas d'écran sur mobile (bottom nav).
4. **Pas de hover-only** : tout ce qui s'active au hover doit aussi être accessible au tap/focus.

## React / Next.js
- **Server Components par défaut**. `"use client"` uniquement si vraie interactivité (état local, event handlers, hooks navigateur).
- **Fetch côté serveur** dans les RSC ou les Route Handlers, jamais directement dans un composant client sauf via TanStack Query.
- **Pas de `useEffect` pour fetcher** : utiliser `await fetch()` côté serveur ou TanStack Query côté client.
- Layouts partagés via `app/(group)/layout.tsx` — ne pas dupliquer le shell.
- **Route Handlers** (`app/api/*/route.ts`) typés avec `Request`/`Response`, validation des inputs avec **Zod**.

## TypeScript
- Pas de `any` sauf justifié par un commentaire `// eslint-disable-next-line` avec raison.
- Préférer `type` aux `interface` sauf pour les types étendus côté librairie.
- Types **partagés** front/BFF dans `lib/types/` (un seul fichier `domain.ts` pour les entités).
- Valider toute entrée externe (formulaires, query params, headers) avec **Zod** avant de l'utiliser.

## Tailwind
- Utiliser les **tokens du theme** (`text-foreground`, `bg-card`…) plutôt que les couleurs brutes (`text-gray-900`).
- Pour les variantes responsive : préférer la composition `flex flex-col md:flex-row` à plusieurs composants conditionnels.
- Pour le dark mode : utiliser le pattern `dark:` de Tailwind v4 + `next-themes`.
- Extraire en composant dès qu'une suite de classes dépasse ~6 utilities et est répétée 2 fois.

## shadcn/ui
- Installer composant par composant via la CLI (`npx shadcn@latest add button`).
- Customiser dans `components/ui/` plutôt que de wrapper. Les composants shadcn t'appartiennent.
- **Toujours** un `<Form>` shadcn + `react-hook-form` + `zodResolver` pour les formulaires.

## Accessibilité (WCAG 2.1 AA minimum)
- HTML sémantique : `<button>` pour les actions, `<a>` pour la navigation. Jamais de `<div onClick>`.
- Tous les inputs ont un `<Label>` lié.
- Contraste texte ≥ 4.5:1 (vérifier avec les outils DevTools).
- Focus visible : ne **jamais** supprimer `outline` sans le remplacer par `focus-visible:ring-*`.
- Images : `alt` obligatoire (vide `alt=""` si décoratif).
- Tester la navigation au clavier `Tab` / `Shift+Tab` / `Enter` / `Escape`.

## Performance
- Images : `next/image` partout, `priority` sur le LCP, `loading="lazy"` ailleurs (auto).
- Polices : `next/font` avec `display: swap`. Pas de Google Fonts en `<link>` direct.
- Bundle : `next-bundle-analyzer` à la moindre suspicion. Cible **< 200 KB JS au first load** sur mobile.
- Préférer la pagination ou l'infinite scroll au listing complet pour > 50 items.

## Design system / cohérence
- Un seul **token de spacing** : multiples de 4px (Tailwind `space-1` à `space-16`).
- **3 niveaux de typographie max** par écran (titre, sous-titre, corps).
- Composants partagés extraits dans `components/` dès la 2ᵉ utilisation.
- Icônes : **lucide-react** uniquement (déjà fourni par shadcn).

## Ce qu'il NE FAUT PAS faire
- ❌ `useEffect` pour fetcher de la donnée
- ❌ State global pour de la donnée serveur (= rôle de TanStack Query / RSC)
- ❌ CSS-in-JS runtime (styled-components, emotion) — Tailwind suffit
- ❌ `getServerSideProps` / Pages Router — on est en App Router
- ❌ Couleurs hardcodées (`#ff0000`) — passer par le theme Tailwind

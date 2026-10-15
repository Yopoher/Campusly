# Changelog

## [Phase 2] — 2026-10-15

### Ajouté

- Projet Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, ESLint, Prettier.
- Supabase CLI et configuration (code de connexion valable 10 min, renvoi limité à une fois par minute, double authentification TOTP activée).
- Migration initiale `supabase/migrations/20261015120000_init.sql` (issue du brouillon de la Phase 1) ; nouvelles tables fermées par défaut aux rôles client.
- Données fictives de développement (`supabase/seed.sql`).
- Tests : 27 tests de base de données (accès, isolation entre campus, modération, comptes désactivés, 20 inscriptions simultanées), 11 tests unitaires (dates en heure de Paris, y compris le passage à l'heure d'hiver ; carte d'événement), 5 parcours Playwright × 2 formats (mobile, ordinateur).
- Système visuel (`docs/DESIGN.md`) : police Archivo auto-hébergée, palette claire et sombre, colonne de date et surligneur d'inscription, boutons, champs (dont la saisie du code), messages, états vides, barre de navigation, logo provisoire. Démonstration sur `/design`.
- PWA : manifeste, icônes (dont icône masquable et icône iOS), service worker minimal sans cache.
- En-têtes de sécurité (HSTS, nosniff, refus d'intégration en iframe, Referrer-Policy, Permissions-Policy).
- Intégration continue GitHub Actions : recherche de secrets, audit des dépendances livrées, format, lint, types, tests sur PostgreSQL 16, construction, parcours Playwright.
- `.env.example` documentant toutes les variables, sans valeur.

### Modifié

- Tests de base de données écrits avec Vitest sur une base jetable plutôt qu'avec pgTAP (mêmes contrôles, sans extension ni Docker).

## [Phase 1] — 2026-10-15

### Ajouté

- Cahier des charges v1.1 (`docs/PRODUCT_SPEC.md`).
- Architecture, modèle de données, modèle de sécurité, plan d'exécution, décisions à valider.
- Brouillon de schéma SQL et 17 contrôles de sécurité, tous réussis sur PostgreSQL 16 (isolation entre campus, brouillons, e-mails, conversations, modération, comptes désactivés, inscriptions simultanées).

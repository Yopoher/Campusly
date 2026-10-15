# Campusly

Plateforme de vie étudiante : les événements d'une école, les inscriptions, une conversation par événement et des notifications. Pilote : Ynov Campus Rouen.

## État

| Phase                                      | Statut                                                      |
| ------------------------------------------ | ----------------------------------------------------------- |
| 1. Analyse et préparation                  | Terminée                                                    |
| 2. Initialisation                          | Terminée                                                    |
| 3. Authentification, organisations, droits | Code terminé ; validation sur le projet Supabase en attente |

Le détail des phases et de leurs critères de validation est dans `docs/PLAN.md`.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (PostgreSQL, Auth, Realtime, Storage) · Tailwind CSS 4 · Vitest · Playwright. Choix et alternatives : `docs/ARCHITECTURE.md`.

## Démarrer

Prérequis : Node.js 22, et un serveur PostgreSQL 16+ jetable pour les tests de base de données.

```bash
npm install
cp .env.example .env.local   # à compléter à partir de la Phase 3
npm run dev                  # http://localhost:3000 — système visuel sur /design
```

## Commandes

| Commande            | Rôle                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `npm run dev`       | Serveur de développement                                                    |
| `npm run build`     | Construction de production                                                  |
| `npm run lint`      | Vérification du code (ESLint)                                               |
| `npm run typecheck` | Vérification des types TypeScript                                           |
| `npm run format`    | Mise en forme (Prettier)                                                    |
| `npm test`          | Tests unitaires **et** de base de données (voir ci-dessous)                 |
| `npm run test:db`   | Tests de base de données seuls : accès, isolation entre écoles, concurrence |
| `npm run test:e2e`  | Parcours dans un navigateur, sur mobile et ordinateur (Playwright)          |

### Tests de base de données

Chaque fichier de `tests/db/` crée une base jetable, y applique `supabase/tests/support/auth_shim.sql` (compatibilité Supabase sur un PostgreSQL nu) puis toutes les migrations de `supabase/migrations/`, et la supprime à la fin. Indiquer le serveur avec :

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run test:db
```

Ne jamais pointer cette variable vers une base contenant des données réelles.

### Navigateur des tests de parcours

`npx playwright install chromium` installe le navigateur. Si ce n'est pas possible (réseau restreint), indiquer un Chromium existant avec `PLAYWRIGHT_CHROMIUM_PATH`.

## Déploiement du projet Supabase de développement

Le workflow GitHub **Supabase (développement)** applique les migrations et la configuration Auth au projet `gazcgauqohrushpyhbyw`. Il tourne après chaque CI réussie qui modifie `supabase/`, ou à la demande (onglet Actions › Run workflow) avec trois options : charger les données de démonstration, inviter un super-administrateur, autoriser une adresse de test.

Secrets du dépôt requis : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Tests de parcours

`npm run test:e2e` construit l'application contre un faux Supabase local (`tests/e2e/support/fake-supabase.mjs`) : les parcours d'interface se testent sans réseau ni secret. Les règles de sécurité réelles sont testées sur une vraie base dans `tests/db/`.

## Organisation du code

```
app/                    pages (App Router) ; /design = démonstration du système visuel
components/ui/          composants génériques (boutons, champs, messages, navigation, logo)
components/events/      composants liés aux événements (carte, colonne de date, organisateur)
components/pwa/         enregistrement du service worker
lib/                    utilitaires (dates dans le fuseau de l'école, classes CSS)
public/sw.js            service worker
supabase/migrations/    schéma de la base, versionné
supabase/seed.sql       données fictives de développement
tests/db/               tests de la base (RLS, permissions, concurrence)
tests/e2e/              parcours Playwright
docs/                   cahier des charges, architecture, données, sécurité, design, plan, décisions
```

## Documentation

`docs/PRODUCT_SPEC.md` (cahier des charges v1.1) · `docs/ARCHITECTURE.md` · `docs/DATABASE.md` · `docs/SECURITY.md` · `docs/DESIGN.md` · `docs/PLAN.md` · `docs/DECISIONS.md` · `CHANGELOG.md`

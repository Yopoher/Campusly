# Changelog

## [Phase 3, en cours] — 2026-10-15

### Ajouté

- Migration `20261015170000_auth_profiles_admin.sql` : contrôle avant envoi de code avec limitation (5 demandes par adresse et 20 par IP par heure, adresses hachées), hook Auth « avant création d'un utilisateur », création automatique du profil depuis la liste de l'école, retrait de la liste qui bloque le compte, profil et préférences, invitation du super-admin, fonctions d'administration (écoles, organisations, membres, permissions, statut des comptes, import minimal) exigeant le second facteur, journal d'audit.
- Connexion par code : `/connexion` (réponse identique que l'adresse soit autorisée ou non, renvoi du code, changement d'adresse), `/bienvenue`, `/profil`, déconnexion, `/connexion/acces-refuse`, proxy de session protégeant les espaces connectés, redirections internes uniquement.
- Administration : enrôlement et vérification du second facteur (TOTP), page d'accueil `/admin`, script `scripts/invite-admin.ts`.
- Déploiement sur le projet Supabase de développement par GitHub Actions (`supabase-dev.yml`), avec invitation du super-admin et autorisation d'une adresse de test à la demande.
- Tests : 33 nouveaux tests de base (connexion, création de compte, administration), 10 tests unitaires de la logique de connexion, 9 parcours de connexion × 2 formats contre un faux Supabase local.

### Corrigé

- Un code collé avec une espace (« 123 456 ») était tronqué par la limite de 6 caractères : la saisie ne garde plus que les chiffres.

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

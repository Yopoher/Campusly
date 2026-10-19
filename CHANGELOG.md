# Changelog

## [Phase 4, en cours] — 2026-10-19

### Ajouté (images d'événements)

- Migration `20261019190000_event_images.sql` : bucket privé `event-images` (4 Mo, WebP), politiques Storage (lecture selon la visibilité de l'événement, ajout et suppression avec `events.edit`), fonction `set_event_image` (chemin vérifié, audit `event.image_changed`).
- Traitement serveur (`lib/events/image.ts`, bibliothèque `sharp` épinglée en version 0.35.5) : JPEG, PNG ou WebP uniquement, orientation appliquée, 1 600 px maximum, ré-encodage WebP sans métadonnées.
- Espace de gestion : section « Image » sur la modification d'un événement (ajout, remplacement, retrait). Affichage sur la fiche d'événement avec un lien signé valable 10 minutes.
- Tests : 21 tests de base (bucket, accès par rôle et par visibilité, chemins refusés, modification et retrait, audit), 10 tests unitaires de traitement (format, poids, EXIF, réduction).
- Limite de requête de Next relevée à 5 Mo pour les actions serveur.

### Ajouté (back-office, Phase 7 en cours)

- Gestion des écoles : création, modification du nom, du fuseau et des domaines (refus de retirer un domaine utilisé), changement de statut, suppression seulement si l'école est vide (aucune adresse autorisée, aucun événement, aucune organisation hors école).
- Organisations : création, modification, suppression si elle est vide, membres et permissions.
- Import CSV : résumé avant confirmation, mode ajout ou remplacement (retrait des adresses absentes du fichier, par `admin_remove_allowed_emails`), détection des doublons, domaines non déclarés et adresses déjà dans une autre école.
- Migrations `20261019150000` à `20261019180000` : invitation d'un super-admin déjà inscrit, retrait de listes, modification et suppression vides.

### Corrigé

- Super-admin invité avec un compte existant : l'accès à `/admin` est désormais activé (migration `20261019150000`).
- Connexion : après plusieurs tests, la limite était atteinte ; les limites ont été rééquilibrées (voir ci-dessous).
- Migrations hors ordre refusées par `supabase db push` : `--include-all` dans le workflow de développement.
- Tests : tri des domaines indépendant de la langue du serveur ; sélecteur exact sur la page de profil.

### Ajouté

- Migration `20261019120000_events.sql` : création, modification, publication et annulation d'événements par des fonctions `SECURITY DEFINER` (permissions, école, statut et audit), lectures par la vue `event_cards` (`security_invoker`), liste des inscrits sans e-mail, profil d'organisation.
- Fil des événements (à venir, mes inscriptions, passés), fiche d'événement avec inscription et désinscription, profil d'organisation, espace de gestion (tableau de bord, création, modification, publication, annulation avec motif et confirmation).
- Tests : 36 tests de base (permissions, visibilité, capacité, inscriptions, annulation), 4 parcours navigateur × 2 formats.
- Heure de Paris prise en compte (`lib/events/time.ts`) : passage en heure d'été et d'hiver couvert par des tests.
- Connexion : envoi des codes par Brevo (SMTP) avec le modèle de message en français.
- Rôle de démonstration : script `scripts/dev-grant-bde.ts` et option du workflow pour donner le rôle d'événements du BDE de démonstration (développement uniquement).

### Modifié

- Migration `20261019130000_login_limit.sql` puis `20261019140000_login_limit_ip.sql` : limite des demandes de code portée à 20 par adresse et par heure, et à 500 par IP et par heure (réseaux d'école partagés). Remplace la fonction `login_precheck` de la migration `20261015170000`.

### Non fait

- Images dans les cartes du fil (seulement sur la fiche d'événement).
- Ajout d'une image à la création (à faire après l'enregistrement, depuis la modification).
- Nettoyage des objets orphelins en cas de remplacements simultanés.
- Notifications et rappels d'événements (Phase 6).

## [Phase 3, en cours] — 2026-10-15

### Ajouté

- Migration `20261015170000_auth_profiles_admin.sql` : contrôle avant envoi de code avec limitation (5 demandes par adresse et 20 par IP par heure, adresses hachées), hook Auth « avant création d'un utilisateur », création automatique du profil depuis la liste de l'école, retrait de la liste qui bloque le compte, profil et préférences, invitation du super-admin, fonctions d'administration (écoles, organisations, membres, permissions, statut des comptes, import minimal) exigeant le second facteur, journal d'audit.
- Connexion par code : `/connexion` (réponse identique que l'adresse soit autorisée ou non, renvoi du code, changement d'adresse), `/bienvenue`, `/profil`, déconnexion, `/connexion/acces-refuse`, proxy de session protégeant les espaces connectés, redirections internes uniquement.
- Administration : enrôlement et vérification du second facteur (TOTP), page d'accueil `/admin`, script `scripts/invite-admin.ts`.
- Déploiement sur le projet Supabase de développement par GitHub Actions (`supabase-dev.yml`), avec invitation du super-admin et autorisation d'une adresse de test à la demande.
- Tests : 33 nouveaux tests de base (connexion, création de compte, administration), 10 tests unitaires de la logique de connexion, 9 parcours de connexion × 2 formats contre un faux Supabase local.

### Déployé

- 2026-10-16 : base et configuration Auth appliquées au projet Supabase de développement, données de démonstration chargées, super-admin invité.

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

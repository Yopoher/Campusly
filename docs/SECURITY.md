# Campusly — Authentification, permissions et sécurité (Phase 1)

**Statut :** proposition à valider · **Référence :** `docs/PRODUCT_SPEC.md` v1.1, sections 3, 5, 11.4, 19

---

## 1. Modèle d'identité

| Notion | Où elle vit | Qui peut la modifier |
|---|---|---|
| Identité (e-mail vérifié, session) | Supabase Auth (`auth.users`) | Supabase, après vérification du code |
| Rattachement à une école, type, statut | `profiles` (créé depuis `allowed_emails`) | Super-admin, import CSV |
| Droits de gestion | `organization_members` + `organization_member_permissions` | Super-admin uniquement |
| Super-admin | `platform_admins` | Commande d'installation uniquement (aucune API) |

Aucun droit ne dépend d'une donnée envoyée par le navigateur ni d'un champ modifiable par l'utilisateur. Les jetons de session ne contiennent que l'identifiant : les droits sont relus en base à chaque requête, donc un retrait de permission ou une désactivation prend effet immédiatement.

---

## 2. Connexion

### 2.1. Parcours

1. Saisie de l'e-mail → Server Action :
   - normalisation (`lower`, `trim`) ;
   - limitation : 5 demandes par adresse par heure, 20 par IP par heure (`login_attempts`, empreintes hachées, purge 24 h) ;
   - `can_request_login(email)` : domaine d'une école active **et** adresse `authorized` dans la liste de cette école **et** compte non désactivé ;
   - si oui : `signInWithOtp({ email, shouldCreateUser: true })` ;
   - **réponse identique dans tous les cas**.
2. Hook Supabase **« before user created »** : refait `can_request_login`. Un appel direct à l'API Auth avec une adresse non autorisée échoue.
3. Code à 6 chiffres, expiration 10 min, usage unique, nombre d'essais limité (paramètres Supabase Auth). Les codes ne sont jamais stockés en clair (Supabase stocke une empreinte) ni écrits dans nos journaux.
4. Session : jeton d'accès court (1 h) + jeton de renouvellement à rotation, en cookies `httpOnly`, `Secure`, `SameSite=Lax`. Durée de session longue (renouvellement automatique) pour que la PWA reste connectée.
5. Première connexion : déclencheur `on auth.users insert` → création du profil (école, type, prénom, nom depuis la liste).

### 2.2. Perte d'accès

| Événement | Effet |
|---|---|
| Adresse retirée de la liste (import « remplacer » ou retrait manuel) | `profiles.status = 'unauthorized'`, sessions révoquées (`auth.admin.signOut(user, 'global')`), plus de code envoyé |
| Désactivation par le super-admin | `status = 'deactivated'`, sessions révoquées |
| Jeton encore valide après révocation (≤ 1 h) | Inutile : `current_school_id()` renvoie `null` pour un compte non actif, donc toutes les politiques RLS et fonctions refusent l'accès (testé, voir §6) |

### 2.3. Super-administrateur

- Créé par `npm run admin:create -- <email>` exécuté avec la clé service role (jamais depuis l'interface).
- Se connecte par code e-mail comme les autres, **plus un second facteur TOTP** (application d'authentification) obligatoire pour toutes les routes `/admin` et toutes les fonctions `admin_*` (vérification du niveau d'assurance `aal2` de Supabase).
- Peut être rattaché à une école pour tester, sans que cela lui donne de droits supplémentaires dans l'application étudiante.

---

## 3. Permissions des organisations

### 3.1. Catalogue

| Permission | Autorise | Organisations |
|---|---|---|
| `events.create` | Créer un événement au nom de l'organisation | Toutes |
| `events.edit` | Modifier les événements de l'organisation | Toutes |
| `events.cancel` | Annuler les événements de l'organisation | Toutes |
| `events.view_participants` | Voir la liste détaillée des inscrits (avec date d'inscription) dans l'espace de gestion | Toutes |
| `events.chat` | Écrire dans les conversations de ses événements sans y être inscrit, sous le profil de l'organisation | Toutes |
| `communications.send_all` | Envoyer une communication officielle à toute l'école | Toutes |
| `moderation.conversations` | Lire toutes les conversations de l'école, masquer un message | **École uniquement** |
| `moderation.reports` | Traiter les signalements | **École uniquement** |
| `moderation.suspend_chat` | Suspendre temporairement l'écriture d'un utilisateur | **École uniquement** |

La restriction « École uniquement » est imposée par un déclencheur en base, pas seulement par l'interface.

### 3.2. Profils types (préréglages dans le back-office)

| Profil | Permissions |
|---|---|
| Responsable d'association / BDE | `events.create`, `events.edit`, `events.cancel`, `events.view_participants`, `events.chat` |
| Membre d'association | `events.create`, `events.edit`, `events.chat` |
| Pédagogie / Direction | profil Responsable + `communications.send_all` |
| Modération École | `moderation.conversations`, `moderation.reports`, `moderation.suspend_chat` (+ `communications.send_all` si l'école le souhaite) |

Les préréglages ne font que cocher des cases : ce sont toujours les permissions individuelles qui sont stockées et vérifiées.

---

## 4. Matrice d'accès

✓ autorisé · — refusé · (O) via une permission d'organisation

| Action | Utilisateur | Membre d'organisation | Modérateur École | Super-admin |
|---|---|---|---|---|
| Voir les événements publiés de son école | ✓ | ✓ | ✓ | ✓ (toutes écoles) |
| Voir un brouillon | — | membres de l'organisation | — | ✓ |
| Voir un événement d'une autre école | — | — | — | ✓ |
| S'inscrire / se désinscrire | ✓ | ✓ | ✓ | — |
| Voir la liste des participants (nom, photo, bio) | ✓ | ✓ | ✓ | ✓ |
| Voir l'e-mail d'un autre utilisateur | — | — | — | via back-office |
| Lire / écrire une conversation | si inscrit | si inscrit ou (O) `events.chat` | lecture de toutes celles de l'école | — |
| Créer / modifier / annuler un événement | — | (O) | — | — |
| Envoyer une communication officielle | — | (O) | (O) | — |
| Signaler un message | si accès à la conversation | idem | idem | — |
| Masquer un message, traiter un signalement, suspendre | — | — | (O) | — |
| Gérer écoles, listes, organisations, permissions, comptes | — | — | — | ✓ (avec TOTP) |
| Lire le journal d'audit | — | — | — | ✓ |

Le super-admin n'a volontairement **pas** d'accès en lecture aux conversations depuis l'application : la modération appartient à l'école. En cas d'incident grave, l'accès se fait par une procédure documentée et journalisée (`docs/OPERATIONS.md`).

---

## 5. Mise en œuvre

### 5.1. Défense en profondeur

1. **Interface :** les actions non autorisées ne sont pas affichées.
2. **Serveur Next.js :** validation des entrées (Zod), vérification de session, appels aux fonctions SQL.
3. **Base :** RLS sur toutes les tables ; **aucun droit d'écriture direct** pour les rôles `anon` et `authenticated` ; toutes les écritures passent par des fonctions `SECURITY DEFINER` qui vérifient identité, école, statut et permissions, puis écrivent l'audit.
4. **Colonnes :** l'e-mail et les champs internes de `profiles` ne sont pas lisibles par les autres utilisateurs (privilèges par colonne) ; chacun lit son propre profil via `get_my_profile()`.

### 5.2. Fonctions d'autorisation

| Fonction | Renvoie |
|---|---|
| `current_school_id()` | L'école de l'utilisateur si son compte **et** l'école sont actifs, sinon `null` |
| `is_platform_admin()` | Présence dans `platform_admins` |
| `has_org_permission(org, perm)` | Permission détenue dans une organisation active de son école |
| `is_org_member(org)` | Appartenance à l'organisation |
| `is_school_moderator(school)` | Permission `moderation.conversations` dans l'organisation École de son école |
| `can_access_conversation(event)` | Inscrit, ou `events.chat` sur l'organisation propriétaire, ou modérateur de l'école |

### 5.3. Fichiers et images (Supabase Storage)

| Compartiment | Contenu | Accès |
|---|---|---|
| `avatars` | Photos de profil | Privé ; URL signées courtes générées côté serveur pour les membres de la même école |
| `event-images` | Images d'événements | Privé ; même principe |
| `org-logos` | Logos d'organisations | Privé ; même principe |

Chemins de la forme `<school_id>/<uuid>.<ext>`, politiques Storage basées sur `current_school_id()`. Formats acceptés : JPEG, PNG, WebP ; 5 Mo maximum ; ré-encodage côté serveur pour supprimer les métadonnées (EXIF, géolocalisation).

### 5.4. Protections web

- Contenu des messages affiché comme texte brut (échappement React, aucun HTML interprété), liens rendus non cliquables ou en `rel="noopener noreferrer nofollow"`.
- En-têtes : `Content-Security-Policy` stricte, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Server Actions Next.js (protection CSRF intégrée par vérification d'origine).
- Route `/api/jobs/dispatch` protégée par un secret partagé (comparaison à temps constant), refusant toute autre origine.
- Limitation de débit sur l'envoi de messages (30 par minute par utilisateur) et de signalements.
- Dépendances : `npm audit` en intégration continue, Dependabot sur le dépôt.

### 5.5. Secrets

| Secret | Emplacement |
|---|---|
| Clé service role Supabase | Variables d'environnement Vercel (production / préproduction), jamais préfixée `NEXT_PUBLIC_` |
| Clé privée VAPID | Variables d'environnement Vercel |
| Clé API et SMTP Brevo | Supabase (SMTP) et Vercel (API) |
| Secret du dispatcher | Vercel + Supabase Vault (lu par pg_cron) |

`.env*` est dans `.gitignore` ; un `.env.example` documente les variables sans valeur. Un contrôle (`gitleaks`) bloque tout secret dans les commits.

---

## 6. Vérification réalisée en Phase 1

Le brouillon de schéma (`docs/schema_draft.sql`) a été chargé sur PostgreSQL 16 avec une couche de compatibilité Supabase, puis testé avec des comptes fictifs sur deux campus partageant le domaine `ynov.com`.

| # | Vérification | Résultat |
|---|---|---|
| T1 | Permission de modération refusée hors organisation École | OK |
| T2 | Contrôle de connexion : normalisation, liste par campus, domaine | OK |
| T3 | Étudiant : ni brouillons ni événements d'un autre campus | OK |
| T4 | E-mails des autres utilisateurs illisibles | OK |
| T5 | Écriture directe dans les tables refusée | OK |
| T6 | Non-inscrit : envoi de message refusé | OK |
| T7 | Inscription à un événement d'un autre campus refusée | OK |
| T8 | Capacité respectée | OK |
| T9 | Non-inscrit : lecture des messages impossible | OK |
| T10 | Participants visibles par l'école | OK |
| T11–12 | Organisatrice : brouillon visible, message sous le profil BDE | OK |
| T13 | Modérateur École : lecture sans inscription | OK |
| T14 | Étudiante d'un autre campus : aucun message ni participant | OK |
| T15 | Compte désactivé : plus aucun accès malgré une session valide | OK |
| T16 | Compte désactivé : plus de code envoyé | OK |
| T17 | 20 inscriptions simultanées sur 3 places → 3 acceptées, 17 refusées, compteur exact | OK |

Ces scripts (`docs/phase1_checks/`) seront convertis en tests pgTAP exécutés à chaque migration à partir de la Phase 2.

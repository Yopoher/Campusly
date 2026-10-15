# Campusly — Modèle de données (Phase 1)

**Statut :** proposition à valider · **Référence :** `docs/PRODUCT_SPEC.md` v1.1, section 18
**SQL de référence :** `docs/schema_draft.sql` (brouillon validé sur PostgreSQL 16 ; il deviendra la première migration en Phase 2)

---

## 1. Conventions

- PostgreSQL (Supabase). Identifiants `uuid` (`gen_random_uuid()`), sauf tables à fort volume (`messages`, `audit_logs`, `analytics_events`) en `bigint` auto-incrémenté.
- Toutes les dates en `timestamptz` (stockées en UTC). Le fuseau de l'école sert uniquement à l'affichage et au calcul des rappels.
- **Chaque table liée à une école porte `school_id`**, même lorsqu'il pourrait être déduit d'une jointure. Cela rend les politiques RLS simples, rapides et vérifiables.
- Adresses e-mail stockées normalisées (minuscules, sans espaces), contrôlées par contrainte `CHECK`.
- Pas de suppression physique des données métier : statuts (`cancelled`, `removed`, `deactivated`, `hidden`). Les suppressions RGPD passent par une fonction d'anonymisation dédiée.
- `created_at` / `updated_at` sur toutes les tables modifiables, `updated_at` maintenu par déclencheur.

---

## 2. Schéma relationnel

```
schools ─┬─< school_domains
         ├─< allowed_emails >── import_batches
         ├─< profiles (= auth.users) ──< push_subscriptions
         │        │                  ──< notifications
         │        └──< organization_members >── organizations
         │                   └─< organization_member_permissions
         ├─< organizations ──< events ──< registrations >── profiles
         │                        ├──< messages ──< message_reports
         │                        └──< notifications
         ├─< communications ──< notifications
         ├─< analytics_events
         └─< audit_logs
platform_admins (hors école) · platform_settings · login_attempts · message_notification_state
```

---

## 3. Tables

### 3.1. Écoles

**`schools`** — `id`, `name`, `slug` (unique), `timezone` (défaut `Europe/Paris`), `status` (`active` | `disabled`), dates.

**`school_domains`** — `school_id`, `domain` ; clé primaire (`school_id`, `domain`). Un domaine **n'est pas unique** : `ynov.com` pourra être déclaré par plusieurs campus. Le rattachement se fait par la liste d'adresses.

### 3.2. Adresses autorisées

**`allowed_emails`** — `id`, `school_id`, `email`, `person_type` (`student` | `staff`), `first_name`, `last_name`, `external_id`, `cohort` (stocké pour un ciblage futur), `status` (`authorized` | `removed`), `import_batch_id`, `removed_at`, dates.
Contrainte : unique (`school_id`, `email`). Index sur `email` (recherche d'une adresse dans plusieurs écoles lors de l'import).

**`import_batches`** — `id`, `school_id`, `mode` (`upsert` | `replace`), `filename`, `stats` (jsonb : ajoutées, mises à jour, retirées, rejetées), `created_by`, `created_at`. Le fichier lui-même n'est pas conservé.

### 3.3. Comptes

**`profiles`** — clé = `auth.users.id`. `school_id`, `email` (unique), `person_type`, `first_name`, `last_name`, `avatar_path`, `bio` (≤ 280 caractères), `status` (`active` | `deactivated` | `unauthorized`), `chat_suspended_until`, `onboarding_completed_at`, préférences (`pref_push_enabled`, `pref_message_notifications`, `pref_email_reminders`), `anonymized_at`, dates.

- `school_id`, `email`, `person_type` et `status` ne sont **jamais modifiables par l'utilisateur** : les politiques RLS n'autorisent la mise à jour que de `first_name`, `last_name`, `avatar_path`, `bio` et des préférences (contrôle par colonne via une fonction `update_my_profile`).
- Le profil est créé par déclencheur à la création du compte Auth, à partir de `allowed_emails`.

**`platform_admins`** — `user_id`, `created_at`. Table sans aucune politique d'écriture : seule la commande d'installation (clé service role) peut y écrire. C'est ce qui empêche de « devenir admin » par une requête.

### 3.4. Organisations

**`organizations`** — `id`, `school_id`, `name`, `type` (`school` | `direction` | `pedagogy` | `bde` | `association` | `other`), `logo_path`, `description`, `status` (`active` | `disabled`), dates.
Index unique partiel : une seule organisation `school` par école (créée automatiquement avec l'école).

**`organization_members`** — `id`, `organization_id`, `user_id`, `school_id`, `added_by`, `updated_by`, dates. Unique (`organization_id`, `user_id`). Contrainte : l'utilisateur et l'organisation appartiennent à la même école.

**`organization_member_permissions`** — `member_id`, `permission`, `granted_by`, `granted_at`. Clé primaire (`member_id`, `permission`).
Type `org_permission` : `events.create`, `events.edit`, `events.cancel`, `events.view_participants`, `events.chat`, `communications.send_all`, `moderation.conversations`, `moderation.reports`, `moderation.suspend_chat`.
Un déclencheur refuse les permissions `moderation.*` hors d'une organisation de type `school`.

### 3.5. Événements et inscriptions

**`events`** — `id`, `school_id`, `organization_id`, `created_by`, `updated_by`, `title` (3–120), `description` (≤ 5 000), `starts_at`, `ends_at`, `location`, `image_path`, `capacity` (> 0 ou null), `registration_deadline`, `external_url` (https uniquement), `status` (`draft` | `published` | `cancelled`), `published_at`, `cancelled_at`, `cancellation_reason`, `participants_count`, dates.
- Contraintes : `ends_at > starts_at`, `registration_deadline <= starts_at`.
- « Terminé » est **calculé** (`now() > coalesce(ends_at, starts_at)`), pas stocké : pas de tâche à exécuter, pas d'incohérence possible.
- `participants_count` est un compteur dénormalisé, maintenu uniquement par les fonctions d'inscription, pour afficher le fil sans requête d'agrégat.

**`registrations`** — `id`, `event_id`, `user_id`, `school_id`, `status` (`registered` | `unregistered`), `registered_at`, `unregistered_at`, `chat_muted`.
Unique (`event_id`, `user_id`) : une ré-inscription réactive la même ligne.

### 3.6. Conversations et modération

**`messages`** — `id`, `event_id`, `school_id`, `author_id`, `organization_id` (renseigné si posté au nom de l'organisation), `body` (1–2 000 caractères), `moderation_status` (`visible` | `hidden`), `moderated_by`, `moderated_at`, `created_at`. Index (`event_id`, `id desc`) pour la pagination.
Un message masqué reste stocké pour l'audit ; les participants n'en voient que la mention « Message masqué par la modération » (vue `messages_feed`).

**`message_reports`** — `id`, `school_id`, `message_id`, `reporter_id`, `reason`, `status` (`pending` | `resolved` | `dismissed`), `handled_by`, `handled_at`, `created_at`. Unique (`message_id`, `reporter_id`).

### 3.7. Notifications

**`notifications`** — une ligne par destinataire et par notification.
`id`, `school_id`, `user_id`, `type` (`event_reminder_24h`, `event_reminder_1h`, `event_updated`, `event_cancelled`, `new_messages`, `communication`, `new_report`), `title`, `body`, `url`, `event_id`, `communication_id`, `scheduled_at`, `dedupe_key` (unique), `push_status`, `email_status` (`not_applicable` | `pending` | `sent` | `failed` | `skipped` | `cancelled`), `attempts`, `next_attempt_at`, `last_error`, `sent_at`, `read_at`, `opened_at`, `created_at`.
- Index partiel sur les lignes à traiter (`next_attempt_at` where statut `pending`).
- Exemple de `dedupe_key` : `reminder_24h:<event_id>:<user_id>:<starts_at>` — si l'horaire change, la clé change et l'ancien rappel est annulé.

**`push_subscriptions`** — `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `platform` (`ios` | `android` | `desktop` | `other`), `is_standalone`, `user_agent`, `status` (`active` | `invalid` | `revoked`), `last_success_at`, dates. Lisibles uniquement par leur propriétaire et le serveur.

**`message_notification_state`** — (`event_id`, `user_id`) → `last_notified_at`. Sert au regroupement des notifications de messages (une par tranche de 10 minutes).

### 3.8. Communications

**`communications`** — `id`, `school_id`, `organization_id`, `author_id`, `title`, `body`, `event_id` (facultatif), `target` (`school` uniquement dans le MVP), `recipients_count`, `created_at`. Les statistiques d'envoi se calculent depuis `notifications`.

### 3.9. Suivi, audit et réglages

**`analytics_events`** — `id`, `school_id`, `user_id`, `type` (`event_view`, `onboarding_shown`, `pwa_installed`, `push_granted`, `push_denied`, `notification_opened`, `session_start`), `platform`, `metadata` (jsonb court), `created_at`. Écriture uniquement via une fonction qui filtre les types autorisés.

**`audit_logs`** — `id`, `school_id`, `actor_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at`. Écriture uniquement par les fonctions SQL et le serveur ; lecture réservée aux super-admins. Jamais de code de connexion ni de secret.

**`platform_settings`** — `key`, `value` (jsonb) : limite hebdomadaire de communications par organisation (défaut 3), délais des rappels, durées de conservation.

**`login_attempts`** — `id`, `email_hash`, `ip_hash`, `created_at`. Limitation applicative des demandes de code (en plus de celle de Supabase Auth). Purge après 24 h.

---

## 4. Fonctions SQL métier (RPC)

Toutes en `SECURITY DEFINER` avec `search_path` fixé, vérifiant elles-mêmes l'identité (`auth.uid()`), l'école et les permissions, puis écrivant l'audit.

| Fonction | Rôle |
|---|---|
| `can_request_login(email)` | Domaine + adresse autorisée + compte actif (utilisée avant l'envoi du code et par le hook Auth) |
| `update_my_profile(...)` | Mise à jour des seuls champs autorisés |
| `create_event(...)`, `update_event(...)` | Création/modification au nom d'une organisation ; recalcul des rappels et notifications si horaire ou lieu changent |
| `publish_event(id)`, `cancel_event(id, reason)` | Changement de statut + notifications aux inscrits |
| `register_for_event(id)`, `unregister_from_event(id)` | Verrouillage de l'événement, capacité, compteur, rappels |
| `post_message(event_id, body, as_organization_id)` | Contrôle d'accès, suspension, regroupement des notifications |
| `report_message(id, reason)`, `moderate_message(id, action)`, `resolve_report(id, outcome)`, `suspend_chat(user_id, until)` | Modération |
| `send_communication(org_id, title, body, event_id)` | Contrôle de permission et de fréquence, création des notifications |
| `admin_*` | Opérations du back-office (écoles, organisations, membres, permissions, désactivation), réservées aux super-admins |
| `anonymize_user(user_id)` | Suppression RGPD : profil anonymisé, messages conservés sous « Utilisateur supprimé », abonnements et notifications supprimés |

---

## 5. Conservation (proposition, à valider avec l'école)

| Donnée | Durée proposée |
|---|---|
| Comptes actifs | Tant que l'adresse est autorisée |
| Comptes retirés de la liste | Anonymisés 12 mois après le retrait |
| Messages | 12 mois après la fin de l'événement, puis supprimés |
| Notifications | 90 jours |
| `analytics_events` | 13 mois |
| `audit_logs` | 3 ans |
| `login_attempts` | 24 heures |
| Sauvegardes | 7 jours (Supabase Pro) |

Les purges sont des tâches `pg_cron` quotidiennes.

# Campusly — Architecture technique (Phase 1)

**Statut :** proposition à valider · **Date :** 2026-10-15 · **Référence :** `docs/PRODUCT_SPEC.md` v1.1

---

## 1. Synthèse

| Brique | Choix recommandé | Rôle |
|---|---|---|
| Application | **Next.js 16 (App Router) + TypeScript** | Interface étudiant, espace de gestion, back-office, API serveur |
| Données | **Supabase (PostgreSQL), région UE (Paris si disponible à la création du projet, sinon Francfort)** | Base, authentification par code, temps réel, stockage des images, tâches planifiées |
| Sécurité des données | **RLS PostgreSQL** + contrôles dans les fonctions serveur | Isolation des écoles et permissions, appliquées par la base elle-même |
| E-mails | **Brevo** (SMTP pour les codes, API pour les e-mails de service) | Codes de connexion, rappels, modifications, annulations |
| Push | **Web Push standard (VAPID)**, librairie `web-push` | Notifications, sans fournisseur payant |
| Tâches planifiées | **pg_cron + pg_net** (dans Supabase) appelant une route sécurisée de l'application | Rappels, file d'envoi, nettoyage |
| Hébergement | **Vercel Pro**, fonctions en région Paris (`cdg1`) | Hébergement de l'application |
| Tests | **Vitest** (unitaires), **pgTAP** (RLS et fonctions SQL), **Playwright** (parcours) | Couverture du cahier des charges section 20 |

Trois fournisseurs au total (Supabase, Vercel, Brevo), plus le registrar du nom de domaine.

---

## 2. Vue d'ensemble

```
 Navigateur / PWA installée
 ├─ Pages Next.js (rendu serveur)          ──► Vercel (cdg1)
 ├─ Service worker (push, cache minimal)        │
 └─ Client Supabase (temps réel conversations)  │ Server Actions / Route Handlers
                │                               │ (validation Zod, contrôles métier)
                ▼                               ▼
        ┌─────────────────── Supabase (UE) ───────────────────┐
        │ Auth (code e-mail, sessions, MFA admin)              │
        │ PostgreSQL + RLS + fonctions SQL transactionnelles   │
        │ Realtime (messages, filtré par RLS)                  │
        │ Storage (avatars, logos, images d'événements)        │
        │ pg_cron ──► pg_net ──► POST /api/jobs/dispatch       │
        └──────────────────────────────────────────────────────┘
                │ SMTP (codes)            │ API (e-mails de service)
                ▼                         ▼
              Brevo ──────────────► Messageries @ynov.com
   Route /api/jobs/dispatch ──► Services push (Apple, Google, Mozilla)
```

### Principes structurants

1. **La base est la dernière ligne de défense.** Chaque table exposée a des politiques RLS. Même si une page oublie un contrôle, un étudiant ne peut pas lire les messages d'un événement auquel il n'est pas inscrit, ni les données d'une autre école.
2. **Les opérations sensibles passent par des fonctions SQL transactionnelles** (`register_for_event`, `publish_event`, `cancel_event`, `send_communication`…). Elles vérifient les permissions, verrouillent les lignes nécessaires et écrivent l'audit dans la même transaction. Cela règle les inscriptions simultanées et garantit qu'aucune action n'échappe au journal.
3. **La clé « service role » de Supabase n'est utilisée que côté serveur**, dans trois contextes limités : le dispatcher de notifications, l'import CSV et les scripts d'administration. Jamais dans le navigateur.
4. **Une seule base de code pour les trois espaces** (étudiant, gestion, super-admin), séparés par des groupes de routes et des contrôles d'accès, pas par des applications distinctes.
5. **Prêt pour le mobile natif :** la logique métier vit dans PostgreSQL (fonctions + RLS). Une future application Expo/React Native pourra utiliser le même client Supabase et les mêmes fonctions, sans dupliquer les règles.

---

## 3. Structure de l'application

```
campusly/
├─ app/
│  ├─ (auth)/            connexion, code, création de profil
│  ├─ (student)/         fil, événement, participants, conversation, notifications, profil, onboarding
│  ├─ gestion/           espace des organisations (sélecteur d'organisation, événements, communications, modération)
│  ├─ admin/             back-office super-admin (MFA obligatoire)
│  ├─ api/jobs/dispatch  route appelée par pg_cron (secret partagé)
│  ├─ api/push/…         abonnement / désabonnement push
│  └─ manifest.ts        manifeste PWA
├─ public/sw.js          service worker (push + clic sur notification)
├─ lib/                  clients Supabase, validation (Zod), notifications, e-mails, CSV
├─ supabase/
│  ├─ migrations/        schéma versionné
│  ├─ tests/             tests pgTAP (RLS, fonctions)
│  └─ seed.sql           données fictives (local / préproduction uniquement)
├─ scripts/              création du super-admin, génération des clés VAPID
├─ tests/                Vitest + Playwright
└─ docs/
```

---

## 4. Flux principaux

### 4.1. Connexion par code

1. L'utilisateur saisit son e-mail. Une Server Action normalise l'adresse et appelle la fonction SQL `can_request_login(email)` (domaine d'une école active + adresse autorisée + compte non désactivé).
2. Si c'est le cas, elle déclenche `signInWithOtp` de Supabase Auth, qui envoie un code à 6 chiffres via le SMTP Brevo. **Dans tous les cas**, la réponse affichée est identique (« Si ton adresse est autorisée, tu vas recevoir un code »), pour ne pas révéler la liste.
3. Un **hook Supabase « before user created »** refait le même contrôle côté Auth : impossible de créer un compte en contournant l'application.
4. L'utilisateur saisit le code, Supabase vérifie expiration et usage unique, puis ouvre une session (jeton court + jeton de renouvellement), conservée dans des cookies `httpOnly`.
5. À la première connexion, un déclencheur rattache le compte à l'école et pré-remplit le profil depuis la liste importée.

Limites : expiration du code à 10 min, limitation par adresse et par IP (paramètres Supabase Auth + compteur applicatif dans `login_attempts`).

### 4.2. Inscription à un événement

Appel à `register_for_event(event_id)` : verrouillage de la ligne de l'événement (`FOR UPDATE`), vérification école / statut / date limite / capacité, insertion ou réactivation de l'inscription, planification des rappels. Une seule transaction : deux étudiants qui cliquent en même temps sur la dernière place ne peuvent pas l'obtenir tous les deux.

### 4.3. Conversations en temps réel

Les messages sont insérés via `post_message` (vérifie accès, suspension, longueur). Les clients reçoivent les nouveaux messages par **Supabase Realtime (Postgres Changes)**, qui applique les politiques RLS : un abonnement à un événement non autorisé ne reçoit rien. Volume pilote très inférieur aux limites du service.

### 4.4. Notifications

```
Action métier (publication, inscription, modification, message…)
   └─► insertion dans `notifications` (une ligne par destinataire, avec date prévue et clé de déduplication)
pg_cron (chaque minute) ──► POST /api/jobs/dispatch (secret)
   └─► sélection des lignes dues  (FOR UPDATE SKIP LOCKED, par lots)
        ├─ push : envoi vers chaque abonnement actif ; 404/410 ⇒ abonnement désactivé
        ├─ e-mail : selon règles 12.4 du cahier des charges, via API Brevo
        └─ mise à jour du statut ; échec ⇒ nouvelle tentative avec délai croissant, 5 maximum
```

- Le **centre de notifications** lit simplement la table `notifications` : tout y figure, même si le push n'est pas parvenu.
- Les **rappels** sont recalculés à chaque modification d'horaire ; une annulation passe les rappels en attente au statut « annulé ».
- Les **messages** sont regroupés : au plus une notification par conversation et par personne toutes les 10 minutes.
- Le **fuseau de l'école** (`Europe/Paris`) est utilisé pour tous les affichages ; les dates sont stockées en `timestamptz` (UTC), ce qui neutralise les changements d'heure.

### 4.5. Onboarding PWA

Détection côté client de la plateforme et du mode d'affichage (`display-mode: standalone`, `navigator.standalone` sur iOS). Les étapes affichées et le résultat (installé, autorisé, refusé) sont enregistrés dans `analytics_events` pour les indicateurs.

---

## 5. Options comparées

### 5.1. Backend

| Option | Avantages | Limites | Verdict |
|---|---|---|---|
| **Supabase** | Postgres standard ; Auth OTP, RLS, Realtime, Storage, cron intégrés ; région UE ; migration possible (c'est du Postgres) | Dépendance à leurs services Auth/Realtime ; offre gratuite mise en pause après 7 jours d'inactivité | **Retenu** |
| Postgres géré (Neon, Scaleway) + Auth.js + Pusher/Ably | Plus de contrôle, hébergement possible en France | 3 à 4 services à assembler et sécuriser ; RLS moins naturel avec un ORM ; temps réel payant à part | Écarté : plus de travail et plus de surface d'erreur pour un pilote solo |
| Firebase | Push natif, temps réel mature | Base non relationnelle, RLS absent (règles Firestore), modèle multi-écoles et permissions plus fragile, dépendance forte | Écarté |

### 5.2. Hébergement de l'application

| Option | Avantages | Limites | Verdict |
|---|---|---|---|
| **Vercel Pro** | Intégration Next.js native, prévisualisations par branche (= préproduction), région Paris | Offre gratuite réservée à un usage non commercial : Pro requis pour le pilote | **Retenu** |
| Netlify / Render | Équivalents fonctionnels | Support Next.js moins direct | Alternative |
| Scaleway / OVH (conteneur) | Hébergeur français | Déploiement, certificats, mises à jour à gérer soi-même | Option si l'école exige un hébergeur français |

### 5.3. E-mails

| Option | Avantages | Limites | Verdict |
|---|---|---|---|
| **Brevo** | Société française, données en UE, SMTP + API, offre gratuite (300 e-mails/jour) | Logo Brevo sur l'offre gratuite ; 300/jour peut être juste lors d'une annulation d'un gros événement | **Retenu**, offre Starter si le volume l'exige |
| Resend | Très simple pour les développeurs | Société américaine | Alternative |
| SMTP intégré de Supabase | Aucun compte | Non prévu pour la production (débit très limité) | Développement uniquement |

### 5.4. Push

Web Push standard avec clés VAPID, envoyé depuis notre serveur via la librairie `web-push`. Pas de OneSignal ni Firebase Cloud Messaging : un fournisseur de plus, des données de plus chez un tiers, et aucun gain réel sur le web (sur iOS, les contraintes Apple s'appliquent de toute façon).

### 5.5. Tâches planifiées

`pg_cron` + `pg_net` dans Supabase appellent la route de dispatch chaque minute. Alternative écartée : les crons Vercel (fréquence limitée selon l'offre, et un second endroit où vit la planification).

---

## 6. Coûts récurrents estimés (pilote, 1 campus)

Tarifs publics relevés le 2026-10-15, à confirmer au moment de la souscription.

| Poste | Développement | Pilote en production |
|---|---|---|
| Supabase | Gratuit (projet de dev, pause après 7 j d'inactivité) | **Pro : 25 $/mois** (pas de pause, sauvegardes quotidiennes 7 jours, 8 Go de base, 100 000 utilisateurs actifs/mois inclus) |
| Vercel | Gratuit (Hobby) tant que non commercial | **Pro : 20 $/mois** (1 siège) |
| Brevo | Gratuit | Gratuit (300/jour) au départ ; offre Starter si besoin (prix à vérifier, quelques euros à une vingtaine d'euros/mois) |
| Nom de domaine | — | ~10 à 15 €/an |
| Web Push | Gratuit | Gratuit |
| **Total** | **0 €** | **≈ 45 à 70 €/mois** |

Non inclus : restauration à un instant précis (PITR) chez Supabase, environ 100 $/mois, **non recommandée** pour le pilote (sauvegardes quotidiennes + export hebdomadaire chiffré suffisent).

---

## 7. Environnements

| Environnement | Application | Base | E-mails |
|---|---|---|---|
| Local | `next dev` | PostgreSQL local (tests de schéma et RLS) **et** projet Supabase « campusly-dev » | Boîte de test Supabase / adresses de test |
| Préproduction | Prévisualisation Vercel (branche `staging`) | Projet Supabase « campusly-dev », données fictives | Brevo, adresses de test |
| Production | Vercel Pro, domaine définitif | Projet Supabase « campusly-prod » (Pro, UE) | Brevo, domaine d'envoi authentifié |

Contrainte observée dans l'environnement de développement actuel : les images Docker de Supabase ne sont pas téléchargeables. Les migrations et politiques RLS seront testées sur un PostgreSQL 16 local avec une couche de compatibilité (`auth.uid()`, rôles `anon` et `authenticated`), et les tests de bout en bout (Auth, Realtime, Storage) sur le projet Supabase de développement.

---

## 8. Limites connues et risques

| Risque | Impact | Mesure |
|---|---|---|
| Push iOS uniquement si l'application est installée | Une partie des étudiants ne recevra pas de push | Onboarding guidé, e-mail de secours, suivi du taux d'installation |
| E-mails de code filtrés par la messagerie Ynov | Connexion impossible | Domaine d'envoi dédié avec SPF/DKIM/DMARC, test manuel sur `yoann.poher@ynov.com` dès la Phase 3, demande de liste blanche à l'informatique Ynov si nécessaire |
| Session expirée dans la PWA iOS | Re-connexion fréquente, frustration | Jetons de renouvellement longue durée ; vérification sur iPhone réel |
| Quota Brevo gratuit dépassé lors d'une annulation massive | E-mails non envoyés | File d'attente avec reprise le lendemain + alerte ; passage à Starter si nécessaire |
| Dépendance à Supabase | Migration coûteuse | Postgres standard, logique en SQL versionné, Auth remplaçable |
| Modération insuffisante | Contenus problématiques non traités | Signalements, notification aux modérateurs, procédure d'incident documentée |
| Développement solo | Charge et maintenance | Périmètre allégé, tests automatisés, documentation |

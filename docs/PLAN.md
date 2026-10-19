# Campusly — Plan d'exécution (Phases 2 à 10)

**Statut :** proposition à valider · Phase 1 terminée le 2026-10-15

Chaque phase se termine par ses **critères de validation**. La phase suivante ne démarre que lorsqu'ils sont tous remplis et que les tests passent. La colonne « Besoin de toi » liste ce qui doit être fourni avant ou pendant la phase.

---

## Phase 2 — Initialisation ✅ terminée le 2026-10-15

**Contenu**

1. Projet Next.js 16 + TypeScript strict, ESLint, Prettier, structure de dossiers (`docs/ARCHITECTURE.md` §3).
2. Supabase CLI, première migration à partir du brouillon de la Phase 1, `seed.sql` de données fictives.
3. Tests : Vitest (unitaires et base de données), Playwright.
4. Système visuel : palette, typographie, composants de base (boutons, champs, cartes, états vides et erreurs), logo provisoire, icônes PWA.
5. Manifeste PWA et service worker minimal.
6. `.env.example`, `README.md`, `CLAUDE.md`, intégration continue (lint, types, tests, recherche de secrets).

**Critères de validation**

- `npm run dev` démarre ; `npm test` et les tests SQL passent en local.
- La migration s'applique sur une base vide sans erreur et les 17 contrôles de sécurité de la Phase 1 passent en tests automatisés.
- Une page de démonstration du système visuel est consultable (mobile et ordinateur).
- Aucun secret dans le dépôt (contrôle automatique).

**Besoin de toi :** un dépôt GitHub vide (privé) pour y pousser le code. Rien de payant.

---

## Phase 3 — Authentification, organisations et permissions

**Contenu**

1. Connexion par code e-mail (contrôle de liste, réponses neutres, limitation, hook « before user created »).
2. Création du profil à la première connexion, page profil, `update_my_profile`.
3. Commande de création du super-admin + TOTP.
4. Organisations, membres, permissions (fonctions `admin_*`), organisation École créée automatiquement avec l'école.
5. Domaine d'envoi Brevo (SPF, DKIM, DMARC) et SMTP branché sur Supabase Auth.
6. Import CSV minimal (mode ajout) pour pouvoir tester.

**Critères de validation**

- Tests 20.1 et 20.2 du cahier des charges automatisés et verts.
- **Test manuel : le code arrive dans la boîte de réception de `yoann.poher@ynov.com`.** Si non : action auprès de l'informatique Ynov avant de continuer.
- Un compte désactivé ou retiré perd l'accès immédiatement.

**Besoin de toi :** compte Supabase (projet de développement gratuit) ; compte Brevo ; nom de domaine acheté et accès DNS ; ton application d'authentification (TOTP) pour le compte super-admin.

**État au 2026-10-15 — code terminé, validation réelle en attente**

| Élément                                                           | État                                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Connexion par code (liste, réponses neutres, limitation, hook) | Fait, testé (base + parcours)                                                                                                                                 |
| 2. Profil à la première connexion, page profil                    | Fait, testé                                                                                                                                                   |
| 3. Invitation du super-admin + TOTP                               | Fait ; TOTP à valider sur le vrai projet                                                                                                                      |
| 4. Organisations, membres, permissions (`admin_*`)                | Fait, testé (interface : Phase 7)                                                                                                                             |
| 5. Domaine d'envoi Brevo et SMTP                                  | **En attente** : domaine `campusly.fr` et compte Brevo                                                                                                        |
| 6. Import minimal (mode ajout)                                    | Fait, testé (interface : Phase 7)                                                                                                                             |
| Déploiement sur le projet Supabase de dev                         | **Fait** le 2026-10-16 : migrations, données de démonstration, hook de création de compte, double authentification ; super-admin invité (`yopoher@gmail.com`) |
| E-mail de connexion en français avec le code                      | Prêt (`supabase/templates/`) ; **bloqué** : Supabase gratuit interdit de modifier les e-mails sans SMTP personnalisé, donc sans Brevo                         |
| Test manuel `yoann.poher@ynov.com`                                | **En attente** de Brevo (l'envoi par défaut de Supabase ne livre qu'aux membres de l'équipe du projet)                                                        |

---

## Phase 4 — Événements

**État au 2026-10-19 :** fil, fiche, inscriptions, gestion et images livrés (branche `event-images`, en attente de fusion). Restent : images dans les cartes du fil, ajout d'image à la création.

**Contenu**

1. Fil (onglets À venir, Mes événements, Passés), carte d'événement, détail, profil d'organisation.
2. Espace de gestion : sélecteur d'organisation, tableau de bord, formulaire de création et de modification, brouillon et publication, annulation.
3. Inscription / désinscription (fonctions transactionnelles), liste des participants avec mention de visibilité.
4. Images (Storage privé, URL signées, ré-encodage).

**Critères de validation**

- Tests 20.3 automatisés et verts, dont inscriptions simultanées.
- Parcours Playwright : un membre du BDE publie, un étudiant découvre et s'inscrit, sur écran mobile et ordinateur.

**Besoin de toi :** rien (données fictives).

---

## Phase 5 — Conversations et modération

**Contenu**

1. Conversation par événement : affichage, pagination, envoi, états d'erreur, temps réel.
2. Messages sous le profil de l'organisation, bandeau d'information sur la modération.
3. Signalement, espace de modération de l'organisation École (lecture, masquage, traitement, suspension).

**Critères de validation**

- Tests 20.4 automatisés et verts.
- Deux navigateurs côte à côte : un message apparaît chez l'autre sans rechargement.

**Besoin de toi :** rien.

---

## Phase 6 — Notifications, onboarding et communications

**Contenu**

1. Onboarding : détection iOS/Android/ordinateur et mode installé, guide d'ajout à l'écran d'accueil, demande d'autorisation contextualisée, suivi.
2. Abonnements push (clés VAPID), service worker complet (affichage, clic → ouverture de la bonne page).
3. File de notifications + dispatcher (pg_cron chaque minute), reprises limitées, désactivation des abonnements invalides.
4. Rappels 24 h et 1 h, recalcul et annulation ; modifications et annulations ; messages regroupés ; signalements.
5. E-mails de service via l'API Brevo selon les règles 12.4.
6. Centre de notifications et préférences.
7. Communications officielles à toute l'école, limite de fréquence, historique.
8. `docs/NOTIFICATIONS.md` : comportement réel constaté par plateforme.

**Critères de validation**

- Tests 20.5 et 20.6 automatisés et verts (horloge simulée pour les rappels).
- **Tests manuels sur appareils réels :** iPhone application installée (push reçu), iPhone dans Safari (e-mail de secours reçu à la place), Android, ordinateur.

**Besoin de toi :** un iPhone et, si possible, un téléphone Android pour les tests manuels (je te donnerai le pas-à-pas).

---

## Phase 7 — Back-office minimal

**Contenu**

1. Écoles et domaines.
2. Import CSV complet : ajout et remplacement, résumé avant confirmation, détection des doublons, des domaines invalides et des adresses présentes dans plusieurs écoles.
3. Organisations, membres, préréglages de permissions.
4. Utilisateurs : recherche, désactivation, révocation de sessions, anonymisation (RGPD).
5. Journal d'audit filtrable, paramètres, `docs/ANALYTICS.md` + page d'indicateurs simple.

**Critères de validation**

- Tests 20.7 automatisés et verts.
- Tu peux, seul, créer une école, importer un CSV fictif, créer le BDE et y ajouter un membre, sans toucher à la base.

**Besoin de toi :** un exemple du format de fichier que Ynov pourra fournir (même avec de fausses adresses), pour caler l'import.

---

## Phase 8 — Tests et stabilisation

Revue complète des parcours, accessibilité (contrastes, clavier, lecteurs d'écran sur les écrans clés), performances (fil et conversation sur réseau mobile lent), test de restauration d'une sauvegarde, correction des défauts.

**Critère de validation :** `docs/TEST_PLAN.md` à jour avec les résultats et les limites restantes.

---

## Phase 9 — Déploiement

Projet Supabase de production (Pro, UE), Vercel Pro, domaine et HTTPS, Brevo en production, variables d'environnement, pg_cron, sauvegardes et export hebdomadaire, création du super-admin, test complet en production.

**Critère de validation :** parcours complet réussi en production avec des comptes de test, `docs/DEPLOYMENT.md` et `docs/OPERATIONS.md` à jour.

**Besoin de toi :** validation de la dépense (≈ 45 à 70 €/mois) et passage des comptes Supabase et Vercel en offre payante.

---

## Phase 10 — Lancement à Ynov Campus Rouen

1. Vérifier la signature du contrat de sous-traitance et l'accord de l'école.
2. Créer l'école « Ynov Campus Rouen » (`ynov.com`, `Europe/Paris`) et ses organisations.
3. Importer la liste réelle (étudiants et personnel).
4. Ajouter les membres des organisations, publier les premiers événements réels.
5. Vérifier le parcours sur plusieurs appareils, dont la réception des codes et des notifications.
6. Guides : prise en main pour les organisations, installation pour les étudiants (une page, avec captures).
7. Procédure de signalement d'incident.
8. Validation du lancement avec le responsable du campus.

**Besoin de toi :** DPA signé, fichier CSV réel, liste des organisations et de leurs responsables, logos.

---

## Ordre de grandeur

Les phases 2 à 7 constituent l'essentiel du développement. Je les enchaîne sans attendre de validation entre elles tant que les critères sont remplis et qu'aucune dépense ni décision de périmètre n'est en jeu ; je m'arrête en revanche à chaque fois que j'ai besoin d'un compte, d'un accès ou d'un test sur ton téléphone.

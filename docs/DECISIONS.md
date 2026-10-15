# Campusly — Décisions à valider et accès à fournir

**Date :** 2026-10-15 · Fin de Phase 1

---

## 1. Décisions qui demandent ta validation

Chaque ligne indique ma recommandation. Sans réponse contraire, je pars sur la recommandation pour la Phase 2, qui n'engage aucune dépense.

| # | Décision | Recommandation | Pourquoi ça compte |
|---|---|---|---|
| D1 | Stack technique | **Next.js + Supabase + Vercel + Brevo** (`docs/ARCHITECTURE.md`) | Détermine tout le développement |
| D2 | Coût en production | **≈ 45 à 70 €/mois** à partir du lancement (Supabase Pro 25 $, Vercel Pro 20 $, Brevo gratuit au départ, domaine). Gratuit pendant le développement | Engagement financier : je ne souscris rien sans ton feu vert (Phase 9) |
| D3 | Hébergement des données | Supabase en **région UE (Paris, sinon Francfort)** ; application chez Vercel en région Paris | Vercel et Supabase sont des sociétés américaines : à mentionner dans la liste des sous-traitants. Si Ynov exige un hébergeur français, l'application peut aller chez Scaleway (plus de travail d'exploitation) |
| D4 | Nom de domaine | À toi de choisir et d'acheter (ex. `campusly.fr`, `campusly.app`) | Sert à l'application **et** à l'adresse d'envoi des codes ; nécessaire dès la Phase 3 |
| D5 | Photos et images | **Privées**, accessibles uniquement aux membres de l'école via des liens temporaires | Une photo de profil ne doit pas être accessible publiquement par son adresse |
| D6 | E-mails de modification et d'annulation | **Non désactivables** tant que l'étudiant est inscrit (seuls les e-mails de rappel le sont) | Informations de service liées à une inscription |
| D7 | Accès du super-admin aux conversations | **Aucun depuis l'application** ; procédure exceptionnelle journalisée en cas d'incident | Cohérent avec « la modération appartient à l'école » et rassurant pour les étudiants |
| D8 | Conversation d'un événement annulé | **Lecture seule** pour les inscrits | Évite une conversation qui continue sans objet |
| D9 | Limite de communications officielles | **3 par organisation et par semaine**, modifiable | Évite la lassitude, qui ferait désactiver les notifications |
| D10 | Durées de conservation | Proposition dans `docs/DATABASE.md` §5 (messages 12 mois après l'événement, comptes retirés anonymisés après 12 mois, audit 3 ans…) | À valider aussi avec Ynov, dans le contrat de sous-traitance |
| D11 | Second facteur pour le super-admin | **Obligatoire** (application d'authentification type Google Authenticator) | Ton compte peut tout faire : il doit être le mieux protégé |

---

## 2. Comptes et accès à fournir

| Quand | Quoi | Coût | Ce que tu me transmets |
|---|---|---|---|
| **Phase 2 (maintenant)** | Dépôt GitHub privé vide (ex. `campusly`) | Gratuit | Le nom du dépôt ; je m'y connecte depuis ici |
| Phase 3 | Compte Supabase + projet `campusly-dev` (région UE) | Gratuit | URL du projet, clé `anon`, clé `service_role` (je t'indiquerai où les trouver et comment me les transmettre sans les écrire en clair dans le chat) |
| Phase 3 | Compte Brevo | Gratuit | Clé API et identifiants SMTP |
| Phase 3 | Nom de domaine + accès à sa zone DNS | ~10–15 €/an | Accès au registrar, ou ajout des enregistrements DNS que je te donnerai |
| Phase 6 | Un iPhone et si possible un Android pour tester | — | Ton temps pour quelques tests guidés |
| Phase 9 | Compte Vercel, passage Supabase et Vercel en offre payante | ≈ 45 $/mois | Validation explicite de la dépense |

## 3. À obtenir de Ynov Campus Rouen (en parallèle)

| Élément | Nécessaire pour |
|---|---|
| Accord formel pour la transmission des adresses + contrat de sous-traitance (DPA) | Tout import de données réelles (Phase 10) |
| Exemple du format de fichier qu'ils peuvent extraire (colonnes, même avec de fausses données) | Caler l'import CSV (Phase 7) |
| Contact du service informatique | Liste blanche du domaine d'envoi si les codes sont filtrés (Phase 3) |
| Liste des organisations, responsables et logos | Mise en place des organisations (Phase 10) |
| Confirmation de l'acceptation d'un hébergement Supabase/Vercel en UE | Décision D3 |

---

## 4. Points d'attention relevés pendant l'analyse

- **Environnement de développement :** les images Docker de Supabase ne sont pas téléchargeables depuis cet espace de travail. Les migrations et la sécurité sont testées sur un PostgreSQL 16 local ; l'authentification, le temps réel et le stockage seront testés sur le projet Supabase de développement (d'où le besoin d'un compte dès la Phase 3).
- **Persistance du code :** cet espace de travail n'est pas un stockage durable. Le dépôt GitHub est nécessaire avant d'aller plus loin que la Phase 2.
- **Quota Brevo gratuit (300 e-mails/jour) :** suffisant au démarrage, mais l'annulation d'un événement de plus de 300 inscrits dépasserait le quota du jour. Les envois en attente reprennent automatiquement ; passage à l'offre Starter si cela arrive.

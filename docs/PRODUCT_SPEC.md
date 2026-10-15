# CAMPUSLY — Cahier des charges fonctionnel et technique

## MVP — Plateforme de communication et de vie étudiante

**Version :** 1.1
**Statut :** Document de référence pour la conception, le développement, les tests et le déploiement
**Outil de développement :** Claude Code
**Périmètre initial :** Une école pilote : Ynov Campus Rouen
**Langue de l'application :** Français
**Nom du produit :** Campusly

---

# 0. Décisions actées en version 1.1

Cette section résume les arbitrages intégrés dans le reste du document. En cas de doute, elle fait foi.

1. **Notifications sur iPhone.** Le web push n'étant reçu sur iOS que si Campusly est ajouté à l'écran d'accueil (PWA, iOS 16.4 et plus), le MVP inclut un parcours d'onboarding guidant l'installation, et le taux d'installation est suivi comme indicateur.
2. **Canal de secours par e-mail.** Les rappels, modifications et annulations d'événements sont aussi envoyés par e-mail selon les règles de la section 12.4.
3. **Un seul compte utilisateur par personne.** Il n'existe plus de « compte professionnel » distinct. Tout utilisateur (étudiant ou personnel) a un compte unique. Les droits de création et de gestion sont portés par des **Organisations** (BDE, associations, pédagogie, direction, école) dont l'utilisateur est membre.
4. **Publication sous le profil de l'organisation.** Un membre habilité publie un événement avec son propre compte, mais l'événement apparaît sous le profil de l'organisation (nom, photo, description). L'auteur réel est enregistré pour l'audit.
5. **Le personnel est dans le même fichier d'import** que les étudiants, avec une colonne indiquant le type (étudiant ou personnel). Tout le monde se connecte par code e-mail.
6. **Adresses e-mail.** Chaque école utilise un domaine propre. Pour le pilote : `prénom.nom@ynov.com`. Le domaine sert de contrôle supplémentaire, mais l'autorisation reste fondée sur la liste importée (voir 5.4).
   7 bis. **Périmètre du pilote : Ynov Campus Rouen uniquement.** Dans Campusly, l'« école » pilote correspond à ce campus. Seules les adresses de la liste fournie par le campus de Rouen sont autorisées, même si d'autres campus Ynov utilisent le même domaine.
7. **Liste des participants visible par toute l'école.** L'adresse e-mail n'est jamais affichée. Les étudiants en sont informés dans la politique de confidentialité et lors de l'inscription.
8. **Modération.** L'organisation de type « École » de chaque établissement modère : ses membres habilités peuvent lire toutes les conversations de l'école, même sans être inscrits, et traitent les signalements. Les étudiants en sont informés.
9. **Cadre RGPD.** Campusly est considéré a priori comme sous-traitant de l'école. Un contrat de sous-traitance (DPA) et l'accord formel de l'école pour transmettre la liste des adresses doivent être signés avant tout import de données réelles.
10. **Périmètre allégé pour le pilote :**
    - back-office super-administrateur minimal ;
    - ciblage par groupes reporté : les communications visent toute l'école ;
    - indicateurs calculés par requêtes SQL documentées, sans tableau de bord dédié ;
    - le « taux de participation » est retiré des indicateurs.
11. **Ce qui ne change pas :** architecture multi-écoles, isolation des données entre écoles, contrôles d'autorisation côté serveur, sécurité et tests. Seules les interfaces sont allégées.

---

# 1. Présentation du projet

## 1.1. Le constat

Dans les établissements d'enseignement supérieur, de nombreuses informations importantes sont communiquées aux étudiants, mais elles ne sont pas toujours consultées.

Les écoles utilisent plusieurs canaux : e-mails, affiches, intranets, plateformes pédagogiques et réseaux sociaux. Les étudiants ne consultent pas systématiquement ces canaux et peuvent manquer des événements, des informations importantes ou des occasions de participer à la vie de leur établissement.

La pédagogie rencontre également des difficultés à promouvoir les événements qu'elle organise : job datings, conférences, rencontres professionnelles, événements de rentrée.

Les BDE et les associations étudiantes utilisent leurs propres réseaux, sans canal centralisé leur permettant de toucher les étudiants de leur école.

Il en résulte une communication dispersée et une participation potentiellement plus faible à la vie étudiante.

## 1.2. La solution

Campusly est une plateforme numérique privée destinée à centraliser les sorties et les événements d'une école, à faciliter les inscriptions et à permettre aux participants d'échanger.

La plateforme doit permettre :

- Aux étudiants de découvrir les événements organisés dans leur établissement.
- Aux étudiants de rejoindre des événements et de consulter les autres participants.
- Aux participants de discuter dans une conversation collective associée à chaque événement.
- Aux organisations de l'école (pédagogie, direction, BDE, associations) de créer et gérer des événements, via leurs membres habilités.
- Aux organisations autorisées d'envoyer des communications à toute l'école.
- À l'école de modérer les conversations.
- Au super-administrateur de gérer les écoles, les organisations et les paramètres de la plateforme.

Campusly ne doit pas devenir, dans son MVP, un réseau social généraliste. Le produit se concentre sur la vie de l'école et la participation aux événements.

## 1.3. Objectif principal

Développer et déployer une première version fonctionnelle dans une école pilote, afin de tester si la centralisation des événements et les notifications facilitent l'accès à l'information et encouragent les étudiants à participer à la vie de leur établissement.

## 1.4. Indicateurs de réussite

Le produit doit permettre de mesurer :

- Le nombre d'étudiants ayant activé leur compte.
- Le nombre d'étudiants actifs chaque semaine.
- Le nombre de consultations des événements.
- Le taux d'inscription aux événements.
- Le nombre de conversations actives et de messages échangés.
- Le taux d'installation de l'application sur l'écran d'accueil (PWA), par système (iOS, Android, ordinateur).
- Le taux d'activation des notifications push.
- Le taux de clic des notifications et des e-mails, lorsque ces données sont techniquement disponibles.
- La rétention des étudiants à 7 et 30 jours.

Pour le pilote, ces indicateurs sont calculés par des requêtes SQL documentées dans `docs/ANALYTICS.md`, exécutables par le super-administrateur. Aucun tableau de bord analytique dédié n'est développé. Le modèle de données doit simplement enregistrer les événements nécessaires (consultations, installations, ouvertures de notifications).

---

# 2. Périmètre du MVP

## 2.1. Fonctionnalités incluses

1. Une application web responsive, installable comme PWA.
2. Un parcours d'onboarding guidant l'installation sur l'écran d'accueil et l'activation des notifications.
3. Une authentification par code reçu par e-mail, identique pour tous les utilisateurs.
4. Une gestion des adresses e-mail autorisées par école (étudiants et personnel), avec contrôle de domaine.
5. La création et la gestion des profils utilisateurs.
6. Des Organisations (École, BDE, associations, pédagogie, direction) avec membres et permissions.
7. Un fil chronologique des événements.
8. La consultation détaillée des événements.
9. L'inscription et la désinscription aux événements.
10. L'affichage de la liste des participants.
11. Une conversation collective par événement.
12. La modération des conversations par l'organisation École.
13. Des notifications push web et un centre de notifications dans l'application.
14. Un canal de secours par e-mail pour les rappels, modifications et annulations.
15. Des communications officielles envoyées à toute l'école.
16. Un espace de gestion pour les membres d'organisations.
17. Un back-office super-administrateur minimal.
18. L'import des adresses autorisées par fichier CSV.
19. Un journal d'audit des actions sensibles.
20. Un déploiement en production avec une base de données persistante et des sauvegardes.
21. Une documentation technique permettant de maintenir et de faire évoluer le produit.

## 2.2. Fonctionnalités exclues du MVP

Ne pas développer pour le moment :

- Une application native iOS ou Android publiée sur les stores.
- Un réseau social avec fil de publications libres.
- La création d'événements par des utilisateurs qui ne sont pas membres habilités d'une organisation.
- Une messagerie privée entre deux utilisateurs.
- Des groupes de discussion indépendants des événements.
- Des catégories et filtres avancés dans le fil.
- Le ciblage des communications par groupes, classes ou promotions (reporté ; le modèle de données peut le prévoir, sans interface).
- Un tableau de bord analytique.
- Des paiements ou une billetterie.
- Des recommandations personnalisées.
- Une intégration avec les ENT, Teams, Discord ou d'autres services.
- La gamification.
- Le pointage de présence, y compris un bouton « j'y étais ».
- Une liste d'attente pour les événements complets.

Ne pas ajouter ces fonctionnalités sans validation explicite.

---

# 3. Comptes, organisations et permissions

Le système repose sur une gestion des rôles et des permissions **côté serveur**. Aucune permission ne doit dépendre d'une donnée modifiable par le navigateur.

## 3.1. Principe général

- **Chaque personne possède un seul compte utilisateur**, rattaché à une école.
- Un utilisateur a un **type** issu de la liste d'import : `étudiant` ou `personnel`. Ce type est informatif et sert au ciblage futur ; il ne donne aucun droit de gestion à lui seul.
- Les droits de création, de gestion, de communication et de modération sont portés par l'**appartenance à une Organisation**, avec des permissions attribuées à chaque membre.
- Un même utilisateur peut être membre de plusieurs organisations (par exemple : membre du BDE et d'une association sportive).
- Un membre d'organisation reste un utilisateur ordinaire pour tout le reste : il peut rejoindre les événements des autres organisations, discuter dans leurs conversations, recevoir les notifications.

Exemple : le président du BDE se connecte avec son compte. Il rejoint la soirée de l'association théâtre comme n'importe quel étudiant. Depuis son espace de gestion, il bascule sur le profil « BDE » et publie la soirée d'intégration, qui apparaît dans le fil sous le nom et la photo du BDE.

## 3.2. Organisations

Une organisation appartient à une école et possède un profil public :

- Nom.
- Type : `école`, `direction`, `pédagogie`, `BDE`, `association`, `autre service`.
- Photo ou logo.
- Courte description.
- Statut (active ou désactivée).

Chaque école dispose d'**une organisation de type `école`**, créée automatiquement avec l'école. Elle porte les droits de modération et de communication officielle (voir 3.4 et section 11.4).

Les événements appartiennent à une organisation, pas à une personne. Quand le bureau d'une association change, le super-administrateur retire les anciens membres et ajoute les nouveaux : les événements, conversations et historiques restent attachés à l'organisation.

## 3.3. Utilisateur (sans appartenance à une organisation)

Un utilisateur peut :

- Se connecter avec une adresse e-mail autorisée.
- Compléter et modifier son profil.
- Installer l'application et gérer ses notifications.
- Consulter les événements publiés de son école et leur détail.
- Voir les participants d'un événement.
- Rejoindre et quitter un événement.
- Accéder à la conversation des événements auxquels il est inscrit, lire et envoyer des messages.
- Signaler un message.
- Consulter son centre de notifications.
- Consulter les informations de son compte et demander sa suppression.

Un utilisateur ne peut pas :

- Créer, modifier ou annuler un événement.
- Envoyer des communications officielles.
- Consulter les données d'autres écoles.
- Accéder à une conversation sans y être inscrit.
- Modifier ses propres permissions ou ses appartenances à des organisations.

## 3.4. Membre d'organisation

Les membres sont ajoutés à une organisation par le super-administrateur. Chaque appartenance porte un ensemble de permissions explicites. Nomenclature indicative (Claude peut l'adapter en conservant le principe d'une autorisation par action) :

| Permission                 | Effet                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `events.create`            | Créer un événement au nom de l'organisation                                                                            |
| `events.edit`              | Modifier les événements de l'organisation                                                                              |
| `events.cancel`            | Annuler les événements de l'organisation                                                                               |
| `events.view_participants` | Voir la liste détaillée des inscrits dans l'espace de gestion                                                          |
| `events.chat`              | Participer à la conversation des événements de l'organisation sans y être inscrit                                      |
| `communications.send_all`  | Envoyer une communication officielle à toute l'école                                                                   |
| `moderation.conversations` | Lire toutes les conversations de l'école et masquer des messages (réservé à l'organisation École)                      |
| `moderation.reports`       | Traiter les signalements (réservé à l'organisation École)                                                              |
| `moderation.suspend_chat`  | Suspendre temporairement la capacité d'un utilisateur à écrire dans les conversations (réservé à l'organisation École) |

Les permissions d'une appartenance ne s'appliquent qu'à l'organisation concernée. Un membre du BDE avec `events.edit` ne peut pas modifier un événement de l'association théâtre.

Les permissions `moderation.*` ne peuvent être attribuées qu'au sein d'une organisation de type `école`.

## 3.5. Super-administrateur

Le super-administrateur est le compte central de gestion de Campusly (le propriétaire du produit).

Il peut :

- Créer, modifier, activer et désactiver les écoles.
- Importer et remplacer les listes d'adresses autorisées.
- Créer, modifier et désactiver les organisations.
- Ajouter ou retirer des membres et leurs permissions.
- Désactiver ou réactiver un compte utilisateur.
- Révoquer les sessions d'un utilisateur.
- Consulter le journal d'audit.
- Exécuter les requêtes d'indicateurs.
- Gérer les demandes de suppression et les incidents de sécurité.

Le super-administrateur dispose d'un accès distinct de l'inscription des écoles. Le statut de super-administrateur est stocké de façon à ne pas pouvoir être obtenu par une requête HTTP ou une donnée envoyée par le navigateur.

Le compte initial est créé par une commande sécurisée lors de l'installation. Aucun mot de passe ou identifiant administrateur fixe dans le code source. L'accès super-administrateur doit être protégé par un second facteur si la technologie retenue le permet simplement.

---

# 4. Gestion des écoles

Même si le premier déploiement concerne une seule école, l'architecture doit permettre d'en ajouter d'autres sans reconstruire l'application.

Chaque école dispose de son propre espace logique. Toute donnée liée à une école (utilisateurs, adresses autorisées, organisations, événements, inscriptions, conversations, messages, communications, notifications, signalements) est rattachée à un identifiant d'école.

Une école possède :

- Un nom.
- Un ou plusieurs domaines e-mail autorisés (par exemple `ynov.com`).
- Un fuseau horaire (par défaut `Europe/Paris`).
- Un statut.
- Son organisation de type `école`, créée automatiquement.

Les requêtes vérifient les autorisations et l'appartenance à l'école côté serveur.

L'isolation entre écoles doit être testée explicitement. Un utilisateur d'une école ne doit jamais pouvoir consulter les événements, messages ou participants d'une autre école en modifiant un identifiant dans l'URL ou dans une requête.

---

# 5. Authentification et inscription

## 5.1. Principe

Tous les utilisateurs (étudiants et personnel) se connectent de la même façon, par un code envoyé par e-mail.

1. L'utilisateur ouvre Campusly.
2. Il saisit son adresse e-mail.
3. Le serveur vérifie que le domaine correspond à une école active et que l'adresse figure dans la liste autorisée de cette école.
4. Si c'est le cas, un code temporaire est envoyé par e-mail.
5. L'utilisateur saisit le code.
6. Le serveur vérifie sa validité, son expiration et son usage unique.
7. À la première connexion, l'utilisateur crée son profil (prénom, nom pré-remplis si disponibles dans l'import, photo et présentation facultatives).
8. Le compte est créé ou activé.
9. L'utilisateur passe par l'onboarding (section 12.2), puis accède au fil des événements de son école.

L'utilisateur reste connecté sur son appareil (session longue et renouvelée) afin de ne pas devoir recommencer à chaque visite, ce qui est particulièrement important pour la PWA installée.

## 5.2. Règles de sécurité

- Une adresse absente de la liste autorisée ne peut pas obtenir de compte.
- Le code expire après une durée limitée (10 minutes recommandé).
- Un code ne peut être utilisé qu'une seule fois.
- Les tentatives de vérification et les demandes d'envoi de code sont limitées par adresse et par IP.
- Les codes ne sont jamais stockés en clair.
- La seule saisie d'une adresse e-mail n'est jamais une preuve d'identité.
- La liste des adresses autorisées n'est jamais exposée.
- Les messages d'erreur ne révèlent pas si une adresse figure dans la base.
- Aucun doublon de compte pour une même adresse normalisée.
- Une adresse retirée de la liste ou un compte désactivé ne peut plus se connecter, et ses sessions existantes sont révoquées.

## 5.3. Profil utilisateur

Le profil contient au minimum :

- Prénom, nom.
- École.
- Type (étudiant ou personnel), issu de l'import.
- Adresse e-mail vérifiée.
- Date de création, statut.
- Préférences de notifications.
- Photo et courte présentation, facultatives.

Champs visibles par les autres utilisateurs de l'école : photo, prénom, nom, courte présentation. L'adresse e-mail n'est jamais affichée aux autres utilisateurs.

## 5.4. Contrôle de domaine et cas Ynov

Chaque école déclare son ou ses domaines. Une adresse dont le domaine ne correspond à aucune école active est refusée avant toute autre vérification.

**Point d'attention pour le pilote :** le domaine `ynov.com` est partagé par tous les campus Ynov. Le domaine seul ne suffit donc pas à rattacher un étudiant au bon campus. L'autorisation repose sur la liste importée, et l'« école » au sens de Campusly correspond au périmètre de cette liste (par exemple un campus). Un même domaine peut être déclaré par plusieurs écoles ; dans ce cas, c'est la présence de l'adresse dans la liste d'une école qui détermine le rattachement. Une adresse présente dans les listes de deux écoles est signalée comme anomalie lors de l'import.

Pour le pilote, l'école créée dans Campusly est **Ynov Campus Rouen**, avec le domaine `ynov.com` et le fuseau `Europe/Paris`. Un étudiant d'un autre campus Ynov, bien qu'ayant une adresse `@ynov.com`, ne peut pas se connecter tant que son adresse ne figure pas dans la liste du campus de Rouen.

## 5.5. Délivrabilité des e-mails

Les messageries d'école (souvent Microsoft 365 ou Google Workspace) filtrent fréquemment les e-mails transactionnels. Prévoir dès la phase 3 :

- un domaine d'envoi dédié, avec SPF, DKIM et DMARC configurés ;
- un test réel d'envoi de code vers l'adresse du propriétaire, `yoann.poher@ynov.com`, avant toute ouverture aux étudiants. Ce test est manuel : vérifier que le code arrive et dans quel dossier (réception ou indésirables). Cette adresse n'est jamais utilisée dans les tests automatisés ;
- une mention sur l'écran de saisie du code invitant à vérifier les courriers indésirables ;
- si nécessaire, une demande à l'informatique de l'école de mettre le domaine d'envoi en liste autorisée.

---

# 6. Import des adresses autorisées

Le super-administrateur importe la liste des personnes autorisées d'une école à partir d'un fichier CSV. Le fichier contient les étudiants et le personnel.

## 6.1. Fonctionnement

1. Sélection de l'école.
2. Téléversement du fichier CSV.
3. Lecture et validation du fichier.
4. Vérification des colonnes obligatoires.
5. Normalisation des adresses (minuscules, espaces retirés).
6. Vérification que le domaine correspond à l'école.
7. Détection des doublons et des lignes invalides.
8. Résumé avant validation.
9. Confirmation.
10. Résultat : lignes importées, mises à jour, doublons, erreurs, adresses rejetées.

L'import doit gérer les fichiers comportant des lignes incorrectes sans échouer en totalité.

## 6.2. Format

| Colonne       | Statut      | Remarque                                             |
| ------------- | ----------- | ---------------------------------------------------- |
| `email`       | Obligatoire | Critère d'autorisation                               |
| `type`        | Facultatif  | `etudiant` ou `personnel` ; `etudiant` par défaut    |
| `prenom`      | Facultatif  | Pré-remplit le profil                                |
| `nom`         | Facultatif  | Pré-remplit le profil                                |
| `identifiant` | Facultatif  | Identifiant interne de l'école                       |
| `promotion`   | Facultatif  | Stocké pour un ciblage futur, sans usage dans le MVP |

Les champs autres que l'adresse ne sont pas considérés comme vérifiés du seul fait qu'ils proviennent du fichier. L'appartenance aux organisations n'est **pas** importée par CSV : elle est attribuée manuellement par le super-administrateur.

## 6.3. Mise à jour de la liste

Deux modes :

- **Ajouter ou mettre à jour** les adresses.
- **Remplacer** la liste par la nouvelle.

Avant un remplacement, afficher le nombre d'adresses ajoutées, conservées et retirées, et exiger une confirmation explicite.

Une adresse retirée ne peut plus se connecter ; les sessions associées sont révoquées et le compte passe au statut « non autorisé ». Les comptes, messages et données historiques ne sont pas supprimés automatiquement : ils suivent les durées de conservation définies (section 19.2).

## 6.4. Prérequis juridique

Aucun fichier contenant des données réelles ne doit être importé avant la signature du contrat de sous-traitance (DPA) avec l'école et son accord formel pour la transmission de la liste. Le back-office peut afficher un rappel lors du premier import d'une école.

---

# 7. Le fil d'événements

Le fil est l'écran principal de Campusly.

## 7.1. Présentation

L'utilisateur voit les événements publiés de son école, triés par date de début, les événements à venir en premier.

Chaque carte affiche :

- Le titre.
- La date et l'heure.
- Le lieu.
- Le nom et le logo de l'organisation.
- Une image facultative.
- Une description courte.
- Le nombre de participants.
- Un indicateur de capacité si une limite est définie (« 12 places restantes », « Complet »).
- Le statut d'inscription de l'utilisateur.
- L'accès au détail.

Prévoir un état vide, un état de chargement et un message d'erreur.

## 7.2. Organisation

- Tri chronologique, sans catégorie, sans recommandation, sans classement algorithmique.
- Les événements annulés à venir restent visibles avec un marquage clair, et restent accessibles aux inscrits.
- Les événements passés n'apparaissent pas dans le fil principal ; un onglet « Passés » permet de les consulter.
- Un onglet ou filtre « Mes événements » regroupe les événements auxquels l'utilisateur est inscrit (simple filtre, pas une catégorie).

## 7.3. Profil d'organisation

Un clic sur le nom d'une organisation ouvre son profil public : nom, logo, description et liste de ses événements à venir.

---

# 8. Création et gestion des événements

## 8.1. Création

Seuls les membres d'une organisation disposant de `events.create` peuvent créer un événement, au nom de cette organisation.

Si l'utilisateur est membre de plusieurs organisations, il choisit l'organisation au nom de laquelle il publie.

Formulaire :

- Organisation (pré-sélectionnée si une seule).
- Titre.
- Description.
- Date et heure de début.
- Heure de fin facultative.
- Lieu.
- Image facultative.
- Nombre maximal de participants facultatif.
- Date limite d'inscription facultative.
- Lien externe facultatif.
- Statut : brouillon ou publié.

L'événement est affiché sous le profil de l'organisation. Le compte de l'auteur réel est enregistré (créateur, dernier modificateur) mais n'est pas affiché aux étudiants.

Le fuseau horaire de l'école est utilisé pour l'affichage et le déclenchement des notifications.

## 8.2. Modification et annulation

Les permissions sont vérifiées côté serveur à chaque action, en fonction de l'organisation propriétaire de l'événement.

Lors d'une modification de date, heure ou lieu, ou d'une annulation :

- les changements sont enregistrés ;
- les inscrits sont notifiés (push et e-mail, section 12) ;
- les rappels planifiés sont recalculés ou annulés ;
- l'interface est actualisée ;
- l'opération est inscrite au journal d'audit.

Une modification mineure (description, image) ne déclenche pas de notification.

L'annulation ne supprime aucune donnée. La conversation d'un événement annulé reste consultable par les inscrits mais passe en lecture seule.

## 8.3. Capacité et inscriptions

- Les inscriptions ne peuvent pas dépasser la capacité, y compris en cas d'inscriptions simultanées (contrôle transactionnel en base).
- Un événement complet affiche clairement son statut.
- Une désinscription libère une place.
- Un utilisateur ne peut pas s'inscrire deux fois (contrainte d'unicité).
- Sans capacité définie, l'événement est sans limite.

## 8.4. Statuts

- **Brouillon** : visible uniquement par les membres de l'organisation.
- **Publié** : visible par toute l'école.
- **Annulé** : visible avec marquage, plus d'inscription possible.
- **Terminé** : après la fin (ou le début si aucune fin n'est définie), consultable, plus d'inscription possible. Ce statut peut être calculé plutôt que stocké.

---

# 9. Inscription et désinscription

Depuis la carte ou le détail, un utilisateur peut rejoindre un événement. Le serveur vérifie :

1. Que le compte est actif.
2. Que l'événement appartient à la même école.
3. Qu'il est publié et ouvert aux inscriptions (date limite non dépassée, non terminé, non annulé).
4. Que l'utilisateur n'est pas déjà inscrit.
5. Que la capacité n'est pas atteinte.

Puis il enregistre l'inscription, met à jour le compteur et renvoie le nouvel état, affiché immédiatement.

La désinscription libère une place et retire l'accès à la conversation.

Les inscriptions simultanées et les erreurs réseau (double clic, nouvelle tentative) ne doivent pas créer de doublons.

Aucune notification n'est envoyée à l'organisation lorsqu'un utilisateur rejoint un événement. Une confirmation visuelle est affichée à l'utilisateur.

---

# 10. Liste des participants

Chaque événement publié affiche la liste de ses inscrits, **visible par tous les utilisateurs de l'école** (décision v1.1).

La liste affiche : photo, prénom, nom, courte présentation. Jamais l'adresse e-mail.

La consultation de la liste ne donne pas accès à la conversation, réservée aux inscrits, aux membres habilités de l'organisation et à la modération de l'école.

Les utilisateurs sont informés, dans la politique de confidentialité et par une mention courte au moment de l'inscription à un événement (« Ta participation sera visible par les étudiants de ton école »), que leur participation est visible.

---

# 11. Conversations collectives

Chaque événement possède une conversation collective. Il n'existe pas de messagerie privée dans le MVP.

## 11.1. Accès

Peuvent lire et écrire :

- Les utilisateurs inscrits à l'événement.
- Les membres de l'organisation propriétaire disposant de `events.chat`. Leurs messages apparaissent sous le profil de l'organisation, avec mention du prénom de l'auteur (« BDE · Lucas »).

Peuvent lire et modérer, sans être inscrits :

- Les membres de l'organisation École disposant de `moderation.conversations`.

L'accès est contrôlé au chargement de la conversation, à l'abonnement temps réel et à l'envoi de chaque message. Un appel direct à l'API avec l'identifiant d'un événement non autorisé doit être refusé.

## 11.2. Fonctionnement

- Messages affichés chronologiquement.
- Envoi de messages texte.
- Auteur et heure affichés.
- Chargement des messages précédents (pagination).
- Réception des nouveaux messages en temps réel.
- État d'envoi et gestion des erreurs.
- Signalement d'un message par tout participant.

Un bandeau discret en tête de conversation indique : « Cette conversation est visible par les participants et peut être modérée par l'école. »

## 11.3. Notifications des messages

- Un nouveau message peut déclencher une notification push pour les autres participants.
- Jamais de notification à l'auteur de son propre message.
- Regroupement : au plus une notification par conversation et par utilisateur sur une fenêtre de temps courte (par exemple 10 minutes), du type « 5 nouveaux messages dans Soirée d'intégration ».
- Pas de notification si l'utilisateur consulte la conversation au même moment, lorsque c'est techniquement détectable.
- Les messages ne déclenchent jamais d'e-mail.
- L'utilisateur peut couper les notifications d'une conversation précise.
- Les modérateurs ne reçoivent pas de notification des conversations auxquelles ils n'appartiennent pas.

## 11.4. Modération

La modération est assurée par l'organisation École de chaque établissement.

Les membres habilités peuvent :

- consulter la liste de toutes les conversations de l'école et les lire ;
- consulter les signalements en attente ;
- masquer un message (il est remplacé par « Message masqué par la modération » ; le contenu est conservé pour l'audit) ;
- clore un signalement sans action ;
- suspendre temporairement la capacité d'écrire d'un utilisateur (`moderation.suspend_chat`).

La désactivation complète d'un compte reste réservée au super-administrateur, sur demande de l'école.

Chaque action de modération est inscrite au journal d'audit.

Un nouveau signalement génère une notification (push et centre de notifications) aux membres habilités de l'organisation École.

---

# 12. Notifications

Les notifications sont une fonctionnalité centrale de Campusly. Le MVP s'appuie sur trois canaux complémentaires :

1. **Le web push**, sur les navigateurs et appareils compatibles.
2. **L'e-mail**, en secours pour les informations critiques sur les événements.
3. **Le centre de notifications** dans l'application, qui conserve tout, quel que soit le canal reçu.

Les notifications ne sont jamais présentées comme garanties : refus d'autorisation, navigateur incompatible ou application non installée sur iOS peuvent empêcher le push.

## 12.1. Limites du web push à documenter

Claude doit documenter dans `docs/NOTIFICATIONS.md` les comportements par plateforme, notamment :

- **iOS / iPadOS** : push uniquement si l'application est ajoutée à l'écran d'accueil (iOS 16.4 et plus) et ouverte depuis cette icône. Rien dans Safari en navigation classique.
- **Android** : push fonctionnel dans Chrome et la plupart des navigateurs, installé ou non.
- **Ordinateur** : fonctionnel dans les navigateurs principaux, si le navigateur est ouvert ou autorisé en arrière-plan.

Ces limites doivent être vérifiées sur appareils réels en phase de tests.

## 12.2. Onboarding : installation et activation

Après la création du profil (et accessible ensuite depuis le profil) :

1. **Détection de la plateforme** et du mode d'affichage (navigateur ou application installée).
2. **iOS dans Safari** : écran expliquant que les rappels et messages ne fonctionnent qu'en ajoutant Campusly à l'écran d'accueil, avec un guide illustré en 2 ou 3 étapes (bouton Partager → « Sur l'écran d'accueil » → ouvrir depuis l'icône). Possibilité de passer l'étape ; un rappel discret reste visible dans le fil tant que l'application n'est pas installée.
3. **Android et ordinateur** : proposition d'installation via l'invite native lorsque disponible, facultative.
4. **Activation des notifications** : écran expliquant d'abord ce que l'utilisateur recevra (rappels, changements, messages, annonces de l'école), puis demande d'autorisation du navigateur au clic sur un bouton. Jamais de demande d'autorisation sans contexte au chargement de la page.
5. Si l'utilisateur refuse, l'application fonctionne normalement ; il est informé que les rappels essentiels lui arriveront par e-mail.

Le système enregistre, pour les indicateurs : affichage de l'onboarding, installation détectée (premier lancement en mode installé), autorisation accordée ou refusée, plateforme.

## 12.3. Types de notifications

| Notification                  | Destinataires                   | Push | E-mail         | Centre |
| ----------------------------- | ------------------------------- | ---- | -------------- | ------ |
| Rappel 24 h avant             | Inscrits                        | Oui  | Secours (12.4) | Oui    |
| Rappel 1 h avant              | Inscrits                        | Oui  | Non            | Oui    |
| Modification date/heure/lieu  | Inscrits                        | Oui  | Oui            | Oui    |
| Annulation                    | Inscrits                        | Oui  | Oui            | Oui    |
| Nouveaux messages (regroupés) | Participants de la conversation | Oui  | Non            | Oui    |
| Communication officielle      | Toute l'école                   | Oui  | Non (MVP)      | Oui    |
| Nouveau signalement           | Modérateurs de l'école          | Oui  | Non            | Oui    |

Règles des rappels :

- Le rappel 24 h n'est programmé que si l'événement commence plus de 24 h après l'inscription ou la publication.
- Le rappel 1 h n'est envoyé que si l'événement n'a pas commencé.
- Aucun rappel n'est envoyé après le début de l'événement, ni pour un événement annulé, ni à un utilisateur désinscrit.
- Une modification de date recalcule les rappels.

## 12.4. Règles du canal e-mail

- **Modification et annulation** : e-mail envoyé à tous les inscrits, en plus du push. Ce sont des informations de service liées à une inscription.
- **Rappel 24 h** : e-mail envoyé uniquement aux inscrits qui n'ont **aucun abonnement push actif** (application non installée sur iOS, autorisation refusée, abonnement expiré).
- **Rappel 1 h, messages, communications** : pas d'e-mail dans le MVP.
- L'utilisateur peut désactiver les e-mails de rappel dans ses préférences. Les e-mails d'annulation et de modification restent envoyés tant qu'il est inscrit, sauf décision contraire documentée.
- Chaque e-mail contient un lien direct vers l'événement et un lien vers les préférences.
- Les e-mails sont courts, sobres et identifiables (expéditeur « Campusly — [Nom de l'école] »), pour limiter le filtrage.

## 12.5. Préférences

L'utilisateur peut, depuis son profil :

- activer ou désactiver les notifications push (et relancer l'activation s'il avait refusé, avec explication sur la façon de réautoriser dans le navigateur) ;
- couper les notifications de messages globalement ou par conversation ;
- désactiver les e-mails de rappel ;
- voir l'état de son abonnement push sur l'appareil courant.

La permission technique du navigateur ne vaut pas autorisation générale : les préférences de l'utilisateur sont toujours respectées côté serveur.

## 12.6. Fiabilité technique

Le système gère :

- les abonnements push, multiples par utilisateur (téléphone et ordinateur) ;
- la suppression des abonnements invalides (réponses d'expiration du service push) ;
- les erreurs de livraison avec un nombre limité de nouvelles tentatives ;
- les notifications planifiées, stockées en base avec leur état (planifiée, envoyée, échouée, annulée) ;
- les changements d'heure (heure d'été) et le fuseau de l'école ;
- la déduplication par clé (type + événement + destinataire + échéance) ;
- l'exécution par un mécanisme planifié côté serveur, jamais par un minuteur dans le navigateur.

---

# 13. Communications officielles

Les membres disposant de `communications.send_all` peuvent envoyer une communication officielle au nom de leur organisation.

## 13.1. Ciblage

Pour le MVP, une seule cible : **tous les utilisateurs actifs de l'école**.

Le ciblage par groupes, classes ou promotions est reporté. Le modèle de données peut prévoir une table de destinataires permettant de l'ajouter plus tard sans refonte.

## 13.2. Formulaire

- Organisation émettrice.
- Titre.
- Message.
- Lien facultatif vers un événement.
- Aperçu avant envoi.
- Nombre de destinataires affiché.
- Confirmation explicite.

## 13.3. Diffusion et historique

À l'envoi :

- la communication apparaît dans le centre de notifications de tous les destinataires ;
- un push est envoyé à ceux qui l'ont autorisé.

Un historique conserve : organisation, auteur, date, nombre de destinataires, nombre de push envoyés et échoués.

Les communications officielles sont visuellement distinctes des messages de conversation.

Une limite de fréquence par organisation (par exemple 3 communications par semaine) est configurable par le super-administrateur afin d'éviter la lassitude des étudiants.

---

# 14. Espace de gestion des organisations

L'espace de gestion est accessible à tout utilisateur membre d'au moins une organisation, depuis un lien dans son profil ou sa navigation. Il est séparé visuellement de l'espace étudiant mais utilise le même compte et la même session.

## 14.1. Sélection de l'organisation

Si l'utilisateur est membre de plusieurs organisations, un sélecteur en haut de l'espace permet de choisir l'organisation active. Toutes les actions s'effectuent au nom de l'organisation sélectionnée, selon les permissions de l'appartenance correspondante.

## 14.2. Tableau de bord

- Événements de l'organisation : à venir, brouillons, passés, annulés.
- Nombre d'inscrits par événement.
- Accès aux conversations.
- Communications envoyées (si permission).

## 14.3. Gestion des événements

Création, modification, annulation, liste des inscrits, accès à la conversation. Les actions non autorisées sont masquées dans l'interface **et** refusées par le serveur.

## 14.4. Profil de l'organisation

Les membres habilités peuvent modifier la description et le logo de leur organisation. Le nom et le type sont modifiés par le super-administrateur.

## 14.5. Espace de modération (organisation École)

Pour les membres de l'organisation École disposant des permissions de modération :

- liste des signalements en attente, avec le message signalé et son contexte ;
- liste de toutes les conversations de l'école ;
- actions de modération décrites en 11.4.

---

# 15. Back-office super-administrateur (minimal)

L'interface est volontairement simple : listes, formulaires et confirmations, sans tableau de bord graphique.

## 15.1. Écoles

- Créer, modifier, activer et désactiver une école.
- Déclarer ses domaines et son fuseau horaire.
- Voir le nombre d'adresses autorisées, de comptes activés et d'événements.

## 15.2. Adresses autorisées

- Importer, mettre à jour et remplacer la liste (section 6).
- Rechercher une adresse et voir son statut.
- Retirer une adresse individuellement.

## 15.3. Organisations et membres

- Créer, modifier et désactiver une organisation.
- Rechercher un utilisateur de l'école et l'ajouter comme membre.
- Attribuer ou retirer des permissions.
- Retirer un membre.

## 15.4. Utilisateurs

- Rechercher un utilisateur.
- Désactiver ou réactiver un compte.
- Révoquer ses sessions.
- Traiter une demande de suppression.

## 15.5. Journal d'audit

Liste filtrable (par école, type d'action, date) des actions sensibles :

- import et remplacement de listes ;
- création et modification d'organisations, ajout et retrait de membres, modification de permissions ;
- désactivation de comptes, révocation de sessions ;
- création, modification et annulation d'événements ;
- envoi de communications officielles ;
- actions de modération ;
- suppression de comptes.

Jamais de code de connexion ni de secret dans les journaux.

## 15.6. Paramètres

- Limite de fréquence des communications.
- Durées de conservation.
- Délais des rappels.

## 15.7. Indicateurs

Les indicateurs de la section 1.4 sont fournis sous forme de requêtes SQL documentées dans `docs/ANALYTICS.md`. Une page « Indicateurs » peut simplement afficher quelques chiffres clés calculés par ces requêtes pour une école, sous forme de tableau, si cela reste trivial à implémenter.

---

# 16. Identité visuelle et expérience utilisateur

Claude propose une identité visuelle cohérente, moderne et adaptée à l'enseignement supérieur.

## 16.1. Direction artistique

Le design doit être moderne, simple, accessible, dynamique sans être enfantin, lisible sur téléphone, adapté à un usage fréquent et cohérent entre l'espace étudiant et l'espace de gestion.

Éviter un design générique fait uniquement de cartes blanches et de dégradés décoratifs.

Proposer une palette, une typographie, un système d'espacement, des styles de boutons, des composants de formulaire et des états visuels cohérents. Créer un logo provisoire Campusly et une icône d'application adaptée à l'installation sur écran d'accueil (iOS et Android).

L'expérience mobile est prioritaire : l'application installée doit ressembler à une application, avec une navigation par barre inférieure.

## 16.2. Écrans attendus

### Espace utilisateur

1. Saisie de l'adresse e-mail.
2. Saisie du code de vérification.
3. Création du profil.
4. Onboarding : installation sur l'écran d'accueil (variante iOS et variante Android/ordinateur).
5. Onboarding : activation des notifications.
6. Fil des événements (onglets À venir, Mes événements, Passés).
7. Détail d'un événement.
8. Liste des participants.
9. Conversation de l'événement.
10. Profil d'une organisation.
11. Centre de notifications.
12. Profil et préférences.
13. États vides et pages d'erreur.

### Espace de gestion des organisations

1. Sélecteur d'organisation.
2. Tableau de bord.
3. Formulaire de création et de modification d'événement.
4. Détail d'événement et inscrits.
5. Conversation.
6. Formulaire de communication et historique.
7. Profil de l'organisation.
8. Modération : signalements et conversations (organisation École).

### Back-office super-administrateur

1. Écoles.
2. Adresses autorisées et import.
3. Organisations et membres.
4. Utilisateurs.
5. Journal d'audit.
6. Paramètres.

## 16.3. Accessibilité

Navigation au clavier, libellés explicites, contrastes suffisants (niveau WCAG AA visé), formulaires compréhensibles, erreurs lisibles, interface utilisable sur petits écrans.

---

# 17. Architecture technique

Claude Code propose une architecture adaptée au MVP et explique ses choix avant de commencer l'implémentation.

La priorité est de livrer rapidement un produit fiable, maintenable, sécurisé et évolutif, sans infrastructure inutilement complexe, et en limitant le nombre de fournisseurs.

## 17.1. Principes

- Application web responsive et PWA.
- Architecture permettant une future application mobile (API ou couche de données réutilisable).
- Base de données relationnelle.
- Autorisations vérifiées côté serveur et, si la base le permet, au niveau des données (RLS).
- Notifications planifiées fiables côté serveur.
- Messagerie en temps réel.
- Environnements distincts : local, préproduction, production.
- Secrets hors du dépôt.
- Sauvegardes et restauration testées.
- Tests automatisés.
- Hébergement des données personnelles dans l'Union européenne.

## 17.2. Technologies à évaluer

Base de réflexion, non obligatoire :

- Next.js avec TypeScript.
- PostgreSQL.
- Supabase (région UE) pour la base, l'authentification par code e-mail, le temps réel, le stockage des images, les politiques RLS et les tâches planifiées.
- Un service d'e-mails transactionnels hébergé ou opérant dans l'UE.
- Le web push standard (VAPID), sans fournisseur tiers payant si possible.
- Un hébergeur adapté à l'application, avec une région européenne.

Claude compare les coûts récurrents, les limites des offres gratuites, la sécurité, les contraintes de déploiement et la possibilité de migrer.

## 17.3. PWA

Prévoir :

- un manifeste web complet (nom, icônes, couleurs, mode d'affichage autonome) ;
- un service worker pour les notifications push et une mise en cache minimale ;
- la détection du mode installé (pour l'onboarding et les indicateurs) ;
- une stratégie de mise à jour de l'application installée ;
- des tests sur iPhone (installé et non installé), Android et ordinateur.

## 17.4. Environnements

- Local.
- Préproduction, avec données fictives uniquement.
- Production.

Les données de test ne sont jamais mélangées aux données réelles. Les clés et identifiants de production ne sont jamais dans le dépôt.

---

# 18. Modèle de données

Claude conçoit un schéma relationnel documenté (`docs/DATABASE.md`) et crée les migrations. Entités minimales :

## 18.1. Écoles (`schools`)

Identifiant, nom, domaines e-mail, fuseau horaire, statut, dates de création et de modification.

## 18.2. Adresses autorisées (`allowed_emails`)

Identifiant, école, adresse normalisée, type (étudiant ou personnel), prénom et nom facultatifs, identifiant interne facultatif, promotion facultative, statut (autorisée, retirée), date d'import, lot d'import.

Contrainte d'unicité sur (école, adresse).

## 18.3. Utilisateurs (`users` / `profiles`)

Identifiant, école, adresse normalisée, type, prénom, nom, photo, présentation, statut (actif, désactivé, non autorisé), indicateur de suspension d'écriture (avec date de fin), préférences de notifications, dates.

Le statut de super-administrateur est stocké dans une table ou un mécanisme distinct, non modifiable par l'utilisateur.

## 18.4. Organisations (`organizations`)

Identifiant, école, nom, type (`ecole`, `direction`, `pedagogie`, `bde`, `association`, `autre`), logo, description, statut, dates.

Une seule organisation de type `ecole` par école.

## 18.5. Appartenances (`organization_members`)

Identifiant, organisation, utilisateur, permissions (liste ou table de liaison), date d'ajout, auteur de l'ajout, date et auteur de la dernière modification.

Contrainte d'unicité sur (organisation, utilisateur).

## 18.6. Événements (`events`)

Identifiant, école, organisation propriétaire, créateur (utilisateur), dernier modificateur, titre, description, début, fin facultative, fuseau horaire, lieu, image, capacité, date limite d'inscription, lien externe, statut (brouillon, publié, annulé), dates.

## 18.7. Inscriptions (`registrations`)

Identifiant, événement, utilisateur, date d'inscription, statut (inscrit, désinscrit), date de désinscription, préférence « notifications de conversation coupées ».

Contrainte d'unicité sur (événement, utilisateur).

## 18.8. Messages (`messages`)

Identifiant, événement, auteur (utilisateur), organisation d'affichage facultative (si posté au nom de l'organisation), contenu, date d'envoi, statut de modération (visible, masqué), modéré par, date de modération.

## 18.9. Signalements (`reports`)

Identifiant, école, message, auteur du signalement, motif facultatif, date, statut (en attente, traité, clos sans suite), traité par, date de traitement.

## 18.10. Notifications (`notifications`)

Destinataire, type, contenu ou référence, canal(aux), date prévue, date d'envoi, statut par canal, événement ou message associé, clé de déduplication, date de lecture dans le centre de notifications, date d'ouverture lorsque disponible.

## 18.11. Abonnements push (`push_subscriptions`)

Utilisateur, informations d'abonnement (endpoint et clés, protégés), plateforme détectée, mode installé ou non, date de création, dernière utilisation réussie, statut.

## 18.12. Communications (`communications`)

Identifiant, école, organisation émettrice, auteur, titre, message, événement lié facultatif, cible (« toute l'école » pour le MVP), nombre de destinataires, statistiques d'envoi, date.

## 18.13. Suivi d'usage (`analytics_events`)

Table légère enregistrant les événements nécessaires aux indicateurs : consultation d'un événement, affichage de l'onboarding, installation détectée, autorisation push accordée ou refusée, ouverture d'une notification, connexion. Contenu limité au strict nécessaire (utilisateur, école, type, date, plateforme).

## 18.14. Audit (`audit_logs`)

Auteur, école, type d'action, objet concerné, date, métadonnées strictement nécessaires.

---

# 19. Sécurité et conformité

## 19.1. Sécurité

- Authentification sécurisée et limitation des tentatives.
- Validation des données côté serveur.
- Protection contre les injections et les attaques web courantes (XSS dans les messages, CSRF, etc.).
- Contrôle d'autorisation sur chaque action sensible, basé sur l'école, l'organisation et les permissions.
- Politiques RLS activées et testées si Supabase est retenu.
- Isolation des conversations et des données entre écoles.
- Sessions sécurisées et révocables.
- Secrets protégés.
- Sauvegardes et restauration testées.
- Journalisation des actions administratives et de modération.
- Dépendances maintenues.
- Tests d'accès non autorisé.

Ne jamais se reposer uniquement sur la visibilité des boutons dans l'interface.

## 19.2. RGPD

Avant le lancement :

- **Contrat de sous-traitance (DPA)** avec l'école, et accord formel pour la transmission de la liste des adresses, signés avant tout import réel.
- Qualification des rôles à confirmer selon le fonctionnement contractuel (Campusly sous-traitant a priori).
- Politique de confidentialité et mentions légales, mentionnant explicitement :
  - que la participation aux événements est visible par les utilisateurs de l'école ;
  - que les conversations peuvent être lues par la modération de l'école ;
  - l'usage des notifications push et des e-mails de service.
- Registre des traitements et liste des sous-traitants techniques (hébergeur, base de données, e-mails).
- Durée de conservation par catégorie de données (comptes, messages, notifications, journaux, adresses retirées).
- Mécanisme de suppression ou d'anonymisation des comptes.
- Procédure de traitement des demandes des utilisateurs (accès, rectification, suppression).
- Gestion des cookies et traceurs conforme (privilégier des mesures sans traceur soumis à consentement).
- Procédure de gestion des incidents et de notification de violation.

La permission technique du navigateur pour le push ne vaut pas autorisation générale pour toutes les communications.

Claude prépare les éléments techniques, mais ne certifie pas la conformité juridique. Les documents juridiques doivent être vérifiés avant le lancement.

---

# 20. Tests et critères d'acceptation

## 20.1. Authentification

- Une adresse autorisée reçoit un code ; un code valide permet de poursuivre.
- Un code expiré ou déjà utilisé est refusé.
- Une adresse non autorisée, ou d'un domaine inconnu, ne peut pas créer de compte.
- Les tentatives répétées sont limitées.
- Un compte existant peut se reconnecter ; la session persiste dans la PWA installée.
- Un compte désactivé ou une adresse retirée perd l'accès et ses sessions sont révoquées.
- Un code arrive effectivement dans la boîte de réception de `yoann.poher@ynov.com` (test manuel).

## 20.2. Organisations et permissions

- Un utilisateur sans appartenance ne peut créer aucun événement.
- Un membre avec `events.create` peut créer un événement au nom de son organisation uniquement.
- Un membre de l'organisation A ne peut pas modifier un événement de l'organisation B.
- Un membre de plusieurs organisations publie sous l'organisation choisie.
- L'événement s'affiche sous le profil de l'organisation ; l'auteur réel est enregistré dans l'audit.
- Un utilisateur ne peut pas s'attribuer de permission ni s'ajouter à une organisation.
- Après retrait d'un membre, ses droits disparaissent immédiatement ; les événements de l'organisation restent intacts.

## 20.3. Événements et inscriptions

- Les événements publiés apparaissent dans le bon ordre ; les brouillons sont invisibles hors de l'organisation.
- Un événement modifié affiche ses nouvelles informations.
- Un événement annulé est clairement signalé.
- Un événement passé ou dont la date limite est dépassée refuse les inscriptions.
- La capacité ne peut pas être dépassée, y compris en inscriptions simultanées.
- Un utilisateur ne peut pas s'inscrire deux fois.
- La liste des participants est visible par l'école sans adresse e-mail.

## 20.4. Conversations et modération

- Un inscrit peut lire et écrire.
- Un non-inscrit ne peut pas accéder à la conversation, y compris par appel direct à l'API.
- Un utilisateur d'une autre école ne peut pas y accéder.
- Un membre habilité de l'organisation peut participer sous le profil de l'organisation.
- Un modérateur de l'organisation École peut lire toutes les conversations de son école, mais pas celles d'une autre école.
- Un message masqué n'est plus visible des participants ; l'action est journalisée.
- Un utilisateur suspendu ne peut plus écrire jusqu'à la fin de la suspension.
- Les nouveaux messages apparaissent en temps réel.
- L'auteur d'un message n'est pas notifié ; les notifications sont regroupées.

## 20.5. Notifications et onboarding

- L'onboarding iOS s'affiche dans Safari non installé et disparaît une fois l'application installée.
- La demande d'autorisation n'apparaît qu'après une action de l'utilisateur.
- Le rappel 24 h et le rappel 1 h sont déclenchés au bon moment, jamais après le début.
- Un utilisateur sans abonnement push actif reçoit le rappel 24 h par e-mail.
- Une modification ou une annulation déclenche push et e-mail aux inscrits uniquement.
- Un désinscrit ne reçoit plus de rappel.
- Un utilisateur ayant désactivé le push ou les e-mails de rappel ne les reçoit pas.
- Les abonnements invalides sont supprimés ; un échec temporaire ne crée pas de boucle d'envoi.
- Les tâches planifiées fonctionnent indépendamment du navigateur.
- Tests manuels réalisés sur iPhone installé, iPhone non installé, Android et ordinateur.

## 20.6. Communications

- Seul un membre avec `communications.send_all` peut envoyer une communication.
- La communication atteint uniquement les utilisateurs actifs de l'école.
- Le nombre de destinataires est affiché avant envoi ; la confirmation est requise.
- La limite de fréquence est respectée.

## 20.7. Administration

- Le super-administrateur peut créer une école, une organisation, ajouter des membres et attribuer des permissions.
- L'import CSV détecte erreurs, doublons, domaines invalides et adresses présentes dans plusieurs écoles.
- Le remplacement d'une liste exige une confirmation après résumé.
- Les actions sensibles sont journalisées.

## 20.8. Tests transversaux

Mobile et ordinateur, états de chargement, erreurs réseau, accès simultanés, isolation inter-écoles, sauvegarde et restauration, migrations, déploiement, parcours complets avec comptes de test.

Jamais de données personnelles réelles dans les tests automatisés.

---

# 21. Plan d'exécution demandé à Claude Code

Claude travaille par étapes et vérifie le fonctionnement à chaque phase.

## Phase 1 — Analyse et préparation

1. Vérifier l'environnement de développement.
2. Proposer l'architecture et comparer les technologies.
3. Identifier les services externes et estimer les coûts récurrents.
4. Définir le modèle de données (dont organisations et appartenances).
5. Définir le modèle d'authentification et de permissions.
6. Identifier les risques techniques (notamment push iOS et délivrabilité e-mail).
7. Produire le plan de développement.
8. Lister les décisions nécessitant une validation humaine.

Livrables : architecture, schéma de données, plan, liste des décisions et des accès à fournir.

## Phase 2 — Initialisation

Dépôt, TypeScript et outils de qualité, variables d'environnement, environnements local et préproduction, base de données et migrations, premiers tests, composants visuels de base, manifeste PWA et icônes, documentation des commandes.

Livrable : un projet qui démarre et dont les tests de base passent.

## Phase 3 — Authentification, organisations et permissions

1. Écoles et domaines.
2. Adresses autorisées (import CSV minimal pour les tests).
3. Authentification par code e-mail, avec domaine d'envoi configuré et test de délivrabilité réel.
4. Profils utilisateurs.
5. Super-administrateur (création sécurisée).
6. Organisations, appartenances, permissions ; organisation École créée automatiquement.
7. Tests d'accès non autorisé et d'isolation.

Livrable : un système d'accès fonctionnel et sécurisé.

## Phase 4 — Événements

Fil (avec onglets), détail, profil d'organisation, création et modification au nom d'une organisation, inscriptions, participants, capacité, statuts, cas limites.

Livrable : un étudiant découvre et rejoint un événement publié par une organisation.

## Phase 5 — Conversations et modération

Conversation par événement, contrôle d'accès, temps réel, participation sous profil d'organisation, signalements, espace de modération de l'organisation École, tests d'accès interdits.

Livrable : les participants échangent et l'école peut modérer.

## Phase 6 — Notifications, onboarding et communications

1. Onboarding d'installation et d'activation, avec suivi.
2. Abonnements web push.
3. Rappels planifiés.
4. Notifications de modification et d'annulation.
5. Canal e-mail de secours.
6. Notifications de messages regroupées.
7. Centre de notifications et préférences.
8. Communications officielles à toute l'école.
9. Tests sur appareils réels et documentation des limites.

Livrable : notifications fonctionnelles en préproduction, limites documentées.

## Phase 7 — Back-office minimal

Import CSV complet (modes ajout et remplacement), gestion des organisations et membres, gestion des utilisateurs, journal d'audit consultable, paramètres, requêtes d'indicateurs dans `docs/ANALYTICS.md`.

Livrable : le super-administrateur gère le produit sans intervention directe dans la base.

## Phase 8 — Tests et stabilisation

Tests unitaires, d'intégration et de parcours ; permissions ; isolation inter-écoles ; notifications ; performances de base ; accessibilité ; sauvegarde et restauration.

Livrable : rapport de tests avec limites restantes.

## Phase 9 — Déploiement

Hébergement, base de production, domaine, e-mails, notifications, sauvegardes, variables d'environnement, déploiement, création sécurisée du super-administrateur, test complet en production.

Livrable : Campusly en ligne avec procédure de maintenance documentée.

## Phase 10 — Préparation de l'école pilote

1. Vérifier la signature du DPA et l'accord de l'école.
2. Créer l'école pilote « Ynov Campus Rouen » (domaine `ynov.com`, fuseau `Europe/Paris`).
3. Importer la liste des adresses du campus de Rouen (étudiants et personnel).
4. Créer les organisations (École, pédagogie, BDE, associations) et leurs membres.
5. Créer quelques événements réels de lancement.
6. Vérifier le parcours sur iPhone, Android et ordinateur, y compris l'installation.
7. Vérifier la réception des e-mails sur des adresses de l'école.
8. Préparer un guide de prise en main pour les organisations et un guide d'installation pour les étudiants.
9. Préparer une procédure de signalement d'incident.
10. Valider le lancement avec le responsable de l'école.

Livrable : une première école utilise Campusly en conditions réelles.

---

# 22. Organisation du travail avec Claude Code

## 22.1. Méthode de travail

- Lire les fichiers existants avant de les modifier.
- Ne pas écraser du travail existant sans nécessité.
- Développer une fonctionnalité cohérente à la fois.
- Exécuter les tests après chaque étape importante et corriger avant de poursuivre.
- Maintenir la documentation à jour.
- Expliquer les choix techniques importants, signaler compromis et limites.
- Ne pas prétendre qu'une fonctionnalité fonctionne si elle n'a pas été testée.
- Ne pas laisser de bouton sans action réelle.
- Ne pas remplacer une fonctionnalité backend par une simulation côté interface.
- Ne pas intégrer de données fictives en production.
- Ne pas ajouter de fonctionnalités hors périmètre sans validation.

## 22.2. Fichiers de référence

- `README.md` : installation, commandes, fonctionnement.
- `CLAUDE.md` : instructions permanentes courtes (règles de travail, commandes, conventions) et renvoi vers `docs/PRODUCT_SPEC.md`. Ne pas y recopier le cahier des charges.
- `docs/PRODUCT_SPEC.md` : le présent cahier des charges.
- `docs/ARCHITECTURE.md`.
- `docs/DATABASE.md`.
- `docs/SECURITY.md` : sécurité, permissions, RLS.
- `docs/NOTIFICATIONS.md` : canaux, règles, limites par plateforme.
- `docs/ANALYTICS.md` : requêtes des indicateurs.
- `docs/DEPLOYMENT.md`.
- `docs/TEST_PLAN.md`.
- `docs/OPERATIONS.md` : maintenance, sauvegardes, incidents.
- `CHANGELOG.md`.

## 22.3. Gestion des erreurs

Lorsqu'un test échoue : identifier la cause, corriger, rejouer le test, exécuter les tests de régression pertinents, documenter si nécessaire. Ne jamais masquer une erreur en désactivant un test ou une vérification de sécurité.

## 22.4. Validation humaine

Claude peut choisir les technologies, écrire le code, créer les migrations, développer les interfaces et préparer le déploiement.

Il demande une validation avant toute opération susceptible d'entraîner une dépense, de publier des données personnelles, de supprimer des données de production, de modifier irréversiblement une infrastructure ou d'engager le propriétaire dans un service payant.

Il n'invente jamais de clés API, mots de passe, comptes fournisseurs ou accès. Lorsque des identifiants sont nécessaires, il explique précisément où les obtenir et comment les configurer.

---

# 23. Conditions de livraison

Le MVP est livré lorsque :

- L'application est accessible via une URL sécurisée et installable comme PWA.
- Le super-administrateur gère écoles, adresses, organisations, membres et utilisateurs.
- La liste des adresses peut être importée.
- Les utilisateurs autorisés s'inscrivent et se connectent.
- L'onboarding d'installation et de notifications fonctionne sur iOS, Android et ordinateur.
- Les utilisateurs consultent, rejoignent et quittent les événements.
- Les membres d'organisations gèrent leurs événements selon leurs permissions.
- Les participants sont affichés selon les règles définies.
- Les conversations sont fonctionnelles, protégées et modérables par l'école.
- Les notifications push fonctionnent dans les environnements compatibles et le canal e-mail de secours fonctionne.
- Les communications officielles fonctionnent.
- Les tests de sécurité et de parcours principaux sont passés.
- Les sauvegardes et la restauration sont documentées et testées.
- La documentation est disponible.
- Aucun secret n'est présent dans le dépôt.
- Les limites connues sont documentées.

La livraison est accompagnée d'un rapport précisant :

1. Les fonctionnalités réellement terminées.
2. Les tests exécutés et leurs résultats.
3. Les défauts connus.
4. Les services externes configurés.
5. Les coûts récurrents estimés.
6. Les accès ou secrets restant à fournir.
7. La procédure de déploiement et de mise à jour.
8. Les améliorations recommandées (dont ciblage par groupes, tableau de bord, application native).

---

# 24. Première instruction à Claude Code

Tu dois maintenant agir comme l'ingénieur logiciel principal responsable de la conception et du développement de Campusly.

Le présent document constitue la référence fonctionnelle du projet. La section 0 résume les décisions déjà actées : ne les remets pas en question sans raison technique sérieuse, et signale-la le cas échéant.

Commence par examiner l'environnement de travail et vérifier si un projet existe déjà. Si aucun projet n'existe, prépare une structure propre.

Ne génère pas toute l'application en une seule fois.

Ta première mission :

1. Analyser le cahier des charges.
2. Identifier les points ambigus qui bloquent réellement l'architecture.
3. Proposer une architecture technique adaptée.
4. Comparer les options pertinentes, avec avantages, limites et coûts.
5. Définir le schéma de données.
6. Définir le modèle d'authentification, d'organisations et de permissions.
7. Présenter un plan d'exécution détaillé avec critères de validation.
8. Lister les services externes, comptes et informations à fournir par le propriétaire.

Tu peux prendre des décisions techniques raisonnables sans validation pour chaque détail mineur. Demande une validation avant tout engagement financier, toute opération irréversible ou toute modification substantielle du périmètre.

Après validation de la préparation, développe Campusly étape par étape, en testant chaque fonctionnalité avant de passer à la suivante.

Le résultat attendu est une application réelle, sécurisée, maintenable et déployable, et non une maquette contenant des fonctionnalités simulées.

**Priorité absolue :** livrer un MVP fiable dans une première école, puis préparer son évolution vers plusieurs établissements et, à terme, des applications mobiles.

---

# Historique des versions

| Version | Date       | Modifications                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-10    | Version initiale                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.1     | 2026-10-15 | Compte unique et Organisations ; onboarding PWA et canal e-mail de secours ; personnel dans l'import ; contrôle de domaine (cas `ynov.com`) ; pilote limité à Ynov Campus Rouen ; participants visibles par l'école ; modération par l'organisation École ; DPA préalable ; périmètre allégé (back-office minimal, ciblage par groupes reporté, indicateurs en SQL, taux de participation retiré) |

Fin du cahier des charges.

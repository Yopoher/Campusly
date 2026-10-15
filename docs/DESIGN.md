# Campusly — Système visuel

## Point de départ

Campusly sert à une seule chose : savoir ce qui se passe sur le campus cette semaine et s'y inscrire. Le repère commun à tous les étudiants est l'**emploi du temps** et l'**agenda papier** : des dates, des créneaux, et ce qu'on surligne quand on s'engage. Le système visuel part de là plutôt que d'un kit d'application générique.

## Ce qui rend Campusly reconnaissable

**La colonne de date.** Chaque événement est ancré par sa date, composée en Archivo très condensé et très gras : le jour de la semaine en petit, le numéro en grand, le mois dessous. C'est l'élément fort de l'interface ; tout le reste est volontairement calme.

**Le surligneur.** Quand un étudiant s'inscrit, la colonne de date passe en jaune surligneur, comme on surligne un créneau dans son agenda. Le fil se lit alors d'un coup d'œil : le jaune, ce sont mes engagements. Le jaune n'est utilisé pour rien d'autre.

## Couleurs

| Nom       | Clair     | Sombre    | Rôle                                                                  |
| --------- | --------- | --------- | --------------------------------------------------------------------- |
| `ink`     | `#17233F` | `#E8ECF4` | Texte principal, boutons principaux                                   |
| `paper`   | `#F3F5F9` | `#0F1626` | Fond de l'application                                                 |
| `surface` | `#FFFFFF` | `#182238` | Cartes, champs, barres                                                |
| `line`    | `#DCE1EA` | `#2A3550` | Séparateurs, bordures de champs                                       |
| `muted`   | `#566074` | `#9AA6BD` | Texte secondaire                                                      |
| `marker`  | `#FFE14D` | `#FFE14D` | Surligneur : inscription uniquement (texte toujours `#17233F` dessus) |
| `focus`   | `#2F5BEA` | `#7A9BFF` | Anneau de focus clavier                                               |
| `danger`  | `#C2342C` | `#FF7B72` | Erreurs, annulation                                                   |
| `success` | `#1D7F55` | `#4CC38A` | Confirmations                                                         |

**Couleurs d'organisation** — elles portent une information (qui organise), jamais une décoration. Elles apparaissent en pastille à côté du nom de l'organisation et en filet sous la date.

| Type             | Couleur   |
| ---------------- | --------- |
| BDE              | `#D9434A` |
| Association      | `#0F8484` |
| Pédagogie        | `#2F5BEA` |
| École, Direction | `#6B4FD8` |
| Autre service    | `#6B7280` |

Contrastes vérifiés : `ink` sur `paper` et `surface` > 12:1 ; `muted` sur `surface` > 6:1 ; `ink` sur `marker` > 11:1.

## Typographie

Une seule famille, **Archivo** (variable, poids 100–900, largeur 62–125), auto-hébergée (aucun appel à un service tiers). La largeur est l'axe expressif :

| Usage                               | Réglages                               | Taille    |
| ----------------------------------- | -------------------------------------- | --------- |
| Numéro de date                      | largeur 62, poids 800                  | 2.5rem    |
| Titres d'écran                      | largeur 75, poids 750                  | 1.75rem   |
| Titres de section (jours, semaines) | largeur 75, poids 700                  | 1.125rem  |
| Titre d'événement                   | largeur 100, poids 650                 | 1.0625rem |
| Texte courant                       | largeur 100, poids 400, interligne 1.5 | 1rem      |
| Méta (heure, lieu)                  | largeur 100, poids 500                 | 0.875rem  |

Pas de capitales pour les libellés : jours et mois abrégés en minuscules (« jeu. », « oct. »).

## Formes et espacements

- Échelle d'espacement de 4 px.
- Rayons : 8 px pour les contrôles, 16 px pour les cartes, 999 px pour les pastilles. Pas d'ombres portées : la profondeur vient du contraste `paper` / `surface`.
- Zone tactile minimale de 44 × 44 px.
- Contenu limité à 640 px de large dans l'espace étudiant (lecture mobile même sur ordinateur) ; l'espace de gestion utilise toute la largeur.

## Mouvement

Aucune animation ne se déclenche toute seule. Les animations répondent à une action — le surligneur qui se pose à l'inscription (200 ms), l'ouverture d'un panneau. Toutes sont désactivées si l'utilisateur a demandé de réduire les animations.

## Écriture

Tutoiement côté étudiants, vouvoiement dans l'espace de gestion et le back-office. Boutons nommés par ce qu'ils font (« M'inscrire », « Me désinscrire », « Publier »), le même verbe dans le message de confirmation (« Tu es inscrit·e », « Événement publié »). Les erreurs disent ce qui s'est passé et quoi faire, sans s'excuser.

## Démonstration

La page `/design` présente tous les éléments, dans les deux thèmes.

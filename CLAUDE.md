# CLAUDE.md — Règles de travail sur Campusly

La référence fonctionnelle est `docs/PRODUCT_SPEC.md` (v1.1). La section 0 liste les décisions actées : ne pas les remettre en question sans raison technique sérieuse, signalée explicitement.

## Documents

- Architecture : `docs/ARCHITECTURE.md` · Données : `docs/DATABASE.md` · Sécurité : `docs/SECURITY.md`
- Plan et critères de validation : `docs/PLAN.md` · Décisions en attente : `docs/DECISIONS.md`

## Règles

- Une fonctionnalité cohérente à la fois ; tests après chaque étape ; corriger avant de continuer.
- Ne jamais désactiver un test ou une vérification de sécurité pour faire passer une étape.
- Toute écriture métier passe par une fonction SQL `SECURITY DEFINER` qui vérifie identité, école, statut, permissions et écrit l'audit. Pas d'écriture directe sur les tables depuis le client.
- Chaque nouvelle table liée à une école porte `school_id` et a ses politiques RLS dans la même migration, **et** ses tests d'accès dans `tests/db/`.
- La clé `service_role` n'est utilisée que côté serveur (dispatcher, import, scripts admin). Jamais de variable `NEXT_PUBLIC_` contenant un secret.
- Pas de bouton sans action réelle, pas de simulation côté interface d'une fonctionnalité serveur.
- Pas de données personnelles réelles dans les tests ni dans `seed.sql` (adresses en `*.test@ynov.com` fictives uniquement).
- Interface et textes en français ; tutoiement côté étudiants.
- Demander validation avant toute dépense, opération irréversible, publication de données personnelles ou changement de périmètre.
- Ne jamais inventer de clé, mot de passe ou compte fournisseur.
- Mettre à jour la documentation et `CHANGELOG.md` à chaque phase.

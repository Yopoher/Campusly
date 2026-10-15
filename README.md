# Campusly

Plateforme de vie étudiante : les événements d'une école, les inscriptions, une conversation par événement et des notifications. Pilote : Ynov Campus Rouen.

## État

**Phase 1 (analyse et préparation) terminée.** Aucun code applicatif pour l'instant.

| Document | Contenu |
|---|---|
| `docs/PRODUCT_SPEC.md` | Cahier des charges v1.1 |
| `docs/ARCHITECTURE.md` | Stack, options comparées, coûts, flux, risques |
| `docs/DATABASE.md` | Modèle de données |
| `docs/schema_draft.sql` | Brouillon SQL du schéma, validé sur PostgreSQL 16 |
| `docs/SECURITY.md` | Authentification, permissions, RLS, résultats des contrôles |
| `docs/PLAN.md` | Phases 2 à 10 et critères de validation |
| `docs/DECISIONS.md` | Décisions à valider, comptes et accès à fournir |
| `docs/phase1_checks/` | Scripts des contrôles de sécurité de la Phase 1 |

## Rejouer les contrôles de la Phase 1

Avec un PostgreSQL 16 local vide (base `campusly`) :

```bash
psql -d campusly -f docs/phase1_checks/auth_shim.sql
psql -d campusly -f docs/schema_draft.sql
psql -d campusly -f docs/phase1_checks/security_tests.sql   # chaque ligne « OK Tn » est un contrôle réussi
```

Les commandes de développement seront documentées ici à partir de la Phase 2.

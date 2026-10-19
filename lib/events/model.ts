import type { OrgType } from "@/components/events/org-badge";
import type { EventCardData } from "@/components/events/event-card";

/** Libellés français des types d'organisation (affichés aux étudiants). */
export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  school: "École",
  direction: "Direction",
  pedagogy: "Pédagogie",
  bde: "BDE",
  association: "Association",
  other: "Autre",
};

export type EventStatus = "draft" | "published" | "cancelled";

/** Un événement tel qu'affiché : mis en forme à partir de la vue event_cards. */
export type EventCard = {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  status: EventStatus;
  capacity: number | null;
  participantsCount: number;
  registrationDeadline: Date | null;
  externalUrl: string | null;
  imagePath: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  organizationId: string;
  organizationName: string;
  organizationType: OrgType;
  organizationDescription: string | null;
  isPast: boolean;
  registered: boolean;
  registrationOpen: boolean;
  isOrgMember: boolean;
  canPublish: boolean;
  canEdit: boolean;
  canCancel: boolean;
};

/** Ligne brute renvoyée par PostgREST (noms de colonnes de la base). */
export type EventRow = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  status: EventStatus;
  capacity: number | null;
  participants_count: number;
  registration_deadline: string | null;
  external_url: string | null;
  image_path: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  organization_id: string;
  organization_name: string;
  organization_type: OrgType;
  organization_description: string | null;
  is_past: boolean;
  registered: boolean;
  registration_open: boolean;
  is_org_member: boolean;
  can_publish: boolean;
  can_edit: boolean;
  can_cancel: boolean;
};

const date = (value: string | null) => (value ? new Date(value) : null);

export function toEventCard(row: EventRow): EventCard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: new Date(row.starts_at),
    endsAt: date(row.ends_at),
    location: row.location,
    status: row.status,
    capacity: row.capacity,
    participantsCount: row.participants_count,
    registrationDeadline: date(row.registration_deadline),
    externalUrl: row.external_url,
    imagePath: row.image_path,
    cancelledAt: date(row.cancelled_at),
    cancellationReason: row.cancellation_reason,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationType: row.organization_type,
    organizationDescription: row.organization_description,
    isPast: row.is_past,
    registered: row.registered,
    registrationOpen: row.registration_open,
    isOrgMember: row.is_org_member,
    canPublish: row.can_publish,
    canEdit: row.can_edit,
    canCancel: row.can_cancel,
  };
}

/** Messages affichés à l'utilisateur à partir d'une erreur de base (codes SQLSTATE définis dans les migrations). */
export function messageForDatabaseError(error: { code?: string; message?: string } | null | undefined): string {
  switch (error?.code) {
    case "22023": // validation métier écrite en base : le message est déjà en français
    case "P0001": // règle d'état (inscriptions fermées, événement annulé…)
      return error.message ?? "Cette action n’est pas possible.";
    case "P0002":
      return "Cet événement n’existe plus ou n’est pas accessible.";
    case "42501":
      return "Tu n’as pas la permission de faire cette action pour cette organisation.";
    case "23514":
      return "Une valeur ne respecte pas les règles de l’événement. Vérifie le formulaire.";
    default:
      return "L’opération n’a pas abouti. Réessaie.";
  }
}

/** Format attendu par la carte d'événement existante (components/events/event-card.tsx). */
export function toCardData(event: EventCard): EventCardData {
  return {
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    organization: { name: event.organizationName, type: event.organizationType },
    participantsCount: event.participantsCount,
    capacity: event.capacity,
    status: event.status === "cancelled" ? "cancelled" : "published",
    isPast: event.isPast,
    registered: event.registered,
  };
}

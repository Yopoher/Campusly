import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatParticipants, formatRemainingSeats, formatTimeRange, remainingSeats } from "@/lib/format";
import { DateBlock } from "./date-block";
import { OrgBadge, type OrgType } from "./org-badge";

export type EventCardData = {
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  location: string;
  organization: { name: string; type: OrgType };
  participantsCount: number;
  capacity?: number | null;
  status: "published" | "cancelled";
  isPast?: boolean;
  registered?: boolean;
};

type Tag = { label: string; tone: "marker" | "danger" | "muted" | "ink" };

function tagFor(e: EventCardData): Tag | null {
  if (e.status === "cancelled") return { label: "Annulé", tone: "danger" };
  if (e.isPast) return { label: "Terminé", tone: "muted" };
  if (e.registered) return { label: "Tu es inscrit·e", tone: "marker" };
  if (remainingSeats(e.participantsCount, e.capacity) === 0) return { label: "Complet", tone: "ink" };
  return null;
}

const tagTone: Record<Tag["tone"], string> = {
  marker: "bg-marker text-marker-ink",
  danger: "bg-danger-soft text-danger",
  muted: "bg-paper text-muted",
  ink: "bg-ink text-paper",
};

export function StatusTag({ tag }: { tag: Tag }) {
  return (
    <span
      className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-[0.8125rem] font-[650]", tagTone[tag.tone])}
    >
      {tag.label}
    </span>
  );
}

function CapacityMeter({ count, capacity }: { count: number; capacity: number }) {
  const ratio = Math.min(count / capacity, 1);
  return (
    <span aria-hidden className="block h-1 w-16 overflow-hidden rounded-full bg-line">
      <span className="block h-full rounded-full bg-ink" style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}

export function EventCard({ event, href, timeZone }: { event: EventCardData; href?: string; timeZone?: string }) {
  const tag = tagFor(event);
  const inactive = event.status === "cancelled" || event.isPast;
  const remaining = remainingSeats(event.participantsCount, event.capacity);

  const body = (
    <>
      <DateBlock
        date={event.startsAt}
        timeZone={timeZone}
        orgType={event.organization.type}
        highlighted={Boolean(event.registered) && event.status !== "cancelled"}
        muted={inactive}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
        <OrgBadge name={event.organization.name} type={event.organization.type} />
        <h3
          className={cn(
            "text-[1.0625rem] leading-snug font-[650] text-ink",
            event.status === "cancelled" && "line-through decoration-danger/60 decoration-2",
          )}
        >
          {event.title}
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-[500] text-muted">
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {formatTimeRange(event.startsAt, event.endsAt, timeZone)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
              <path
                d="M8 14.5s4.8-4.4 4.8-8a4.8 4.8 0 1 0-9.6 0c0 3.6 4.8 8 4.8 8Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="8" cy="6.4" r="1.6" fill="currentColor" />
            </svg>
            <span className="truncate">{event.location}</span>
          </span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          {tag && <StatusTag tag={tag} />}
          {!inactive && (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="whitespace-nowrap">{formatParticipants(event.participantsCount)}</span>
              {event.capacity != null && remaining !== 0 && (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <CapacityMeter count={event.participantsCount} capacity={event.capacity} />
                  {formatRemainingSeats(remaining!)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const shell = "flex gap-3.5 rounded-[var(--radius-card)] bg-surface p-3";
  return href ? (
    <Link href={href} className={cn(shell, "transition-colors hover:bg-surface/70")}>
      {body}
    </Link>
  ) : (
    <article className={shell}>{body}</article>
  );
}

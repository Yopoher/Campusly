import { cn } from "@/lib/cn";
import { dateBlockParts, formatLongDate } from "@/lib/format";
import { ORG_COLOR, type OrgType } from "./org-badge";

/**
 * Colonne de date : l'élément fort de Campusly.
 * Surlignée en jaune quand l'utilisateur est inscrit, comme un créneau dans un agenda.
 */
export function DateBlock({
  date,
  timeZone,
  orgType,
  highlighted = false,
  muted = false,
}: {
  date: Date;
  timeZone?: string;
  orgType: OrgType;
  highlighted?: boolean;
  muted?: boolean;
}) {
  const { weekday, day, month } = dateBlockParts(date, timeZone);
  return (
    <div
      className={cn(
        "flex w-[4.25rem] shrink-0 flex-col items-center justify-center self-start rounded-[12px] py-2.5 transition-colors duration-200",
        highlighted ? "bg-marker text-marker-ink" : "bg-paper text-ink",
        muted && "opacity-55",
      )}
    >
      <span className="sr-only">{formatLongDate(date, timeZone)}</span>
      <span aria-hidden className="text-[0.8125rem] leading-none font-[600]">
        {weekday}
      </span>
      <span aria-hidden className="text-[2.5rem] leading-[0.95] font-[800] font-condensed tabular-nums">
        {day}
      </span>
      <span aria-hidden className="text-[0.8125rem] leading-none font-[600]">
        {month}
      </span>
      <span aria-hidden className="mt-2 h-[3px] w-6 rounded-full" style={{ backgroundColor: ORG_COLOR[orgType] }} />
    </div>
  );
}

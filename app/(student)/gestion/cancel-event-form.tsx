"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import type { EventActionState } from "./actions";

/** Annulation : confirmation explicite, motif facultatif. L'événement reste consultable par les inscrits. */
export function CancelEventForm({
  action,
}: {
  action: (prev: EventActionState, formData: FormData) => Promise<EventActionState>;
}) {
  const [state, submit, saving] = useActionState<EventActionState, FormData>(action, {});
  return (
    <form action={submit} className="flex flex-col gap-4">
      {state.error && <Notice tone="error" title={state.error} />}
      <TextAreaField
        label="Motif (facultatif)"
        name="reason"
        maxLength={500}
        rows={3}
        hint="Affiché aux étudiants sur la fiche de l’événement."
      />
      <label className="flex items-start gap-3 text-[0.9375rem] text-ink">
        <input type="checkbox" name="confirm" required className="mt-1 size-5 accent-[var(--c-danger)]" />
        <span>Je confirme l’annulation. Les données de l’événement sont conservées.</span>
      </label>
      <Button type="submit" variant="danger" loading={saving} loadingLabel="Annulation…" className="self-start">
        Annuler l’événement
      </Button>
    </form>
  );
}

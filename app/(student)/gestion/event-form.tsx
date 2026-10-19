"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import type { EventFormState } from "./actions";

export type EventFormValues = Partial<
  Record<
    | "title"
    | "description"
    | "starts_at"
    | "ends_at"
    | "location"
    | "capacity"
    | "registration_deadline"
    | "external_url",
    string
  >
>;

/**
 * Formulaire de création et de modification d'un événement.
 * Les valeurs saisies sont renvoyées par le serveur en cas d'erreur, pour ne rien perdre.
 */
export function EventForm({
  action,
  mode,
  organizations,
  organizationId,
  defaults,
  canPublish,
}: {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  mode: "create" | "edit";
  organizations: { id: string; name: string }[];
  organizationId: string;
  defaults: EventFormValues;
  /** Afficher le bouton « Publier » (création, ou modification d'un brouillon). */
  canPublish: boolean;
}) {
  const [state, submit, saving] = useActionState<EventFormState, FormData>(action, {});
  const values = { ...defaults, ...(state.values as EventFormValues | undefined) };
  const errors = state.errors ?? {};

  return (
    <form action={submit} className="flex flex-col gap-5" noValidate>
      {state.error && <Notice tone="error" title={state.error} />}
      {state.done === "updated" && <Notice tone="success" title="Modifications enregistrées" />}
      {state.done === "published" && <Notice tone="success" title="Événement publié" />}

      {mode === "create" && organizations.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.9375rem] font-[600] text-ink">Au nom de</span>
          <select
            name="organization_id"
            defaultValue={String(state.values?.organization_id ?? organizationId)}
            className="min-h-12 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 text-base text-ink"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="organization_id" value={organizationId} />
      )}

      <TextField
        label="Titre"
        name="title"
        required
        maxLength={120}
        defaultValue={values.title ?? ""}
        error={errors.title}
      />
      <TextAreaField
        label="Description (facultatif)"
        name="description"
        maxLength={5000}
        rows={5}
        defaultValue={values.description ?? ""}
        error={errors.description}
        hint="5 000 caractères maximum."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Début"
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={values.starts_at ?? ""}
          error={errors.starts_at}
          hint="Heure de Paris."
        />
        <TextField
          label="Fin (facultatif)"
          name="ends_at"
          type="datetime-local"
          defaultValue={values.ends_at ?? ""}
          error={errors.ends_at}
        />
      </div>
      <TextField
        label="Lieu"
        name="location"
        required
        maxLength={200}
        defaultValue={values.location ?? ""}
        error={errors.location}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Nombre de places (facultatif)"
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={values.capacity ?? ""}
          error={errors.capacity}
          hint="Vide : sans limite."
        />
        <TextField
          label="Date limite d’inscription (facultatif)"
          name="registration_deadline"
          type="datetime-local"
          defaultValue={values.registration_deadline ?? ""}
          error={errors.registration_deadline}
        />
      </div>
      <TextField
        label="Lien externe (facultatif)"
        name="external_url"
        type="url"
        placeholder="https://"
        defaultValue={values.external_url ?? ""}
        error={errors.external_url}
        hint="Billetterie ou formulaire externe. Doit commencer par https://."
      />

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <Button
          type="submit"
          variant={canPublish ? "secondary" : "primary"}
          loading={saving}
          loadingLabel="Enregistrement…"
        >
          {mode === "create" ? "Enregistrer le brouillon" : "Enregistrer les modifications"}
        </Button>
        {canPublish && (
          <Button type="submit" name="publish" value="1" loading={saving} loadingLabel="Publication…">
            Publier
          </Button>
        )}
      </div>
    </form>
  );
}

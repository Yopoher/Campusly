"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { EVENT_PERMISSIONS, ORG_TYPES } from "@/lib/admin/forms";
import {
  addMemberAction,
  createOrganizationAction,
  createSchoolAction,
  type BackOfficeState,
} from "./back-office-actions";

const select = "min-h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-base text-ink";

function Feedback({ state }: { state: BackOfficeState }) {
  if (state.error) return <Notice tone="error" title={state.error} />;
  if (state.done) return <Notice tone="success" title={state.done} />;
  return null;
}

export function SchoolForm() {
  const [state, submit, saving] = useActionState<BackOfficeState, FormData>(createSchoolAction, {});
  return (
    <form action={submit} className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5" noValidate>
      <h3 className="text-base font-[700]">Nouvelle école</h3>
      <Feedback state={state} />
      <TextField name="name" label="Nom de l’école" required />
      <TextField
        name="slug"
        label="Identifiant"
        hint="Lettres minuscules, chiffres et tirets. Ex. : ynov-lyon"
        required
      />
      <TextField
        name="domains"
        label="Domaines e-mail"
        hint="Séparés par des virgules. Ex. : ynov.com, ynov-lyon.com"
        required
      />
      <TextField name="timezone" label="Fuseau horaire" defaultValue="Europe/Paris" />
      <Button type="submit" loading={saving} loadingLabel="Création en cours">
        Créer l’école
      </Button>
    </form>
  );
}

export function OrganizationForm({ schoolId }: { schoolId: string }) {
  const [state, submit, saving] = useActionState<BackOfficeState, FormData>(createOrganizationAction, {});
  return (
    <form action={submit} className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5" noValidate>
      <input type="hidden" name="school_id" value={schoolId} />
      <h3 className="text-base font-[700]">Nouvelle organisation</h3>
      <Feedback state={state} />
      <TextField name="name" label="Nom" required />
      <label className="flex flex-col gap-2">
        <span className="font-[600]">Type</span>
        <select name="type" className={select} defaultValue="bde">
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <TextAreaField name="description" label="Description (facultative)" rows={3} />
      <Button type="submit" loading={saving} loadingLabel="Création en cours">
        Créer l’organisation
      </Button>
    </form>
  );
}

export function MemberForm({ schoolId, organizationId }: { schoolId: string; organizationId: string }) {
  const [state, submit, saving] = useActionState<BackOfficeState, FormData>(addMemberAction, {});
  return (
    <form action={submit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="school_id" value={schoolId} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <Feedback state={state} />
      <TextField name="email" label="Adresse e-mail de la personne" type="email" required />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-[600]">Permissions</legend>
        {EVENT_PERMISSIONS.map((p) => (
          <label key={p.value} className="flex items-center gap-3 text-base">
            <input type="checkbox" name="permissions" value={p.value} className="size-5 accent-ink" />
            {p.label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="secondary" loading={saving} loadingLabel="Ajout en cours">
        Ajouter le membre
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { saveProfileAction, type ProfileFormState } from "./profile-actions";

export function ProfileForm({
  defaults,
  onboarding = false,
}: {
  defaults: { first_name: string; last_name: string; bio: string | null };
  onboarding?: boolean;
}) {
  const [state, save, saving] = useActionState<ProfileFormState, FormData>(saveProfileAction, {});
  return (
    <form action={save} className="flex flex-col gap-5">
      {state.error && <Notice tone="error" title={state.error} />}
      {state.saved && <Notice tone="success" title="Profil enregistré" />}
      {onboarding && <input type="hidden" name="onboarding" value="1" />}
      <TextField
        label="Prénom"
        name="first_name"
        autoComplete="given-name"
        defaultValue={defaults.first_name}
        required
        maxLength={60}
      />
      <TextField
        label="Nom"
        name="last_name"
        autoComplete="family-name"
        defaultValue={defaults.last_name}
        required
        maxLength={60}
      />
      <TextAreaField
        label="Courte présentation (facultatif)"
        name="bio"
        maxLength={280}
        defaultValue={defaults.bio ?? ""}
        hint="280 caractères maximum. Visible par les étudiants de ton école, avec ton prénom, ton nom et ta photo."
      />
      <Button type="submit" fullWidth={onboarding} loading={saving} loadingLabel="Enregistrement…">
        {onboarding ? "Continuer" : "Enregistrer"}
      </Button>
    </form>
  );
}

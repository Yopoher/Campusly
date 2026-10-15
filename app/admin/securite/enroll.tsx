"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CodeField } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { confirmEnrollmentAction, startEnrollmentAction, type EnrollState } from "../actions";

export function Enroll() {
  const [enrollment, setEnrollment] = useState<EnrollState>({});
  const [starting, startTransition] = useTransition();
  const [state, confirm, confirming] = useActionState(confirmEnrollmentAction, {});

  if (!enrollment.factorId) {
    return (
      <div className="flex flex-col gap-4">
        {enrollment.error && <Notice tone="error" title={enrollment.error} />}
        <Button
          loading={starting}
          loadingLabel="Préparation…"
          onClick={() => startTransition(async () => setEnrollment(await startEnrollmentAction()))}
        >
          Configurer l’application d’authentification
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">
        Scanne ce QR code avec ton application d’authentification (Google Authenticator, Microsoft Authenticator,
        1Password…), puis saisis le code à 6 chiffres qu’elle affiche.
      </p>
      {/* QR code fourni par Supabase sous forme d'image SVG en data URL */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrollment.qrCode} alt="QR code d’enrôlement" className="size-48 rounded-[12px] bg-white p-2" />
      <details className="text-sm text-muted">
        <summary className="cursor-pointer">Saisir la clé à la main</summary>
        <code className="mt-2 block break-all text-ink">{enrollment.secret}</code>
      </details>
      <form action={confirm} className="flex flex-col gap-4">
        <input type="hidden" name="factor_id" value={enrollment.factorId} />
        <CodeField label="Code de l’application" name="code" required error={state.error} />
        <Button type="submit" loading={confirming} loadingLabel="Vérification…">
          Activer la double authentification
        </Button>
      </form>
    </div>
  );
}

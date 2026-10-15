"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CodeField } from "@/components/ui/field";
import { verifySecondFactorAction } from "../actions";

export function VerifyForm() {
  const [state, verify, verifying] = useActionState(verifySecondFactorAction, {});
  return (
    <form action={verify} className="flex flex-col gap-4">
      <CodeField label="Code de l’application d’authentification" name="code" required autoFocus error={state.error} />
      <Button type="submit" loading={verifying} loadingLabel="Vérification…">
        Accéder à l’administration
      </Button>
    </form>
  );
}

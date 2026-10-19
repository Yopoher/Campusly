"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { registerForEventAction, unregisterFromEventAction, type RegistrationState } from "./actions";

/**
 * Bouton d'inscription et de désinscription. Le serveur décide de tout (état, capacité, école) ;
 * l'interface ne fait qu'afficher le résultat renvoyé.
 */
export function RegistrationPanel({
  eventId,
  registered,
  open,
  closedReason,
}: {
  eventId: string;
  registered: boolean;
  open: boolean;
  /** Explication affichée quand les inscriptions sont fermées (ex. « Complet »). */
  closedReason: string | null;
}) {
  const [state, submit, pending] = useActionState<RegistrationState, FormData>(
    async (_prev, formData) =>
      formData.get("intent") === "leave" ? unregisterFromEventAction(eventId) : registerForEventAction(eventId),
    {},
  );

  const isRegistered = state.done === "registered" ? true : state.done === "unregistered" ? false : registered;

  return (
    <section aria-labelledby="inscription" className="flex flex-col gap-3">
      <h2 id="inscription" className="sr-only">
        Inscription
      </h2>
      {state.error && <Notice tone="error" title={state.error} />}

      {isRegistered ? (
        <>
          <Notice tone="success" title="Tu es inscrit·e à cet événement" />
          {open && (
            <form action={submit}>
              <input type="hidden" name="intent" value="leave" />
              <Button type="submit" variant="secondary" fullWidth loading={pending} loadingLabel="Désinscription…">
                Me désinscrire
              </Button>
            </form>
          )}
        </>
      ) : open ? (
        <>
          <p className="text-sm text-muted">Ta participation sera visible par les étudiants de ton école.</p>
          <form action={submit}>
            <input type="hidden" name="intent" value="join" />
            <Button type="submit" fullWidth loading={pending} loadingLabel="Inscription…">
              Je m’inscris
            </Button>
          </form>
        </>
      ) : (
        closedReason && <Notice tone="info" title={closedReason} />
      )}
    </section>
  );
}

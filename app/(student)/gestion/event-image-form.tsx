"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import type { EventImageState } from "./actions";

/**
 * Image d'un événement : aperçu, ajout ou remplacement, retrait.
 * Le traitement du fichier (format, poids, ré-encodage) se fait sur le serveur.
 */
export function EventImageForm({
  currentUrl,
  upload,
  remove,
}: {
  currentUrl: string | null;
  upload: (prev: EventImageState, formData: FormData) => Promise<EventImageState>;
  remove: () => Promise<EventImageState>;
}) {
  const [state, submit, saving] = useActionState<EventImageState, FormData>(upload, {});
  const [removeState, removeSubmit, removing] = useActionState<EventImageState, FormData>(async () => remove(), {});

  return (
    <div className="flex flex-col gap-5">
      {currentUrl ? (
        // Lien signé et temporaire, produit par le serveur : pas d'optimisation d'image côté Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt="Image actuelle de l’événement"
          className="aspect-video w-full rounded-[var(--radius-card)] border border-line object-cover"
        />
      ) : (
        <p className="text-muted">Aucune image pour l’instant.</p>
      )}

      {state.error && <Notice tone="error" title={state.error} />}
      {removeState.error && <Notice tone="error" title={removeState.error} />}
      {state.done === "uploaded" && <Notice tone="success" title="Image enregistrée" />}
      {removeState.done === "removed" && <Notice tone="success" title="Image retirée" />}

      <form action={submit} className="flex flex-col gap-3" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.9375rem] font-[600] text-ink">
            {currentUrl ? "Remplacer l’image" : "Ajouter une image"}
          </span>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
            className="min-h-12 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-base text-ink file:mr-3 file:font-[600]"
          />
          <span className="text-sm text-muted">JPEG, PNG ou WebP, 4 Mo maximum.</span>
        </label>
        <Button type="submit" variant="secondary" loading={saving} loadingLabel="Envoi…" className="self-start">
          Envoyer l’image
        </Button>
      </form>

      {currentUrl && (
        <form action={removeSubmit}>
          <Button type="submit" variant="ghost" loading={removing} loadingLabel="Retrait…">
            Retirer l’image
          </Button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { importConfirmAction, importPreviewAction, type ImportState } from "@/app/admin/back-office-actions";

const textArea =
  "min-h-40 w-full rounded-[var(--radius-control)] border border-line bg-surface p-3 font-mono text-sm text-ink";

export function ImportForm({ schoolId }: { schoolId: string }) {
  const [text, setText] = useState("");
  const [preview, submitPreview, checking] = useActionState<ImportState, FormData>(importPreviewAction, {});
  const [confirm, submitConfirm, importing] = useActionState<ImportState, FormData>(importConfirmAction, {});

  async function readFile(file: File | undefined) {
    if (file) setText(await file.text());
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={submitPreview}
        className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5"
        noValidate
      >
        <input type="hidden" name="school_id" value={schoolId} />
        <h2 className="text-lg font-[700]">1. Choisir le fichier</h2>
        <p className="text-sm text-muted">
          Colonnes : <code>email</code> (obligatoire), <code>prenom</code>, <code>nom</code>, <code>type</code>{" "}
          (étudiant ou personnel), <code>promotion</code>, <code>identifiant</code>. Séparateur virgule ou
          point-virgule.
        </p>
        {preview.error && <Notice tone="error" title={preview.error} />}
        <label className="flex flex-col gap-2">
          <span className="font-[600]">Fichier CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => readFile(e.target.files?.[0])}
            className="text-base"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-[600]">Ou colle le contenu</span>
          <textarea name="csv" value={text} onChange={(e) => setText(e.target.value)} className={textArea} />
        </label>
        <Button type="submit" variant="secondary" loading={checking} loadingLabel="Vérification en cours">
          Vérifier le fichier
        </Button>
      </form>

      {preview.preview && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5">
          <h2 className="text-lg font-[700]">2. Résumé avant import</h2>
          <ul className="flex flex-col gap-1 text-base">
            <li>{preview.preview.added} adresse(s) seront ajoutées</li>
            <li>{preview.preview.updated} adresse(s) déjà présentes seront mises à jour</li>
            <li>{preview.preview.rejected.length} ligne(s) refusée(s)</li>
            <li>{preview.preview.conflicts.length} adresse(s) déjà dans une autre école (non importées)</li>
          </ul>
          {preview.preview.rejected.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="font-[600]">Lignes refusées</h3>
              <ul className="text-sm">
                {preview.preview.rejected.map((r) => (
                  <li key={`${r.line}-${r.email}`}>
                    Ligne {r.line} · {r.email || "(vide)"} : {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.preview.conflicts.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="font-[600]">À traiter à la main</h3>
              <ul className="text-sm">
                {preview.preview.conflicts.map((c) => (
                  <li key={`${c.line}-${c.email}`}>
                    Ligne {c.line} · {c.email}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {confirm.error && <Notice tone="error" title={confirm.error} />}
          {confirm.done && (
            <Notice
              tone="success"
              title={`Import terminé : ${confirm.done.inserted} ajoutée(s), ${confirm.done.updated} mise(s) à jour, ${confirm.done.rejected} refusée(s) ou en conflit.`}
            />
          )}
          <form action={submitConfirm}>
            <input type="hidden" name="school_id" value={schoolId} />
            <input type="hidden" name="csv" value={preview.csv ?? ""} />
            <Button
              type="submit"
              loading={importing}
              loadingLabel="Import en cours"
              disabled={preview.preview.toImportCount === 0}
            >
              Importer {preview.preview.toImportCount} adresse(s)
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}

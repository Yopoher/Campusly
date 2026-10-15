"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CodeField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { requestCodeAction, verifyCodeAction, type LoginState } from "./actions";

const initial: LoginState = { step: "email" };

export function LoginForm() {
  const next = useSearchParams().get("suite") ?? "";
  const [requestState, requestCode, requesting] = useActionState(requestCodeAction, initial);
  const [verifyState, verifyCode, verifying] = useActionState(verifyCodeAction, initial);
  const [editingEmail, setEditingEmail] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const onCodeStep = requestState.step === "code" && !editingEmail;
  const email = requestState.step === "code" ? requestState.email : (requestState.email ?? "");

  useEffect(() => {
    if (onCodeStep) codeRef.current?.focus();
  }, [onCodeStep, requestState]);

  if (!onCodeStep) {
    return (
      <form
        action={(fd) => {
          setEditingEmail(false);
          requestCode(fd);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        {requestState.error && <Notice tone="error" title={requestState.error} />}
        <TextField
          label="Adresse e-mail de l’école"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="prenom.nom@ynov.com"
          defaultValue={email}
          required
          autoFocus
        />
        <Button type="submit" fullWidth loading={requesting} loadingLabel="Envoi du code…">
          Recevoir un code
        </Button>
      </form>
    );
  }

  const error = verifyState.step === "code" && verifyState.email === email ? verifyState.error : undefined;
  return (
    <div className="flex flex-col gap-5">
      <Notice tone="info" title={`Si ${email} est autorisée, tu vas recevoir un code à 6 chiffres.`}>
        Il est valable 10 minutes. Pense à regarder dans tes courriers indésirables.
      </Notice>
      <form action={verifyCode} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="suite" value={next} />
        <CodeField ref={codeRef} name="code" required error={error} />
        <Button type="submit" fullWidth loading={verifying} loadingLabel="Vérification…">
          Me connecter
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form action={requestCode}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="ghost" size="sm" loading={requesting} loadingLabel="Envoi…">
            Renvoyer un code
          </Button>
        </form>
        <Button variant="ghost" size="sm" onClick={() => setEditingEmail(true)}>
          Changer d’adresse
        </Button>
      </div>
    </div>
  );
}

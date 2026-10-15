"use client";

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { inputId: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
};

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[0.9375rem] font-[600] text-ink">
        {label}
      </label>
      {children({ inputId, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-[500] text-danger">
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden>
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

const controlBase =
  "w-full rounded-[var(--radius-control)] border bg-surface px-3.5 text-base text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy, invalid }) => (
        <input
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            controlBase,
            "min-h-12",
            invalid ? "border-danger" : "border-line hover:border-ink/40",
            className,
          )}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextAreaField({ label, hint, error, className, ...props }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy, invalid }) => (
        <textarea
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            controlBase,
            "min-h-28 py-3 leading-relaxed",
            invalid ? "border-danger" : "border-line hover:border-ink/40",
            className,
          )}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/**
 * Saisie du code de connexion : un seul champ (collage et remplissage automatique iOS/Android
 * via autocomplete="one-time-code"), composé en grands chiffres condensés.
 */
export function CodeField({
  label = "Code reçu par e-mail",
  hint,
  error,
  ...props
}: Omit<TextFieldProps, "label" | "type" | "inputMode"> & { label?: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy, invalid }) => (
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          placeholder="••••••"
          className={cn(
            controlBase,
            "min-h-16 text-center text-[2.25rem] font-[750] tracking-[0.45em] font-condensed tabular-nums placeholder:tracking-[0.45em]",
            invalid ? "border-danger" : "border-line hover:border-ink/40",
          )}
          {...props}
        />
      )}
    </FieldShell>
  );
}

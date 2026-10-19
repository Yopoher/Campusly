"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { messageForDatabaseError } from "@/lib/events/model";

// --- Types d'état retournés aux composants ---

export type SendMessageState = { error?: string; done?: boolean };
export type ReportMessageState = { error?: string; done?: boolean };
export type HideMessageState = { error?: string; done?: boolean };

// --- Validations ---

const messageSchema = z.object({
  eventId: z.guid(),
  body: z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide.")
    .max(2000, "Le message ne peut pas dépasser 2 000 caractères."),
  organizationId: z.guid().optional(),
});

const messageIdSchema = z.coerce.number().int().positive();

// --- Actions ---

/**
 * Envoyer un message dans la conversation d'un événement.
 * La fonction post_message vérifie l'accès, l'état de l'événement et la suspension.
 */
export async function sendMessageAction(
  _prev: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const parsed = messageSchema.safeParse({
    eventId: formData.get("eventId"),
    body: formData.get("body"),
    organizationId: formData.get("organizationId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("post_message", {
    p_event: parsed.data.eventId,
    p_body: parsed.data.body,
    p_as_org: parsed.data.organizationId ?? null,
  });

  if (error) return { error: messageForDatabaseError(error) };
  return { done: true };
}

/**
 * Signaler un message. Idempotent côté base.
 */
export async function reportMessageAction(
  _prev: ReportMessageState,
  formData: FormData,
): Promise<ReportMessageState> {
  const id = messageIdSchema.safeParse(formData.get("messageId"));
  if (!id.success) return { error: "Message introuvable." };

  const reason = z.string().max(500).optional().parse(formData.get("reason") || undefined);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("report_message", {
    p_message_id: id.data,
    p_reason: reason ?? null,
  });

  if (error) return { error: messageForDatabaseError(error) };
  return { done: true };
}

/**
 * Masquer un message (modérateur uniquement).
 */
export async function hideMessageAction(
  _prev: HideMessageState,
  formData: FormData,
): Promise<HideMessageState> {
  const id = messageIdSchema.safeParse(formData.get("messageId"));
  if (!id.success) return { error: "Message introuvable." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("hide_message", { p_message_id: id.data });

  if (error) return { error: messageForDatabaseError(error) };
  return { done: true };
}

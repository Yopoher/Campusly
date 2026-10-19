"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { messageForDatabaseError } from "@/lib/events/model";

export type ModerationActionState = { error?: string; done?: boolean };

/**
 * Traiter un signalement (résoudre ou rejeter).
 */
export async function handleReportAction(
  _prev: ModerationActionState,
  formData: FormData,
): Promise<ModerationActionState> {
  const reportId = z.guid().safeParse(formData.get("reportId"));
  if (!reportId.success) return { error: "Signalement introuvable." };

  const action = formData.get("action");
  if (action !== "resolved" && action !== "dismissed") return { error: "Action invalide." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("handle_report", {
    p_report_id: reportId.data,
    p_action: action,
  });

  if (error) return { error: messageForDatabaseError(error) };
  revalidatePath("/gestion/moderation");
  return { done: true };
}

/**
 * Suspendre le chat d'un utilisateur.
 */
export async function suspendChatAction(
  _prev: ModerationActionState,
  formData: FormData,
): Promise<ModerationActionState> {
  const userId = z.guid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Utilisateur introuvable." };

  const hours = z.coerce.number().int().min(1).max(720).safeParse(formData.get("hours"));
  if (!hours.success) return { error: "Durée invalide (entre 1 et 720 heures)." };

  const until = new Date(Date.now() + hours.data * 3600 * 1000).toISOString();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("suspend_chat_user", {
    p_user_id: userId.data,
    p_until: until,
  });

  if (error) return { error: messageForDatabaseError(error) };
  revalidatePath("/gestion/moderation");
  return { done: true };
}

/**
 * Lever la suspension du chat d'un utilisateur.
 */
export async function unsuspendChatAction(
  _prev: ModerationActionState,
  formData: FormData,
): Promise<ModerationActionState> {
  const userId = z.guid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Utilisateur introuvable." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unsuspend_chat_user", { p_user_id: userId.data });

  if (error) return { error: messageForDatabaseError(error) };
  revalidatePath("/gestion/moderation");
  return { done: true };
}

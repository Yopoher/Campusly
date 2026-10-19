"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { messageForDatabaseError } from "@/lib/events/model";

export type RegistrationState = { error?: string; done?: "registered" | "unregistered" };

const eventId = z.guid();

/**
 * Inscription : la fonction register_for_event vérifie l'état, la date limite, la capacité et l'école,
 * et verrouille l'événement pour que deux inscriptions simultanées ne dépassent pas la capacité.
 * Un double clic est sans effet (idempotent côté base).
 */
export async function registerForEventAction(id: string): Promise<RegistrationState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_for_event", { p_event: id });
  if (error) return { error: messageForDatabaseError(error) };
  revalidatePath("/evenements", "layout");
  return { done: "registered" };
}

export async function unregisterFromEventAction(id: string): Promise<RegistrationState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unregister_from_event", { p_event: id });
  if (error) return { error: messageForDatabaseError(error) };
  revalidatePath("/evenements", "layout");
  return { done: "unregistered" };
}

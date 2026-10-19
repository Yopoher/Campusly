import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listMessages } from "@/lib/conversations/queries";
import { getCurrentUser } from "@/lib/auth/session";

const params = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(
  request: NextRequest,
  { params: routeParams }: { params: Promise<{ eventId: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.profile) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { eventId } = await routeParams;
  if (!z.guid().safeParse(eventId).success) {
    return NextResponse.json({ error: "Paramètre invalide" }, { status: 400 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = params.safeParse(searchParams);
  if (!parsed.success) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });

  try {
    const result = await listMessages(eventId, {
      limit: parsed.data.limit,
      before: parsed.data.before,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }
}

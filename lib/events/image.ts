import sharp from "sharp";

/**
 * Traitement des images d'événements (docs/SECURITY.md §5.3).
 * Chaque image est décodée puis ré-encodée côté serveur : seuls les pixels sont conservés
 * (EXIF, géolocalisation et autres métadonnées sont supprimés), l'orientation est appliquée,
 * la taille est réduite et le format est toujours WebP. Un fichier qui n'est pas une image
 * JPEG, PNG ou WebP est refusé avant tout stockage.
 */

/** Bucket Storage privé (docs/SECURITY.md §5.3). */
export const EVENT_IMAGE_BUCKET = "event-images";
/** Durée de validité des liens d'affichage, en secondes. */
export const EVENT_IMAGE_URL_SECONDS = 600;

/** Taille maximale du fichier envoyé. Limitée aussi par la taille de requête de l'hébergeur (4,5 Mo). */
export const EVENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/** Côté le plus long de l'image conservée, en pixels. */
export const EVENT_IMAGE_MAX_EDGE = 1600;
/** Nombre de pixels acceptés à la lecture (protection contre les images « bombes »). */
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProcessedEventImage = { ok: true; data: Buffer } | { ok: false; message: string };

const refuse = (message: string): ProcessedEventImage => ({ ok: false, message });

export async function processEventImage(input: Buffer): Promise<ProcessedEventImage> {
  if (input.byteLength === 0) return refuse("Le fichier est vide.");
  if (input.byteLength > EVENT_IMAGE_MAX_BYTES) return refuse("L’image dépasse 4 Mo. Réduis-la avant de l’envoyer.");

  let format: string | undefined;
  try {
    ({ format } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata());
  } catch {
    return refuse("Ce fichier n’est pas une image lisible.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    return refuse("Format refusé : envoie une image JPEG, PNG ou WebP.");
  }

  try {
    const data = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: EVENT_IMAGE_MAX_EDGE,
        height: EVENT_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    return { ok: true, data };
  } catch {
    return refuse("Cette image n’a pas pu être traitée. Essaie avec une autre photo.");
  }
}

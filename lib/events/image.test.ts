// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { EVENT_IMAGE_MAX_BYTES, EVENT_IMAGE_MAX_EDGE, processEventImage } from "./image";

const RIFF_WEBP = (b: Buffer) =>
  b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";

async function jpeg(width = 200, height = 120) {
  return sharp({ create: { width, height, channels: 3, background: "#3b82f6" } })
    .jpeg()
    .toBuffer();
}

describe("processEventImage", () => {
  it("convertit un JPEG en WebP", async () => {
    const result = await processEventImage(await jpeg());
    expect(result.ok).toBe(true);
    if (result.ok) expect(RIFF_WEBP(result.data)).toBe(true);
  });

  it("accepte un PNG", async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 4, background: "#00000080" } })
      .png()
      .toBuffer();
    const result = await processEventImage(png);
    expect(result.ok).toBe(true);
  });

  it("accepte un WebP", async () => {
    const webp = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#ffffff" } })
      .webp()
      .toBuffer();
    const result = await processEventImage(webp);
    expect(result.ok).toBe(true);
  });

  it("réduit les grandes images au côté maximal, sans agrandir les petites", async () => {
    const big = await processEventImage(await jpeg(3000, 2000));
    expect(big.ok).toBe(true);
    if (big.ok) {
      const meta = await sharp(big.data).metadata();
      expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(EVENT_IMAGE_MAX_EDGE);
    }

    const small = await processEventImage(await jpeg(200, 120));
    if (small.ok) {
      const meta = await sharp(small.data).metadata();
      expect(meta.width).toBe(200);
    }
  });

  it("supprime les métadonnées EXIF (localisation comprise)", async () => {
    const withExif = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#ffffff" } })
      .withExif({ IFD0: { Copyright: "PRIVE-TEST", ImageDescription: "adresse secrète" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await processEventImage(withExif);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const meta = await sharp(result.data).metadata();
      expect(meta.exif).toBeUndefined();
      expect(result.data.includes(Buffer.from("PRIVE-TEST"))).toBe(false);
    }
  });

  it("refuse un fichier vide", async () => {
    const result = await processEventImage(Buffer.alloc(0));
    expect(result).toMatchObject({ ok: false, message: "Le fichier est vide." });
  });

  it("refuse un fichier trop lourd avant de le lire", async () => {
    const result = await processEventImage(Buffer.alloc(EVENT_IMAGE_MAX_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("4 Mo");
  });

  it("refuse un texte, même renommé en .jpg", async () => {
    const result = await processEventImage(Buffer.from("<script>alert(1)</script>"));
    expect(result).toMatchObject({ ok: false, message: "Ce fichier n’est pas une image lisible." });
  });

  it("refuse un SVG, qui peut contenir du code", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    const result = await processEventImage(svg);
    expect(result.ok).toBe(false);
  });

  it("refuse un GIF", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#ffffff" } })
      .gif()
      .toBuffer();
    const result = await processEventImage(gif);
    expect(result).toMatchObject({ ok: false, message: "Format refusé : envoie une image JPEG, PNG ou WebP." });
  });
});

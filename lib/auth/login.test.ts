import { describe, expect, it, vi } from "vitest";
import { requestLoginCode, safeNextPath, verifyLoginCode } from "./login";

const deps = (precheck: string, sendStatus?: number) => ({
  precheck: vi.fn(async () => precheck),
  sendCode: vi.fn(async () => ({ errorStatus: sendStatus })),
});

describe("demande d'un code", () => {
  it("normalise l'adresse et envoie le code si elle est autorisée", async () => {
    const d = deps("ok");
    expect(await requestLoginCode("  Alice.Martin@YNOV.com ", "ip", d)).toEqual({
      status: "sent",
      email: "alice.martin@ynov.com",
    });
    expect(d.sendCode).toHaveBeenCalledWith("alice.martin@ynov.com");
  });

  it("répond exactement pareil pour une adresse non autorisée, sans envoyer de code", async () => {
    const d = deps("denied");
    expect(await requestLoginCode("inconnu@ynov.com", "ip", d)).toEqual({ status: "sent", email: "inconnu@ynov.com" });
    expect(d.sendCode).not.toHaveBeenCalled();
  });

  it("traite un refus du service d'authentification comme une adresse non autorisée", async () => {
    expect((await requestLoginCode("a@ynov.com", null, deps("ok", 403))).status).toBe("sent");
  });

  it("signale une limite atteinte, en base ou côté Auth", async () => {
    expect((await requestLoginCode("a@ynov.com", null, deps("throttled"))).status).toBe("throttled");
    expect((await requestLoginCode("a@ynov.com", null, deps("ok", 429))).status).toBe("throttled");
  });

  it("refuse une adresse mal formée avec un message utile", async () => {
    const r = await requestLoginCode("alice.martin", null, deps("ok"));
    expect(r).toMatchObject({ status: "invalid" });
  });

  it("renvoie une erreur générique si la base ne répond pas", async () => {
    const d = { precheck: vi.fn(async () => Promise.reject(new Error("réseau"))), sendCode: vi.fn() };
    expect((await requestLoginCode("a@ynov.com", null, d)).status).toBe("error");
  });
});

describe("vérification du code", () => {
  const ok = { verify: vi.fn(async () => ({})) };

  it("accepte un code de 6 chiffres, espaces tolérés", async () => {
    expect(await verifyLoginCode("a@ynov.com", "482 913", ok)).toEqual({ status: "verified" });
    expect(ok.verify).toHaveBeenCalledWith("a@ynov.com", "482913");
  });

  it("refuse un code mal formé sans interroger le serveur", async () => {
    const d = { verify: vi.fn() };
    expect(await verifyLoginCode("a@ynov.com", "12ab", d)).toMatchObject({ status: "invalid" });
    expect(d.verify).not.toHaveBeenCalled();
  });

  it("distingue code expiré ou déjà utilisé, et trop d'essais", async () => {
    expect(
      (
        await verifyLoginCode("a@ynov.com", "123456", {
          verify: async () => ({ errorStatus: 403, errorCode: "otp_expired" }),
        })
      ).status,
    ).toBe("expired");
    expect((await verifyLoginCode("a@ynov.com", "123456", { verify: async () => ({ errorStatus: 429 }) })).status).toBe(
      "throttled",
    );
  });
});

describe("redirection après connexion", () => {
  it("n'accepte que des chemins internes", () => {
    expect(safeNextPath("/profil")).toBe("/profil");
    expect(safeNextPath("https://pirate.example")).toBe("/evenements");
    expect(safeNextPath("//pirate.example")).toBe("/evenements");
    expect(safeNextPath("/\\pirate.example")).toBe("/evenements");
    expect(safeNextPath("/connexion")).toBe("/evenements");
    expect(safeNextPath(null)).toBe("/evenements");
  });
});

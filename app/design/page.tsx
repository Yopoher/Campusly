import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { CodeField, TextAreaField, TextField } from "@/components/ui/field";
import { EmptyState, Notice, SectionHeading } from "@/components/ui/feedback";
import { BottomNav } from "@/components/ui/bottom-nav";
import { EventCard, type EventCardData } from "@/components/events/event-card";
import { OrgBadge } from "@/components/events/org-badge";
import { RegisterDemo } from "./register-demo";
import { ThemeSwitch } from "./theme-switch";

export const metadata: Metadata = {
  title: "Système visuel",
  robots: { index: false, follow: false },
};

// Dates fixes : la page de démonstration ne dépend pas de l’heure courante.
const d = (iso: string) => new Date(iso);

const integration: EventCardData = {
  title: "Soirée d’intégration au Hangar 23",
  startsAt: d("2026-10-16T16:30:00Z"),
  endsAt: d("2026-10-16T20:30:00Z"),
  location: "Hangar 23, quai de Boisguilbert",
  organization: { name: "BDE Ynov Rouen", type: "bde" },
  participantsCount: 142,
  capacity: 180,
  status: "published",
};

const feed: { heading: string; events: EventCardData[] }[] = [
  {
    heading: "Cette semaine",
    events: [
      {
        title: "Job dating alternance : agences web et studios",
        startsAt: d("2026-10-15T12:00:00Z"),
        endsAt: d("2026-10-15T15:00:00Z"),
        location: "Amphi B",
        organization: { name: "Pédagogie", type: "pedagogy" },
        participantsCount: 38,
        capacity: 60,
        status: "published",
        registered: true,
      },
      {
        title: "Tournoi Smash Bros",
        startsAt: d("2026-10-17T13:00:00Z"),
        location: "Salle 204",
        organization: { name: "Ynov Gaming", type: "association" },
        participantsCount: 32,
        capacity: 32,
        status: "published",
      },
    ],
  },
  {
    heading: "La semaine prochaine",
    events: [
      {
        title: "Conférence : designer pour l’accessibilité",
        startsAt: d("2026-10-20T16:00:00Z"),
        endsAt: d("2026-10-20T17:30:00Z"),
        location: "Amphi A",
        organization: { name: "Ynov Campus Rouen", type: "school" },
        participantsCount: 0,
        capacity: null,
        status: "published",
      },
      {
        title: "Afterwork au Saint-Marc",
        startsAt: d("2026-10-22T17:00:00Z"),
        location: "Place Saint-Marc",
        organization: { name: "BDE Ynov Rouen", type: "bde" },
        participantsCount: 21,
        status: "cancelled",
        registered: true,
      },
    ],
  },
];

const past: EventCardData = {
  title: "Petit-déjeuner de rentrée",
  startsAt: d("2026-09-08T07:30:00Z"),
  location: "Cafétéria",
  organization: { name: "Ynov Campus Rouen", type: "school" },
  participantsCount: 96,
  status: "published",
  isPast: true,
  registered: true,
};

const palette = [
  { name: "ink", role: "Texte, boutons principaux", varName: "--c-ink" },
  { name: "paper", role: "Fond", varName: "--c-paper" },
  { name: "surface", role: "Cartes, champs", varName: "--c-surface" },
  { name: "line", role: "Séparateurs", varName: "--c-line" },
  { name: "muted", role: "Texte secondaire", varName: "--c-muted" },
  { name: "marker", role: "Inscription uniquement", varName: "--c-marker" },
];

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.75rem] leading-tight font-[750] font-narrow">{title}</h2>
        {intro && <p className="max-w-[60ch] text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-10 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <Logo size="lg" />
          <p className="max-w-[52ch] text-lg text-muted">
            Système visuel de Campusly. La date est l’élément fort ; le jaune surligneur ne sert qu’à une chose, montrer
            où tu es inscrit·e.
          </p>
        </div>
        <ThemeSwitch />
      </header>

      <Section
        title="Le fil"
        intro="Les événements de l’école, classés par date. Les dates surlignées sont celles où tu es inscrit·e."
      >
        <div className="grid items-start gap-8 lg:grid-cols-[400px_1fr]">
          <div className="overflow-hidden rounded-[28px] border border-line bg-paper">
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <Logo size="sm" />
              <span className="text-sm text-muted">Ynov Campus Rouen</span>
            </div>
            <div className="flex flex-col gap-6 px-3 pb-6">
              {feed.map((group) => (
                <div key={group.heading} className="flex flex-col gap-2.5">
                  <div className="px-1">
                    <SectionHeading>{group.heading}</SectionHeading>
                  </div>
                  {group.events.map((e) => (
                    <EventCard key={e.title} event={e} />
                  ))}
                </div>
              ))}
            </div>
            <BottomNav
              items={[
                { label: "Événements", icon: "events", active: true },
                { label: "Notifications", icon: "notifications", badge: 3 },
                { label: "Profil", icon: "profile" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-6">
            <section aria-labelledby="demo-inscription" className="flex flex-col gap-3">
              <h3 id="demo-inscription" className="text-lg font-[650]">
                S’inscrire
              </h3>
              <p className="text-sm text-muted">Démonstration visuelle, rien n’est enregistré.</p>
              <RegisterDemo event={integration} />
            </section>
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-[650]">Événement passé</h3>
              <EventCard event={past} />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-[650]">Organisateurs</h3>
              <p className="text-sm text-muted">La pastille indique le type d’organisateur.</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <OrgBadge name="BDE" type="bde" />
                <OrgBadge name="Association" type="association" />
                <OrgBadge name="Pédagogie" type="pedagogy" />
                <OrgBadge name="École, direction" type="school" />
                <OrgBadge name="Autre service" type="other" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Typographie" intro="Une seule famille, Archivo. La largeur des caractères porte la hiérarchie.">
        <div className="flex flex-col gap-5">
          <div className="flex items-end gap-6">
            <span className="text-[5rem] leading-[0.85] font-[800] font-condensed tabular-nums">17</span>
            <p className="pb-2 text-sm text-muted">Numéro de date, condensé 62 %, graisse 800</p>
          </div>
          <div>
            <p className="text-[1.75rem] leading-tight font-[750] font-narrow">Mes inscriptions</p>
            <p className="text-sm text-muted">Titre d’écran, étroit 75 %, graisse 750</p>
          </div>
          <div>
            <p className="text-lg font-[700] font-narrow">Jeudi 17 octobre</p>
            <p className="text-sm text-muted">Intertitre du fil, étroit 75 %, graisse 700</p>
          </div>
          <div>
            <p className="text-[1.0625rem] font-[650]">Job dating alternance : agences web et studios</p>
            <p className="text-sm text-muted">Titre d’événement, largeur normale, graisse 650</p>
          </div>
          <p className="max-w-[60ch]">
            Rencontre une quinzaine d’agences et de studios de la région qui recrutent en alternance. Apporte ton CV et
            ton portfolio ; les entretiens durent dix minutes. Texte courant, graisse 400, interligne 1,5.
          </p>
        </div>
      </Section>

      <Section title="Couleurs" intro="Les couleurs d’organisation portent une information ; elles ne décorent pas.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {palette.map((c) => (
            <li key={c.name} className="flex flex-col gap-2">
              <span className="h-16 rounded-[12px] border border-line" style={{ background: `var(${c.varName})` }} />
              <span className="text-sm font-[650]">{c.name}</span>
              <span className="text-[0.8125rem] text-muted">{c.role}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Boutons" intro="Chaque bouton dit ce qu’il fait.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>M’inscrire</Button>
          <Button variant="secondary">Voir les participants</Button>
          <Button variant="ghost">Annuler</Button>
          <Button variant="danger">Annuler l’événement</Button>
          <Button loading loadingLabel="Envoi du code…">
            Recevoir un code
          </Button>
          <Button disabled>Complet</Button>
          <Button size="sm" variant="secondary">
            Modifier
          </Button>
        </div>
      </Section>

      <Section title="Formulaires">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <TextField
              label="Adresse e-mail de l’école"
              type="email"
              placeholder="prenom.nom@ynov.com"
              autoComplete="email"
            />
            <TextField
              label="Adresse e-mail de l’école"
              type="email"
              defaultValue="prenom.nom@gmail.com"
              error="Utilise ton adresse de l’école, en @ynov.com."
            />
            <TextAreaField
              label="Courte présentation"
              hint="280 caractères maximum. Visible par les étudiants de ton école."
              defaultValue="B2 développement web. Toujours partant pour un tournoi."
            />
          </div>
          <div className="flex flex-col gap-5">
            <CodeField hint="Le code est valable 10 minutes. Pense à regarder dans tes courriers indésirables." />
            <CodeField defaultValue="482913" error="Ce code n’est plus valable. Demande un nouveau code." />
          </div>
        </div>
      </Section>

      <Section title="Messages et états vides">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Notice tone="success" title="Tu es inscrit·e">
              Tu recevras un rappel la veille et une heure avant.
            </Notice>
            <Notice
              tone="error"
              title="L’inscription n’a pas abouti"
              action={
                <Button size="sm" variant="secondary">
                  Réessayer
                </Button>
              }
            >
              La connexion a été interrompue. Ta place n’a pas été réservée.
            </Notice>
            <Notice tone="info" title="Installe Campusly sur ton iPhone">
              Pour recevoir les rappels, ajoute Campusly à ton écran d’accueil.
            </Notice>
          </div>
          <EmptyState title="Aucun événement prévu pour l’instant">
            Les événements publiés par le BDE, les associations et la pédagogie apparaîtront ici. Active les
            notifications pour être prévenu·e dès qu’il y en a un.
          </EmptyState>
        </div>
      </Section>

      <Section title="Logo" intro="Provisoire : une page d’agenda dont la date est surlignée.">
        <div className="flex flex-wrap items-center gap-8">
          <Logo size="lg" />
          <Logo size="md" />
          <LogoMark className="size-16" title="Campusly" />
          <span className="inline-flex rounded-[22%] bg-[#17233f] p-3">
            <svg viewBox="0 0 48 48" className="size-12" aria-hidden>
              <rect x="4" y="8" width="40" height="36" rx="9" fill="#f3f5f9" />
              <rect x="12" y="3" width="5" height="11" rx="2.5" fill="#f3f5f9" stroke="#17233f" strokeWidth="2" />
              <rect x="31" y="3" width="5" height="11" rx="2.5" fill="#f3f5f9" stroke="#17233f" strokeWidth="2" />
              <rect x="11" y="21" width="26" height="14" rx="3" fill="#ffe14d" />
            </svg>
          </span>
        </div>
      </Section>
    </div>
  );
}

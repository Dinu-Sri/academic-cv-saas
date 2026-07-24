import { ScholarPagesChrome, ScholarPagesFooter } from "@/components/website/scholar-pages-chrome";
import type {
  AcademicCategoryKey,
  WebsiteComposition,
  WebsiteCompositionPage,
  WebsiteContentModule
} from "@/lib/website/composition-types";
import { getLegalPage, type LegalPageKey } from "@/lib/website/legal-content";
import { WEBSITE_SECTION_BY_KEY } from "@/lib/website/section-registry";

type PublicEntry = { id: string; sectionKey: string; data: Record<string, string> };

export type ModernScholarModel = {
  publicUrl: string;
  username?: string;
  identity: {
    displayName: string;
    headline: string;
    affiliation: string;
    location: string;
    email: string;
    orcidUrl: string;
    googleScholarUrl: string;
    linkedinUrl: string;
  };
  summary: string;
  pages: { key: string; label: string; href: string }[];
  content: {
    research?: string;
    journey?: string;
    contributions?: string;
    contactIntro: string;
    about?: string;
    teaching?: string;
  };
  sections: Record<string, PublicEntry[]>;
  composition?: WebsiteComposition;
  contactFormEnabled: boolean;
  cvDownloadUrl?: string;
  /** Free + PDF Pass show platform badge; Scholar Annual hides it. */
  showPlatformBranding?: boolean;
  seo?: { title?: string; description?: string };
};

/** @deprecated Use ScholarPagesModel alias, retained for snapshot compatibility. */
export type ScholarPagesModel = ModernScholarModel;

type Props = {
  model: ModernScholarModel;
  mode?: "preview" | "public";
  activePage?: string;
  contactSlot?: React.ReactNode;
  legalPage?: LegalPageKey;
};

export function ModernScholarPreview({ model, mode = "preview", activePage, contactSlot, legalPage }: Props) {
  const page = legalPage || activePage || "home";
  const isPublicPaged = mode === "public" && Boolean(activePage || legalPage);
  const useHashNav = mode === "preview";
  const name = model.identity.displayName || "Academic Scholar";
  const composition = model.composition || buildSnapshotFallback(model);
  const contentPages = composition.pages;
  const firstDestination = model.pages.find((entry) => entry.key !== "home" && entry.key !== "contact");
  const contactPage = model.pages.find((entry) => entry.key === "contact");

  return (
    <div
      className={`scholar-pages quiet-authority-site ${mode === "preview" ? "is-preview" : "is-public"}`}
      data-template="scholar-pages"
      data-version="qa-1"
    >
      <ScholarPagesChrome
        brandName={name}
        brandHref={mode === "public" ? "/" : "#sp-home"}
        brandSub={model.identity.affiliation || model.identity.headline || undefined}
        pages={model.pages}
        activePage={page}
        mode={mode}
        useHashNav={useHashNav}
        cvHref={model.cvDownloadUrl}
        showPlatformBranding={model.showPlatformBranding !== false}
      />

      <main id="sp-main" className="sp-main" tabIndex={-1}>
        {legalPage ? (
          <div className="sp-page sp-legal-page">
            <LegalSection pageKey={legalPage} />
          </div>
        ) : (
          <>
            {(!isPublicPaged || page === "home") && (
              <HomePage
                model={model}
                composition={composition}
                firstDestination={firstDestination}
                contactPage={contactPage}
                useHashNav={useHashNav}
              />
            )}

            {contentPages.map((contentPage) =>
              !isPublicPaged || page === contentPage.key ? (
                <CategoryPage
                  key={contentPage.key}
                  page={contentPage}
                  isPageHeading={isPublicPaged && page === contentPage.key}
                />
              ) : null
            )}

            {(!isPublicPaged || page === "contact") && model.contactFormEnabled ? (
              <ContactPage model={model} contactSlot={contactSlot} isPageHeading={isPublicPaged && page === "contact"} />
            ) : null}

            {mode === "preview" ? (
              <div className="sp-legal-preview-block" aria-label="Legal pages preview">
                <div className="sp-page">
                  <LegalSection pageKey="privacy" idPrefix="sp-legal-privacy" />
                  <LegalSection pageKey="terms" idPrefix="sp-legal-terms" />
                  <LegalSection pageKey="cookies" idPrefix="sp-legal-cookies" />
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>

      <ScholarPagesFooter
        displayName={name}
        affiliation={model.identity.affiliation}
        publicUrl={model.publicUrl}
        mode={mode}
        orcidUrl={model.identity.orcidUrl}
        scholarUrl={model.identity.googleScholarUrl}
        linkedinUrl={model.identity.linkedinUrl}
        showPlatformBranding={model.showPlatformBranding !== false}
      />
    </div>
  );
}

function HomePage({
  model,
  composition,
  firstDestination,
  contactPage,
  useHashNav
}: {
  model: ModernScholarModel;
  composition: WebsiteComposition;
  firstDestination?: ModernScholarModel["pages"][number];
  contactPage?: ModernScholarModel["pages"][number];
  useHashNav: boolean;
}) {
  const name = model.identity.displayName || "Academic Scholar";
  const metrics = [
    ["Publications", model.sections.publications?.length || 0],
    ["Projects", model.sections.projects?.length || 0],
    ["Teaching", model.sections.teaching?.length || 0],
    ["Supervision", model.sections.supervision?.length || 0]
  ].filter(([, count]) => Number(count) > 0);
  const spotlights = selectHomeModules(model, composition);

  return (
    <div className="sp-page sp-page-home" id="sp-home">
      {/* Simple academic snapshot: left narrative, right identity card */}
      <header className="sp-home-hero" aria-labelledby="sp-home-title">
        <div className="sp-home-hero-copy">
          {(model.identity.affiliation || model.identity.headline) ? (
            <p className="sp-home-kicker">{model.identity.affiliation || model.identity.headline}</p>
          ) : null}
          <h1 id="sp-home-title" className="sp-display-name">{name}</h1>
          {model.identity.headline && model.identity.affiliation ? (
            <p className="sp-title-line">{model.identity.headline}</p>
          ) : null}
          <p className="sp-intro">{model.summary || "Academic work, teaching, and contributions."}</p>
          <div className="sp-home-actions">
            {firstDestination ? (
              <a className="sp-text-link" href={useHashNav ? `#sp-${firstDestination.key}` : firstDestination.href}>
                Explore {firstDestination.label.toLowerCase()} <span aria-hidden="true">→</span>
              </a>
            ) : null}
            {model.cvDownloadUrl ? (
              <a className="sp-text-link sp-text-link-muted" href={model.cvDownloadUrl}>
                Download CV <span aria-hidden="true">↓</span>
              </a>
            ) : null}
            {contactPage ? (
              <a className="sp-text-link sp-text-link-muted" href={useHashNav ? "#sp-contact" : contactPage.href}>
                Contact <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </div>
        <aside className="sp-home-aside" aria-label="Profile summary">
          <div className="sp-portrait" aria-hidden="true">
            <span>{initials(name)}</span>
          </div>
          <div className="sp-aside-facts">
            <strong>{name}</strong>
            {model.identity.headline ? <span>{model.identity.headline}</span> : null}
            {model.identity.location ? <span>{model.identity.location}</span> : null}
          </div>
          <AcademicIdentityLinks identity={model.identity} />
        </aside>
      </header>

      {metrics.length > 0 ? (
        <dl className="sp-metric-band" aria-label="Profile counts">
          {metrics.map(([label, count]) => (
            <div key={String(label)}>
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </dl>
      ) : null}

      {composition.pages.length > 0 ? (
        <nav className="sp-home-nav" aria-label="Site sections">
          <p className="sp-section-label">Browse</p>
          <ul>
            {composition.pages.map((entry) => {
              const href = model.pages.find((nav) => nav.key === entry.key)?.href || `/${entry.key}`;
              return (
                <li key={entry.key}>
                  <a href={useHashNav ? `#sp-${entry.key}` : href}>
                    <strong>{entry.label}</strong>
                    {entry.description ? <span>{entry.description}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {spotlights.length > 0 ? (
        <section className="sp-home-highlights" aria-labelledby="sp-home-work-title">
          <header className="sp-section-heading">
            <p className="sp-section-label">Selected work</p>
            <h2 id="sp-home-work-title">Highlights</h2>
          </header>
          <ol className="sp-highlight-list">
            {spotlights.map((module) => {
              const first = module.entries[0];
              const fields = WEBSITE_SECTION_BY_KEY.get(module.key)?.fields || ["title", "name"];
              const href =
                useHashNav || composition.homeModules.some((homeModule) => homeModule.key === module.key)
                  ? `#sp-${module.key}`
                  : `${model.pages.find((entry) => entry.key === module.category)?.href || `/${module.category}`}#sp-${module.key}`;
              return (
                <li key={module.key} id={`sp-${module.key}`}>
                  <span className="sp-highlight-label">{module.label}</span>
                  <div>
                    <h3>{first ? primaryValue(first.data, fields) : module.label}</h3>
                    {first ? (
                      <p>{secondaryValues(first.data, fields, primaryValue(first.data, fields), "")}</p>
                    ) : null}
                    <a className="sp-text-link" href={href}>
                      View section <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function CategoryPage({ page, isPageHeading }: { page: WebsiteCompositionPage; isPageHeading: boolean }) {
  const Heading = isPageHeading ? "h1" : "h2";
  return (
    <div className={`sp-page sp-category-page sp-category-${page.key}`} id={`sp-${page.key}`}>
      <header className="sp-page-intro">
        <p className="sp-section-label">{page.label}</p>
        <Heading className="sp-page-title">{page.label}</Heading>
        {page.narrative || page.description ? (
          <p className="sp-page-lede">{page.narrative || page.description}</p>
        ) : null}
        {page.modules.length > 1 ? (
          <nav className="sp-page-jump" aria-label={`Sections on ${page.label}`}>
            {page.modules.map((module) => (
              <a key={module.key} href={`#sp-${module.key}`}>
                {module.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="sp-module-stack">
        {page.modules.map((module) => (
          <ContentModule key={module.key} module={module} />
        ))}
      </div>
    </div>
  );
}

function ContentModule({ module }: { module: WebsiteContentModule }) {
  if (module.key === "publications") return <PublicationArchive module={module} />;
  if (module.key === "research_interests") return <ResearchThemeGrid module={module} />;
  if (["academic_appointments", "experience", "education", "teaching", "supervision"].includes(module.key)) {
    return <CareerTimeline module={module} />;
  }
  if (["skills", "languages"].includes(module.key)) return <TagCollection module={module} />;
  if (module.key === "awards") return <RecognitionStrip module={module} />;
  return <ContributionLedger module={module} />;
}

function PublicationArchive({ module }: { module: WebsiteContentModule }) {
  const groups = groupByYear(module.entries);
  return (
    <section className="sp-content-block sp-publication-archive" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHeading module={module} />
      {groups.map(([year, entries]) => (
        <div className="sp-publication-year" key={year}>
          <h3>{year}</h3>
          <ol className="sp-pub-list">
            {entries.map((entry, index) => <PubItem key={entry.id} data={entry.data} index={index + 1} />)}
          </ol>
        </div>
      ))}
    </section>
  );
}

function ResearchThemeGrid({ module }: { module: WebsiteContentModule }) {
  return (
    <section className="sp-content-block" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHeading module={module} />
      <div className="sp-theme-grid">
        {module.entries.map((entry, index) => (
          <article key={entry.id}>
            <span>0{index + 1}</span>
            <h3>{primaryValue(entry.data, ["interest", "title", "name"])}</h3>
            {entry.data.description ? <p>{entry.data.description}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CareerTimeline({ module }: { module: WebsiteContentModule }) {
  const fields = WEBSITE_SECTION_BY_KEY.get(module.key)?.fields || [];
  return (
    <section className="sp-content-block" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHeading module={module} />
      <ol className="sp-timeline">
        {module.entries.map((entry) => {
          const date = entry.data.year || entry.data.years || entry.data.date || "";
          const title = primaryValue(entry.data, fields);
          const meta = secondaryValues(entry.data, fields, title, date);
          return (
            <li key={entry.id}>
              <time>{date || "Undated"}</time>
              <div>
                <h3>{title}</h3>
                {meta ? <p>{meta}</p> : null}
                {entry.data.description ? <p>{entry.data.description}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ContributionLedger({ module }: { module: WebsiteContentModule }) {
  const fields = WEBSITE_SECTION_BY_KEY.get(module.key)?.fields || [];
  return (
    <section className="sp-content-block" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHeading module={module} />
      <div className="sp-ledger">
        {module.entries.map((entry, index) => {
          const title = primaryValue(entry.data, fields);
          return (
            <article key={entry.id}>
              <span className="sp-ledger-index">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{title}</h3><p>{secondaryValues(entry.data, fields, title, "")}</p></div>
              <span>{entry.data.year || entry.data.years || ""}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RecognitionStrip({ module }: { module: WebsiteContentModule }) {
  return (
    <section className="sp-content-block" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHeading module={module} />
      <div className="sp-recognition-grid">
        {module.entries.map((entry) => (
          <article key={entry.id}><span>{entry.data.year}</span><h3>{entry.data.title || entry.data.name || "Recognition"}</h3><p>{entry.data.issuer || entry.data.organization}</p></article>
        ))}
      </div>
    </section>
  );
}

function TagCollection({ module }: { module: WebsiteContentModule }) {
  return (
    <section className="sp-content-block" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHeading module={module} />
      <ul className="sp-tag-list">
        {module.entries.map((entry) => <li key={entry.id}>{primaryValue(entry.data, ["name", "skill", "language", "title"])}</li>)}
      </ul>
    </section>
  );
}

function ModuleHeading({ module }: { module: WebsiteContentModule }) {
  return (
    <header className="sp-module-heading">
      <h2 id={`sp-${module.key}-title`}>{module.label}</h2>
      <span>
        {module.entries.length} {module.entries.length === 1 ? "entry" : "entries"}
      </span>
    </header>
  );
}

function ContactPage({ model, contactSlot, isPageHeading }: { model: ModernScholarModel; contactSlot?: React.ReactNode; isPageHeading: boolean }) {
  const Heading = isPageHeading ? "h1" : "h2";
  return (
    <div className="sp-page sp-contact-page" id="sp-contact">
      <header className="sp-page-intro">
        <p className="sp-section-label">Contact</p>
        <Heading className="sp-page-title">Get in touch</Heading>
        <p className="sp-page-lede">
          {model.content.contactIntro ||
            "For research collaboration, supervision, or academic enquiries, please get in touch."}
        </p>
      </header>
      <div className="sp-contact-layout">
        <div className="sp-contact-context">
          <h3>{model.identity.displayName}</h3>
          {model.identity.affiliation ? <p>{model.identity.affiliation}</p> : null}
          {model.identity.email ? (
            <p>
              <a href={`mailto:${model.identity.email}`}>{model.identity.email}</a>
            </p>
          ) : null}
          <AcademicIdentityLinks identity={model.identity} />
        </div>
        <div className="sp-contact-panel">{contactSlot || <ContactPreview />}</div>
      </div>
    </div>
  );
}

function ContactPreview() {
  return (
    <div className="sp-contact-card">
      <label>Name<input disabled placeholder="Your name" /></label>
      <label>Email<input disabled placeholder="you@example.com" /></label>
      <label>Message<textarea disabled placeholder="How can we work together?" rows={5} /></label>
      <button type="button" className="sp-btn-primary" disabled>Send message</button>
    </div>
  );
}

function AcademicIdentityLinks({ identity }: { identity: ModernScholarModel["identity"] }) {
  const links = [
    ["ORCID", identity.orcidUrl],
    ["Google Scholar", identity.googleScholarUrl],
    ["LinkedIn", identity.linkedinUrl]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (!links.length && !identity.email) return null;
  return (
    <ul className="sp-profile-links" aria-label="Academic identity links">
      {links.map(([label, href]) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer">{label} <span aria-hidden="true">&#8599;</span></a></li>)}
      {identity.email ? <li><a href={`mailto:${identity.email}`}>Email</a></li> : null}
    </ul>
  );
}

function PubItem({ data, index }: { data: Record<string, string>; index: number }) {
  const title = data.title || "Untitled publication";
  const link = publicationLink(data);
  return (
    <li className="sp-pub-item">
      <span className="sp-pub-index" aria-hidden="true">{String(index).padStart(2, "0")}</span>
      <div className="sp-pub-body">
        <h4 className="sp-pub-title">{link ? <a href={link} target="_blank" rel="noopener noreferrer">{title}</a> : title}</h4>
        <p className="sp-pub-meta">{[data.authors, data.venue].filter(Boolean).join(" / ")}</p>
        {data.doi ? <p className="sp-pub-doi">DOI {data.doi.replace(/^https?:\/\/doi\.org\//i, "")}</p> : null}
      </div>
    </li>
  );
}

function LegalSection({ pageKey, idPrefix }: { pageKey: LegalPageKey; idPrefix?: string }) {
  const doc = getLegalPage(pageKey);
  const id = idPrefix || `sp-legal-${pageKey}`;
  return (
    <article className="sp-legal" id={id} aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className="sp-page-title">{doc.title}</h1>
      <p className="sp-page-lede">Last updated: {doc.updated}</p>
      {doc.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 48)} className="sp-prose">{paragraph}</p>)}
    </article>
  );
}

function selectHomeModules(model: ModernScholarModel, composition: WebsiteComposition) {
  if (composition.homeModules.length > 0) return composition.homeModules.slice(0, 3);
  const preferred = ["publications", "projects", "academic_appointments", "teaching", "awards", "education"];
  return preferred
    .map((key) => {
      const entries = model.sections[key] || [];
      const definition = WEBSITE_SECTION_BY_KEY.get(key);
      if (!entries.length || !definition) return null;
      return { key, label: definition.label, category: definition.category, entries: entries.slice(0, 2), anchor: Boolean(definition.anchor), featured: false };
    })
    .filter((module): module is WebsiteContentModule => Boolean(module))
    .slice(0, 3);
}

function buildSnapshotFallback(model: ModernScholarModel): WebsiteComposition {
  const categories = ["research", "journey", "contributions"] as AcademicCategoryKey[];
  const pages = categories
    .filter((key) => model.pages.some((page) => page.key === key))
    .map((key) => ({
      key,
      label: key === "journey" ? "Academic Journey" : key[0].toUpperCase() + key.slice(1),
      description: "Academic profile and selected work.",
      narrative: model.content[key] || "",
      score: 3,
      strength: "developing" as const,
      reason: "qualified" as const,
      modules: Array.from(WEBSITE_SECTION_BY_KEY.values())
        .filter((definition) => definition.category === key && (model.sections[definition.key] || []).length > 0)
        .map((definition) => ({ key: definition.key, label: definition.label, category: key, entries: model.sections[definition.key], anchor: Boolean(definition.anchor), featured: false }))
    }));
  const byKey = Object.fromEntries(categories.map((key) => [key, pages.find((page) => page.key === key) || { key, label: key, description: "", narrative: "", score: 0, strength: "empty", reason: "empty", modules: [] }])) as WebsiteComposition["categories"];
  return { mode: pages.length === 0 ? "sparse" : pages.length === 3 ? "rich" : "developing", pages, categories: byKey, homeModules: [], navigation: model.pages.map((page) => page.key).filter((key): key is WebsiteComposition["navigation"][number] => ["home", "research", "journey", "contributions", "contact"].includes(key)) };
}

function primaryValue(data: Record<string, string>, fields: string[]) {
  return fields.map((field) => data[field]).find(Boolean) || data.title || data.name || data.course || "Academic entry";
}

function secondaryValues(data: Record<string, string>, fields: string[], primary: string, date: string) {
  return fields.map((field) => data[field]).filter(Boolean).filter((value) => value !== primary && value !== date && value !== data.description).slice(0, 3).join(" / ");
}

function publicationLink(data: Record<string, string>) {
  if (data.doi) return /^https?:\/\//i.test(data.doi) ? data.doi : `https://doi.org/${data.doi.replace(/^\//, "")}`;
  return /^https?:\/\//i.test(data.url || "") ? data.url : "";
}

function groupByYear(entries: PublicEntry[]) {
  const groups = new Map<string, PublicEntry[]>();
  for (const entry of entries) {
    const year = entry.data.year || "Earlier or undated";
    groups.set(year, [...(groups.get(year) || []), entry]);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AP";
}

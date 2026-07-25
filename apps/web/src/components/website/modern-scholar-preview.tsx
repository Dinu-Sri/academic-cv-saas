import { ScholarPagesChrome, ScholarPagesFooter } from "@/components/website/scholar-pages-chrome";
import type {
  AcademicCategoryKey,
  WebsiteComposition,
  WebsiteCompositionPage,
  WebsiteContentModule
} from "@/lib/website/composition-types";
import {
  buildHomeHighlights,
  buildHomeMetrics,
  resolveHomeBodyModules
} from "@/lib/website/home-highlights";
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

/**
 * Scholar Pages renderer — markup + class names match
 * design-prototypes/academic-website (strict static design).
 */
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
      className={`scholar-pages ${mode === "preview" ? "is-preview" : "is-public"}`}
      data-template="scholar-pages"
      data-version="static-1"
    >
      <ScholarPagesChrome
        brandName={name}
        brandHref={mode === "public" ? "/" : "#sp-home"}
        brandSub={model.identity.headline || model.identity.affiliation || undefined}
        pages={model.pages}
        activePage={page}
        mode={mode}
        useHashNav={useHashNav}
        cvHref={model.cvDownloadUrl}
        showPlatformBranding={model.showPlatformBranding !== false}
      />

      <main id="sp-main" className="site-main" tabIndex={-1}>
        {legalPage ? (
          <LegalSection pageKey={legalPage} />
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
              <div className="section" aria-label="Legal pages preview">
                <LegalSection pageKey="privacy" idPrefix="sp-legal-privacy" />
                <LegalSection pageKey="terms" idPrefix="sp-legal-terms" />
                <LegalSection pageKey="cookies" idPrefix="sp-legal-cookies" />
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
        pages={model.pages}
        cvHref={model.cvDownloadUrl}
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
  const metrics = buildHomeMetrics(model.sections);
  const highlights = buildHomeHighlights(model.sections);
  const homeBodyModules = resolveHomeBodyModules(model.sections, composition);
  const summary =
    model.summary ||
    [model.identity.headline, model.identity.affiliation].filter(Boolean).join(" · ") ||
    "Academic profile.";
  const primaryHref = firstDestination
    ? useHashNav
      ? `#sp-${firstDestination.key}`
      : firstDestination.href
    : contactPage
      ? useHashNav
        ? "#sp-contact"
        : contactPage.href
      : undefined;
  const primaryLabel = firstDestination
    ? `Explore ${firstDestination.label.toLowerCase()}`
    : contactPage
      ? "Contact"
      : undefined;

  const hasDetails = Boolean(
    model.identity.location ||
      model.identity.email ||
      model.identity.orcidUrl ||
      model.identity.googleScholarUrl ||
      model.identity.linkedinUrl
  );

  return (
    <div id="sp-home">
      <header className={`home-hero${hasDetails ? " home-hero-no-photo" : ""}`}>
        <div className="home-hero-copy">
          {model.identity.affiliation ? <p className="home-kicker">{model.identity.affiliation}</p> : null}
          <h1>{name}</h1>
          {model.identity.headline ? <p className="home-role">{model.identity.headline}</p> : null}
          <p className="home-bio">{summary}</p>
          <div className="home-actions">
            {primaryHref && primaryLabel ? (
              <a className="text-link" href={primaryHref}>
                {primaryLabel} <span>→</span>
              </a>
            ) : null}
            {model.cvDownloadUrl ? (
              <a className="text-link muted" href={model.cvDownloadUrl}>
                Download CV <span>↓</span>
              </a>
            ) : null}
            {contactPage && firstDestination ? (
              <a className="text-link muted" href={useHashNav ? "#sp-contact" : contactPage.href}>
                Contact <span>→</span>
              </a>
            ) : null}
          </div>
        </div>
        {hasDetails ? <HomeDetailsPanel identity={model.identity} /> : null}
      </header>

      {metrics.length > 0 ? (
        <section className="metric-band" aria-label="Profile counts">
          {metrics.map((metric) => (
            <div className="metric-item" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section className="section">
          <p className="section-label">Selected work</p>
          <h2 className="section-title">Highlights</h2>
          <ul className="highlight-list">
            {highlights.map((item) => (
              <li key={`${item.sectionKey}-${item.entryId}`}>
                <span className="label">{item.label}</span>
                <div>
                  <h3>{item.title}</h3>
                  {item.meta ? <p>{item.meta}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {homeBodyModules.map((module) => (
        <ContentModule key={module.key} module={module} />
      ))}

      {contactPage && composition.mode === "sparse" ? (
        <section className="section">
          <p className="section-label">Contact</p>
          <h2 className="section-title">Get in touch</h2>
          <p className="section-lede">
            {model.content.contactIntro || "For teaching, collaboration, or academic enquiries."}
          </p>
          <a className="text-link" href={useHashNav ? "#sp-contact" : contactPage.href}>
            Contact form <span>→</span>
          </a>
        </section>
      ) : null}
    </div>
  );
}

function HomeDetailsPanel({ identity }: { identity: ModernScholarModel["identity"] }) {
  const external = [
    ["ORCID", identity.orcidUrl],
    ["Google Scholar", identity.googleScholarUrl],
    ["LinkedIn", identity.linkedinUrl]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <aside className="home-contact-panel" aria-label="Contact details">
      <p className="section-label">Details</p>
      <dl className="contact-detail-list">
        {identity.location ? (
          <div>
            <dt>Location</dt>
            <dd>{identity.location}</dd>
          </div>
        ) : null}
        {identity.email ? (
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${identity.email}`}>{identity.email}</a>
            </dd>
          </div>
        ) : null}
        {external.map(([label, href]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <a href={href} target="_blank" rel="noopener noreferrer">
                Profile ↗
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function CategoryPage({ page, isPageHeading }: { page: WebsiteCompositionPage; isPageHeading: boolean }) {
  return (
    <div id={`sp-${page.key}`}>
      {page.narrative ? (
        <header className="page-intro">
          <p className="section-label">{page.label}</p>
          <p>{page.narrative}</p>
        </header>
      ) : null}
      {page.modules.length > 1 ? (
        <nav className="page-jump" aria-label={`Sections on ${page.label}`}>
          {page.modules.map((module) => (
            <a key={module.key} href={`#sp-${module.key}`}>
              {module.label}
            </a>
          ))}
        </nav>
      ) : null}
      {page.modules.map((module, index) => (
        <ContentModule
          key={module.key}
          module={module}
          headingLevel={index === 0 && isPageHeading && !page.narrative ? "h1" : "h2"}
        />
      ))}
    </div>
  );
}

function ContentModule({
  module,
  headingLevel = "h2"
}: {
  module: WebsiteContentModule;
  headingLevel?: "h1" | "h2";
}) {
  if (module.key === "publications") return <PublicationArchive module={module} headingLevel={headingLevel} />;
  if (module.key === "research_interests") return <ResearchThemeGrid module={module} headingLevel={headingLevel} />;
  if (["academic_appointments", "experience", "education", "teaching", "supervision"].includes(module.key)) {
    return <CareerTimeline module={module} headingLevel={headingLevel} />;
  }
  if (["skills", "languages"].includes(module.key)) return <TagCollection module={module} headingLevel={headingLevel} />;
  if (module.key === "awards") return <RecognitionStrip module={module} headingLevel={headingLevel} />;
  return <ContributionLedger module={module} headingLevel={headingLevel} />;
}

function ModuleHead({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  const Title = headingLevel;
  return (
    <div className="section-head">
      <Title className="section-title" id={`sp-${module.key}-title`}>
        {module.label}
      </Title>
      <span className="count">
        {module.entries.length} {module.entries.length === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
}

function PublicationArchive({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  return (
    <section className="section" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHead module={module} headingLevel={headingLevel} />
      <div className="publication-list">
        {module.entries.map((entry) => {
          const link = publicationLink(entry.data);
          return (
            <article
              key={entry.id}
              className="publication"
              data-year={entry.data.year || ""}
              data-type={entry.data.type || ""}
            >
              <time>{entry.data.year || "—"}</time>
              <div>
                {entry.data.type ? <p className="publication-type">{entry.data.type}</p> : null}
                <h3>{entry.data.title || "Untitled publication"}</h3>
                {entry.data.authors ? <p>{entry.data.authors}</p> : null}
                {entry.data.venue ? (
                  <p>
                    <em>{entry.data.venue}</em>
                    {entry.data.detail ? `, ${entry.data.detail}` : ""}
                  </p>
                ) : null}
              </div>
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${entry.data.title || "publication"}`}>
                  DOI ↗
                </a>
              ) : (
                <span />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ResearchThemeGrid({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  return (
    <section className="section" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHead module={module} headingLevel={headingLevel} />
      <div className="chip-row">
        {module.entries.map((entry) => (
          <span key={entry.id}>{primaryValue(entry.data, ["interest", "title", "name"])}</span>
        ))}
      </div>
      {module.entries.some((entry) => entry.data.description) ? (
        <div className="row-list" style={{ marginTop: "1rem" }}>
          {module.entries
            .filter((entry) => entry.data.description)
            .map((entry) => (
              <article className="row" key={entry.id}>
                <div className="meta-col">Theme</div>
                <div>
                  <h3>{primaryValue(entry.data, ["interest", "title", "name"])}</h3>
                  <p>{entry.data.description}</p>
                </div>
              </article>
            ))}
        </div>
      ) : null}
    </section>
  );
}

function CareerTimeline({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  const fields = WEBSITE_SECTION_BY_KEY.get(module.key)?.fields || [];
  return (
    <section className="section" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHead module={module} headingLevel={headingLevel} />
      <div className="row-list">
        {module.entries.map((entry) => {
          const date = entry.data.year || entry.data.years || entry.data.date || "";
          const title = primaryValue(entry.data, fields);
          const meta = secondaryValues(entry.data, fields, title, date);
          return (
            <article className="row" key={entry.id}>
              <time>{date || "—"}</time>
              <div>
                <h3>{title}</h3>
                {meta ? <p className="meta">{meta}</p> : null}
                {entry.data.description ? <p>{entry.data.description}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ContributionLedger({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  const fields = WEBSITE_SECTION_BY_KEY.get(module.key)?.fields || [];
  return (
    <section className="section" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHead module={module} headingLevel={headingLevel} />
      <div className="row-list">
        {module.entries.map((entry) => {
          const title = primaryValue(entry.data, fields);
          const date = entry.data.year || entry.data.years || "";
          return (
            <article className="row" key={entry.id}>
              <time>{date || "—"}</time>
              <div>
                <h3>{title}</h3>
                <p className="meta">{secondaryValues(entry.data, fields, title, date)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RecognitionStrip({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  return (
    <section className="section" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHead module={module} headingLevel={headingLevel} />
      <div className="row-list">
        {module.entries.map((entry) => (
          <article className="row" key={entry.id}>
            <time>{entry.data.year || "—"}</time>
            <div>
              <h3>{entry.data.title || entry.data.name || "Recognition"}</h3>
              <p className="meta">{entry.data.issuer || entry.data.organization || ""}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TagCollection({
  module,
  headingLevel
}: {
  module: WebsiteContentModule;
  headingLevel: "h1" | "h2";
}) {
  return (
    <section className="section" id={`sp-${module.key}`} aria-labelledby={`sp-${module.key}-title`}>
      <ModuleHead module={module} headingLevel={headingLevel} />
      <div className="chip-row">
        {module.entries.map((entry) => (
          <span key={entry.id}>{primaryValue(entry.data, ["name", "skill", "language", "title"])}</span>
        ))}
      </div>
    </section>
  );
}

function ContactPage({
  model,
  contactSlot,
  isPageHeading
}: {
  model: ModernScholarModel;
  contactSlot?: React.ReactNode;
  isPageHeading: boolean;
}) {
  const Heading = isPageHeading ? "h1" : "h2";
  return (
    <section className="contact-page" id="sp-contact">
      <div className="contact-intro">
        <p className="section-label">Contact</p>
        <Heading>Get in touch</Heading>
        <p>
          {model.content.contactIntro ||
            "For research collaboration, supervision, invited talks, or general academic enquiries."}
        </p>
        <dl className="contact-facts">
          {model.identity.email ? (
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${model.identity.email}`}>{model.identity.email}</a>
              </dd>
            </div>
          ) : null}
          {model.identity.affiliation ? (
            <div>
              <dt>Affiliation</dt>
              <dd>{model.identity.affiliation}</dd>
            </div>
          ) : null}
          {model.identity.location ? (
            <div>
              <dt>Location</dt>
              <dd>{model.identity.location}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {contactSlot || (
        <div className="contact-form">
          <ContactPreview />
        </div>
      )}
    </section>
  );
}

function ContactPreview() {
  return (
    <>
      <label>
        <span>Name</span>
        <input disabled placeholder="Your name" />
      </label>
      <label>
        <span>Email</span>
        <input disabled placeholder="you@example.com" />
      </label>
      <label>
        <span>Message</span>
        <textarea disabled placeholder="How can we work together?" rows={5} />
      </label>
      <button type="button" disabled>
        Send message <span>→</span>
      </button>
    </>
  );
}

function LegalSection({ pageKey, idPrefix }: { pageKey: LegalPageKey; idPrefix?: string }) {
  const doc = getLegalPage(pageKey);
  const id = idPrefix || `sp-legal-${pageKey}`;
  return (
    <article className="section" id={id} aria-labelledby={`${id}-title`}>
      <h1 className="section-title" id={`${id}-title`}>
        {doc.title}
      </h1>
      <p className="section-lede">Last updated: {doc.updated}</p>
      {doc.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="section-lede">
          {paragraph}
        </p>
      ))}
    </article>
  );
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
        .map((definition) => ({
          key: definition.key,
          label: definition.label,
          category: key,
          entries: model.sections[definition.key],
          anchor: Boolean(definition.anchor),
          featured: false
        }))
    }));
  const byKey = Object.fromEntries(
    categories.map((key) => [
      key,
      pages.find((page) => page.key === key) || {
        key,
        label: key,
        description: "",
        narrative: "",
        score: 0,
        strength: "empty",
        reason: "empty",
        modules: []
      }
    ])
  ) as WebsiteComposition["categories"];
  return {
    mode: pages.length === 0 ? "sparse" : pages.length === 3 ? "rich" : "developing",
    pages,
    categories: byKey,
    homeModules: [],
    navigation: model.pages
      .map((page) => page.key)
      .filter((key): key is WebsiteComposition["navigation"][number] =>
        ["home", "research", "journey", "contributions", "contact"].includes(key)
      )
  };
}

function primaryValue(data: Record<string, string>, fields: string[]) {
  return fields.map((field) => data[field]).find(Boolean) || data.title || data.name || data.course || "Academic entry";
}

function secondaryValues(data: Record<string, string>, fields: string[], primary: string, date: string) {
  return fields
    .map((field) => data[field])
    .filter(Boolean)
    .filter((value) => value !== primary && value !== date && value !== data.description)
    .slice(0, 3)
    .join(" · ");
}

function publicationLink(data: Record<string, string>) {
  if (data.doi) return /^https?:\/\//i.test(data.doi) ? data.doi : `https://doi.org/${data.doi.replace(/^\//, "")}`;
  return /^https?:\/\//i.test(data.url || "") ? data.url : "";
}

import { ScholarPagesChrome, ScholarPagesFooter } from "@/components/website/scholar-pages-chrome";
import { getLegalPage, type LegalPageKey } from "@/lib/website/legal-content";

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
    about: string;
    research: string;
    teaching: string;
    contactIntro: string;
  };
  sections: Record<string, { id: string; sectionKey: string; data: Record<string, string> }[]>;
  contactFormEnabled: boolean;
  seo?: {
    title?: string;
    description?: string;
  };
};

/** @deprecated Use ScholarPagesModel alias — kept for snapshot compatibility. */
export type ScholarPagesModel = ModernScholarModel;

type Props = {
  model: ModernScholarModel;
  mode?: "preview" | "public";
  /** When set, render a single public page instead of the full draft scroll. */
  activePage?: string;
  contactSlot?: React.ReactNode;
  /** Legal page render on public host (/privacy, /terms, /cookies). */
  legalPage?: LegalPageKey;
};

/**
 * Scholar Pages — professional multipage academic personal website.
 * Shared by draft preview and published public sites.
 */
export function ModernScholarPreview({ model, mode = "preview", activePage, contactSlot, legalPage }: Props) {
  const page = legalPage || activePage || "home";
  const isPublicPaged = mode === "public" && Boolean(activePage || legalPage);
  const useHashNav = mode === "preview";
  const brandHref = mode === "public" ? "/" : "#sp-home";
  const name = model.identity.displayName || "Academic Scholar";

  const jumpPages = model.pages.filter((entry) => entry.key !== "home");
  const featuredPubs = (model.sections.publications || []).slice(0, 5);
  const pubHref = model.pages.find((p) => p.key === "publications")?.href || "/publications";

  return (
    <div
      className={`scholar-pages modern-scholar-site ${mode === "preview" ? "is-preview" : "is-public"}`}
      data-template="scholar-pages"
      data-version="sp-b1"
    >
      <ScholarPagesChrome
        brandName={name}
        brandHref={brandHref}
        brandSub={model.identity.affiliation || model.identity.headline || undefined}
        pages={model.pages}
        activePage={page}
        mode={mode}
        useHashNav={useHashNav}
      />

      <main id="sp-main" className="sp-main" tabIndex={-1}>
        {legalPage ? (
          <div className="sp-page">
            <LegalSection pageKey={legalPage} />
          </div>
        ) : (
          <>
            {(!isPublicPaged || page === "home") && (
              <div className="sp-page sp-page-home" id="sp-home">
                <header className="sp-masthead" aria-labelledby="sp-home-title">
                  <div className="sp-masthead-inner">
                    <p className="sp-affiliation">{model.identity.affiliation || "Academic profile"}</p>
                    <h1 id="sp-home-title" className="sp-display-name">
                      {name}
                    </h1>
                    {model.identity.headline ? <p className="sp-title-line">{model.identity.headline}</p> : null}
                    {model.identity.location ? <p className="sp-location">{model.identity.location}</p> : null}

                    <div className="sp-rule" aria-hidden="true" />

                    <p className="sp-intro">
                      {model.summary || "Your research summary and public introduction will appear here."}
                    </p>

                    <ul className="sp-profile-links" aria-label="Scholarly profiles">
                      {model.identity.orcidUrl ? (
                        <li>
                          <a href={model.identity.orcidUrl} rel="noopener noreferrer">
                            ORCID
                          </a>
                        </li>
                      ) : null}
                      {model.identity.googleScholarUrl ? (
                        <li>
                          <a href={model.identity.googleScholarUrl} rel="noopener noreferrer">
                            Google Scholar
                          </a>
                        </li>
                      ) : null}
                      {model.identity.linkedinUrl ? (
                        <li>
                          <a href={model.identity.linkedinUrl} rel="noopener noreferrer">
                            LinkedIn
                          </a>
                        </li>
                      ) : null}
                      {model.identity.email ? (
                        <li>
                          <a href={`mailto:${model.identity.email}`}>Email</a>
                        </li>
                      ) : null}
                    </ul>

                    <dl className="sp-metrics" aria-label="Profile highlights">
                      <div>
                        <dt>Publications</dt>
                        <dd>{model.sections.publications?.length ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Teaching</dt>
                        <dd>{model.sections.teaching?.length ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Projects</dt>
                        <dd>{model.sections.projects?.length ?? 0}</dd>
                      </div>
                    </dl>
                  </div>
                </header>

                {jumpPages.length > 0 ? (
                  <nav className="sp-directory" aria-label="Site sections">
                    <div className="sp-directory-inner">
                      <h2 className="sp-section-label">Explore</h2>
                      <ul className="sp-directory-list">
                        {jumpPages.map((entry) => (
                          <li key={entry.key}>
                            <a href={useHashNav ? `#sp-${entry.key}` : entry.href}>
                              <span className="sp-directory-title">{entry.label}</span>
                              <span className="sp-directory-arrow" aria-hidden="true">
                                →
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </nav>
                ) : null}

                {featuredPubs.length > 0 ? (
                  <section className="sp-band" aria-labelledby="sp-featured-pubs-title">
                    <div className="sp-band-inner">
                      <div className="sp-band-head">
                        <h2 id="sp-featured-pubs-title" className="sp-section-title">
                          Selected publications
                        </h2>
                        <a className="sp-text-link" href={useHashNav ? "#sp-publications" : pubHref}>
                          All publications
                        </a>
                      </div>
                      <ol className="sp-pub-list">
                        {featuredPubs.map((entry, index) => (
                          <PubItem key={entry.id} data={entry.data} index={index + 1} />
                        ))}
                      </ol>
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            {(!isPublicPaged || page === "about") && (
              <div className="sp-page" id={isPublicPaged ? undefined : "sp-about-wrap"}>
                <Section
                  title="About"
                  id="sp-about"
                  body={model.content.about}
                  pageHeading={isPublicPaged && page === "about"}
                />
                <EntrySection
                  title="Education"
                  id="sp-education"
                  entries={model.sections.education}
                  fields={["degree", "institution", "year", "field"]}
                  layout="cv"
                />
              </div>
            )}

            {(!isPublicPaged || page === "research") && (
              <div className="sp-page">
                <Section
                  title="Research"
                  id="sp-research"
                  body={model.content.research}
                  entries={model.sections.projects}
                  entryFields={["title", "year", "role", "funder"]}
                  pageHeading={isPublicPaged && page === "research"}
                />
              </div>
            )}

            {(!isPublicPaged || page === "publications") && (
              <div className="sp-page">
                <EntrySection
                  title="Publications"
                  id="sp-publications"
                  entries={model.sections.publications}
                  fields={["title", "authors", "year", "venue"]}
                  layout="publications"
                  pageHeading={isPublicPaged && page === "publications"}
                />
              </div>
            )}

            {(!isPublicPaged || page === "teaching") && (
              <div className="sp-page">
                <EntrySection
                  title="Teaching"
                  id="sp-teaching"
                  entries={model.sections.teaching}
                  fields={["course", "role", "institution", "year"]}
                  body={model.content.teaching}
                  layout="cv"
                  pageHeading={isPublicPaged && page === "teaching"}
                />
              </div>
            )}

            {(!isPublicPaged || page === "cv") && (
              <div className="sp-page" id="sp-cv">
                <header className="sp-page-header">
                  {isPublicPaged && page === "cv" ? (
                    <h1 id="sp-cv-title" className="sp-page-title">
                      Curriculum Vitae
                    </h1>
                  ) : (
                    <h2 id="sp-cv-title" className="sp-page-title">
                      Curriculum Vitae
                    </h2>
                  )}
                  <p className="sp-page-lede">Selected public sections from the academic profile.</p>
                </header>
                <EntrySection
                  title="Experience"
                  id="sp-experience"
                  entries={model.sections.experience}
                  fields={["title", "organization", "years", "location"]}
                  layout="cv"
                />
              </div>
            )}

            {(!isPublicPaged || page === "contact") && model.contactFormEnabled ? (
              <div className="sp-page" id="sp-contact">
                <header className="sp-page-header">
                  {isPublicPaged && page === "contact" ? (
                    <h1 id="sp-contact-title" className="sp-page-title">
                      Contact
                    </h1>
                  ) : (
                    <h2 id="sp-contact-title" className="sp-page-title">
                      Contact
                    </h2>
                  )}
                  <p className="sp-page-lede">
                    {model.content.contactIntro ||
                      "For research collaboration, supervision, or academic enquiries, please use the form below."}
                  </p>
                </header>
                <div className="sp-contact-panel">
                  {contactSlot ? (
                    contactSlot
                  ) : (
                    <div className="sp-contact-card">
                      <label>
                        Name
                        <input disabled placeholder="Visitor name" />
                      </label>
                      <label>
                        Email
                        <input disabled placeholder="visitor@example.com" />
                      </label>
                      <label>
                        Message
                        <textarea disabled placeholder="Message" rows={5} />
                      </label>
                      <button type="button" className="sp-btn-primary" disabled>
                        Contact form (preview)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {mode === "preview" ? (
              <div className="sp-legal-preview-block" aria-label="Legal pages (preview)">
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
      />
    </div>
  );
}

function PubItem({ data, index }: { data: Record<string, string>; index: number }) {
  const title = data.title || "Untitled";
  const authors = data.authors;
  const year = data.year;
  const venue = data.venue;
  const doi = data.doi;
  const url = data.url;
  const link = doi
    ? /^https?:\/\//i.test(doi)
      ? doi
      : `https://doi.org/${doi.replace(/^\//, "")}`
    : url || "";

  return (
    <li className="sp-pub-item">
      <span className="sp-pub-index" aria-hidden="true">
        {index}.
      </span>
      <div className="sp-pub-body">
        <p className="sp-pub-title">
          {link ? (
            <a href={link} rel="noopener noreferrer">
              {title}
            </a>
          ) : (
            title
          )}
        </p>
        <p className="sp-pub-meta">
          {[authors, year, venue].filter(Boolean).join(" · ")}
        </p>
      </div>
    </li>
  );
}

function LegalSection({ pageKey, idPrefix }: { pageKey: LegalPageKey; idPrefix?: string }) {
  const doc = getLegalPage(pageKey);
  const id = idPrefix || `sp-legal-${pageKey}`;
  return (
    <article className="sp-legal" id={id} aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className="sp-page-title">
        {doc.title}
      </h1>
      <p className="sp-page-lede">Last updated: {doc.updated}</p>
      {doc.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="sp-prose">
          {paragraph}
        </p>
      ))}
    </article>
  );
}

function Section({
  title,
  id,
  body,
  entries = [],
  entryFields,
  pageHeading = false
}: {
  title: string;
  id: string;
  body?: string;
  entries?: { id: string; data: Record<string, string> }[];
  entryFields?: string[];
  pageHeading?: boolean;
}) {
  if (!body?.trim() && entries.length === 0) return null;
  const Heading = pageHeading ? "h1" : "h2";
  return (
    <section className="sp-content-block" id={id} aria-labelledby={`${id}-title`}>
      <header className="sp-page-header">
        <Heading id={`${id}-title`} className="sp-page-title">
          {title}
        </Heading>
      </header>
      {body?.trim() ? <p className="sp-prose">{body}</p> : null}
      {entries.length && entryFields ? (
        <ul className="sp-cv-list">
          {entries.slice(0, 24).map((entry) => (
            <CvItem key={entry.id} data={entry.data} fields={entryFields} />
          ))}
        </ul>
      ) : entries.length ? (
        <ul className="sp-cv-list">
          {entries.slice(0, 24).map((entry) => (
            <li key={entry.id} className="sp-cv-item">
              <div className="sp-cv-main">
                <strong>{entry.data.title || entry.data.name || entry.data.course || "Entry"}</strong>
                <span className="sp-cv-sub">
                  {[entry.data.year, entry.data.institution, entry.data.role].filter(Boolean).join(" · ")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EntrySection({
  title,
  id,
  entries,
  fields,
  body,
  pageHeading = false,
  layout = "cv"
}: {
  title: string;
  id: string;
  entries?: { id: string; data: Record<string, string> }[];
  fields: string[];
  body?: string;
  pageHeading?: boolean;
  layout?: "cv" | "publications";
}) {
  if (!entries?.length && !body?.trim()) return null;
  const Heading = pageHeading ? "h1" : "h2";
  return (
    <section className="sp-content-block" id={id} aria-labelledby={`${id}-title`}>
      <header className="sp-page-header">
        <Heading id={`${id}-title`} className="sp-page-title">
          {title}
        </Heading>
      </header>
      {body?.trim() ? <p className="sp-prose">{body}</p> : null}
      {layout === "publications" && entries?.length ? (
        <ol className="sp-pub-list sp-pub-list-full">
          {entries.slice(0, 80).map((entry, index) => (
            <PubItem key={entry.id} data={entry.data} index={index + 1} />
          ))}
        </ol>
      ) : entries?.length ? (
        <ul className="sp-cv-list">
          {entries.slice(0, 40).map((entry) => (
            <CvItem key={entry.id} data={entry.data} fields={fields} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CvItem({ data, fields }: { data: Record<string, string>; fields: string[] }) {
  const primary = fields.map((field) => data[field]).find(Boolean) || "Untitled";
  const yearish = data.year || data.years || data.date || "";
  const rest = fields
    .map((field) => data[field])
    .filter(Boolean)
    .slice(1)
    .filter((value) => value !== yearish);

  return (
    <li className="sp-cv-item">
      <div className="sp-cv-main">
        <strong>{primary}</strong>
        {rest.length ? <span className="sp-cv-sub">{rest.join(" · ")}</span> : null}
      </div>
      {yearish ? <span className="sp-cv-date">{yearish}</span> : null}
    </li>
  );
}

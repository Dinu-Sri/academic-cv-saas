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
 * Scholar Pages template (evolved Modern Scholar).
 * Shared by draft preview and published public sites.
 */
export function ModernScholarPreview({ model, mode = "preview", activePage, contactSlot, legalPage }: Props) {
  const page = legalPage || activePage || "home";
  const isPublicPaged = mode === "public" && Boolean(activePage || legalPage);
  const useHashNav = mode === "preview";
  const brandHref = mode === "public" ? "/" : "#sp-home";

  const jumpPages = model.pages.filter((entry) => entry.key !== "home");

  return (
    <div className={`scholar-pages modern-scholar-site ${mode === "preview" ? "is-preview" : "is-public"}`} data-template="scholar-pages">
      <ScholarPagesChrome
        brandName={model.identity.displayName || "Academic Scholar"}
        brandHref={brandHref}
        brandSub={model.identity.headline || undefined}
        pages={model.pages}
        activePage={page}
        mode={mode}
        useHashNav={useHashNav}
      />

      <main id="sp-main" className="sp-main" tabIndex={-1}>
        {legalPage ? (
          <LegalSection pageKey={legalPage} />
        ) : (
          <>
            {(!isPublicPaged || page === "home") && (
              <section className="sp-hero" id="sp-home" aria-labelledby="sp-home-title">
                <div className="sp-hero-copy">
                  <p className="sp-kicker">{model.identity.affiliation || "Academic profile"}</p>
                  <h1 id="sp-home-title">{model.identity.displayName || "Your name"}</h1>
                  {model.identity.headline ? <p className="sp-lead">{model.identity.headline}</p> : null}
                  {model.identity.location ? <p className="sp-meta">{model.identity.location}</p> : null}
                  <p className="sp-prose">
                    {model.summary || "Your research summary and public introduction will appear here."}
                  </p>
                  <div className="sp-link-row" aria-label="Profile links">
                    {model.identity.orcidUrl ? (
                      <a href={model.identity.orcidUrl} rel="noopener noreferrer">
                        ORCID
                      </a>
                    ) : null}
                    {model.identity.googleScholarUrl ? (
                      <a href={model.identity.googleScholarUrl} rel="noopener noreferrer">
                        Google Scholar
                      </a>
                    ) : null}
                    {model.identity.linkedinUrl ? (
                      <a href={model.identity.linkedinUrl} rel="noopener noreferrer">
                        LinkedIn
                      </a>
                    ) : null}
                    {model.identity.email ? <a href={`mailto:${model.identity.email}`}>Email</a> : null}
                  </div>
                </div>

                <div className="sp-stats" aria-label="Profile highlights">
                  <div>
                    <strong>{model.sections.publications?.length ?? 0}</strong>
                    <span>Publications</span>
                  </div>
                  <div>
                    <strong>{model.sections.teaching?.length ?? 0}</strong>
                    <span>Teaching</span>
                  </div>
                  <div>
                    <strong>{model.sections.projects?.length ?? 0}</strong>
                    <span>Projects</span>
                  </div>
                </div>

                {jumpPages.length > 0 ? (
                  <nav className="sp-jump-cards" aria-label="Explore this website">
                    {jumpPages.map((entry) => (
                      <a
                        key={entry.key}
                        className="sp-jump-card"
                        href={useHashNav ? (entry.key === "home" ? "#sp-home" : `#sp-${entry.key}`) : entry.href}
                      >
                        <span className="sp-jump-label">{entry.label}</span>
                        <span className="sp-jump-hint">Open page</span>
                      </a>
                    ))}
                  </nav>
                ) : null}
              </section>
            )}

            {(!isPublicPaged || page === "about") && (
              <Section title="About" id="sp-about" body={model.content.about} pageHeading={isPublicPaged && page === "about"} />
            )}
            {(!isPublicPaged || page === "about") && (
              <EntrySection
                title="Education"
                id="sp-education"
                entries={model.sections.education}
                fields={["degree", "institution", "year", "field"]}
                pageHeading={false}
              />
            )}
            {(!isPublicPaged || page === "research") && (
              <Section
                title="Research"
                id="sp-research"
                body={model.content.research}
                entries={model.sections.projects}
                pageHeading={isPublicPaged && page === "research"}
              />
            )}
            {(!isPublicPaged || page === "publications") && (
              <EntrySection
                title="Publications"
                id="sp-publications"
                entries={model.sections.publications}
                fields={["title", "authors", "year", "venue"]}
                pageHeading={isPublicPaged && page === "publications"}
              />
            )}
            {(!isPublicPaged || page === "teaching") && (
              <EntrySection
                title="Teaching"
                id="sp-teaching"
                entries={model.sections.teaching}
                fields={["course", "role", "institution", "year"]}
                body={model.content.teaching}
                pageHeading={isPublicPaged && page === "teaching"}
              />
            )}
            {(!isPublicPaged || page === "cv") && (
              <section className="sp-section" id="sp-cv" aria-labelledby="sp-cv-title">
                {isPublicPaged && page === "cv" ? <h1 id="sp-cv-title">CV</h1> : <h2 id="sp-cv-title">CV</h2>}
                <p className="sp-prose">Selected public CV sections from the published academic profile.</p>
                <EntrySection
                  title="Experience"
                  id="sp-experience"
                  entries={model.sections.experience}
                  fields={["title", "organization", "years"]}
                  pageHeading={false}
                />
              </section>
            )}
            {(!isPublicPaged || page === "contact") && model.contactFormEnabled ? (
              <section className="sp-section" id="sp-contact" aria-labelledby="sp-contact-title">
                {isPublicPaged && page === "contact" ? (
                  <h1 id="sp-contact-title">Contact</h1>
                ) : (
                  <h2 id="sp-contact-title">Contact</h2>
                )}
                <p className="sp-prose">
                  {model.content.contactIntro ||
                    "Use the contact form to reach out about research collaboration and academic opportunities."}
                </p>
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
                      <textarea disabled placeholder="Message" rows={4} />
                    </label>
                    <button type="button" className="primary-action" disabled>
                      Contact form (preview)
                    </button>
                  </div>
                )}
              </section>
            ) : null}

            {mode === "preview" ? (
              <div className="sp-legal-preview-block" aria-label="Legal pages (preview)">
                <LegalSection pageKey="privacy" idPrefix="sp-legal-privacy" />
                <LegalSection pageKey="terms" idPrefix="sp-legal-terms" />
                <LegalSection pageKey="cookies" idPrefix="sp-legal-cookies" />
              </div>
            ) : null}
          </>
        )}
      </main>

      <ScholarPagesFooter
        displayName={model.identity.displayName}
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

function LegalSection({ pageKey, idPrefix }: { pageKey: LegalPageKey; idPrefix?: string }) {
  const doc = getLegalPage(pageKey);
  const id = idPrefix || `sp-legal-${pageKey}`;
  return (
    <article className="sp-section sp-legal" id={id} aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`}>{doc.title}</h1>
      <p className="sp-meta">Last updated: {doc.updated}</p>
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
  pageHeading = false
}: {
  title: string;
  id: string;
  body?: string;
  entries?: { id: string; data: Record<string, string> }[];
  pageHeading?: boolean;
}) {
  if (!body?.trim() && entries.length === 0) return null;
  const Heading = pageHeading ? "h1" : "h2";
  return (
    <section className="sp-section" id={id} aria-labelledby={`${id}-title`}>
      <Heading id={`${id}-title`}>{title}</Heading>
      {body?.trim() ? <p className="sp-prose">{body}</p> : null}
      {entries.length ? (
        <ul className="sp-entry-list">
          {entries.slice(0, 24).map((entry) => (
            <li key={entry.id}>
              <strong>{entry.data.title || entry.data.name || entry.data.course || "Entry"}</strong>
              <span>{[entry.data.year, entry.data.institution, entry.data.role].filter(Boolean).join(" · ")}</span>
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
  pageHeading = false
}: {
  title: string;
  id: string;
  entries?: { id: string; data: Record<string, string> }[];
  fields: string[];
  body?: string;
  pageHeading?: boolean;
}) {
  if (!entries?.length && !body?.trim()) return null;
  const Heading = pageHeading ? "h1" : "h2";
  return (
    <section className="sp-section" id={id} aria-labelledby={`${id}-title`}>
      <Heading id={`${id}-title`}>{title}</Heading>
      {body?.trim() ? <p className="sp-prose">{body}</p> : null}
      {entries?.length ? (
        <ul className="sp-entry-list">
          {entries.slice(0, 40).map((entry) => (
            <li key={entry.id}>
              <strong>{fields.map((field) => entry.data[field]).find(Boolean) || "Untitled"}</strong>
              <span>{fields.map((field) => entry.data[field]).filter(Boolean).slice(1).join(" · ")}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

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

type Props = {
  model: ModernScholarModel;
  mode?: "preview" | "public";
  /** When set, render a single public page instead of the full draft scroll. */
  activePage?: string;
  contactSlot?: React.ReactNode;
};

export function ModernScholarPreview({ model, mode = "preview", activePage, contactSlot }: Props) {
  const page = activePage || "home";
  const isPublicPaged = mode === "public" && Boolean(activePage);

  return (
    <div className={`modern-scholar-site ${mode === "preview" ? "is-preview" : "is-public"}`}>
      <header className="ms-header">
        <div className="ms-brand">
          <strong>{model.identity.displayName || "Academic Scholar"}</strong>
          <span>{model.identity.headline || "Academic website"}</span>
        </div>
        <nav className="ms-nav" aria-label="Website pages">
          {model.pages.map((entry) => (
            <a key={entry.key} href={isPublicPaged || mode === "public" ? entry.href : `#ms-${entry.key}`} className={page === entry.key ? "is-active" : ""}>
              {entry.label}
            </a>
          ))}
        </nav>
      </header>

      {(!isPublicPaged || page === "home") && (
        <section className="ms-hero" id="ms-home">
          <div>
            <p className="ms-kicker">{model.identity.affiliation || "Academic profile"}</p>
            <h1>{model.identity.displayName || "Your name"}</h1>
            <p className="ms-lead">{model.identity.headline}</p>
            <p>{model.summary || "Your research summary and public introduction will appear here."}</p>
            <div className="ms-links">
              {model.identity.orcidUrl ? <a href={model.identity.orcidUrl}>ORCID</a> : null}
              {model.identity.googleScholarUrl ? <a href={model.identity.googleScholarUrl}>Google Scholar</a> : null}
              {model.identity.linkedinUrl ? <a href={model.identity.linkedinUrl}>LinkedIn</a> : null}
              {model.identity.email ? <a href={`mailto:${model.identity.email}`}>Email</a> : null}
            </div>
          </div>
          <div className="ms-stats">
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
        </section>
      )}

      {(!isPublicPaged || page === "about") && <Section title="About" id="ms-about" body={model.content.about} />}
      {(!isPublicPaged || page === "research") && (
        <Section title="Research" id="ms-research" body={model.content.research} entries={model.sections.projects} />
      )}
      {(!isPublicPaged || page === "publications") && (
        <EntrySection title="Publications" id="ms-publications" entries={model.sections.publications} fields={["title", "authors", "year", "venue"]} />
      )}
      {(!isPublicPaged || page === "teaching") && (
        <EntrySection
          title="Teaching"
          id="ms-teaching"
          entries={model.sections.teaching}
          fields={["course", "role", "institution", "year"]}
          body={model.content.teaching}
        />
      )}
      {(!isPublicPaged || page === "about") && (
        <EntrySection title="Education" id="ms-education" entries={model.sections.education} fields={["degree", "institution", "year", "field"]} />
      )}
      {(!isPublicPaged || page === "cv") && (
        <section className="ms-section" id="ms-cv">
          <h2>CV</h2>
          <p>Selected public CV sections are presented from the published academic profile snapshot.</p>
          <EntrySection title="Experience" id="ms-experience" entries={model.sections.experience} fields={["title", "organization", "years"]} />
        </section>
      )}
      {(!isPublicPaged || page === "contact") && model.contactFormEnabled ? (
        <section className="ms-section" id="ms-contact">
          <h2>Contact</h2>
          <p>{model.content.contactIntro || "Use the contact form to reach out about research collaboration and academic opportunities."}</p>
          {contactSlot ? (
            contactSlot
          ) : (
            <div className="ms-contact-card">
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

      <footer className="ms-footer">
        <span>{model.publicUrl}</span>
        <span>Built with CVScholar · Modern Scholar</span>
      </footer>
    </div>
  );
}

function Section({
  title,
  id,
  body,
  entries = []
}: {
  title: string;
  id: string;
  body?: string;
  entries?: { id: string; data: Record<string, string> }[];
}) {
  if (!body?.trim() && entries.length === 0) return null;
  return (
    <section className="ms-section" id={id}>
      <h2>{title}</h2>
      {body?.trim() ? <p>{body}</p> : null}
      {entries.length ? (
        <ul className="ms-entry-list">
          {entries.slice(0, 12).map((entry) => (
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
  body
}: {
  title: string;
  id: string;
  entries?: { id: string; data: Record<string, string> }[];
  fields: string[];
  body?: string;
}) {
  if (!entries?.length && !body?.trim()) return null;
  return (
    <section className="ms-section" id={id}>
      <h2>{title}</h2>
      {body?.trim() ? <p>{body}</p> : null}
      {entries?.length ? (
        <ul className="ms-entry-list">
          {entries.slice(0, 12).map((entry) => (
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

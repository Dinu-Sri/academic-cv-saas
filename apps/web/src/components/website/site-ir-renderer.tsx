import { ScholarPagesChrome, ScholarPagesFooter } from "@/components/website/scholar-pages-chrome";
import type { SiteBlock, SiteIR, SiteRoute, SiteSectionEntry, SiteSectionModule } from "@/lib/website/site-engine";
import { getSiteRoute } from "@/lib/website/site-engine";
import { getSiteTheme } from "@/lib/website/themes/registry";

type Props = {
  ir: SiteIR;
  mode?: "preview" | "public";
  /** Active route key: home | research | journey | contributions | contact | privacy | … */
  activeRoute?: string;
  contactSlot?: React.ReactNode;
  /** Preview mode can show all content routes stacked (hash nav). */
  stackAllContent?: boolean;
};

/**
 * Thin renderer: Site IR + theme registry → DOM.
 * No composition logic. Unknown block types are skipped.
 */
export function SiteIrRenderer({
  ir,
  mode = "preview",
  activeRoute = "home",
  contactSlot,
  stackAllContent = mode === "preview"
}: Props) {
  const theme = getSiteTheme(ir.themeId);
  const useHashNav = mode === "preview";

  const contentKeys = ir.routes
    .map((r) => r.key)
    .filter((k) => !["privacy", "terms", "cookies"].includes(k));

  const routesToRender: SiteRoute[] = stackAllContent
    ? ir.routes.filter((r) => contentKeys.includes(r.key) || r.key === activeRoute)
    : (() => {
        const route = getSiteRoute(ir, activeRoute) || getSiteRoute(ir, "home");
        return route ? [route] : [];
      })();

  // Preview stacks content; legal routes only when active
  const legalOnly = ["privacy", "terms", "cookies"].includes(activeRoute);
  const displayRoutes = legalOnly
    ? ir.routes.filter((r) => r.key === activeRoute)
    : stackAllContent
      ? ir.routes.filter((r) => !["privacy", "terms", "cookies"].includes(r.key))
      : routesToRender;

  // Preview: append legal docs at bottom for hash targets
  const finalRoutes =
    mode === "preview" && !legalOnly
      ? [
          ...displayRoutes,
          ...ir.routes.filter((r) => ["privacy", "terms", "cookies"].includes(r.key))
        ]
      : displayRoutes;

  return (
    <div
      className={theme.rootClass}
      data-template="scholar-pages"
      data-theme-id={theme.id}
      data-ir-version={ir.irVersion}
      data-policy-version={ir.policyVersion}
      data-site-mode={ir.mode}
    >
      <ScholarPagesChrome
        brandName={ir.chrome.brandName}
        brandHref={mode === "public" ? "/" : "#sp-home"}
        brandSub={ir.chrome.brandSub}
        brandPhotoUrl={ir.identity.photoUrl || undefined}
        pages={ir.chrome.nav.map((item) => ({
          key: item.key,
          label: item.label,
          href: item.href
        }))}
        activePage={activeRoute}
        mode={mode}
        useHashNav={useHashNav}
        cvHref={ir.chrome.cvHref}
        showPlatformBranding={ir.chrome.showPlatformBranding}
      />

      <main id="sp-main" className="site-main" tabIndex={-1}>
        {finalRoutes.map((route) => (
          <div
            key={route.key}
            id={route.key === "home" ? "sp-home" : `sp-${route.key}`}
            data-route={route.key}
          >
            {route.blocks.map((block) => (
              <SiteBlockView
                key={block.id}
                block={block}
                mode={mode}
                contactSlot={route.key === "contact" ? contactSlot : undefined}
                useHashNav={useHashNav}
              />
            ))}
          </div>
        ))}
      </main>

      <ScholarPagesFooter
        displayName={ir.chrome.footer.displayName}
        affiliation={ir.chrome.footer.affiliation}
        publicUrl={ir.chrome.footer.publicUrl}
        mode={mode}
        orcidUrl={ir.identity.orcidUrl}
        scholarUrl={ir.identity.googleScholarUrl}
        linkedinUrl={ir.identity.linkedinUrl}
        showPlatformBranding={ir.chrome.showPlatformBranding}
        pages={ir.chrome.nav.map((item) => ({
          key: item.key,
          label: item.label,
          href: item.href
        }))}
        cvHref={ir.chrome.cvHref}
      />
    </div>
  );
}

function SiteBlockView({
  block,
  contactSlot,
  useHashNav
}: {
  block: SiteBlock;
  mode?: "preview" | "public";
  contactSlot?: React.ReactNode;
  useHashNav: boolean;
}) {
  switch (block.type) {
    case "identity_hero":
      return <IdentityHeroBlock block={block} useHashNav={useHashNav} />;
    case "details_panel":
      // Rendered inside hero for paper theme; skip standalone if paired
      return null;
    case "metric_band":
      return (
        <section className="metric-band" aria-label="Profile counts" data-block={block.type}>
          {block.props.items.map((item) => (
            <div className="metric-item" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>
      );
    case "highlight_list":
      return (
        <section className="section" data-block={block.type}>
          <p className="section-label">Selected work</p>
          <h2 className="section-title">Latest highlights</h2>
          <ul className="highlight-list">
            {block.props.items.map((item) => (
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
      );
    case "section_module":
      return <SectionModuleBlock module={block.props.module} headingLevel={block.props.headingLevel} />;
    case "sparse_contact_cta":
      return (
        <section className="section" data-block={block.type}>
          <p className="section-label">Contact</p>
          <h2 className="section-title">Get in touch</h2>
          <p className="section-lede">{block.props.intro}</p>
          <a className="text-link" href={hrefFor(block.props.href, useHashNav, "contact")}>
            Contact form <span>→</span>
          </a>
        </section>
      );
    case "contact_page":
      return (
        <section className="contact-page" data-block={block.type}>
          <div className="contact-intro">
            <p className="section-label">Contact</p>
            <h1>Get in touch</h1>
            <p>{block.props.intro}</p>
            <dl className="contact-facts">
              {block.props.identity.email ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${block.props.identity.email}`}>{block.props.identity.email}</a>
                  </dd>
                </div>
              ) : null}
              {block.props.identity.affiliation ? (
                <div>
                  <dt>Affiliation</dt>
                  <dd>{block.props.identity.affiliation}</dd>
                </div>
              ) : null}
              {block.props.identity.location ? (
                <div>
                  <dt>Location</dt>
                  <dd>{block.props.identity.location}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {contactSlot || (
            <div className="contact-form">
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
                <textarea disabled rows={5} placeholder="How can we work together?" />
              </label>
              <button type="button" disabled>
                Send message <span>→</span>
              </button>
            </div>
          )}
        </section>
      );
    case "legal_doc":
      return (
        <article className="section" id={`sp-legal-${block.props.pageKey}`} data-block={block.type}>
          <h1 className="section-title">{block.props.title}</h1>
          <p className="section-lede">Last updated: {block.props.updated}</p>
          {block.props.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="section-lede">
              {p}
            </p>
          ))}
        </article>
      );
    default:
      return null;
  }
}

function IdentityHeroBlock({
  block,
  useHashNav
}: {
  block: Extract<SiteBlock, { type: "identity_hero" }>;
  useHashNav: boolean;
}) {
  const { identity, heroMode, primaryCta, secondaryCtas, cvHref } = block.props;
  const showDetails = heroMode === "details_panel" || heroMode === "with_photo";
  const hasPhoto = heroMode === "with_photo" && Boolean(identity.photoUrl);

  return (
    <header className={`home-hero${showDetails && !hasPhoto ? " home-hero-no-photo" : ""}${hasPhoto ? " home-hero-with-photo" : ""}`} data-block={block.type} data-hero-mode={heroMode}>
      <div className="home-hero-copy">
        {identity.affiliation ? <p className="home-kicker">{identity.affiliation}</p> : null}
        <h1>{identity.displayName}</h1>
        {identity.headline ? <p className="home-role">{identity.headline}</p> : null}
        <p className="home-bio">{identity.summary}</p>
        <div className="home-actions">
          {primaryCta ? (
            <a className="text-link" href={hrefFor(primaryCta.href, useHashNav, primaryCta.href.replace(/^\//, "") || "home")}>
              {primaryCta.label} <span>→</span>
            </a>
          ) : null}
          {cvHref || secondaryCtas.find((c) => c.label.includes("CV")) ? (
            <a className="text-link muted" href={cvHref || secondaryCtas.find((c) => c.label.includes("CV"))!.href}>
              Download CV <span>↓</span>
            </a>
          ) : null}
          {secondaryCtas
            .filter((c) => !c.label.includes("CV"))
            .map((cta) => (
              <a
                key={cta.label}
                className="text-link muted"
                href={hrefFor(cta.href, useHashNav, cta.href.replace(/^\//, "") || "contact")}
              >
                {cta.label} <span>→</span>
              </a>
            ))}
        </div>
      </div>
      {hasPhoto ? (
        <figure className="home-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- Public/profile photo served by app routes */}
          <img src={identity.photoUrl} alt="" width={220} height={220} />
        </figure>
      ) : null}
      {showDetails && !hasPhoto ? (
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
            {identity.orcidUrl ? (
              <div>
                <dt>ORCID</dt>
                <dd>
                  <a href={identity.orcidUrl} target="_blank" rel="noopener noreferrer">
                    Profile ↗
                  </a>
                </dd>
              </div>
            ) : null}
            {identity.googleScholarUrl ? (
              <div>
                <dt>Google Scholar</dt>
                <dd>
                  <a href={identity.googleScholarUrl} target="_blank" rel="noopener noreferrer">
                    Profile ↗
                  </a>
                </dd>
              </div>
            ) : null}
            {identity.linkedinUrl ? (
              <div>
                <dt>LinkedIn</dt>
                <dd>
                  <a href={identity.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    Profile ↗
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      ) : null}
    </header>
  );
}

function SectionModuleBlock({
  module,
  headingLevel
}: {
  module: SiteSectionModule;
  headingLevel: "h1" | "h2";
}) {
  const Title = headingLevel;
  return (
    <section className="section" id={`sp-${module.key}`} data-block="section_module" data-section={module.key}>
      <div className="section-head">
        <Title className="section-title" id={`sp-${module.key}-title`}>
          {module.label}
        </Title>
        <span className="count">
          {module.entries.length} {module.entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {module.presentation === "publication_list" ? (
        <div className="publication-list">
          {module.entries.map((entry: SiteSectionEntry) => {
            const link = pubLink(entry.data);
            return (
              <article className="publication" key={entry.id}>
                <time>{entry.data.year || "—"}</time>
                <div>
                  {entry.data.type ? <p className="publication-type">{entry.data.type}</p> : null}
                  <h3>{entry.data.title || "Untitled"}</h3>
                  {entry.data.authors ? <p>{entry.data.authors}</p> : null}
                  {entry.data.venue ? (
                    <p>
                      <em>{entry.data.venue}</em>
                    </p>
                  ) : null}
                </div>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    DOI ↗
                  </a>
                ) : (
                  <span />
                )}
              </article>
            );
          })}
        </div>
      ) : module.presentation === "chip_list" ? (
        <div className="chip-row">
          {module.entries.map((entry: SiteSectionEntry) => (
            <span key={entry.id}>{firstField(entry.data, ["interest", "name", "skill", "language", "title"])}</span>
          ))}
        </div>
      ) : (
        <div className="row-list">
          {module.entries.map((entry: SiteSectionEntry) => {
            const date = entry.data.year || entry.data.years || entry.data.date || "—";
            const title = firstField(entry.data, [
              "title",
              "degree",
              "course",
              "name",
              "role",
              "interest",
              "student"
            ]);
            const meta = [
              entry.data.institution,
              entry.data.organization,
              entry.data.role,
              entry.data.field,
              entry.data.issuer,
              entry.data.venue
            ]
              .filter(Boolean)
              .filter((v, i, a) => a.indexOf(v) === i && v !== title)
              .slice(0, 3)
              .join(" · ");
            return (
              <article className="row" key={entry.id}>
                <time>{date}</time>
                <div>
                  <h3>{title}</h3>
                  {meta ? <p className="meta">{meta}</p> : null}
                  {entry.data.description ? <p>{entry.data.description}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function hrefFor(href: string, useHashNav: boolean, keyHint: string) {
  if (!useHashNav) return href;
  if (href === "/" || keyHint === "home") return "#sp-home";
  const key = href.replace(/^\//, "") || keyHint;
  return `#sp-${key}`;
}

function firstField(data: Record<string, string>, fields: string[]) {
  return fields.map((f) => data[f]).find(Boolean) || data.title || data.name || "Entry";
}

function pubLink(data: Record<string, string>) {
  if (data.doi) return /^https?:\/\//i.test(data.doi) ? data.doi : `https://doi.org/${data.doi.replace(/^\//, "")}`;
  return /^https?:\/\//i.test(data.url || "") ? data.url : "";
}

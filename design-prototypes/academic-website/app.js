(function () {
  const root = document.querySelector("#site-root");
  if (!root || !window.AcademicDemo) return;

  const page = document.body.dataset.page || "home";
  const isSparse = document.body.dataset.profile === "sparse" || new URLSearchParams(window.location.search).get("profile") === "sparse";
  const profile = isSparse ? window.AcademicDemo.sparseProfile : window.AcademicDemo.profile;
  const sections = profile.sections;

  const pageNames = {
    home: "Home",
    research: "Research",
    journey: "Academic Journey",
    contributions: "Contributions",
    contact: "Contact",
    system: "Design system",
    sparse: "Sparse profile"
  };

  function items(key) {
    return Array.isArray(sections[key]) ? sections[key] : [];
  }

  function hasAny(keys) {
    return keys.some((key) => items(key).length > 0);
  }

  function yearGroups(publications) {
    return publications.reduce((groups, publication) => {
      (groups[publication.year] ||= []).push(publication);
      return groups;
    }, {});
  }

  function renderHeader() {
    const richNav = ["home", "research", "journey", "contributions", "contact"];
    const sparseNav = ["home", "contact"];
    const links = (isSparse ? sparseNav : richNav)
      .map((key) => {
        const href = isSparse ? (key === "home" ? "sparse.html" : "contact.html?profile=sparse") : `${key === "home" ? "index" : key}.html`;
        return `<a href="${href}" ${page === key || (page === "sparse" && key === "home") ? 'aria-current="page"' : ""}>${pageNames[key]}</a>`;
      })
      .join("");

    return `
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header class="site-header">
        <a class="identity" href="${isSparse ? "sparse.html" : "index.html"}" aria-label="${profile.name}, home">
          <span class="identity-mark">${profile.initials}</span>
          <span><strong>${profile.name}</strong><small>${profile.role}</small></span>
        </a>
        <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-navigation">Menu</button>
        <nav id="site-navigation" class="site-navigation" aria-label="Primary navigation">${links}</nav>
        <button class="theme-button" type="button" aria-label="Change color theme"><span class="theme-dot"></span><span class="theme-label">Ink</span></button>
      </header>`;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <div><strong>${profile.name}</strong><span>${profile.affiliation}</span></div>
        <div class="footer-links"><a href="${isSparse ? "contact.html?profile=sparse" : "contact.html"}">Contact</a><a href="#">Download CV</a><a href="system.html">Prototype notes</a></div>
        <p>Academic website prototype · Demo content · 2026</p>
      </footer>`;
  }

  function eyebrow(text, number) {
    return `<div class="eyebrow"><span>${number}</span>${text}</div>`;
  }

  function renderHome() {
    const featured = items("projects").find((item) => item.featured) || items("projects")[0];
    const selectedPublications = items("publications").filter((item) => item.featured).slice(0, 3);
    const highlights = [
      items("grants")[0] && { label: "Current funding", value: items("grants")[0].title, meta: items("grants")[0].agency },
      items("teaching")[0] && { label: "Teaching", value: items("teaching")[0].course, meta: items("teaching")[0].role },
      items("awards")[0] && { label: "Recognition", value: items("awards")[0].title, meta: items("awards")[0].year }
    ].filter(Boolean);

    return `
      <main id="main-content">
        <section class="home-hero reveal">
          <div class="hero-copy">
            <p class="hero-kicker">${profile.affiliation}</p>
            <h1>${profile.headline}</h1>
            <p class="hero-summary">${profile.bio}</p>
            <div class="hero-actions"><a class="text-link" href="research.html">Explore research <span>→</span></a><a class="text-link secondary" href="#">Download CV <span>↓</span></a></div>
          </div>
          <aside class="profile-panel" aria-label="Academic profile summary">
            <div class="portrait" aria-hidden="true"><span>${profile.initials}</span></div>
            <div class="profile-facts"><strong>${profile.name}</strong><span>${profile.role}</span><span>${profile.location}</span></div>
            <div class="profile-links">${profile.links.map((link) => `<a href="#"><span>${link.label}</span><strong>${link.value}</strong></a>`).join("")}</div>
          </aside>
        </section>

        <section class="metric-band reveal" aria-label="Academic profile metrics">
          ${profile.metrics.map((metric) => `<div><strong>${metric.value}</strong><span>${metric.label}</span></div>`).join("")}
        </section>

        <section class="home-overview section-pad reveal">
          <div class="section-heading">${eyebrow("At a glance", "01")}<h2>A concise view of the work.</h2></div>
          <div class="overview-grid">
            <div class="research-note"><p>${profile.researchSummary}</p><div class="interest-list">${profile.interests.map((interest) => `<span>${interest}</span>`).join("")}</div></div>
            <div class="highlight-list">${highlights.map((item) => `<article><span>${item.label}</span><h3>${item.value}</h3><p>${item.meta}</p></article>`).join("")}</div>
          </div>
        </section>

        ${featured ? `<section class="featured-project section-pad reveal">
          <div class="section-heading">${eyebrow("Current work", "02")}<h2>${featured.title}</h2></div>
          <div class="featured-grid"><p class="lead-copy">${featured.description}</p><dl><div><dt>Role</dt><dd>${featured.role}</dd></div><div><dt>Period</dt><dd>${featured.years}</dd></div>${featured.collaborators ? `<div><dt>Partners</dt><dd>${featured.collaborators}</dd></div>` : ""}</dl></div>
          <a class="text-link" href="research.html">View projects and funding <span>→</span></a>
        </section>` : ""}

        ${selectedPublications.length ? `<section class="home-publications section-pad reveal">
          <div class="section-heading split"><div>${eyebrow("Selected publications", "03")}<h2>Recent writing</h2></div><a class="text-link" href="research.html#publications">All publications <span>→</span></a></div>
          <div class="publication-list compact">${selectedPublications.map(renderPublication).join("")}</div>
        </section>` : ""}

        ${isSparse ? renderSparseExplanation() : `<section class="closing-note reveal"><p>Research is strongest when methods, materials, and communities shape the question together.</p><a href="contact.html">Start a conversation <span>→</span></a></section>`}
      </main>`;
  }

  function renderSparseExplanation() {
    return `<section class="sparse-explainer section-pad reveal">
      ${eyebrow("Adaptive composition", "04")}
      <h2>No empty pages.</h2>
      <p>This profile has research, education, teaching, conference, and language entries, but not enough depth for three separate category pages. The useful content is therefore composed into this single homepage. Only Contact remains in navigation.</p>
      <a class="text-link" href="index.html">Compare rich profile <span>→</span></a>
    </section>`;
  }

  function renderResearch() {
    const projects = items("projects");
    const grants = items("grants");
    const patents = items("patents");
    const publications = items("publications");
    const years = Object.keys(yearGroups(publications)).sort().reverse();
    const types = [...new Set(publications.map((item) => item.type))];

    return `
      <main id="main-content">
        <section class="page-intro reveal">
          ${eyebrow("Research", "01")}
          <div><h1>Materials designed for useful, maintainable systems.</h1><p>${profile.researchSummary}</p></div>
        </section>
        <section class="theme-index reveal" aria-label="Research themes">${profile.interests.map((interest, index) => `<div><span>0${index + 1}</span><strong>${interest}</strong></div>`).join("")}</section>

        ${projects.length ? `<section class="section-pad reveal" id="projects">
          <div class="section-heading split"><div>${eyebrow("Projects", "02")}<h2>Current and recent work</h2></div><p>${projects.length} projects</p></div>
          <div class="project-list">${projects.map((project, index) => `<article class="project-row ${index === 0 ? "featured" : ""}"><span class="project-number">0${index + 1}</span><div><p class="meta">${project.role} · ${project.years}</p><h3>${project.title}</h3><p>${project.description}</p>${project.outputs ? `<p class="output"><strong>Outputs</strong> ${project.outputs}</p>` : ""}</div><span class="project-org">${project.organization}</span></article>`).join("")}</div>
        </section>` : ""}

        ${grants.length ? `<section class="funding-section section-pad reveal">
          <div class="section-heading">${eyebrow("Funding and innovation", "03")}<h2>Support behind the work</h2></div>
          <div class="funding-grid">${grants.map((grant) => `<article><p class="meta">${grant.status} · ${grant.years || grant.year}</p><h3>${grant.title}</h3><p>${grant.agency}</p><dl><div><dt>Role</dt><dd>${grant.role}</dd></div><div><dt>Award</dt><dd>${grant.amount}</dd></div></dl></article>`).join("")}${patents.map((patent) => `<article class="patent"><p class="meta">${patent.status} · ${patent.year}</p><h3>${patent.title}</h3><p>${patent.number} · ${patent.jurisdiction}</p><span>Innovation record</span></article>`).join("")}</div>
        </section>` : ""}

        <section class="publication-section section-pad reveal" id="publications">
          <div class="section-heading split"><div>${eyebrow("Publications", "04")}<h2>Research record</h2></div><p><span id="publication-count">${publications.length}</span> items</p></div>
          <div class="publication-tools" aria-label="Publication filters">
            <label><span>Search</span><input id="publication-search" type="search" placeholder="Title, author, or journal"></label>
            <label><span>Year</span><select id="publication-year"><option value="all">All years</option>${years.map((year) => `<option>${year}</option>`).join("")}</select></label>
            <label><span>Type</span><select id="publication-type"><option value="all">All types</option>${types.map((type) => `<option>${type}</option>`).join("")}</select></label>
          </div>
          <div class="publication-list" id="publication-list">${publications.map(renderPublication).join("")}</div>
          <p class="empty-filter" id="publication-empty" hidden>No publications match those filters.</p>
        </section>
      </main>`;
  }

  function renderPublication(publication) {
    return `<article class="publication" data-year="${publication.year}" data-type="${publication.type || ""}" data-search="${[publication.title, publication.authors, publication.venue].join(" ").toLowerCase()}">
      <time>${publication.year}</time><div><p class="publication-type">${publication.type || "Publication"}</p><h3>${publication.title}</h3><p>${publication.authors}</p><p class="publication-venue"><em>${publication.venue}</em>${publication.detail ? `, ${publication.detail}` : ""}</p></div>${publication.doi ? `<a href="#" aria-label="DOI for ${publication.title}">DOI ↗</a>` : `<span></span>`}
    </article>`;
  }

  function renderJourney() {
    const timeline = [...items("academic_appointments"), ...items("experience")];
    return `
      <main id="main-content">
        <section class="page-intro journey-intro reveal">${eyebrow("Academic journey", "01")}<div><h1>Scholarship built through practice, teaching, and exchange.</h1><p>A chronological view of appointments, education, teaching, and mentorship, composed as one connected academic story.</p></div></section>

        ${timeline.length ? `<section class="journey-timeline section-pad reveal"><div class="section-heading">${eyebrow("Appointments", "02")}<h2>Academic and professional roles</h2></div><div class="timeline">${timeline.map((role) => `<article><time>${role.years}</time><div><h3>${role.title}</h3><p><strong>${role.institution || role.organization}</strong>${role.department ? ` · ${role.department}` : ""}</p>${role.description ? `<p>${role.description}</p>` : ""}</div><span>${role.location || ""}</span></article>`).join("")}</div></section>` : ""}

        <section class="education-section section-pad reveal"><div class="section-heading">${eyebrow("Formation", "03")}<h2>Education</h2></div><div class="degree-list">${items("education").map((degree) => `<article><time>${degree.year}</time><div><h3>${degree.degree}</h3><p>${degree.institution}</p><span>${degree.field}</span>${degree.detail ? `<small>${degree.detail}</small>` : ""}</div></article>`).join("")}</div></section>

        ${hasAny(["teaching", "supervision"]) ? `<section class="teaching-section section-pad reveal"><div class="section-heading split"><div>${eyebrow("Teaching and mentorship", "04")}<h2>Learning as a shared practice</h2></div><p>${items("teaching").length} courses · ${items("supervision").length} supervision records</p></div><div class="teaching-grid"><div>${items("teaching").map((course) => `<article class="course"><span>${course.code || course.level}</span><h3>${course.course}</h3><p>${course.role} · ${course.institution}</p><time>${course.years || course.year}</time>${course.description ? `<small>${course.description}</small>` : ""}</article>`).join("")}</div><aside><h3>Current supervision</h3>${items("supervision").map((record) => `<article><p>${record.level} · ${record.status}</p><strong>${record.student}</strong><span>${record.topic}</span><time>${record.years}</time></article>`).join("")}</aside></div></section>` : ""}

        ${hasAny(["skills", "languages", "certifications"]) ? `<section class="capabilities section-pad reveal"><div class="section-heading">${eyebrow("Capabilities", "05")}<h2>Methods, tools, and languages</h2></div><div class="capability-grid"><div>${items("skills").map((skill) => `<article><h3>${skill.name}</h3><p>${skill.values}</p></article>`).join("")}</div><div class="language-list">${items("languages").map((language) => `<p><strong>${language.language}</strong><span>${language.proficiency}</span></p>`).join("")}${items("certifications").map((cert) => `<p><strong>${cert.name}</strong><span>${cert.issuer} · ${cert.year}</span></p>`).join("")}</div></div></section>` : ""}
      </main>`;
  }

  function renderContributions() {
    return `
      <main id="main-content">
        <section class="page-intro contributions-intro reveal">${eyebrow("Contributions", "01")}<div><h1>Work that strengthens the academic community.</h1><p>Selected service, editorial activity, public scholarship, professional affiliations, and recognition.</p></div></section>

        ${hasAny(["invited_talks", "conferences"]) ? `<section class="talks-section section-pad reveal"><div class="section-heading split"><div>${eyebrow("Public scholarship", "02")}<h2>Talks and conferences</h2></div><p>${items("invited_talks").length + items("conferences").length} selected engagements</p></div><div class="talk-list">${[...items("invited_talks").map((item) => ({ ...item, kind: "Invited talk" })), ...items("conferences").map((item) => ({ ...item, event: item.conference, kind: item.role }))].map((talk) => `<article><time>${talk.year}</time><div><p>${talk.kind}</p><h3>${talk.title}</h3><span>${talk.event}${talk.institution ? ` · ${talk.institution}` : ""}</span></div><strong>${talk.location}</strong></article>`).join("")}</div></section>` : ""}

        ${hasAny(["academic_service", "editorial"]) ? `<section class="service-section section-pad reveal"><div class="section-heading">${eyebrow("Service and editorial", "03")}<h2>Stewardship of institutions and ideas</h2></div><div class="service-columns"><div><h3>Academic service</h3>${items("academic_service").map((service) => `<article><p>${service.years}</p><strong>${service.role}</strong><span>${service.organization}</span>${service.description ? `<small>${service.description}</small>` : ""}</article>`).join("")}</div><div><h3>Editorial and reviewing</h3>${items("editorial").map((role) => `<article><p>${role.years}</p><strong>${role.role}</strong><span>${role.journal}</span><small>${role.publisher || ""}</small></article>`).join("")}</div></div></section>` : ""}

        ${hasAny(["awards", "memberships"]) ? `<section class="recognition-section section-pad reveal"><div class="section-heading">${eyebrow("Recognition and affiliations", "04")}<h2>Professional standing</h2></div><div class="recognition-grid"><div>${items("awards").map((award) => `<article><time>${award.year}</time><h3>${award.title}</h3><p>${award.issuer}</p></article>`).join("")}</div><div>${items("memberships").map((membership) => `<article><p>${membership.years}</p><h3>${membership.organization}</h3><span>${membership.role}</span></article>`).join("")}</div></div></section>` : ""}
      </main>`;
  }

  function renderContact() {
    return `
      <main id="main-content">
        <section class="contact-page reveal">
          <div class="contact-intro">${eyebrow("Contact", "01")}<h1>Let’s discuss research, teaching, or collaboration.</h1><p>For research enquiries, prospective supervision, invited talks, or institutional collaboration, send a concise note below.</p><dl><div><dt>Email</dt><dd><a href="mailto:${profile.email}">${profile.email}</a></dd></div><div><dt>Affiliation</dt><dd>${profile.affiliation}</dd></div><div><dt>Location</dt><dd>${profile.location}</dd></div></dl></div>
          <form class="contact-form" action="#" method="post"><label><span>Name</span><input type="text" autocomplete="name" required></label><label><span>Email</span><input type="email" autocomplete="email" required></label><label><span>Reason for writing</span><select><option>Research collaboration</option><option>Prospective supervision</option><option>Invited talk or teaching</option><option>Media or general enquiry</option></select></label><label><span>Message</span><textarea rows="6" required></textarea></label><button type="submit">Send message <span>→</span></button><p>This prototype does not submit or store messages.</p></form>
        </section>
      </main>`;
  }

  function renderSystem() {
    return `
      <main id="main-content" class="system-page">
        <section class="system-intro reveal">${eyebrow("Prototype reference", "00")}<h1>Quiet Authority</h1><p>A compact editorial system for academic websites: credible, information-dense, calm, and adaptable to very different levels of profile completeness.</p><div class="scenario-links"><a href="index.html">Rich profile demo <span>→</span></a><a href="sparse.html">Sparse profile demo <span>→</span></a></div></section>
        <section class="system-section reveal"><div><span>01</span><h2>Principles</h2></div><div class="principle-grid"><article><strong>Snapshot first</strong><p>Name, role, research direction, credibility, and current work are visible in one desktop viewport.</p></article><article><strong>Typography over boxes</strong><p>Hairlines, rhythm, and hierarchy organize information without turning every item into a card.</p></article><article><strong>Adaptive pages</strong><p>Categories qualify only when content is strong enough. Thin categories merge into Home or Academic Journey.</p></article><article><strong>Academic utility</strong><p>Publication filtering, citation identifiers, dates, roles, and affiliations remain easy to scan.</p></article></div></section>
        <section class="system-section reveal"><div><span>02</span><h2>Color</h2></div><div class="swatches"><article style="--swatch:#f2efe7"><span>Paper</span><code>#F2EFE7</code></article><article style="--swatch:#102f2b"><span>Ink</span><code>#102F2B</code></article><article style="--swatch:#c66b3d"><span>Signal</span><code>#C66B3D</code></article><article style="--swatch:#d8cda9"><span>Sand</span><code>#D8CDA9</code></article><article style="--swatch:#faf8f2"><span>Sheet</span><code>#FAF8F2</code></article></div></section>
        <section class="system-section type-specimen reveal"><div><span>03</span><h2>Typography</h2></div><div><p class="display-sample">Research should be useful beyond the laboratory.</p><p class="body-sample">Editorial serif headings carry academic character. A restrained humanist sans serif supports dense metadata, controls, and long-form reading.</p><div class="type-scale"><span>Display 56/58</span><span>Page title 44/48</span><span>Section 32/36</span><span>Body 16/26</span><span>Metadata 12/18</span></div></div></section>
        <section class="system-section reveal"><div><span>04</span><h2>Components</h2></div><div class="component-samples"><a class="text-link" href="#">Text action <span>→</span></a><button>Primary action <span>→</span></button><div class="interest-list"><span>Research theme</span><span>Another theme</span></div><article class="mini-publication"><time>2026</time><div><small>Journal article</small><strong>Publication title set as readable editorial content</strong><span>Author, Journal Name, volume and pages</span></div><a href="#">DOI ↗</a></article></div></section>
      </main>`;
  }

  const renderers = { home: renderHome, sparse: renderHome, research: renderResearch, journey: renderJourney, contributions: renderContributions, contact: renderContact, system: renderSystem };
  root.innerHTML = `${renderHeader()}${(renderers[page] || renderHome)()}${renderFooter()}`;

  const menuButton = document.querySelector(".menu-button");
  const navigation = document.querySelector(".site-navigation");
  menuButton?.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
    navigation?.classList.toggle("open", !open);
  });

  const themeButton = document.querySelector(".theme-button");
  const storedTheme = localStorage.getItem("academic-demo-theme");
  if (storedTheme === "night") document.documentElement.dataset.theme = "night";
  updateThemeLabel();
  themeButton?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "night" ? "day" : "night";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("academic-demo-theme", next);
    updateThemeLabel();
  });

  function updateThemeLabel() {
    const label = document.querySelector(".theme-label");
    if (label) label.textContent = document.documentElement.dataset.theme === "night" ? "Paper" : "Ink";
  }

  const search = document.querySelector("#publication-search");
  const year = document.querySelector("#publication-year");
  const type = document.querySelector("#publication-type");
  [search, year, type].forEach((control) => control?.addEventListener("input", filterPublications));

  function filterPublications() {
    const query = search?.value.trim().toLowerCase() || "";
    const selectedYear = year?.value || "all";
    const selectedType = type?.value || "all";
    let visible = 0;
    document.querySelectorAll(".publication").forEach((publication) => {
      const matches = (!query || publication.dataset.search.includes(query)) && (selectedYear === "all" || publication.dataset.year === selectedYear) && (selectedType === "all" || publication.dataset.type === selectedType);
      publication.hidden = !matches;
      if (matches) visible += 1;
    });
    const count = document.querySelector("#publication-count");
    const empty = document.querySelector("#publication-empty");
    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible !== 0;
  }

  document.querySelector(".contact-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.textContent = "Prototype only — message not sent";
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
})();

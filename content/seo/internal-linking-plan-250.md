# CVScholar Internal Linking Plan — 250 Articles

## Architecture: Hub-and-Spoke with Cross-Pillar Bridges

```
          P10 ←→ P1 ←→ P2
           ↕      ↕      ↕
          P5  ←→ P3 ←→ P7
           ↕      ↕      ↕
          P8  ←→ P4 ←→ P9
                  ↕
                 P6
```

Each pillar is a hub (P*-00) with 24 spoke articles. Hubs interconnect via the bridge map below.

---

## 1. Hub-to-Hub Bridge Map

| Hub | Direct Hub Links |
|-----|-----------------|
| P1-00 Academic CV Writing | P2-00, P3-00, P6-00 |
| P2-00 CV Sections | P1-00, P7-00, P8-00 |
| P3-00 Career Stages | P1-00, P5-00, P4-00 |
| P4-00 Field-Specific | P1-00, P3-00, P6-00 |
| P5-00 Job Market | P1-00, P3-00, P8-00 |
| P6-00 Formatting | P1-00, P4-00, P7-00 |
| P7-00 Publications | P2-00, P9-00, P6-00 |
| P8-00 Grants & Awards | P2-00, P5-00, P7-00 |
| P9-00 Digital Presence | P7-00, P1-00, P6-00 |
| P10-00 International | P1-00, P4-00, P5-00 |

---

## 2. Mandatory Links Per Article (All 250)

Every article must contain:

| Link Type | Count | Rule |
|-----------|-------|------|
| Pillar hub link | 1 | Link to own P*-00 within first 200 words |
| Same-pillar cluster | 1-2 | Link to topically adjacent clusters |
| Cross-pillar bridge | 1 | Link to a cluster in a different pillar via entity overlap |
| CTA link | 1 | Final section links to CVScholar signup/feature page |

**Minimum total internal links per article: 4**
**Maximum recommended: 8** (avoid over-linking)

---

## 3. Cross-Pillar Bridge Rules

Bridge links connect articles across pillars based on **shared entity attributes**. Select bridges using this mapping:

| Article Topic | Bridge To Pillar | Shared Entity Attribute |
|--------------|-----------------|----------------------|
| Publications listing (P2-01) | P7 (Publications) | Sections.Publications |
| Grants section (P2-05) | P8 (Grants) | Sections.Grants |
| PhD student CV (P3-01) | P1 (Writing) | Career Stage + Structure |
| STEM CV (P4-01) | P7 (Publications) | Field Conventions + Publications |
| Cover letter (P5-03) | P1 (Writing) | Purpose + Application Package |
| LaTeX templates (P6-02) | P4 (Field-Specific) | Formatting + Field Conventions |
| ORCID (P9-01) | P7 (Publications) | Digital Identity + DOI |
| UK CV (P10-01) | P4 (Field-Specific) | Regional Norms + Field Conventions |
| DOI autofill (P7-24) | P9 (Digital Presence) | DOI + Digital Tools |
| Fellowship CV (P5-09) | P8 (Grants & Awards) | Purpose + Funding |
| Formatting (P6-*) | P10 (International) | Formatting + Country Standards |
| Career transition (P3-14/15) | P5 (Job Market) | Career Stage + Application |

---

## 4. Pillar Hub Content Requirements

Each pillar hub (P*-00) must:

1. **Link to every cluster** in its pillar (24 links, organized by subtopic)
2. **Link to 3 other pillar hubs** (per bridge map above)
3. **Provide a mini-TOC** with anchor links to each cluster's summary paragraph
4. **Be updated weekly** as new clusters publish — add each new cluster link
5. **Target 3,000–4,000 words** as the authoritative overview

---

## 5. Anchor Text Guidelines

### Do:
- Use the target article's primary entity phrase: *"how to list publications on an academic CV"*
- Include entity + attribute: *"formatting your academic CV in LaTeX"*
- Use question-form anchors matching H1: *"what is a DOI"*
- Vary slightly across linking pages

### Don't:
- ❌ Generic: "click here", "read more", "learn more", "this article"
- ❌ Exact-match spam: identical anchor text on every linking page
- ❌ URL as anchor: "https://cvscholar.com/blog/..."
- ❌ Over-optimized: keyword-stuffed anchors

---

## 6. Link Placement Patterns

| Position | Link Type | Purpose |
|----------|-----------|---------|
| Paragraph 1-2 | Pillar hub link | Establish topical hierarchy |
| Body sections | Same-pillar clusters | Deepen subtopic coverage |
| Comparison/context sections | Cross-pillar bridges | Build semantic bridges |
| Final section | CTA link | Conversion |
| Tables / lists | Contextual links | Support specific claims |

---

## 7. Category & Tag Internal Links

### Category Pages
Each category page auto-aggregates articles from its pillar(s):

| Category | Pillar(s) | Auto-linked Articles |
|----------|-----------|---------------------|
| CV Writing Guide | P1 | 25 articles |
| CV Sections | P2 | 25 articles |
| Career Stage Guide | P3 | 25 articles |
| Field-Specific | P4 | 25 articles |
| Job Market | P5 | 25 articles |
| CV Formatting | P6 | 25 articles |
| Publications | P7 | 25 articles |
| Grants & Awards | P8 | 25 articles |
| Digital Presence | P9 | 25 articles |
| International CVs | P10 | 25 articles |

### Tag Pages
Tags create cross-pillar discovery paths. High-value tags:
- `academic cv` — links across all pillars
- `publications` — P2, P7, P9
- `tenure` — P3, P5, P8
- `LaTeX` — P6, P7
- `ORCID` — P7, P9
- `grants` — P2, P5, P8

---

## 8. Link Audit Checklist (Per Article)

Before publishing, verify:

- [ ] Link to own pillar hub within first 200 words
- [ ] 1-2 links to same-pillar clusters
- [ ] 1 cross-pillar bridge link with entity-overlap justification
- [ ] CTA link in final section
- [ ] No generic anchor text
- [ ] No broken links
- [ ] Total internal links: 4-8
- [ ] Pillar hub updated with new cluster link

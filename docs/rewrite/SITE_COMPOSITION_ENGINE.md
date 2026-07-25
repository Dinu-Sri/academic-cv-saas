# Site Composition Engine

Solid, agent-style pipeline: **CV content → plan → frozen IR → theme renderer**.

## Decisions (product)

| # | Decision |
|---|----------|
| 1 | Default theme: **`paper-academic-v1`**. Architecture supports many themes later. |
| 2 | Users may **hide** compositions (`enabledPages`) even if content qualifies. |
| 3 | **Draft** = live recompose. **Published** = frozen IR snapshot. |
| 4 | Tests start with **structure/class contracts**; screenshots later. |

## Pipeline

```
entries + profile + website config
        │
        ▼
 1. Normalize     clean blanks, section visibility, field visibility
        ▼
 2. Inventory     counts / recency per section
        ▼
 3. Compose IA    composition-engine (qualify / merge / nav)
        ▼
 4. Select blocks metrics, highlights, hero mode, home modules
        ▼
 5. Site IR       versioned JSON (routes → blocks)
        ▼
 6. Theme pack    paper-academic-v1 (css + block components)
        ▼
 7. Renderer      pure IR + themeId → DOM
        ▼
 8. Publish       freeze model + siteIr + themeId + policyVersion
```

## IR version

- `irVersion`: `1`
- `policyVersion`: `1`
- `themeId`: `paper-academic-v1` (or future themes)

## Block types (closed set v1)

`site_chrome`, `identity_hero`, `details_panel`, `metric_band`, `highlight_list`, `section_module`, `contact_page`, `legal_page`, `sparse_contact_cta`

## Hide composition

`enabledPages.research|journey|contributions === false` → category not in nav; modules may still merge to home per composition-engine rules.

## Files

| Path | Role |
|------|------|
| `lib/website/site-engine/*` | Pipeline + IR |
| `lib/website/themes/paper-academic-v1/*` | Theme metadata |
| `styles/scholar-static.css` | Theme CSS (v1 paper) |
| `components/website/site-ir-renderer.tsx` | Thin IR renderer |
| `tests/site-ir-contract.test.ts` | Structure contracts |

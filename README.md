# CVScholar - Academic CV Builder

Professional academic CV builder with PDF generation, ORCID/Google Scholar integration, and Google OAuth.

## Features
- 3 professionally designed CV templates (Classic, Modern, Detailed)
- LaTeX PDF generation with xelatex
- ORCID import (education, employment, publications)
- Google Scholar publication import
- OpenAI full-page CV PDF import with canonical academic section mapping
- Google OAuth sign-in with account linking
- Real-time CV editor with section management

## Tech Stack
- **Backend**: PHP 8.2 (vanilla MVC, no framework)
- **Database**: MySQL 8.0
- **PDF**: LaTeX-only renderer via xelatex (`LatexRenderer`)
- **Frontend**: Bootstrap 5.3.3, vanilla JavaScript
- **Deployment**: Docker (PHP Apache) via Portainer


## AI CV PDF Import

The CV import page turns an existing CV PDF into a reviewable CV draft by rendering PDF pages and sending them to OpenAI for full-page visual extraction. The mapper uses the active template section schemas so advanced academic sections such as patents, grants, invited talks, supervision, academic service, and editorial work are preserved even when the current template cannot display them yet.

Recommended production environment variables:

```bash
AI_CV_IMPORT_USE_OPENAI=true
AI_CV_IMPORT_REQUIRE_OPENAI_MAPPING=true
AI_CV_IMPORT_MAX_UPLOAD_MB=8
AI_CV_IMPORT_OPENAI_FULL_PAGE_LIMIT=10
OPENAI_API_KEY=sk-...
OPENAI_CV_IMPORT_VISION_MODEL=gpt-5.4-mini
```

PDF import requires `pdftoppm` from `poppler-utils` so the app can render pages for OpenAI image input. There is no Docling sidecar and no local semantic extraction fallback in the production PDF path.

New users with no CVs see a first-CV onboarding choice that links to either CV PDF import or manual CV creation. Existing users can open the same feature any time from **Import CV / Publications** in the header.

## Local Development (XAMPP)

1. Clone and place in XAMPP htdocs:
```
git clone https://github.com/Dinu-Sri/academic-cv-saas.git
```

2. Create MySQL database `academic_cv`

3. Import schema or let migrations handle it:
```
php migrations/migrate.php
```

4. Visit `http://localhost/academic-cv-saas/public`

## Docker Deployment

```bash
docker compose up -d --build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for Portainer deployment instructions.

## Project Structure
```
app/
  controllers/    # AuthController, CVController, DashboardController, TemplateController
  models/         # User, CVProfile, Template
  services/       # RendererFactory, LatexRenderer, GoogleAuthService, ProfileImportService
  lib/            # Legacy PDF/font assets
  config.php      # Configuration
  helpers.php     # Utility functions
  Auth.php        # Session authentication
  Database.php    # PDO singleton
  Router.php      # URL routing
public/           # Entry point + assets (CSS, JS, images)
templates/        # PHP view templates
migrations/       # SQL migration files + runner
storage/          # Generated PDFs, logs, uploads
```

## License
All rights reserved.

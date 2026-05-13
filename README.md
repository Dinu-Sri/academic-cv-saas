# CVScholar - Academic CV Builder

Professional academic CV builder with PDF generation, ORCID/Google Scholar integration, and Google OAuth.

## Features
- 3 professionally designed CV templates (Classic, Modern, Detailed)
- LaTeX PDF generation with xelatex
- ORCID import (education, employment, publications)
- Google Scholar publication import
- Low-cost AI-assisted CV PDF import (local PDF text extraction + optional OpenAI structuring)
- Google OAuth sign-in with account linking
- Real-time CV editor with section management

## Tech Stack
- **Backend**: PHP 8.2 (vanilla MVC, no framework)
- **Database**: MySQL 8.0
- **PDF**: LaTeX-only renderer via xelatex (`LatexRenderer`)
- **Frontend**: Bootstrap 5.3.3, vanilla JavaScript
- **Deployment**: Docker (PHP Apache) via Portainer


## AI CV PDF Import

The CV import page can turn an existing text-based CV PDF into a reviewable CV draft. To keep API cost low, the Docker image includes `pdftotext` from `poppler-utils` and extracts PDF text locally first. OpenAI refinement is disabled by default; enable it only when you want better section mapping.

Recommended production environment variables:

```bash
AI_CV_IMPORT_USE_OPENAI=false        # keep false for zero API cost local extraction
AI_CV_IMPORT_TEXT_CHAR_LIMIT=24000   # cap text sent to the API when enabled
AI_CV_IMPORT_MAX_UPLOAD_MB=8
OPENAI_API_KEY=sk-...                # only needed when AI_CV_IMPORT_USE_OPENAI=true
OPENAI_CV_IMPORT_MODEL=gpt-4.1-nano  # low-cost default for structuring extracted text
```

For lowest cost, keep `AI_CV_IMPORT_USE_OPENAI=false` and rely on local extraction plus user review. For better mapping, set `AI_CV_IMPORT_USE_OPENAI=true`; the app sends capped plain text, not PDF images, to reduce token usage.

When deploying with Portainer, rebuild/redeploy the app image after pulling this code so the container installs `poppler-utils`. If you only restart an old image, `pdftotext` will not be available and PDF import will fail until the image is rebuilt.

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

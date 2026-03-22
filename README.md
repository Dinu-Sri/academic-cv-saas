# CVScholar - Academic CV Builder

Professional academic CV builder with PDF generation, ORCID/Google Scholar integration, and Google OAuth.

## Features
- 3 professionally designed CV templates (Classic, Modern, Detailed)
- PDF generation with Computer Modern fonts (classical LaTeX look)
- ORCID import (education, employment, publications)
- Google Scholar publication import
- Google OAuth sign-in with account linking
- Real-time CV editor with section management

## Tech Stack
- **Backend**: PHP 8.2 (vanilla MVC, no framework)
- **Database**: MySQL 8.0
- **PDF**: FPDF with Computer Modern Unicode fonts
- **Frontend**: Bootstrap 5.3.3, vanilla JavaScript
- **Deployment**: Docker (PHP Apache) via Portainer

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
  services/       # LatexService (FPDF), GoogleAuthService, ProfileImportService
  lib/            # FPDF library + Computer Modern fonts
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

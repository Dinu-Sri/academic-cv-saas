# Development Guide for Claude Opus

This guide is specifically designed for you (Claude Opus 4.6) to continue building the Academic CV SaaS system. It provides clear instructions on implementing each phase.

## Project Structure Overview

```
academic-cv-saas/
├── app/
│   ├── __init__.py              ✅ Created
│   ├── app.py                   ✅ Created (basic)
│   ├── config.py                ✅ Created
│   ├── database.py              ✅ Created
│   ├── models/
│   │   └── __init__.py          ✅ Created (all models)
│   ├── pages/                   ⚠️  TO BUILD
│   │   ├── __init__.py
│   │   ├── auth.py              📝 Phase 1
│   │   ├── dashboard.py         📝 Phase 1
│   │   ├── editor.py            📝 Phase 1
│   │   ├── templates.py         📝 Phase 1
│   │   └── settings.py          📝 Phase 2
│   ├── components/              ⚠️  TO BUILD
│   │   ├── __init__.py
│   │   ├── cv_preview.py        📝 Phase 1
│   │   ├── form_elements.py     📝 Phase 1
│   │   ├── navigation.py        📝 Phase 1
│   │   └── template_blocks.py   📝 Phase 1
│   ├── services/                ⚠️  TO BUILD
│   │   ├── __init__.py
│   │   ├── auth_service.py      📝 Phase 1
│   │   ├── cv_service.py        📝 Phase 1
│   │   ├── latex_service.py     📝 Phase 1
│   │   ├── scholar_api.py       📝 Phase 2
│   │   ├── orcid_api.py         📝 Phase 2
│   │   ├── pdf_parser.py        📝 Phase 2
│   │   ├── ai_service.py        📝 Phase 3
│   │   └── payment_service.py   📝 Phase 3
│   ├── state/                   ⚠️  TO BUILD
│   │   ├── __init__.py
│   │   ├── auth_state.py        📝 Phase 1
│   │   ├── cv_state.py          📝 Phase 1
│   │   └── editor_state.py      📝 Phase 1
│   ├── tasks/
│   │   ├── __init__.py          ✅ Created
│   │   ├── latex_tasks.py       ✅ Created
│   │   ├── sync_tasks.py        📝 Phase 2
│   │   └── email_tasks.py       📝 Phase 3
│   ├── api/                     ⚠️  TO BUILD
│   │   ├── __init__.py
│   │   └── endpoints.py         📝 Phase 1
│   └── templates_latex/         ⚠️  TO BUILD
│       ├── classic.tex          📝 Phase 1
│       ├── modern.tex           📝 Phase 1
│       └── detailed.tex         📝 Phase 1
├── alembic/                     ✅ Created
├── tests/                       ⚠️  TO BUILD
├── scripts/                     ✅ Created
├── docker/                      ✅ Created
├── docs/                        ⚠️  TO BUILD
└── .github/workflows/           ⚠️  TO BUILD
```

---

## Phase 1 Implementation Guide (Weeks 1-4)

### Week 1: Authentication & Basic UI

#### Day 1-2: Authentication System

**File: `app/services/auth_service.py`**

```python
"""Authentication service"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.models import User
from app.database import get_db
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)
    
    @staticmethod
    def create_access_token(data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    @staticmethod
    def authenticate_user(email: str, password: str):
        db = next(get_db())
        user = db.query(User).filter(User.email == email).first()
        if not user or not AuthService.verify_password(password, user.hashed_password):
            return None
        return user
```

**File: `app/state/auth_state.py`**

```python
"""Authentication state management"""
import reflex as rx
from app.services.auth_service import AuthService

class AuthState(rx.State):
    email: str = ""
    password: str = ""
    full_name: str = ""
    error_message: str = ""
    is_authenticated: bool = False
    current_user: dict = {}
    
    def login(self):
        """Handle login"""
        user = AuthService.authenticate_user(self.email, self.password)
        if user:
            self.is_authenticated = True
            self.current_user = {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name
            }
            return rx.redirect("/dashboard")
        else:
            self.error_message = "Invalid credentials"
    
    def register(self):
        """Handle registration"""
        # TODO: Implement registration logic
        pass
    
    def logout(self):
        """Handle logout"""
        self.is_authenticated = False
        self.current_user = {}
        return rx.redirect("/")
```

**File: `app/pages/auth.py`**

```python
"""Authentication pages"""
import reflex as rx
from app.state.auth_state import AuthState

def login() -> rx.Component:
    return rx.container(
        rx.card(
            rx.vstack(
                rx.heading("Login", size="8"),
                rx.input(
                    placeholder="Email",
                    on_blur=AuthState.set_email,
                    size="3"
                ),
                rx.input(
                    type="password",
                    placeholder="Password",
                    on_blur=AuthState.set_password,
                    size="3"
                ),
                rx.cond(
                    AuthState.error_message != "",
                    rx.text(AuthState.error_message, color="red"),
                ),
                rx.button(
                    "Login",
                    on_click=AuthState.login,
                    size="3",
                    width="100%"
                ),
                rx.link("Don't have an account? Sign up", href="/signup"),
                spacing="4",
                width="100%"
            ),
            width="400px"
        ),
        display="flex",
        justify_content="center",
        align_items="center",
        min_height="100vh"
    )

def signup() -> rx.Component:
    # Similar to login, with additional fields
    pass
```

#### Day 3-4: Dashboard & Navigation

**File: `app/components/navigation.py`**

```python
"""Navigation component"""
import reflex as rx
from app.state.auth_state import AuthState

def navbar() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.heading("Academic CV", size="6"),
            rx.spacer(),
            rx.hstack(
                rx.link("Dashboard", href="/dashboard"),
                rx.link("Templates", href="/templates"),
                rx.link("Settings", href="/settings"),
                rx.button("Logout", on_click=AuthState.logout, variant="ghost"),
                spacing="4"
            ),
            width="100%",
            padding="1rem"
        ),
        background_color="var(--gray-2)",
        position="sticky",
        top="0",
        z_index="1000"
    )
```

**File: `app/pages/dashboard.py`**

```python
"""Dashboard page"""
import reflex as rx
from app.components.navigation import navbar
from app.state.auth_state import AuthState

def dashboard() -> rx.Component:
    return rx.box(
        navbar(),
        rx.container(
            rx.vstack(
                rx.heading(f"Welcome, {AuthState.current_user['full_name']}", size="8"),
                rx.text("Your CVs", size="6", weight="bold"),
                # TODO: List user's CVs
                rx.button(
                    "Create New CV",
                    on_click=lambda: rx.redirect("/editor"),
                    size="3"
                ),
                spacing="6",
                padding="2rem"
            )
        )
    )
```

### Week 2: CV Editor Core

**Key Files to Build:**

1. `app/state/editor_state.py` - Manage CV data editing
2. `app/pages/editor.py` - CV editor UI
3. `app/components/form_elements.py` - Reusable form inputs
4. `app/services/cv_service.py` - CV CRUD operations

**Implementation Priority:**
1. Create editor state with CV data structure
2. Build form components for each CV section
3. Implement save/load CV functionality
4. Add section reordering

### Week 3: LaTeX Generation & Preview

**Key Files to Build:**

1. `app/services/latex_service.py` - LaTeX generation logic
2. `app/components/cv_preview.py` - Preview component
3. `app/templates_latex/*.tex` - LaTeX templates

**Implementation Steps:**
1. Create LaTeX service to convert CV data to LaTeX
2. Integrate with Celery task for compilation
3. Build preview component with WebSocket updates
4. Add PDF download functionality

### Week 4: Templates & PDF Export

**Key Files to Build:**

1. `app/pages/templates.py` - Template gallery
2. Complete all three LaTeX templates
3. Template switching logic

**Testing Checklist:**
- [ ] User can register and login
- [ ] User can create a CV
- [ ] User can fill in all sections
- [ ] LaTeX compilation works
- [ ] PDF downloads correctly
- [ ] Template switching works

---

## Phase 2 Implementation Guide (Weeks 5-8)

### Week 5: Google Scholar Integration

**File: `app/services/scholar_api.py`**

```python
"""Google Scholar API integration"""
from scholarly import scholarly
from typing import List, Dict

class ScholarService:
    @staticmethod
    def search_author(author_name: str):
        """Search for author by name"""
        search_query = scholarly.search_author(author_name)
        return next(search_query, None)
    
    @staticmethod
    def get_author_publications(scholar_id: str) -> List[Dict]:
        """Get all publications for an author"""
        author = scholarly.search_author_id(scholar_id)
        author = scholarly.fill(author)
        
        publications = []
        for pub in author['publications']:
            pub_detail = scholarly.fill(pub)
            publications.append({
                'title': pub_detail['bib']['title'],
                'authors': pub_detail['bib']['author'],
                'year': pub_detail['bib'].get('pub_year'),
                'venue': pub_detail['bib'].get('venue'),
                'citations': pub_detail.get('num_citations', 0)
            })
        
        return publications
```

**File: `app/tasks/sync_tasks.py`**

```python
"""Synchronization tasks for external APIs"""
from app.tasks import celery_app
from app.services.scholar_api import ScholarService
from app.services.orcid_api import ORCIDService
from app.models import Publication, User
from app.database import SessionLocal

@celery_app.task(name="app.tasks.sync_tasks.sync_google_scholar")
def sync_google_scholar(user_id: int, scholar_id: str):
    """Sync publications from Google Scholar"""
    db = SessionLocal()
    try:
        publications = ScholarService.get_author_publications(scholar_id)
        
        for pub_data in publications:
            # Check if publication already exists
            existing = db.query(Publication).filter(
                Publication.user_id == user_id,
                Publication.title == pub_data['title']
            ).first()
            
            if not existing:
                publication = Publication(
                    user_id=user_id,
                    title=pub_data['title'],
                    authors=pub_data['authors'],
                    year=pub_data['year'],
                    venue=pub_data['venue'],
                    citation_count=pub_data['citations'],
                    source='google_scholar'
                )
                db.add(publication)
        
        db.commit()
        return {'success': True, 'count': len(publications)}
    
    except Exception as e:
        db.rollback()
        return {'success': False, 'error': str(e)}
    finally:
        db.close()
```

### Week 6: ORCID Integration

**Similar structure to Google Scholar, implement:**
1. ORCID OAuth flow
2. Publication sync
3. Work history sync

### Week 7: PDF Upload & Parsing

**File: `app/services/pdf_parser.py`**

```python
"""PDF parsing service"""
import pdfplumber
from typing import Dict
from openai import OpenAI

class PDFParser:
    def __init__(self):
        self.client = OpenAI()
    
    def extract_text(self, pdf_path: str) -> str:
        """Extract text from PDF"""
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text()
        return text
    
    def parse_cv(self, pdf_path: str) -> Dict:
        """Parse CV and extract structured data"""
        text = self.extract_text(pdf_path)
        
        # Use OpenAI to structure the data
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Extract CV information as JSON"},
                {"role": "user", "content": f"Extract: {text}"}
            ]
        )
        
        # Parse response and return structured data
        return {}
```

### Week 8: Template Customization

**Implement:**
1. Color scheme selector
2. Font selection
3. Section reordering
4. Template migration without data loss

---

## Phase 3 Implementation Guide (Weeks 9-12)

### Week 9: AI Chat Assistant

**File: `app/services/ai_service.py`**

```python
"""AI service for CV assistance"""
from openai import OpenAI
from app.config import settings

class AIService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def chat(self, messages: list, cv_context: dict = None):
        """Chat with AI assistant"""
        system_message = {
            "role": "system",
            "content": "You are a helpful CV writing assistant..."
        }
        
        if cv_context:
            system_message["content"] += f"\n\nCurrent CV: {cv_context}"
        
        response = self.client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[system_message] + messages
        )
        
        return response.choices[0].message.content
```

### Week 10: Payment Integration

**File: `app/services/payment_service.py`**

```python
"""Payment service"""
import requests
from app.config import settings

class PayHereService:
    @staticmethod
    def create_payment(user_id: int, plan: str, amount: float):
        """Create PayHere payment"""
        # TODO: Implement PayHere integration
        pass

class PayPalService:
    @staticmethod
    def create_payment(user_id: int, plan: str, amount: float):
        """Create PayPal payment"""
        # TODO: Implement PayPal integration
        pass
```

### Week 11: Premium Features & Admin Dashboard

**Implement:**
1. Subscription management
2. Admin panel
3. User management
4. Analytics

### Week 12: Email & Final Polish

**File: `app/tasks/email_tasks.py`**

```python
"""Email tasks"""
from app.tasks import celery_app
import smtplib
from email.mime.text import MIMEText

@celery_app.task(name="app.tasks.email_tasks.send_cv_update_reminders")
def send_cv_update_reminders():
    """Send CV update reminders"""
    # TODO: Implement email sending
    pass
```

---

## Testing Strategy

### Unit Tests

Create files in `tests/`:
- `test_auth.py`
- `test_cv_service.py`
- `test_latex_compilation.py`
- `test_scholar_sync.py`

### Integration Tests

Test full workflows:
1. User registration → CV creation → PDF export
2. Google Scholar sync → CV update
3. Payment → Subscription activation

---

## Deployment Checklist

### Before Each Phase Deployment:

- [ ] All tests passing
- [ ] Database migrations created
- [ ] Environment variables updated
- [ ] Documentation updated
- [ ] Backup created
- [ ] Deployment tested on staging

---

## Commands Reference

### Development

```bash
# Start development server
reflex run

# Create database migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Start Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# Run tests
pytest
```

### Deployment

```bash
# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Run migrations in production
docker exec -it academic-cv-saas-app-prod-1 alembic upgrade head
```

---

## Next Steps for Claude Opus

1. **Start with Phase 1, Week 1** - Build authentication system
2. **Follow the structure** - Use existing config and models
3. **Test incrementally** - Ensure each component works before moving on
4. **Commit frequently** - Push to GitHub after each feature
5. **Document changes** - Update README with implementation notes

The foundation is laid out. Now build upon it systematically, phase by phase.

Good luck! 🚀

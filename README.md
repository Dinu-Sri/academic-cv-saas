# Academic CV SaaS Platform

A comprehensive SaaS platform for creating, managing, and maintaining academic CVs using LaTeX with real-time preview, Google Scholar/ORCID integration, and AI-powered features.

## 🎯 Project Overview

### Core Features
- **LaTeX-based CV generation** with beautiful typesetting
- **Real-time preview** with WebSocket updates
- **Template system** (object-oriented: Templates → Blocks → Elements)
- **Google Scholar & ORCID integration** for automatic publication updates
- **PDF/Word upload** with AI-powered data extraction
- **AI chat assistant** for CV creation
- **Multi-currency payment** (PayHere for local, PayPal for international)
- **Template switching** without data loss

### Technology Stack
- **Framework**: Reflex (Python full-stack)
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + Celery
- **LaTeX Engine**: TexLive
- **Containerization**: Docker + Docker Compose
- **Deployment**: VPS with Portainer
- **Authentication**: JWT + OAuth2

## 📋 3-Phase Development Plan

### **PHASE 1: MVP - Core CV Builder (Weeks 1-4)**

**Goal**: Basic functional CV builder with LaTeX generation

**Features**:
- ✅ User authentication (register, login, logout)
- ✅ Basic profile management
- ✅ 3 pre-built templates (Classic, Modern, Academic)
- ✅ Core CV sections:
  - Personal Information
  - Education
  - Work Experience
  - Publications (manual entry)
  - Skills
- ✅ Real-time LaTeX preview
- ✅ PDF export
- ✅ Basic responsive UI

**Deliverables**:
- Working authentication system
- Database schema with basic models
- LaTeX compilation service
- 3 functional templates
- PDF generation

**Success Criteria**:
- User can create account
- User can fill CV data
- User can preview and download PDF
- System handles 50 concurrent users

---

### **PHASE 2: Integration & Automation (Weeks 5-8)**

**Goal**: Add automatic data sync and advanced features

**Features**:
- ✅ Google Scholar integration
  - Connect account
  - Automatic publication import
  - Scheduled updates (weekly)
- ✅ ORCID integration
  - OAuth connection
  - Work history sync
  - Publication metadata
- ✅ PDF/Word upload & parsing
  - AI-powered text extraction
  - Smart field mapping
  - Manual correction interface
- ✅ Template switching
  - Data persistence
  - Preview comparison
- ✅ Advanced template customization
  - Color schemes
  - Font selection
  - Section reordering
- ✅ Background job processing (Celery)

**Deliverables**:
- Google Scholar API integration
- ORCID OAuth flow
- Document parsing service
- Template migration system
- Celery task queue

**Success Criteria**:
- Automatic publication sync works
- PDF upload extracts 80%+ accuracy
- Template switching preserves all data
- Background jobs process within 30 seconds

---

### **PHASE 3: AI & Monetization (Weeks 9-12)**

**Goal**: Launch with payment system and AI features

**Features**:
- ✅ AI Chat Assistant
  - Conversational CV building
  - Content suggestions
  - Grammar improvements
  - Achievement rewording
- ✅ Payment Integration
  - PayHere (Sri Lankan users)
  - PayPal (International users)
  - Subscription plans (Free, Pro, Enterprise)
- ✅ Premium Features
  - Unlimited templates
  - Advanced customization
  - Priority compilation
  - Export to multiple formats
  - Analytics dashboard
- ✅ Admin Dashboard
  - User management
  - Template management
  - Usage analytics
  - Revenue tracking
- ✅ Email notifications
  - Publication updates
  - Subscription reminders
  - CV update suggestions
- ✅ Performance optimization
  - Caching layer
  - CDN for assets
  - Database indexing

**Deliverables**:
- AI chat interface
- Payment gateway integration
- Subscription management
- Admin panel
- Email service
- Production-ready deployment

**Success Criteria**:
- AI generates quality content
- Payment processing <3 seconds
- 99.5% uptime
- Handle 1000+ concurrent users
- Revenue generation starts

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- Node.js 18+ (for Reflex)
- PostgreSQL 15+
- Redis 7+

### Local Development Setup

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/academic-cv-saas.git
cd academic-cv-saas
```

2. **Create virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Setup environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Initialize database**:
```bash
alembic upgrade head
```

6. **Run development server**:
```bash
reflex run
```

Visit `http://localhost:3000`

### Docker Development

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## 🐳 Deployment

### VPS Deployment with Portainer

#### 1. **Prepare VPS**
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Portainer
docker volume create portainer_data
docker run -d -p 8000:8000 -p 9443:9443 \
  --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Access Portainer: `https://your-vps-ip:9443`

#### 2. **Setup Domain & SSL**

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Point your domain to VPS IP (in your DNS provider)
# A Record: yourdomain.com -> VPS_IP
# A Record: www.yourdomain.com -> VPS_IP

# Get SSL certificate (will be automated in nginx container)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

#### 3. **Deploy via Portainer**

1. Access Portainer web UI
2. Go to **Stacks** → **Add Stack**
3. Name: `academic-cv-saas`
4. Choose **Git Repository**:
   - Repository URL: `https://github.com/yourusername/academic-cv-saas`
   - Reference: `main`
   - Compose path: `docker-compose.prod.yml`
5. Add **Environment Variables**:
   ```
   DOMAIN=yourdomain.com
   POSTGRES_PASSWORD=your_secure_password
   SECRET_KEY=your_secret_key_here
   OPENAI_API_KEY=your_openai_key
   ```
6. Click **Deploy the stack**

#### 4. **Initial Setup**

```bash
# Create admin user
docker exec -it academic-cv-saas-app-1 python scripts/create_admin.py

# Load initial templates
docker exec -it academic-cv-saas-app-1 python scripts/load_templates.py
```

#### 5. **Monitoring**

- **Portainer Dashboard**: Monitor container health
- **Application Logs**: 
  ```bash
  docker logs -f academic-cv-saas-app-1
  ```
- **Database Backup**:
  ```bash
  docker exec academic-cv-saas-postgres-1 pg_dump -U cvuser cvdb > backup.sql
  ```

### Alternative: Manual Deployment

```bash
# On your VPS
git clone https://github.com/yourusername/academic-cv-saas.git
cd academic-cv-saas

# Setup environment
cp .env.example .env.production
nano .env.production  # Edit with production values

# Deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps
```

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f app

# Restart a service
docker-compose restart app
```

### Database Backups
```bash
# Automated daily backup (add to cron)
0 2 * * * docker exec academic-cv-saas-postgres-1 pg_dump -U cvuser cvdb | gzip > /backups/cvdb_$(date +\%Y\%m\%d).sql.gz
```

### Performance Monitoring
- CPU/Memory: `docker stats`
- Application metrics: Built-in Reflex metrics at `/metrics`
- Database: pgAdmin container (optional)

## 🧪 Testing

```bash
# Run all tests
pytest

# Run specific test suite
pytest tests/test_auth.py

# Run with coverage
pytest --cov=app tests/

# Integration tests
pytest tests/integration/
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all configuration options:

- **Database**: `DATABASE_URL`
- **Redis**: `REDIS_URL`
- **APIs**: `OPENAI_API_KEY`, `GOOGLE_SCHOLAR_API_KEY`
- **Payment**: `PAYHERE_MERCHANT_ID`, `PAYPAL_CLIENT_ID`
- **Email**: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`

### Feature Flags

Enable/disable features in `app/config.py`:

```python
ENABLE_AI_CHAT = True
ENABLE_PDF_UPLOAD = True
ENABLE_GOOGLE_SCHOLAR = True
ENABLE_ORCID = True
```

## 📁 Project Structure

```
academic-cv-saas/
├── app/                        # Main application
│   ├── __init__.py
│   ├── app.py                 # Reflex app entry point
│   ├── config.py              # Configuration
│   ├── pages/                 # UI pages
│   ├── components/            # Reusable components
│   ├── models/                # Database models
│   ├── services/              # Business logic
│   ├── api/                   # API endpoints
│   ├── state/                 # Reflex state management
│   └── templates_latex/       # LaTeX templates
├── alembic/                   # Database migrations
├── tests/                     # Test suite
├── scripts/                   # Utility scripts
├── docker/                    # Docker configurations
├── docs/                      # Documentation
├── .github/                   # GitHub Actions CI/CD
├── docker-compose.yml         # Development
├── docker-compose.prod.yml    # Production
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
├── .gitignore
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/academic-cv-saas/issues)
- **Email**: support@yourdomain.com

## 🗺️ Roadmap

### Q2 2025
- ✅ Phase 1: MVP Launch
- ✅ Phase 2: Integrations
- ✅ Phase 3: AI & Monetization

### Q3 2025
- Mobile app (React Native)
- API for third-party integrations
- Team collaboration features
- University/Institution plans

### Q4 2025
- Multi-language support
- Advanced analytics
- CV scoring system
- Job board integration

---

**Built with ❤️ for the academic community**

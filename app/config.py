"""Academic CV SaaS - Main Configuration"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Academic CV SaaS"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "your-secret-key-change-in-production"
    DOMAIN: str = "localhost:3000"
    
    # Database
    DATABASE_URL: str = "postgresql://cvuser:cvpassword@localhost:5432/cvdb"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # JWT
    JWT_SECRET_KEY: str = "your-jwt-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000"]
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    GENERATED_CV_DIR: str = "./generated"
    MAX_UPLOAD_SIZE_MB: int = 10
    
    # LaTeX
    LATEX_COMPILER: str = "pdflatex"
    LATEX_COMPILE_TIMEOUT: int = 30
    LATEX_TEMP_DIR: str = "/tmp/latex"
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    OPENAI_MAX_TOKENS: int = 2000
    
    # Google Scholar
    GOOGLE_SCHOLAR_API_KEY: Optional[str] = None
    
    # ORCID
    ORCID_CLIENT_ID: Optional[str] = None
    ORCID_CLIENT_SECRET: Optional[str] = None
    ORCID_REDIRECT_URI: str = "http://localhost:3000/auth/orcid/callback"
    ORCID_API_URL: str = "https://pub.orcid.org/v3.0"
    
    # PayHere
    PAYHERE_MERCHANT_ID: Optional[str] = None
    PAYHERE_MERCHANT_SECRET: Optional[str] = None
    PAYHERE_CURRENCY: str = "LKR"
    PAYHERE_SANDBOX: bool = True
    
    # PayPal
    PAYPAL_CLIENT_ID: Optional[str] = None
    PAYPAL_CLIENT_SECRET: Optional[str] = None
    PAYPAL_MODE: str = "sandbox"
    PAYPAL_CURRENCY: str = "USD"
    
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@yourdomain.com"
    SMTP_FROM_NAME: str = "Academic CV SaaS"
    
    # Sentry
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "development"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Feature Flags
    ENABLE_AI_CHAT: bool = True
    ENABLE_PDF_UPLOAD: bool = True
    ENABLE_GOOGLE_SCHOLAR: bool = True
    ENABLE_ORCID: bool = True
    ENABLE_PAYMENT: bool = False
    ENABLE_EMAIL_NOTIFICATIONS: bool = False
    
    # Subscription Plans
    PLAN_FREE_MAX_CVS: int = 1
    PLAN_FREE_MAX_TEMPLATES: int = 3
    PLAN_PRO_PRICE: float = 9.99
    PLAN_PRO_MAX_CVS: int = 10
    PLAN_ENTERPRISE_PRICE: float = 29.99
    PLAN_ENTERPRISE_MAX_CVS: str = "unlimited"
    
    # Background Jobs
    SCHOLAR_SYNC_INTERVAL_DAYS: int = 7
    ORCID_SYNC_INTERVAL_DAYS: int = 7
    CV_REMINDER_INTERVAL_MONTHS: int = 3
    
    # Security
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()


# Create necessary directories
def init_directories():
    """Initialize required directories"""
    directories = [
        settings.UPLOAD_DIR,
        settings.GENERATED_CV_DIR,
        settings.LATEX_TEMP_DIR,
        "logs",
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)


# Phase configurations
PHASE_1_FEATURES = {
    "auth": True,
    "basic_profile": True,
    "templates": ["classic", "modern", "academic"],
    "sections": ["personal", "education", "experience", "publications", "skills"],
    "pdf_export": True,
}

PHASE_2_FEATURES = {
    **PHASE_1_FEATURES,
    "google_scholar": True,
    "orcid": True,
    "pdf_upload": True,
    "template_switching": True,
    "customization": True,
}

PHASE_3_FEATURES = {
    **PHASE_2_FEATURES,
    "ai_chat": True,
    "payments": True,
    "premium_features": True,
    "admin_dashboard": True,
    "email_notifications": True,
}


def get_current_phase_features():
    """Get features available in current phase"""
    # This can be controlled by environment variable
    phase = os.getenv("DEVELOPMENT_PHASE", "1")
    
    if phase == "1":
        return PHASE_1_FEATURES
    elif phase == "2":
        return PHASE_2_FEATURES
    elif phase == "3":
        return PHASE_3_FEATURES
    else:
        return PHASE_1_FEATURES


# Initialize on import
init_directories()

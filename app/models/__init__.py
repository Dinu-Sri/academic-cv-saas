"""Database models base configuration"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, DateTime, Integer, String, Boolean, Text, ForeignKey, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)


class User(Base, TimestampMixin):
    """User model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    # Subscription
    subscription_plan = Column(String(50), default="free")  # free, pro, enterprise
    subscription_expires_at = Column(DateTime, nullable=True)
    
    # External integrations
    google_scholar_id = Column(String(255), nullable=True)
    orcid_id = Column(String(255), nullable=True)
    
    # Relationships
    profiles = relationship("CVProfile", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")


class CVProfile(Base, TimestampMixin):
    """CV Profile model - stores all CV data"""
    __tablename__ = "cv_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    is_default = Column(Boolean, default=False)
    
    # Personal Information (JSON for flexibility)
    personal_info = Column(JSON, default={})
    
    # Relationships
    user = relationship("User", back_populates="profiles")
    template = relationship("Template")
    sections = relationship("CVSection", back_populates="profile", cascade="all, delete-orphan")


class Template(Base, TimestampMixin):
    """CV Template model"""
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    preview_image_url = Column(String(500))
    latex_template = Column(Text, nullable=False)
    is_premium = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Style configuration (JSON)
    style_config = Column(JSON, default={})
    
    # Relationships
    blocks = relationship("TemplateBlock", back_populates="template", cascade="all, delete-orphan")


class TemplateBlock(Base):
    """Template Block model - defines sections in a template"""
    __tablename__ = "template_blocks"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "education", "experience"
    display_name = Column(String(100), nullable=False)
    order = Column(Integer, default=0)
    is_required = Column(Boolean, default=False)
    
    # LaTeX code for this block
    latex_code = Column(Text)
    
    # Relationships
    template = relationship("Template", back_populates="blocks")
    elements = relationship("BlockElement", back_populates="block", cascade="all, delete-orphan")


class BlockElement(Base):
    """Block Element model - defines fields in a block"""
    __tablename__ = "block_elements"
    
    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("template_blocks.id"), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(100), nullable=False)
    field_type = Column(String(50), nullable=False)  # text, textarea, date, list, etc.
    is_required = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    
    # Validation rules (JSON)
    validation_rules = Column(JSON, default={})
    
    # Relationships
    block = relationship("TemplateBlock", back_populates="elements")


class CVSection(Base, TimestampMixin):
    """CV Section model - stores data for each section"""
    __tablename__ = "cv_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("cv_profiles.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("template_blocks.id"), nullable=False)
    order = Column(Integer, default=0)
    
    # Section data (JSON for flexibility)
    data = Column(JSON, default={})
    
    # Relationships
    profile = relationship("CVProfile", back_populates="sections")
    block = relationship("TemplateBlock")


class Publication(Base, TimestampMixin):
    """Publication model - stores publications from Scholar/ORCID"""
    __tablename__ = "publications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Publication details
    title = Column(String(500), nullable=False)
    authors = Column(Text)
    year = Column(Integer)
    venue = Column(String(500))
    doi = Column(String(255))
    url = Column(String(500))
    citation_count = Column(Integer, default=0)
    
    # Source
    source = Column(String(50))  # google_scholar, orcid, manual
    external_id = Column(String(255))  # ID from external source
    
    # Status
    is_verified = Column(Boolean, default=False)
    is_included = Column(Boolean, default=True)  # Include in CV
    
    # Relationships
    user = relationship("User")


class Payment(Base, TimestampMixin):
    """Payment model - stores payment transactions"""
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Payment details
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False)
    payment_method = Column(String(50), nullable=False)  # payhere, paypal, stripe
    transaction_id = Column(String(255), unique=True)
    status = Column(String(50), nullable=False)  # pending, completed, failed, refunded
    
    # Subscription
    subscription_plan = Column(String(50))
    subscription_months = Column(Integer, default=1)
    
    # Payment gateway response (JSON)
    gateway_response = Column(JSON, default={})
    
    # Relationships
    user = relationship("User", back_populates="payments")


class SyncLog(Base, TimestampMixin):
    """Sync Log model - tracks external API syncs"""
    __tablename__ = "sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Sync details
    source = Column(String(50), nullable=False)  # google_scholar, orcid
    status = Column(String(50), nullable=False)  # success, failed
    items_synced = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User")

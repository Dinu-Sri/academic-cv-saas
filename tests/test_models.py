"""Test database models"""
import pytest
from app.models import User, CVProfile, Template, Publication


@pytest.mark.unit
@pytest.mark.phase1
def test_create_user(db_session, sample_user_data):
    """Test creating a user"""
    user = User(
        email=sample_user_data["email"],
        username=sample_user_data["username"],
        hashed_password="hashed_password_here",
        full_name=sample_user_data["full_name"],
    )
    
    db_session.add(user)
    db_session.commit()
    
    assert user.id is not None
    assert user.email == sample_user_data["email"]
    assert user.is_active is True
    assert user.subscription_plan == "free"


@pytest.mark.unit
@pytest.mark.phase1
def test_user_relationships(db_session, sample_user_data):
    """Test user relationships"""
    # Create user
    user = User(
        email=sample_user_data["email"],
        username=sample_user_data["username"],
        hashed_password="hashed_password_here",
        full_name=sample_user_data["full_name"],
    )
    db_session.add(user)
    db_session.commit()
    
    # Create template
    template = Template(
        name="Test Template",
        description="Test template description",
        latex_template="\\documentclass{article}\\begin{document}Test\\end{document}",
        is_premium=False,
    )
    db_session.add(template)
    db_session.commit()
    
    # Create CV profile
    cv = CVProfile(
        user_id=user.id,
        name="My CV",
        template_id=template.id,
        personal_info={"name": "Test User"},
    )
    db_session.add(cv)
    db_session.commit()
    
    # Test relationships
    assert len(user.profiles) == 1
    assert user.profiles[0].name == "My CV"
    assert user.profiles[0].template.name == "Test Template"


@pytest.mark.unit
@pytest.mark.phase2
def test_create_publication(db_session, sample_user_data):
    """Test creating a publication"""
    # Create user first
    user = User(
        email=sample_user_data["email"],
        username=sample_user_data["username"],
        hashed_password="hashed_password_here",
    )
    db_session.add(user)
    db_session.commit()
    
    # Create publication
    pub = Publication(
        user_id=user.id,
        title="Test Publication",
        authors="John Doe, Jane Smith",
        year=2023,
        venue="Test Conference",
        source="google_scholar",
        citation_count=10,
    )
    
    db_session.add(pub)
    db_session.commit()
    
    assert pub.id is not None
    assert pub.title == "Test Publication"
    assert pub.is_verified is False
    assert pub.is_included is True


@pytest.mark.unit
@pytest.mark.phase1
def test_template_blocks(db_session):
    """Test template block structure"""
    from app.models import TemplateBlock, BlockElement
    
    # Create template
    template = Template(
        name="Test Template",
        description="Test",
        latex_template="test",
    )
    db_session.add(template)
    db_session.commit()
    
    # Create block
    block = TemplateBlock(
        template_id=template.id,
        name="education",
        display_name="Education",
        order=1,
        is_required=True,
    )
    db_session.add(block)
    db_session.commit()
    
    # Create element
    element = BlockElement(
        block_id=block.id,
        field_name="degree",
        field_label="Degree",
        field_type="text",
        is_required=True,
        order=1,
    )
    db_session.add(element)
    db_session.commit()
    
    # Test relationships
    assert len(template.blocks) == 1
    assert template.blocks[0].name == "education"
    assert len(block.elements) == 1
    assert block.elements[0].field_name == "degree"

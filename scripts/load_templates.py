#!/usr/bin/env python3
"""Script to load default CV templates"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, init_db
from app.models import Template, TemplateBlock, BlockElement


def load_templates():
    """Load default CV templates into database"""
    db = SessionLocal()
    
    try:
        # Template 1: Classic Academic CV
        classic_template = Template(
            name="Classic Academic",
            description="Traditional academic CV with clean formatting",
            preview_image_url="/static/templates/classic.png",
            latex_template=get_classic_latex_template(),
            is_premium=False,
            is_active=True,
            style_config={
                "font": "times",
                "color": "black",
                "margins": "1in"
            }
        )
        
        db.add(classic_template)
        db.flush()  # Get ID
        
        # Add blocks for classic template
        add_classic_blocks(db, classic_template.id)
        
        # Template 2: Modern CV
        modern_template = Template(
            name="Modern Professional",
            description="Contemporary design with color accents",
            preview_image_url="/static/templates/modern.png",
            latex_template=get_modern_latex_template(),
            is_premium=False,
            is_active=True,
            style_config={
                "font": "helvetica",
                "color": "blue",
                "margins": "0.75in"
            }
        )
        
        db.add(modern_template)
        db.flush()
        
        add_modern_blocks(db, modern_template.id)
        
        # Template 3: Academic Detailed
        detailed_template = Template(
            name="Academic Detailed",
            description="Comprehensive template for senior academics",
            preview_image_url="/static/templates/detailed.png",
            latex_template=get_detailed_latex_template(),
            is_premium=True,
            is_active=True,
            style_config={
                "font": "palatino",
                "color": "darkblue",
                "margins": "1in"
            }
        )
        
        db.add(detailed_template)
        db.flush()
        
        add_detailed_blocks(db, detailed_template.id)
        
        db.commit()
        
        print("=" * 60)
        print("Templates loaded successfully!")
        print("=" * 60)
        print("✓ Classic Academic")
        print("✓ Modern Professional")
        print("✓ Academic Detailed")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error loading templates: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def add_classic_blocks(db, template_id: int):
    """Add blocks for classic template"""
    blocks_data = [
        {
            "name": "personal",
            "display_name": "Personal Information",
            "order": 1,
            "is_required": True,
            "elements": [
                {"field_name": "full_name", "field_label": "Full Name", "field_type": "text", "is_required": True, "order": 1},
                {"field_name": "email", "field_label": "Email", "field_type": "email", "is_required": True, "order": 2},
                {"field_name": "phone", "field_label": "Phone", "field_type": "text", "is_required": False, "order": 3},
                {"field_name": "address", "field_label": "Address", "field_type": "textarea", "is_required": False, "order": 4},
                {"field_name": "website", "field_label": "Website", "field_type": "url", "is_required": False, "order": 5},
            ]
        },
        {
            "name": "education",
            "display_name": "Education",
            "order": 2,
            "is_required": True,
            "elements": [
                {"field_name": "degree", "field_label": "Degree", "field_type": "text", "is_required": True, "order": 1},
                {"field_name": "institution", "field_label": "Institution", "field_type": "text", "is_required": True, "order": 2},
                {"field_name": "year", "field_label": "Year", "field_type": "number", "is_required": True, "order": 3},
                {"field_name": "gpa", "field_label": "GPA", "field_type": "text", "is_required": False, "order": 4},
            ]
        },
        {
            "name": "experience",
            "display_name": "Work Experience",
            "order": 3,
            "is_required": False,
            "elements": [
                {"field_name": "position", "field_label": "Position", "field_type": "text", "is_required": True, "order": 1},
                {"field_name": "organization", "field_label": "Organization", "field_type": "text", "is_required": True, "order": 2},
                {"field_name": "start_date", "field_label": "Start Date", "field_type": "date", "is_required": True, "order": 3},
                {"field_name": "end_date", "field_label": "End Date", "field_type": "date", "is_required": False, "order": 4},
                {"field_name": "description", "field_label": "Description", "field_type": "textarea", "is_required": False, "order": 5},
            ]
        },
        {
            "name": "publications",
            "display_name": "Publications",
            "order": 4,
            "is_required": False,
            "elements": [
                {"field_name": "title", "field_label": "Title", "field_type": "text", "is_required": True, "order": 1},
                {"field_name": "authors", "field_label": "Authors", "field_type": "text", "is_required": True, "order": 2},
                {"field_name": "venue", "field_label": "Venue", "field_type": "text", "is_required": False, "order": 3},
                {"field_name": "year", "field_label": "Year", "field_type": "number", "is_required": True, "order": 4},
            ]
        },
        {
            "name": "skills",
            "display_name": "Skills",
            "order": 5,
            "is_required": False,
            "elements": [
                {"field_name": "skills_list", "field_label": "Skills", "field_type": "textarea", "is_required": False, "order": 1},
            ]
        },
    ]
    
    for block_data in blocks_data:
        elements = block_data.pop("elements")
        block = TemplateBlock(template_id=template_id, **block_data)
        db.add(block)
        db.flush()
        
        for element_data in elements:
            element = BlockElement(block_id=block.id, **element_data)
            db.add(element)


def add_modern_blocks(db, template_id: int):
    """Add blocks for modern template (similar structure)"""
    add_classic_blocks(db, template_id)  # Same structure for now


def add_detailed_blocks(db, template_id: int):
    """Add blocks for detailed template (extended structure)"""
    add_classic_blocks(db, template_id)  # Base structure
    
    # Add additional blocks
    additional_blocks = [
        {
            "name": "grants",
            "display_name": "Grants & Funding",
            "order": 6,
            "is_required": False,
        },
        {
            "name": "awards",
            "display_name": "Awards & Honors",
            "order": 7,
            "is_required": False,
        },
    ]
    
    for block_data in additional_blocks:
        block = TemplateBlock(template_id=template_id, **block_data)
        db.add(block)


def get_classic_latex_template() -> str:
    """Get LaTeX template for classic style"""
    return r"""
\documentclass[11pt,a4paper]{article}
\usepackage[margin=1in]{geometry}
\usepackage{enumitem}
\usepackage{hyperref}

\begin{document}

\begin{center}
{\Large \textbf{ {{full_name}} }}\\[0.5em]
{{email}} | {{phone}} | {{website}}\\
{{address}}
\end{center}

\section*{Education}
{{education}}

\section*{Experience}
{{experience}}

\section*{Publications}
{{publications}}

\section*{Skills}
{{skills}}

\end{document}
"""


def get_modern_latex_template() -> str:
    """Get LaTeX template for modern style"""
    return r"""
\documentclass[11pt,a4paper]{article}
\usepackage[margin=0.75in]{geometry}
\usepackage{enumitem}
\usepackage{hyperref}
\usepackage{xcolor}

\definecolor{accentcolor}{RGB}{0,102,204}

\begin{document}

\begin{center}
{\Large \textbf{\color{accentcolor} {{full_name}} }}\\[0.5em]
{{email}} | {{phone}} | {{website}}
\end{center}

\section*{\color{accentcolor}Education}
{{education}}

\section*{\color{accentcolor}Experience}
{{experience}}

\section*{\color{accentcolor}Publications}
{{publications}}

\section*{\color{accentcolor}Skills}
{{skills}}

\end{document}
"""


def get_detailed_latex_template() -> str:
    """Get LaTeX template for detailed academic style"""
    return get_classic_latex_template()  # Extended version


if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    
    print("Loading templates...")
    load_templates()

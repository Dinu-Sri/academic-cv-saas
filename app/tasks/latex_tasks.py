"""LaTeX compilation tasks"""
import os
import subprocess
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from app.tasks import celery_app
from app.config import settings


@celery_app.task(name="app.tasks.latex_tasks.compile_cv_to_pdf")
def compile_cv_to_pdf(cv_data: dict, template_latex: str, output_filename: str):
    """
    Compile CV data to PDF using LaTeX
    
    Args:
        cv_data: Dictionary containing CV data
        template_latex: LaTeX template string
        output_filename: Output PDF filename
    
    Returns:
        dict: {'success': bool, 'pdf_path': str, 'error': str}
    """
    try:
        # Create unique temporary directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_dir = Path(settings.LATEX_TEMP_DIR) / f"cv_{timestamp}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate LaTeX content
        latex_content = generate_latex_from_template(template_latex, cv_data)
        
        # Write LaTeX file
        tex_file = temp_dir / "cv.tex"
        with open(tex_file, "w", encoding="utf-8") as f:
            f.write(latex_content)
        
        # Compile LaTeX to PDF
        result = subprocess.run(
            [settings.LATEX_COMPILER, "-interaction=nonstopmode", "cv.tex"],
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=settings.LATEX_COMPILE_TIMEOUT
        )
        
        if result.returncode != 0:
            # Try compiling again (sometimes needed for references)
            result = subprocess.run(
                [settings.LATEX_COMPILER, "-interaction=nonstopmode", "cv.tex"],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=settings.LATEX_COMPILE_TIMEOUT
            )
        
        pdf_file = temp_dir / "cv.pdf"
        
        if pdf_file.exists():
            # Move PDF to generated directory
            output_dir = Path(settings.GENERATED_CV_DIR)
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / output_filename
            
            shutil.copy(pdf_file, output_path)
            
            # Cleanup temp directory
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            return {
                "success": True,
                "pdf_path": str(output_path),
                "latex_source": latex_content,
                "error": None
            }
        else:
            error_log = result.stderr if result.stderr else "PDF generation failed"
            return {
                "success": False,
                "pdf_path": None,
                "latex_source": latex_content,
                "error": error_log
            }
    
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "pdf_path": None,
            "latex_source": None,
            "error": "LaTeX compilation timed out"
        }
    except Exception as e:
        return {
            "success": False,
            "pdf_path": None,
            "latex_source": None,
            "error": str(e)
        }


def generate_latex_from_template(template: str, data: dict) -> str:
    """
    Generate LaTeX content from template and data
    
    Args:
        template: LaTeX template string with placeholders
        data: Dictionary containing CV data
    
    Returns:
        str: Complete LaTeX document
    """
    # Simple template rendering (will be enhanced with Jinja2 in actual implementation)
    latex_content = template
    
    # Replace placeholders
    for key, value in data.items():
        placeholder = f"{{{{{key}}}}}"  # {{key}} in template
        if isinstance(value, list):
            # Handle lists (e.g., publications)
            value_str = format_list_for_latex(value)
        else:
            value_str = escape_latex(str(value))
        latex_content = latex_content.replace(placeholder, value_str)
    
    return latex_content


def escape_latex(text: str) -> str:
    """
    Escape special LaTeX characters
    
    Args:
        text: Text to escape
    
    Returns:
        str: Escaped text safe for LaTeX
    """
    replacements = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\^{}',
        '\\': r'\textbackslash{}',
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    return text


def format_list_for_latex(items: list) -> str:
    """
    Format a list of items for LaTeX
    
    Args:
        items: List of items (strings or dicts)
    
    Returns:
        str: Formatted LaTeX string
    """
    latex_items = []
    
    for item in items:
        if isinstance(item, dict):
            # Format dict items (e.g., publications)
            latex_items.append(format_dict_for_latex(item))
        else:
            latex_items.append(escape_latex(str(item)))
    
    return "\n".join(latex_items)


def format_dict_for_latex(data: dict) -> str:
    """
    Format a dictionary for LaTeX (e.g., publication entry)
    
    Args:
        data: Dictionary with structured data
    
    Returns:
        str: Formatted LaTeX string
    """
    # Example: format publication
    if "title" in data:
        parts = []
        if "authors" in data:
            parts.append(escape_latex(data["authors"]))
        if "title" in data:
            parts.append(f"\\textit{{{escape_latex(data['title'])}}}")
        if "venue" in data:
            parts.append(escape_latex(data["venue"]))
        if "year" in data:
            parts.append(f"({data['year']})")
        
        return ". ".join(parts) + "."
    
    return str(data)


@celery_app.task(name="app.tasks.latex_tasks.cleanup_temp_files")
def cleanup_temp_files():
    """
    Cleanup old temporary LaTeX files
    
    Removes files older than 24 hours
    """
    try:
        temp_dir = Path(settings.LATEX_TEMP_DIR)
        if not temp_dir.exists():
            return {"success": True, "removed": 0}
        
        cutoff_time = datetime.now() - timedelta(hours=24)
        removed = 0
        
        for item in temp_dir.iterdir():
            if item.is_dir():
                # Check directory modification time
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                if mtime < cutoff_time:
                    shutil.rmtree(item, ignore_errors=True)
                    removed += 1
        
        return {"success": True, "removed": removed}
    
    except Exception as e:
        return {"success": False, "error": str(e)}

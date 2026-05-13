import os
import tempfile
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel


app = FastAPI(title="CVScholar Docling Extractor", version="1.0.0")
_DOC_CONVERTER = None
_STARTUP_ERROR = ""


class ExtractResponse(BaseModel):
    ok: bool
    method: str
    text: str
    markdown: str
    chars: int


def _extract_with_docling(path: str) -> tuple[str, str]:
    converter = _get_converter()
    result = converter.convert(path)

    document: Any = getattr(result, "document", result)

    markdown = ""
    if hasattr(document, "export_to_markdown"):
        markdown = str(document.export_to_markdown() or "")

    text = ""
    if hasattr(document, "export_to_text"):
        text = str(document.export_to_text() or "")

    if not text and markdown:
        text = markdown

    if not text:
        text = str(result)

    return text.strip(), markdown.strip()


def _get_converter():
    global _DOC_CONVERTER
    if _DOC_CONVERTER is None:
        from docling.document_converter import DocumentConverter

        _DOC_CONVERTER = DocumentConverter()
    return _DOC_CONVERTER


def _extract_with_pypdf(path: str) -> str:
    # Fallback path when Docling model loading fails.
    from pypdf import PdfReader

    reader = PdfReader(path)
    chunks: list[str] = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n\n".join(chunks).strip()


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ok": _STARTUP_ERROR == "",
        "service": "docling-extractor",
        "warmed": _DOC_CONVERTER is not None,
        "startup_error": _STARTUP_ERROR,
    }


@app.on_event("startup")
def warmup_docling() -> None:
    global _STARTUP_ERROR
    try:
        _get_converter()

        # Trigger one tiny conversion so OCR/model artifacts are downloaded
        # before the first user upload request.
        from pypdf import PdfWriter

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            warm_path = tmp.name

        try:
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            with open(warm_path, "wb") as f:
                writer.write(f)

            _extract_with_docling(warm_path)
        finally:
            if os.path.exists(warm_path):
                try:
                    os.remove(warm_path)
                except OSError:
                    pass
    except Exception as exc:
        _STARTUP_ERROR = str(exc)


@app.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)) -> ExtractResponse:
    name = (file.filename or "upload.pdf").lower()
    if not name.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            temp_path = tmp.name
            tmp.write(await file.read())

        text = ""
        markdown = ""
        method = "docling"

        try:
            text, markdown = _extract_with_docling(temp_path)
        except Exception:
            # Graceful fallback keeps the endpoint stable even if Docling
            # dependencies fail at runtime.
            text = _extract_with_pypdf(temp_path)
            markdown = text
            method = "pypdf_fallback"

        if not text:
            raise HTTPException(status_code=422, detail="No readable text extracted from PDF.")

        return ExtractResponse(
            ok=True,
            method=method,
            text=text,
            markdown=markdown,
            chars=len(text),
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

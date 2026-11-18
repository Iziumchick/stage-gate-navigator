import pymupdf as fitz
import re
from dataclasses import dataclass
from typing import Optional


MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_PDF_MIME_TYPES = {
    "application/pdf",
    "application/x-pdf",
}


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    code: Optional[str] = None
    safe_message: Optional[str] = None
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None


class PdfValidationError(Exception):
    def __init__(self, safe_message: str, code: str = "invalid_pdf"):
        super().__init__(safe_message)
        self.safe_message = safe_message
        self.code = code


class PdfProcessingError(Exception):
    def __init__(self, safe_message: str = "Invalid or unreadable PDF"):
        super().__init__(safe_message)
        self.safe_message = safe_message


def validate_pdf_upload(
    *,
    filename: Optional[str],
    content_type: Optional[str],
    data: bytes,
    max_size_bytes: int = MAX_PDF_SIZE_BYTES,
) -> ValidationResult:
    """
    Обязательная валидация ДО любого parsing.
    Проверяем:
    - extension
    - non-empty
    - file size
    - MIME type
    - magic bytes (%PDF- в начале файла)
    """
    safe_filename = (filename or "").strip()
    safe_content_type = (content_type or "").strip().lower()
    size_bytes = len(data) if data is not None else 0

    if not safe_filename.lower().endswith(".pdf"):
        raise PdfValidationError(
            safe_message="Please upload a PDF file",
            code="invalid_extension",
        )

    if not data:
        raise PdfValidationError(
            safe_message="Empty file",
            code="empty_file",
        )

    if size_bytes > max_size_bytes:
        raise PdfValidationError(
            safe_message=f"File is too large (max {max_size_bytes // (1024 * 1024)} MB)",
            code="file_too_large",
        )

    # MIME check (практичный старт: используем content_type от UploadFile)
    # Если content_type отсутствует — не валим файл только из-за этого.
    if safe_content_type and safe_content_type not in ALLOWED_PDF_MIME_TYPES:
        raise PdfValidationError(
            safe_message="Unsupported file type",
            code="invalid_mime",
        )

    # Require an actual PDF header, independently of the filename and MIME type.
    if not re.match(br"%PDF-(?:1\.[0-9]|2\.0)", data.lstrip()[:16]):
        raise PdfValidationError(
            safe_message="File content does not look like a valid PDF",
            code="invalid_magic_bytes",
        )

    return ValidationResult(
        ok=True,
        code=None,
        safe_message=None,
        size_bytes=size_bytes,
        content_type=safe_content_type or None,
    )


def inspect_student_pdf(data:bytes):
    """Strict passive print-export policy before reading transcript rows."""
    try:
        with fitz.open(stream=data,filetype='pdf') as doc:
            if doc.needs_pass or doc.is_encrypted:
                raise PdfValidationError('Bitte eine unverschlüsselte Druck-PDF aus HISinOne hochladen.','encrypted_pdf')
            if not 1<=doc.page_count<=80 or doc.xref_length()>100000:
                raise PdfValidationError('Die PDF ist zu umfangreich.','pdf_limits')
            if doc.embfile_count() or doc.is_form_pdf:
                raise PdfValidationError('Bitte eine reine Druck-PDF ohne Anhänge oder Formularfelder hochladen.','active_content')
            for xref in range(1,doc.xref_length()):
                value=doc.xref_object(xref,compressed=False)
                if re.search(r'/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|SubmitForm|ImportData)\b',value):
                    raise PdfValidationError('Interaktive PDF-Inhalte sind nicht erlaubt. Bitte die Leistungen erneut als PDF drucken.','active_content')
    except PdfValidationError:raise
    except Exception as error:raise PdfProcessingError('Die PDF ist beschädigt oder nicht lesbar.') from error


def parse_student_pdf(data:bytes):
    import json
    import os
    import subprocess
    import sys
    env={key:os.environ[key] for key in ('PATH','PYTHONPATH','LANG') if key in os.environ}
    try:
        result=subprocess.run([sys.executable,'-m','app.services.pdf_worker'],input=data,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=20,env=env,check=False)
        if result.returncode or len(result.stdout)>5*1024*1024:raise PdfProcessingError('Die PDF konnte innerhalb der Sicherheitsgrenzen nicht verarbeitet werden.')
        payload=json.loads(result.stdout)
    except (subprocess.TimeoutExpired,ValueError,OSError) as error:
        raise PdfProcessingError('Die PDF konnte innerhalb der Sicherheitsgrenzen nicht verarbeitet werden.') from error
    if not payload.get('ok'):
        from app.services.leistungen_import import ExportError,REPRINT
        message=payload.get('message','Die PDF ist nicht lesbar.').removesuffix(' '+REPRINT)
        raise ExportError(message,payload.get('code','invalid_pdf'))
    return payload['parsed']

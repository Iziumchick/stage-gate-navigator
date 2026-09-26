# backend/app/models.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Import(Base):
    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    source: Mapped[str] = mapped_column(String(64))
    parser_version: Mapped[str] = mapped_column(String(32))
    pdf_sha256: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ✅ новое поле для строк со стилем
    raw_lines_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    parsed_modules_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    degree_program_raw: Mapped[str | None] = mapped_column(String, nullable=True)
    degree_program_key: Mapped[str | None] = mapped_column(String, nullable=True)

    overall_grade: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_credits: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(16), default="success")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    stats_total_rows: Mapped[int] = mapped_column(Integer, default=0)
    stats_saved_rows: Mapped[int] = mapped_column(Integer, default=0)

    achievements: Mapped[list["Achievement"]] = relationship(
        back_populates="imp",
        cascade="all, delete-orphan",
    )


class Achievement(Base):
    __tablename__ = "achievements"

    requirement_title_raw: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requirement_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    import_id: Mapped[int] = mapped_column(ForeignKey("imports.id"), index=True)

    module_name_raw: Mapped[str] = mapped_column(Text)
    module_name_norm: Mapped[str] = mapped_column(String(256), index=True)

    ects: Mapped[int | None] = mapped_column(Integer, nullable=True)

    grade_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    grade_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    grade_text: Mapped[str | None] = mapped_column(String, nullable=True)

    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    status_raw: Mapped[str | None] = mapped_column(String(32), nullable=True)
    attempt: Mapped[int | None] = mapped_column(Integer, nullable=True)

    imp: Mapped["Import"] = relationship(back_populates="achievements")

    __table_args__ = (
        Index("ix_achievements_import_norm", "import_id", "module_name_norm"),
    )
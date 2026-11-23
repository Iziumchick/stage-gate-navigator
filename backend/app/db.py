# backend/app/db.py
import os
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker
from app.models import Base


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

# Для SQLite важно: check_same_thread=False (FastAPI будет работать с потоками)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args,hide_parameters=True)
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine,'connect')
    def sqlite_protection(connection,_):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA secure_delete=ON')
Base.metadata.create_all(bind=engine)
# Additive migration for the existing prototype database; no account reset.
columns={c['name'] for c in inspect(engine).get_columns('users')}
import_columns={c['name'] for c in inspect(engine).get_columns('imports')}
with engine.begin() as connection:
    if 'last_uploaded_at' not in import_columns:
        connection.execute(text('ALTER TABLE imports ADD COLUMN last_uploaded_at DATETIME'))
    for name,kind in [('privacy_version','VARCHAR(40)'),('privacy_accepted_at','DATETIME'),('last_active_at','DATETIME'),('email_verified_at','DATETIME')]:
        if name not in columns:connection.execute(text(f'ALTER TABLE users ADD COLUMN {name} {kind}'))
    connection.execute(text('UPDATE users SET last_active_at=CURRENT_TIMESTAMP WHERE last_active_at IS NULL'))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

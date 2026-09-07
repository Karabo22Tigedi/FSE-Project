from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.encoders import ENCODERS_BY_TYPE
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import *  # noqa: F401,F403 - register models before migrations
from app.schemas.base import serialize_utc_datetime
from app.services.bootstrap import seed_defaults

# SQLite returns naive datetimes; treat them as UTC in jsonable_encoder paths too.
ENCODERS_BY_TYPE[datetime] = serialize_utc_datetime


def run_migrations() -> None:
    """Apply Alembic migrations to DATABASE_URL. Replaces create_all as the
    runtime schema path so new columns (e.g. settlement outbox fields) are
    actually applied on existing databases.
    """
    from alembic import command
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import text

    from app.config import get_settings

    backend_dir = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", (backend_dir / "alembic").as_posix())
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url)

    # SQLite on OneDrive can block Alembic's upgrade lock even when the
    # schema is already current. Skip the lock if we are already at head.
    try:
        script = ScriptDirectory.from_config(cfg)
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
        if row is not None and row[0] == script.get_current_head():
            return
    except Exception:
        pass

    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    # Alembic is the source of schema for file/server databases. create_all
    # is a no-op when tables already exist, and is required for sqlite://
    # in-memory (Alembic opens a different connection, so its tables vanish).
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()
    yield


app = FastAPI(title="XRPL FX Remittance Platform", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(api_router)

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

from app.config import get_settings
from app.database import Base
from app.models import *  # noqa: F401,F403 - register metadata for autogenerate

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Always honour the running app's DATABASE_URL (env / .env), including when
# FastAPI lifespan calls command.upgrade and when `alembic` is run from backend/.
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


def _render_item(type_, obj, autogen_context):
    """Keep EncryptedString out of revision files (it is VARCHAR at rest)."""
    from app.core.crypto import EncryptedString

    if type_ == "type" and isinstance(obj, EncryptedString):
        length = getattr(obj.impl, "length", None)
        if length is not None:
            return f"sa.String(length={length})"
        return "sa.String()"
    return False


def _render_as_batch(url: str) -> bool:
    return url.startswith("sqlite")


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=_render_as_batch(url or ""),
        render_item=_render_item,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",
            render_item=_render_item,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

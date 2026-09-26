"""Quote TTL, tracking_ref, cancelled status, and hashed session tokens.

Revision ID: 0002_quote_session
Revises: 0001_initial
Create Date: 2026-09-07

Patch B: do not edit 0001_initial_schema.py.
"""
from datetime import timedelta
import hashlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_quote_session"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("token_hash", sa.String(length=64), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, token FROM sessions")).fetchall()
    for row in rows:
        token_hash = hashlib.sha256(row.token.encode("utf-8")).hexdigest()
        conn.execute(
            sa.text("UPDATE sessions SET token_hash = :h WHERE id = :id"),
            {"h": token_hash, "id": row.id},
        )

    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.alter_column("token_hash", existing_type=sa.String(length=64), nullable=False)
        batch_op.drop_index(batch_op.f("ix_sessions_token"))
        batch_op.drop_column("token")
        batch_op.create_index(batch_op.f("ix_sessions_token_hash"), ["token_hash"], unique=True)

    with op.batch_alter_table("remittances", schema=None) as batch_op:
        batch_op.add_column(sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("tracking_ref", sa.String(length=12), nullable=True))

    remittance_rows = conn.execute(sa.text("SELECT id, created_at FROM remittances")).fetchall()
    for i, row in enumerate(remittance_rows, start=1):
        created = row.created_at
        if created is None:
            expires = None
        else:
            expires = created + timedelta(seconds=900)
        conn.execute(
            sa.text(
                "UPDATE remittances SET tracking_ref = :ref, expires_at = :exp WHERE id = :id"
            ),
            {"ref": f"MG{i:010d}", "exp": expires, "id": row.id},
        )

    with op.batch_alter_table("remittances", schema=None) as batch_op:
        batch_op.alter_column(
            "expires_at", existing_type=sa.DateTime(timezone=True), nullable=False
        )
        batch_op.alter_column("tracking_ref", existing_type=sa.String(length=12), nullable=False)
        batch_op.create_index(batch_op.f("ix_remittances_tracking_ref"), ["tracking_ref"], unique=True)

    # RemittanceStatus.CANCELLED ('cancelled') is a new Python enum value.
    # SQLite stores this column as VARCHAR; no CHECK/native enum DDL is required.


def downgrade() -> None:
    with op.batch_alter_table("remittances", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_remittances_tracking_ref"))
        batch_op.drop_column("tracking_ref")
        batch_op.drop_column("expires_at")

    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("token", sa.String(length=128), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM sessions")).fetchall()
    for i, row in enumerate(rows, start=1):
        conn.execute(
            sa.text("UPDATE sessions SET token = :t WHERE id = :id"),
            {"t": f"downgrade-placeholder-{i:08d}", "id": row.id},
        )

    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.alter_column("token", existing_type=sa.String(length=128), nullable=False)
        batch_op.drop_index(batch_op.f("ix_sessions_token_hash"))
        batch_op.drop_column("token_hash")
        batch_op.create_index(batch_op.f("ix_sessions_token"), ["token"], unique=True)

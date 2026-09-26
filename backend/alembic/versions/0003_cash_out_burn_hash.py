"""Add xrpl_burn_tx_hash to cash_out_requests.

Revision ID: 0003_cash_out_burn
Revises: 0002_quote_session
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_cash_out_burn"
down_revision: Union[str, None] = "0002_quote_session"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("cash_out_requests", schema=None) as batch_op:
        batch_op.add_column(sa.Column("xrpl_burn_tx_hash", sa.String(length=96), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("cash_out_requests", schema=None) as batch_op:
        batch_op.drop_column("xrpl_burn_tx_hash")

from datetime import datetime

from app.models.settlement import SettlementMessageStatus
from app.schemas.base import SchemaModel


class SettlementMessageOut(SchemaModel):
    id: str
    remittance_id: str
    status: SettlementMessageStatus
    attempts: int
    failure_reason: str | None
    stream_entry_id: str | None = None
    created_at: datetime
    processed_at: datetime | None

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, field_serializer


def serialize_utc_datetime(value: datetime) -> str:
    """Emit UTC ISO-8601 with a timezone suffix. Naive values are treated as UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


class SchemaModel(BaseModel):
    """Response models: SQLite-naive datetimes serialize as UTC with Z."""

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("*", mode="wrap", when_used="json")
    def _serialize_utc_datetime(self, value: Any, handler: Any) -> Any:
        if isinstance(value, datetime):
            return serialize_utc_datetime(value)
        return handler(value)

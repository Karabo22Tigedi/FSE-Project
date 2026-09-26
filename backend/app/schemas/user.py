from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole
from app.schemas.base import SchemaModel
from app.schemas.validators import MobileNumber


class UserRegister(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    mobile_number: MobileNumber
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """FR-04a: only basic profile fields are user-editable."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    mobile_number: MobileNumber | None = None


class UserOut(SchemaModel):
    id: str
    full_name: str
    email: str
    mobile_number: str
    role: UserRole
    created_at: datetime


class TokenResponse(SchemaModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserOut

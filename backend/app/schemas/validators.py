import re
from typing import Annotated

from pydantic import AfterValidator

_PHONE_RE = re.compile(r"^\+?\d{8,15}$")


def normalize_mobile_number(value: str) -> str:
    """E.164-ish: optional leading '+', 8-15 digits. Strips spaces/hyphens
    so '071 234 5678' and '071-234-5678' are treated the same as '0712345678'.
    Not country-specific - beneficiaries can be outside South Africa.
    """
    cleaned = re.sub(r"[\s-]", "", value.strip())
    if not _PHONE_RE.match(cleaned):
        raise ValueError(
            "mobile_number must be 8-15 digits, optionally prefixed with '+' (e.g. +27821234567)"
        )
    return cleaned


MobileNumber = Annotated[str, AfterValidator(normalize_mobile_number)]

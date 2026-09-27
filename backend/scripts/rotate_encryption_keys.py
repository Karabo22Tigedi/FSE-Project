"""Re-encrypt every encrypted column so the database matches the keys in .env.

Use this when a database was created under different KYC_ENCRYPTION_KEY /
XRPL_KEY_ENCRYPTION_KEY values (e.g. a teammate's funded copy) and the app
now fails with "Failed to decrypt column". Pass the keys the database was
encrypted with; the current .env keys become the new ones:

    set OLD_XRPL_KEY_ENCRYPTION_KEY=<old xrpl key>
    set OLD_KYC_ENCRYPTION_KEY=<old kyc key>
    python -m scripts.rotate_encryption_keys

Rows that already decrypt with the current keys are left alone, so it is
safe to re-run. Nothing is written unless every row can be decrypted.
Back up fx_platform.db first. Plaintext secrets are never printed.
"""

import os
import sys

sys.path.insert(0, ".")

from cryptography.fernet import Fernet, InvalidToken  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import engine  # noqa: E402

# (table, primary key, column, settings attribute holding the current key)
ENCRYPTED_COLUMNS = [
    ("platform_wallet", "id", "secret", "xrpl_key_encryption_key"),
    ("recipient_wallets", "id", "secret", "xrpl_key_encryption_key"),
    ("kyc_applications", "id", "identification_number", "kyc_encryption_key"),
]


def _decrypts(fernet: Fernet, value: str) -> bool:
    try:
        fernet.decrypt(value.encode())
        return True
    except InvalidToken:
        return False


def main():
    settings = get_settings()
    old_keys = {
        "xrpl_key_encryption_key": os.environ.get("OLD_XRPL_KEY_ENCRYPTION_KEY", ""),
        "kyc_encryption_key": os.environ.get("OLD_KYC_ENCRYPTION_KEY", ""),
    }

    updates = []
    problems = []
    with engine.connect() as conn:
        for table, pk, column, key_field in ENCRYPTED_COLUMNS:
            new = Fernet(getattr(settings, key_field).encode())
            old = Fernet(old_keys[key_field].encode()) if old_keys[key_field] else None
            rows = conn.execute(
                text(f"SELECT {pk}, {column} FROM {table} WHERE {column} IS NOT NULL")
            ).all()
            already = rotated = 0
            for row_id, value in rows:
                if _decrypts(new, value):
                    already += 1
                elif old is not None and _decrypts(old, value):
                    plaintext = old.decrypt(value.encode())
                    updates.append((table, pk, column, row_id, new.encrypt(plaintext).decode()))
                    rotated += 1
                else:
                    problems.append(f"{table}.{column} row {row_id}")
            print(f"{table}.{column}: {len(rows)} rows, {already} already current, {rotated} to re-encrypt")

    if problems:
        print(f"{len(problems)} rows decrypt with neither the old nor the current key; nothing was changed:")
        for p in problems:
            print(f"  {p}")
        raise SystemExit(1)

    if not updates:
        print("Database already matches the current keys.")
        return

    with engine.begin() as conn:
        for table, pk, column, row_id, value in updates:
            conn.execute(
                text(f"UPDATE {table} SET {column} = :value WHERE {pk} = :id"),
                {"value": value, "id": row_id},
            )
    print(f"Re-encrypted {len(updates)} values with the current .env keys.")


if __name__ == "__main__":
    main()

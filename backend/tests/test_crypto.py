import pytest
from cryptography.fernet import Fernet

from app.core.crypto import EncryptedString


def test_encrypted_string_invalid_ciphertext_raises():
    col = EncryptedString(500, key_field="kyc_encryption_key")
    with pytest.raises(RuntimeError, match="invalid token"):
        col.process_result_value("this-is-not-a-fernet-token", None)


def test_encrypted_string_roundtrip():
    col = EncryptedString(500, key_field="kyc_encryption_key")
    stored = col.process_bind_param("secret-value", None)
    assert stored != "secret-value"
    assert col.process_result_value(stored, None) == "secret-value"
    # Wrong key must also raise rather than silently returning None.
    other = Fernet.generate_key().decode()
    wrong = Fernet(other.encode()).encrypt(b"secret-value").decode()
    with pytest.raises(RuntimeError, match="invalid token"):
        col.process_result_value(wrong, None)

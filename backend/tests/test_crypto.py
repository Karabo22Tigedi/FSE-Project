import pytest
from cryptography.fernet import Fernet

from app.core.crypto import EncryptedString, EncryptedXrplSecret, decrypt_xrpl_secret


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


def test_encrypted_xrpl_secret_roundtrip():
    col = EncryptedXrplSecret(500)
    stored = col.process_bind_param("sSEED", None)
    assert stored != "sSEED"
    assert col.process_result_value(stored, None) == stored
    assert decrypt_xrpl_secret(stored) == "sSEED"
    # Loading leaves ciphertext on the object. Saving that value must not encrypt it again.
    assert col.process_bind_param(stored, None) == stored

from app.config import get_settings
from app.models.user import User, UserRole
from app.services.bootstrap import seed_admin_if_configured
from tests.conftest import TestingSessionLocal


def test_no_admin_when_host_env_empty():
    db = TestingSessionLocal()
    try:
        seed_admin_if_configured(db)
        assert db.query(User).filter(User.role == UserRole.ADMIN).count() == 0
    finally:
        db.close()


def test_seed_admin_from_env_once(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "host-admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "HostAdmin1!")
    get_settings.cache_clear()
    db = TestingSessionLocal()
    try:
        seed_admin_if_configured(db)
        seed_admin_if_configured(db)
        rows = db.query(User).filter(User.email == "host-admin@example.com").all()
        assert len(rows) == 1
        assert rows[0].role == UserRole.ADMIN
    finally:
        db.close()
        get_settings.cache_clear()


def test_root_stays_api_only_without_frontend_dist(client):
    assert client.get("/").status_code == 404
    assert client.get("/health").json() == {"status": "ok"}

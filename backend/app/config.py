from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, loaded from environment / .env file.

    Kept as a single source of truth so later modules (remittance, wallet,
    XRPL settlement, message queue) can add their own settings here without
    scattering os.environ lookups across the codebase.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./fx_platform.db"
    session_expire_hours: int = 12
    kyc_encryption_key: str = ""
    quote_ttl_seconds: int = 900
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]

    # FR-13: a live public exchange-rate API is the primary source, with
    # this fixed value as the fallback if that API is unreachable or
    # returns something unexpected - quote creation shouldn't break just
    # because a free third-party service had a blip. See
    # app/services/exchange_rate.py.
    usd_zar_rate: float = 18.50
    exchange_rate_api_url: str = "https://open.er-api.com/v6/latest/USD"
    exchange_rate_cache_seconds: int = 300
    exchange_rate_timeout_seconds: float = 5.0

    # XRPL Testnet Integration (FR-27-29). Issuer/currency are config, not
    # hardcoded. UCTUSD is the CURRENT course token because the official
    # RLUSD Testnet faucet is capped at 10 RLUSD / 24h. Switching back to
    # RLUSD later is still a .env change IF Ripple funds a liquidity
    # wallet. Do not mint a new token.
    xrpl_json_rpc_url: str = "https://s.altnet.rippletest.net:51234/"
    xrpl_issuer_address: str = "rELez4x4Zqv3KYqboYVfrYPF8521Ycbxa5"
    xrpl_currency_code: str = "5543545553440000000000000000000000000000"
    xrpl_trustline_limit: str = "1000000"
    xrpl_currency_symbol: str = "UCTUSD"
    xrpl_distributor_address: str = "rsWPX7FKwnfk6enosumAzEuTs5Y12Steq4"

    # Separate from kyc_encryption_key (NFR-04/05): a distinct key means a
    # leak of one secret category doesn't automatically expose the other.
    xrpl_key_encryption_key: str = ""

    # Message queue (FR-21/22): Redis Streams, per basics.pdf's recommendation
    # ("lowest-friction options to stand up locally"). Tests point this at a
    # separate DB number so they never collide with dev/demo data.
    redis_url: str = "redis://localhost:6379/0"

    # Optional public host (Render). Empty means local Vite + FastAPI.
    # Same-origin UI is served from this folder when it exists.
    frontend_dist: str = ""
    admin_email: str = ""
    admin_full_name: str = "Group 3 Admin"
    admin_mobile_number: str = "+27000000000"
    admin_password: str = ""
    setup_platform_wallet: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()

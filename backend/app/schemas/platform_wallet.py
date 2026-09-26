from pydantic import BaseModel


class PlatformWalletOut(BaseModel):
    classic_address: str
    network: str
    trustline_established: bool
    xrp_drops: str
    uctusd_balance: str
    issuer_address: str
    currency_code: str
    currency_symbol: str
    distributor_address: str
    explorer_url: str
    liquidity_ready: bool

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.auth_service import AuthService
import time

security = HTTPBearer(auto_error=False)
auth_service = AuthService()

# Simple rate limiting store
_rate_limit_store = {}

async def verify_token(credentials: HTTPAuthorizationCredentials | None) -> dict | None:
    if not credentials:
        return None
    payload = auth_service.decode_token(credentials.credentials)
    return payload

async def get_current_user(request: Request) -> dict:
    credentials = await security(request)
    payload = await verify_token(credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

def rate_limit(key: str, max_requests: int = 60, window_seconds: int = 60):
    now = time.time()
    if key in _rate_limit_store:
        window_start, count = _rate_limit_store[key]
        if now - window_start > window_seconds:
            _rate_limit_store[key] = (now, 1)
        else:
            if count >= max_requests:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
            _rate_limit_store[key] = (window_start, count + 1)
    else:
        _rate_limit_store[key] = (now, 1)

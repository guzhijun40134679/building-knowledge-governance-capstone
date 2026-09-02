from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone


PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 120_000
SESSION_TTL_DAYS = 30


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        scheme, iterations, salt, expected = password_hash.split("$", 3)
    except ValueError:
        return False

    if scheme != PASSWORD_SCHEME:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations),
    ).hex()
    return hmac.compare_digest(digest, expected)


def make_session_token() -> tuple[str, str, str]:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = (utc_now() + timedelta(days=SESSION_TTL_DAYS)).isoformat()
    return token, token_hash, expires_at


def hash_token(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()

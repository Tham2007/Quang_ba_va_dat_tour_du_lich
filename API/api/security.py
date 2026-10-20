import base64
import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from fastapi import HTTPException


def hash_password(password):
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return 'scrypt$'+base64.b64encode(salt).decode()+'$'+base64.b64encode(derived).decode()


def verify_password(password, stored):
    try:
        _, salt, digest = stored.split('$')
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=2**14, r=8, p=1)
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def random_token():
    return secrets.token_urlsafe(32)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


# Development only. Production requires shared IP/user rate limiter (Redis/proxy).
_limiter = defaultdict(deque)

def rate_limit(key, limit=8, window=60):
    t = time.monotonic()
    dq = _limiter[key]
    while dq and dq[0] < t-window:
        dq.popleft()
    if len(dq) >= limit:
        raise HTTPException(429, 'Quá nhiều yêu cầu. Vui lòng thử lại sau.')
    dq.append(t)

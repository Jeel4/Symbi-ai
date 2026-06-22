# =============================================================================
# auth.py — JWT helpers + require_auth decorator
# Shared across all blueprints
# =============================================================================
import os
import jwt
from functools import wraps
from datetime import datetime, timezone, timedelta
from flask import request, jsonify
import bcrypt
import logging

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "fallback_dev_secret")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, stored: str) -> bool:
    return bcrypt.checkpw(plain.encode(), stored.encode())


def create_token(username: str) -> str:
    payload = {
        'username': username,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT rejected")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Invalid JWT rejected")
        return None


def require_auth(f):
    """Decorator: verifies Bearer JWT on every protected route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        parts = auth_header.split(' ', 1)
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Authorization header missing or malformed'}), 401
        payload = verify_token(parts[1])
        if payload is None:
            return jsonify({'error': 'Token expired or invalid. Please log in again.'}), 401
        request.current_user = payload['username']
        return f(*args, **kwargs)
    return decorated
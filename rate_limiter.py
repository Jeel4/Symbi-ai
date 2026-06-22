# =============================================================================
# rate_limiter.py — Sliding window rate limiter
# =============================================================================
#
# WHAT CHANGED FROM BEFORE:
# - Login limit relaxed: 10 attempts per 15 minutes (was 5 per 5 min)
#   Reason: 5/5min was blocking real users who mistyped password twice
# - Each limit returns time_remaining so the frontend can show a countdown
# - get_client_ip() handles X-Forwarded-For for Render/Vercel proxies
#
# PRODUCTION NOTE:
# This is still in-memory (resets on server restart).
# For true production: replace with Redis using flask-limiter + redis backend.
# For this project level it is perfectly fine and interview-explainable.

import time
import logging
from collections import defaultdict
from flask import request

logger = logging.getLogger(__name__)

# { ip_address: [timestamp1, timestamp2, ...] }
_store: dict[str, list[float]] = defaultdict(list)

# ── Limits ────────────────────────────────────────────────────────────────────
HINT_LIMIT      = 10   # hint requests per minute
HINT_WINDOW     = 60

LOGIN_LIMIT     = 10   # login attempts  (RELAXED from 5)
LOGIN_WINDOW    = 900  # per 15 minutes  (RELAXED from 5 min)

REGISTER_LIMIT  = 5
REGISTER_WINDOW = 300


def get_client_ip() -> str:
    """
    Gets real client IP even behind Render/Vercel reverse proxies.
    X-Forwarded-For header format: "client, proxy1, proxy2"
    We want the first (leftmost) value — the real client.
    """
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def check_rate_limit(ip: str, limit: int, window: int) -> tuple[bool, int]:
    """
    Checks rate limit for an IP address.

    Returns (is_limited: bool, seconds_remaining: int)
    seconds_remaining tells the frontend how long to show the countdown.

    HOW SLIDING WINDOW WORKS:
    We keep a list of timestamps of past requests for this IP.
    On each call:
      1. Remove timestamps older than `window` seconds (slide the window)
      2. If count >= limit → blocked, return time until oldest entry expires
      3. Otherwise → record this timestamp, allow
    """
    now = time.time()
    cutoff = now - window

    # Slide: remove expired timestamps
    _store[ip] = [t for t in _store[ip] if t > cutoff]

    if len(_store[ip]) >= limit:
        # Time until the oldest request falls outside the window
        oldest = _store[ip][0]
        seconds_remaining = int(window - (now - oldest)) + 1
        logger.warning(f"Rate limit hit: {ip} ({len(_store[ip])}/{limit})")
        return True, seconds_remaining

    _store[ip].append(now)
    return False, 0
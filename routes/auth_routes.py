# =============================================================================
# routes/auth_routes.py — Blueprint for /register and /login
# =============================================================================
#
# WHAT IS A FLASK BLUEPRINT?
# A Blueprint is a mini-app that groups related routes together.
# Instead of @app.route() we use @auth_bp.route().
# The main app.py registers each blueprint with a URL prefix.
#
# WHY BLUEPRINTS:
# Before: one 500-line app.py with everything mixed together.
# After:  each concern lives in its own file:
#   routes/auth_routes.py    → login, register
#   routes/hint_routes.py    → get_hint, rate_hint
#   routes/metrics_routes.py → metrics
#   routes/profile_routes.py → profile view/edit
#
# INTERVIEW TIP: "I refactored from a monolithic Flask app to a Blueprint
# architecture following the separation of concerns principle. Each domain
# (auth, AI hints, metrics, profile) lives in its own module with its
# own route prefix. This makes the codebase testable and scalable."

import re
import logging
from flask import Blueprint, request, jsonify
from models import db, User
from auth import hash_password, verify_password, create_token
from rate_limiter import check_rate_limit, get_client_ip, LOGIN_LIMIT, LOGIN_WINDOW, REGISTER_LIMIT, REGISTER_WINDOW

logger = logging.getLogger(__name__)

# Blueprint name = 'auth', URL prefix = '' (routes are /register and /login at root)
auth_bp = Blueprint('auth', __name__)

USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')


def validate_username(u: str) -> str | None:
    if not u: return "Username is required"
    if len(u) < 3: return "Username must be at least 3 characters"
    if len(u) > 30: return "Username must be 30 characters or less"
    if not USERNAME_PATTERN.match(u): return "Username: letters, numbers, _ and - only"
    return None


def validate_email(e: str) -> str | None:
    if not e: return "Email is required"
    if len(e) > 254: return "Email too long"
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', e): return "Invalid email format"
    return None


def validate_password(p: str) -> str | None:
    if not p: return "Password is required"
    if len(p) < 8: return "Password must be at least 8 characters"
    if len(p) > 128: return "Password too long"
    return None


@auth_bp.route('/register', methods=['POST'])
def register():
    ip = get_client_ip()
    limited, wait = check_rate_limit(ip, REGISTER_LIMIT, REGISTER_WINDOW)
    if limited:
        return jsonify({
            'error': f'Too many attempts. Try again in {wait} seconds.',
            'retry_after': wait
        }), 429

    data = request.json or {}
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    for err in [validate_username(username), validate_email(email), validate_password(password)]:
        if err:
            return jsonify({'error': err}), 400

    # ORM query: User.query.filter_by() instead of raw SQL SELECT
    if User.query.filter(
        (User.username == username) | (User.email == email)
    ).first():
        return jsonify({'error': 'Username or email already exists'}), 409

    # ORM insert: create object, add to session, commit
    user = User(
        username=username,
        email=email,
        password=hash_password(password),
    )
    db.session.add(user)
    db.session.commit()

    token = create_token(username)
    logger.info(f"Registered: {username}")
    return jsonify({
        'success': True,
        'token': token,
        'username': username,
        'message': 'Welcome to Symbi.ai!'
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    ip = get_client_ip()
    limited, wait = check_rate_limit(ip, LOGIN_LIMIT, LOGIN_WINDOW)
    if limited:
        # CHANGE: Now returns retry_after so frontend shows countdown timer
        return jsonify({
            'error': f'Too many login attempts. Try again in {wait} seconds.',
            'retry_after': wait   # NEW: frontend uses this for countdown
        }), 429

    data     = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    # ORM query: User.query.filter_by(email=email).first()
    user = User.query.filter_by(email=email).first()

    if user and verify_password(password, user.password):
        token = create_token(user.username)
        logger.info(f"Login: {user.username}")
        return jsonify({
            'success': True,
            'token': token,
            'username': user.username,
        })

    logger.warning(f"Failed login from {ip}")
    return jsonify({'error': 'Invalid credentials'}), 401
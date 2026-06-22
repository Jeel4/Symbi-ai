# =============================================================================
# app.py — Symbi.ai Application Factory
# =============================================================================
#
# WHAT IS AN APPLICATION FACTORY?
# Instead of creating app = Flask(__name__) at module level, we wrap it
# in a create_app() function. This pattern:
# 1. Prevents circular imports between blueprints and models
# 2. Makes testing easy (create a test app with different config)
# 3. Allows multiple app instances (e.g. one for API, one for admin)
#
# This file is now only ~80 lines. Before it was 500+.
# All route logic lives in routes/ blueprints.
# All AI logic lives in ai/chain.py.
# All models live in models.py.
# All auth logic lives in auth.py.
# All rate limiting lives in rate_limiter.py.
#
# INTERVIEW TIP: "I refactored from a 500-line monolith to an application
# factory pattern with Flask Blueprints. Each domain (auth, hints, metrics,
# profile) is a separate Blueprint registered at startup. This follows the
# separation of concerns principle and makes each module independently testable."

import os
import logging
from datetime import datetime, timezone
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv

# Load .env before anything else touches os.environ
load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    """
    Application factory — creates and configures the Flask app.
    Called once at startup. Returns the configured app instance.
    """
    app = Flask(__name__)

    # ── Config ────────────────────────────────────────────────────────────────
    # SQLAlchemy database URI
    # In development: SQLite file (simple, no setup)
    # In production: set DATABASE_URL env var to PostgreSQL URI
    # e.g. postgresql://user:pass@host:5432/dbname
    db_url = os.environ.get('DATABASE_URL', 'sqlite:///symbi.db')

    # Render's PostgreSQL gives URLs starting with "postgres://" but
    # SQLAlchemy requires "postgresql://". This fixes that automatically.
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)

    app.config['SQLALCHEMY_DATABASE_URI']        = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # saves memory
    app.config['SECRET_KEY']                     = os.environ.get('JWT_SECRET_KEY', 'dev')

    # ── Extensions ────────────────────────────────────────────────────────────
    from models import db
    db.init_app(app)        # Bind SQLAlchemy to this app
    Migrate(app, db)        # Flask-Migrate: run "flask db migrate" for schema changes

    # CORS: allow frontend origins
    CORS(app, resources={r"/*": {"origins": "*"}})

    # ── Register Blueprints ───────────────────────────────────────────────────
    # Each blueprint is a mini-app with its own routes
    from routes.auth_routes    import auth_bp
    from routes.hint_routes    import hint_bp
    from routes.metrics_routes import metrics_bp
    from routes.profile_routes import profile_bp

    app.register_blueprint(auth_bp)       # /register, /login
    app.register_blueprint(hint_bp)       # /api/get_hint, /api/rate_hint
    app.register_blueprint(metrics_bp)    # /api/metrics
    app.register_blueprint(profile_bp)    # /api/profile

    # ── Health endpoint ───────────────────────────────────────────────────────
    # GET /health — used by cron job to keep Render awake
    # Also used by monitoring tools to check if backend is alive
    @app.route('/health')
    def health():
        """
        Health check endpoint.
        Returns 200 if the app and database are both operational.
        Cron job (cron-job.org) pings this every 14 minutes to prevent
        Render free tier cold starts.
        """
        try:
            # Quick DB check — if this fails, DB is down
            db.session.execute(db.text('SELECT 1'))
            db_status = 'ok'
        except Exception as e:
            db_status = f'error: {str(e)}'

        return jsonify({
            'status':    'ok' if db_status == 'ok' else 'degraded',
            'db':        db_status,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'version':   '2.0.0',
        }), 200 if db_status == 'ok' else 503

    # ── Create tables on first run ────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        logger.info("Database tables ready")

    return app


# ── Entry point ───────────────────────────────────────────────────────────────
app = create_app()

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    logger.info(f"Starting Symbi.ai (debug={debug})")
    app.run(port=5000, debug=debug)
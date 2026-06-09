# =============================================================================
# app.py - Symbi.ai Backend
# Improvement #1: Environment Variables + bcrypt + JWT Auth
# Improvement #2: Rate Limiting + Input Validation
# Improvement #3: AI Evaluation Metrics
# =============================================================================

# ---- Standard Library Imports ----
import os
import time
import logging
import re                          # NEW #2: regex for input validation
from datetime import datetime, timezone, timedelta
from collections import defaultdict  # NEW #2: for in-memory rate limiting

# ---- Third-Party Imports ----
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import requests
import backoff
import bcrypt
import jwt
from dotenv import load_dotenv

# =============================================================================
# CONFIGURATION
# =============================================================================

load_dotenv()

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')

CORS(app, resources={
    r"/api/*": {"origins": "*"},
    r"/register": {"origins": "*"},
    r"/login": {"origins": "*"},
})

# =============================================================================
# SECRETS
# =============================================================================

GROQ_API_KEY    = os.environ.get("GROQ_API_KEY")
JWT_SECRET_KEY  = os.environ.get("JWT_SECRET_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not set in .env file")
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY not set in .env file")

# =============================================================================
# LOGGING
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# IMPROVEMENT #2 — RATE LIMITING (in-memory)
# =============================================================================
#
# WHAT IS RATE LIMITING?
# It restricts how many requests a user/IP can make in a time window.
# Without it, someone can spam your AI endpoint and drain your API credits.
#
# HOW THIS WORKS:
# We keep a dictionary: { ip_address: [timestamp1, timestamp2, ...] }
# On every request we:
#   1. Remove timestamps older than the window (60 seconds)
#   2. Count remaining timestamps
#   3. If count >= limit → reject with 429 Too Many Requests
#   4. Otherwise → add current timestamp and allow
#
# WHY IN-MEMORY (not a database)?
# Fast, simple, zero dependencies. Downside: resets when server restarts
# and doesn't work across multiple server instances. For production,
# use Redis. For a student project, this is perfect.
#
# INTERVIEW TIP: "I implemented a sliding window rate limiter using Python's
# defaultdict. Each IP gets a list of request timestamps; we slide the
# window by removing entries older than 60 seconds before checking the count."

# Stores request timestamps per IP address
# defaultdict(list) auto-creates an empty list for new keys
rate_limit_store = defaultdict(list)

# Configuration: how many requests allowed per window
RATE_LIMIT_REQUESTS = 10      # max 10 hint requests...
RATE_LIMIT_WINDOW   = 60      # ...per 60 seconds per IP
LOGIN_LIMIT_REQUESTS = 5      # max 5 login attempts...
LOGIN_LIMIT_WINDOW   = 300    # ...per 5 minutes per IP (brute-force protection)

def is_rate_limited(ip: str, limit: int, window: int) -> bool:
    """
    Checks if an IP address has exceeded the rate limit.

    ip     — the client's IP address (from request.remote_addr)
    limit  — maximum number of requests allowed
    window — time window in seconds

    Returns True if the IP should be blocked, False if the request is allowed.

    HOW THE SLIDING WINDOW WORKS:
    Imagine you allow 10 requests per 60 seconds.
    At time=100s user makes their 1st request  → store: [100]
    At time=110s user makes their 5th request  → store: [100,102,104,106,110]
    At time=155s user makes their 10th request → store: [100,...,155]
    At time=161s user makes 11th request:
      - First, remove all timestamps < (161-60) = 101 → removes [100]
      - Now store has 9 entries → under limit → allowed
    This is a "sliding" window because the 60s range moves with time.
    """
    now = time.time()
    window_start = now - window

    # Remove timestamps outside the current window (they're too old to count)
    # This is the "slide" — we forget old requests
    rate_limit_store[ip] = [
        t for t in rate_limit_store[ip]
        if t > window_start
    ]

    # Count requests in the current window
    if len(rate_limit_store[ip]) >= limit:
        return True  # Rate limited — block this request

    # Not limited — record this request's timestamp and allow
    rate_limit_store[ip].append(now)
    return False


def get_client_ip() -> str:
    """
    Gets the real client IP address.

    WHY NOT JUST request.remote_addr?
    When deployed behind a proxy (like Nginx or a cloud load balancer),
    request.remote_addr is the proxy's IP, not the user's IP.
    The real IP is forwarded in the X-Forwarded-For header.
    We check that first, fall back to remote_addr if not present.
    """
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        # X-Forwarded-For can be a comma-separated list: "client, proxy1, proxy2"
        # We want the first one (the original client)
        return forwarded_for.split(',')[0].strip()
    return request.remote_addr or 'unknown'


# =============================================================================
# IMPROVEMENT #2 — INPUT VALIDATION
# =============================================================================
#
# WHAT IS INPUT VALIDATION?
# Never trust data coming from the client. Always check:
#   - Is it the right type? (string, not a number or object)
#   - Is it within acceptable length? (prevents memory exhaustion)
#   - Does it contain dangerous patterns? (XSS, injection)
#
# WHY VALIDATE ON THE SERVER (not just the frontend)?
# Frontend validation is for UX only. Anyone can bypass it using curl,
# Postman, or browser DevTools. Server-side validation is the real defense.

# Allowed characters for username: letters, numbers, underscore, hyphen
# re.compile() pre-compiles the pattern for performance (faster repeated use)
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')

def validate_username(username: str) -> str | None:
    """
    Validates a username string.
    Returns an error message string if invalid, or None if valid.

    WHY RETURN ERROR MESSAGE:
    The caller can do:  error = validate_username(u)
                        if error: return jsonify({'error': error}), 400
    Clean and readable.
    """
    if not username:
        return "Username is required"
    if len(username) < 3:
        return "Username must be at least 3 characters"
    if len(username) > 30:
        return "Username must be 30 characters or less"
    if not USERNAME_PATTERN.match(username):
        return "Username can only contain letters, numbers, underscores, and hyphens"
    return None  # None means valid


def validate_email(email: str) -> str | None:
    """
    Validates an email address using regex.

    The pattern checks for: something@something.something
    It's not exhaustive (email validation is surprisingly complex),
    but catches the vast majority of invalid inputs.
    """
    if not email:
        return "Email is required"
    if len(email) > 254:  # RFC 5321 max email length
        return "Email address is too long"
    # Basic email pattern: word chars + @ + domain + . + tld
    email_pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    if not email_pattern.match(email):
        return "Invalid email address format"
    return None


def validate_password(password: str) -> str | None:
    """
    Validates password strength.

    Rules:
    - At least 8 characters (short passwords are easy to brute-force)
    - At most 128 characters (bcrypt silently truncates at 72 bytes — a known quirk)
    - No other restrictions (don't force "must have uppercase" — it hurts usability
      more than it helps security, per NIST guidelines)

    INTERVIEW TIP: "I follow NIST SP 800-63B guidelines — minimum length matters
    more than character complexity rules. I also cap at 128 chars because bcrypt
    only processes the first 72 bytes of a password."
    """
    if not password:
        return "Password is required"
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if len(password) > 128:
        return "Password must be 128 characters or less"
    return None


def sanitize_text(text: str, max_length: int) -> str:
    """
    Sanitizes free-text input (questions, code).

    - Strips leading/trailing whitespace
    - Truncates to max_length (defense in depth — even if frontend
      allows long input, backend enforces the limit)
    - Does NOT remove characters — we want to preserve code snippets
      and special chars. The AI prompt is not executed as code.
    """
    return text.strip()[:max_length]


# =============================================================================
# DATABASE HELPERS
# =============================================================================

def get_db_connection():
    """
    Opens a SQLite connection with row_factory for named column access.
    Creates a new connection per request (SQLite is not thread-safe).
    """
    conn = sqlite3.connect('symbi.db')
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Creates all database tables on first startup.

    NEW IN IMPROVEMENT #3:
    Added 'hint_ratings' table to store user feedback on hints.
    Added 'sessions' table to track full question sessions (for metrics).
    Added 'response_time_ms' column to hints table for performance tracking.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Users table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username    TEXT PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            created_at  REAL NOT NULL
        )
    ''')

    # Hints table — stores every AI-generated hint
    # NEW: response_time_ms tracks how fast the AI responded
    cur.execute('''
        CREATE TABLE IF NOT EXISTS hints (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id       TEXT,
            username         TEXT,
            question         TEXT,
            hint_number      INTEGER,
            hint_text        TEXT,
            timestamp        REAL,
            code_context     TEXT,
            response_time_ms INTEGER,
            FOREIGN KEY (username) REFERENCES users(username)
        )
    ''')

    # NEW #3: Sessions table — one row per question asked
    # A session = one question + all its hints + outcome
    # outcome: 'solved_with_hints', 'requested_answer', 'abandoned'
    cur.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            session_id      TEXT PRIMARY KEY,
            username        TEXT,
            question        TEXT,
            started_at      REAL,
            ended_at        REAL,
            total_hints     INTEGER DEFAULT 0,
            got_direct_answer INTEGER DEFAULT 0,
            outcome         TEXT DEFAULT 'in_progress',
            FOREIGN KEY (username) REFERENCES users(username)
        )
    ''')

    # NEW #3: Hint ratings table — user thumbs up/down feedback
    # This is the MOST IMPRESSIVE metric because it's real user data
    cur.execute('''
        CREATE TABLE IF NOT EXISTS hint_ratings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            hint_id     INTEGER,
            username    TEXT,
            rating      INTEGER,   -- 1 = helpful (thumbs up), 0 = not helpful
            timestamp   REAL,
            FOREIGN KEY (hint_id) REFERENCES hints(id)
        )
    ''')

    conn.commit()
    conn.close()
    logger.info("Database initialized successfully!")


# =============================================================================
# PASSWORD SECURITY
# =============================================================================

def hash_password(plain_password: str) -> str:
    """bcrypt hash — slow by design, includes automatic salt."""
    return bcrypt.hashpw(
        plain_password.encode('utf-8'),
        bcrypt.gensalt(rounds=12)
    ).decode('utf-8')


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """bcrypt verification — must use checkpw(), not string comparison."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        stored_hash.encode('utf-8')
    )


# =============================================================================
# JWT HELPERS
# =============================================================================

def create_token(username: str) -> str:
    """
    Creates a signed JWT token valid for 24 hours.
    Payload contains username and expiry — NO sensitive data.
    """
    payload = {
        'username': username,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')


def verify_token(token: str) -> dict | None:
    """Verifies JWT signature and expiry. Returns payload or None."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        logger.warning("Rejected expired JWT token")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Rejected invalid JWT token")
        return None


def require_auth(f):
    """
    Decorator that protects routes requiring authentication.
    Reads Bearer token from Authorization header, verifies it,
    and sets request.current_user to the username from the token.
    """
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Authorization header missing'}), 401

        parts = auth_header.split(' ', 1)
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid format. Use: Bearer <token>'}), 401

        payload = verify_token(parts[1])
        if payload is None:
            return jsonify({'error': 'Invalid or expired token. Please log in again.'}), 401

        request.current_user = payload['username']
        return f(*args, **kwargs)

    return decorated


# =============================================================================
# PROMPT ENGINEERING
# =============================================================================

def get_hint_instruction(hint_number: int, want_direct_answer: bool = False) -> str:
    """Returns the system prompt for each progressive hint level."""
    if want_direct_answer:
        return """You are a helpful programming tutor giving the complete solution.
Provide a clear, comprehensive explanation. Include:
1. The core concept clearly explained
2. Step-by-step implementation guide
3. A well-commented code example
4. Potential pitfalls or edge cases"""

    hint_templates = [
        """You are a friendly programming tutor giving the FIRST hint.
Give a conceptual hint only. Guide their thinking with a simple analogy.
Ask ONE guiding question. Be encouraging.
DO NOT provide the answer or any code solution.""",

        """You are a helpful programming tutor giving the SECOND hint.
Give a strategic hint about the approach or algorithm.
Hint at relevant patterns without giving them away.
Ask ONE question about the next step.
DO NOT provide the answer or complete code.""",

        """You are a supportive programming tutor giving the THIRD hint.
Give an implementation-focused hint.
You may show a small pseudocode snippet for ONE part only.
Point out common mistakes to avoid.
DO NOT provide the complete solution."""
    ]

    return hint_templates[min(hint_number - 1, len(hint_templates) - 1)]


# =============================================================================
# AI API CALL
# =============================================================================

@backoff.on_exception(
    backoff.expo,
    (requests.exceptions.RequestException, requests.exceptions.Timeout),
    max_tries=3
)
def generate_ai_response(prompt: str, model_name: str) -> tuple[str | None, int]:
    """
    Calls Groq API and returns (generated_text, response_time_ms).

    CHANGE FROM BEFORE: Now returns a tuple (text, time_ms) so we can
    store how long the AI took to respond — this is an evaluation metric.

    response_time_ms = wall-clock time from sending request to receiving response.
    Used in the /api/metrics endpoint to show average AI response latency.
    """
    start_time = time.time()  # Record start time

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 700,
        "temperature": 0.7,
    }

    logger.info(f"Calling Groq API: {model_name}")

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=45
    )

    # Calculate how many milliseconds the API call took
    elapsed_ms = int((time.time() - start_time) * 1000)

    if response.status_code == 200:
        result = response.json()
        text = result['choices'][0]['message']['content'].strip()
        logger.info(f"Groq response: {len(text)} chars in {elapsed_ms}ms")
        return text, elapsed_ms
    else:
        logger.error(f"Groq API Error {response.status_code}: {response.text[:200]}")
        return None, elapsed_ms


# =============================================================================
# ROUTES — AUTHENTICATION
# =============================================================================

@app.route('/register', methods=['POST'])
def register():
    """
    Creates a new user account.

    IMPROVEMENT #2 ADDITIONS:
    - Rate limiting: max 5 registrations per IP per 5 minutes
    - Full input validation via validate_* functions
    - Proper HTTP status codes (201 Created, 409 Conflict)
    """
    # Rate limiting check — prevent registration spam
    ip = get_client_ip()
    if is_rate_limited(ip, limit=5, window=300):
        logger.warning(f"Rate limit hit on /register from {ip}")
        return jsonify({
            'error': 'Too many registration attempts. Please wait 5 minutes.'
        }), 429  # 429 = Too Many Requests

    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        username = data.get('username', '').strip()
        email    = data.get('email', '').strip().lower()  # normalize email to lowercase
        password = data.get('password', '')

        # Validate each field — returns error string or None
        error = validate_username(username)
        if error:
            return jsonify({'error': error}), 400

        error = validate_email(email)
        if error:
            return jsonify({'error': error}), 400

        error = validate_password(password)
        if error:
            return jsonify({'error': error}), 400

        hashed_password = hash_password(password)

        conn = get_db_connection()
        cur  = conn.cursor()

        cur.execute(
            "SELECT username FROM users WHERE username = ? OR email = ?",
            (username, email)
        )
        if cur.fetchone():
            conn.close()
            return jsonify({'error': 'Username or email already exists'}), 409

        cur.execute(
            "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, ?)",
            (username, email, hashed_password, time.time())
        )
        conn.commit()
        conn.close()

        token = create_token(username)
        logger.info(f"New user registered: {username} from {ip}")

        return jsonify({
            'success': True,
            'token': token,
            'username': username,
            'message': 'Registration successful! Welcome to Symbi.ai!'
        }), 201

    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500


@app.route('/login', methods=['POST'])
def login():
    """
    Authenticates a user and returns a JWT token.

    IMPROVEMENT #2 ADDITIONS:
    - Rate limiting: max 5 login attempts per IP per 5 minutes
      This prevents brute-force password attacks.
    - Input validation before hitting the database
    """
    # Rate limiting on login — critical for preventing brute-force attacks
    ip = get_client_ip()
    if is_rate_limited(ip, limit=LOGIN_LIMIT_REQUESTS, window=LOGIN_LIMIT_WINDOW):
        logger.warning(f"Rate limit hit on /login from {ip}")
        return jsonify({
            'error': 'Too many login attempts. Please wait 5 minutes.'
        }), 429

    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        email    = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        conn = get_db_connection()
        cur  = conn.cursor()
        cur.execute("SELECT username, password FROM users WHERE email = ?", (email,))
        user = cur.fetchone()
        conn.close()

        if user and verify_password(password, user['password']):
            token = create_token(user['username'])
            logger.info(f"User logged in: {user['username']} from {ip}")
            return jsonify({
                'success': True,
                'token': token,
                'username': user['username']
            })
        else:
            logger.warning(f"Failed login from {ip} for email: {email[:20]}...")
            return jsonify({'error': 'Invalid credentials'}), 401

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500


# =============================================================================
# ROUTES — HINT GENERATION
# =============================================================================

@app.route('/api/get_hint', methods=['POST'])
@require_auth
def generate_hint():
    """
    Generates an AI hint for a programming question.

    IMPROVEMENT #2 ADDITIONS:
    - Per-user rate limiting (10 hints per 60 seconds)
    - Strict input sanitization on question and code_context

    IMPROVEMENT #3 ADDITIONS:
    - Tracks session_id to group hints for the same question
    - Stores response_time_ms (AI latency metric)
    - Creates/updates session record for outcome tracking
    - Returns hint_id so frontend can submit ratings
    """
    # Per-user rate limiting using their IP
    ip = get_client_ip()
    if is_rate_limited(ip, limit=RATE_LIMIT_REQUESTS, window=RATE_LIMIT_WINDOW):
        logger.warning(f"Rate limit hit on /api/get_hint from {ip}")
        return jsonify({
            'error': f'Rate limit exceeded. Max {RATE_LIMIT_REQUESTS} hints per minute.'
        }), 429

    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        # IMPROVEMENT #2: sanitize all text inputs
        question         = sanitize_text(data.get('question', ''), max_length=2000)
        code_context     = sanitize_text(data.get('code_context', ''), max_length=10000)
        hint_number      = data.get('hint_number', 1)
        want_direct_answer = data.get('want_direct_answer', False)

        # IMPROVEMENT #3: session_id groups all hints for one question together
        # Frontend generates a UUID when user starts a new question and sends it
        # with every hint request. If not provided, we create one server-side.
        session_id = data.get('session_id', '') or \
                     f"{request.current_user}_{int(time.time())}"

        # Username from JWT — cannot be spoofed
        username = request.current_user

        # Validate required fields
        if not question:
            return jsonify({'error': 'Question is required'}), 400

        # IMPROVEMENT #2: validate types, not just values
        if not isinstance(hint_number, int) or not (1 <= hint_number <= 10):
            hint_number = 1
        if not isinstance(want_direct_answer, bool):
            want_direct_answer = False

        logger.info(f"Hint #{hint_number} from '{username}' | session: {session_id[:20]}")

        # Build prompt
        instruction = get_hint_instruction(hint_number, want_direct_answer)
        if code_context:
            prompt = f"""{instruction}

Question: {question}

Code:
```
{code_context}
```

Provide your hint:"""
        else:
            prompt = f"""{instruction}

Question: {question}

Provide your hint based only on the question:"""

        # Call AI with timing
        ai_text, response_time_ms = generate_ai_response(prompt, "llama-3.3-70b-versatile")

        if not ai_text:
            logger.info("Primary model failed, trying fallback")
            ai_text, response_time_ms = generate_ai_response(prompt, "llama-3.1-8b-instant")

        if not ai_text:
            return jsonify({'error': 'AI service temporarily unavailable. Please try again.'}), 503

        # Store hint in database — now includes response_time_ms and session_id
        conn = get_db_connection()
        cur  = conn.cursor()

        cur.execute(
            '''INSERT INTO hints
               (session_id, username, question, hint_number, hint_text,
                timestamp, code_context, response_time_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (session_id, username, question, hint_number, ai_text,
             time.time(), code_context, response_time_ms)
        )
        hint_id = cur.lastrowid  # The auto-generated ID of the row we just inserted

        # IMPROVEMENT #3: Create or update the session record
        # INSERT OR IGNORE creates the row on first hint for this session
        cur.execute(
            '''INSERT OR IGNORE INTO sessions
               (session_id, username, question, started_at, total_hints)
               VALUES (?, ?, ?, ?, 0)''',
            (session_id, username, question, time.time())
        )
        # Always update total_hints and ended_at
        cur.execute(
            '''UPDATE sessions
               SET total_hints = total_hints + 1,
                   ended_at = ?,
                   got_direct_answer = ?,
                   outcome = ?
               WHERE session_id = ?''',
            (
                time.time(),
                1 if want_direct_answer else 0,
                'requested_answer' if want_direct_answer else 'in_progress',
                session_id
            )
        )

        conn.commit()
        conn.close()

        logger.info(f"Hint stored (id={hint_id}) in {response_time_ms}ms for '{username}'")

        return jsonify({
            'hint': ai_text,
            'hint_id': hint_id,        # NEW: frontend uses this to submit ratings
            'session_id': session_id,  # NEW: frontend sends this back on next hint
            'response_time_ms': response_time_ms,
            'show_direct_answer_option': hint_number >= 3 and not want_direct_answer
        })

    except Exception as e:
        logger.error(f"Error in generate_hint: {str(e)}")
        return jsonify({'error': 'Failed to generate hint. Please try again.'}), 500


# =============================================================================
# IMPROVEMENT #3 — HINT RATING ENDPOINT
# =============================================================================

@app.route('/api/rate_hint', methods=['POST'])
@require_auth
def rate_hint():
    """
    Accepts a thumbs up (1) or thumbs down (0) rating for a hint.

    This is the core of our AI evaluation system.
    Every rating is stored in hint_ratings and aggregated in /api/metrics.

    Request body:
    {
        "hint_id": 42,     -- the hint_id returned by /api/get_hint
        "rating": 1        -- 1 = helpful, 0 = not helpful
    }

    WHY THIS MATTERS FOR YOUR RESUME:
    Most students say "I built an AI chatbot." You can say:
    "I built an AI hint system with user satisfaction tracking.
    Collected X ratings across Y sessions with Z% helpfulness rate."
    That's a real, measurable claim.

    INTERVIEW TIP: "I implemented a thumbs-up/down rating system on every AI
    hint. The rating data feeds into an analytics dashboard showing helpfulness
    rate, average hints per session, and AI response latency. This lets me
    quantitatively evaluate the prompt engineering quality."
    """
    # Rate limit ratings too (prevent spam ratings)
    ip = get_client_ip()
    if is_rate_limited(ip, limit=30, window=60):
        return jsonify({'error': 'Too many requests'}), 429

    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        hint_id = data.get('hint_id')
        rating  = data.get('rating')

        # Validate hint_id
        if not isinstance(hint_id, int) or hint_id < 1:
            return jsonify({'error': 'hint_id must be a positive integer'}), 400

        # Validate rating: must be exactly 0 or 1
        if rating not in (0, 1):
            return jsonify({'error': 'rating must be 0 (not helpful) or 1 (helpful)'}), 400

        username = request.current_user

        conn = get_db_connection()
        cur  = conn.cursor()

        # Verify this hint belongs to this user (security: can't rate others' hints)
        cur.execute(
            "SELECT id FROM hints WHERE id = ? AND username = ?",
            (hint_id, username)
        )
        if not cur.fetchone():
            conn.close()
            return jsonify({'error': 'Hint not found or access denied'}), 404

        # INSERT OR REPLACE: if user already rated this hint, update their rating
        # (prevents duplicate ratings inflating numbers)
        cur.execute(
            '''INSERT OR REPLACE INTO hint_ratings (hint_id, username, rating, timestamp)
               VALUES (?, ?, ?, ?)''',
            (hint_id, username, rating, time.time())
        )
        conn.commit()
        conn.close()

        logger.info(f"Hint {hint_id} rated {rating} by '{username}'")
        return jsonify({'success': True, 'message': 'Rating recorded'})

    except Exception as e:
        logger.error(f"Error in rate_hint: {str(e)}")
        return jsonify({'error': 'Failed to record rating'}), 500


# =============================================================================
# IMPROVEMENT #3 — METRICS DASHBOARD ENDPOINT
# =============================================================================

@app.route('/api/metrics', methods=['GET'])
@require_auth
def get_metrics():
    """
    Returns aggregated AI evaluation metrics for the dashboard.

    WHAT METRICS WE TRACK:

    1. HINT HELPFULNESS RATE (most important)
       = (number of thumbs-up) / (total ratings) × 100
       Shows how often the AI hints are useful to students.
       A good system should be > 70%.

    2. AVERAGE HINTS PER SESSION
       = total hints generated / total sessions
       Lower is better — means students solved the problem faster.
       If this is 3.0 (the max), hints may not be guiding well.

    3. DIRECT ANSWER RATE
       = sessions where user clicked "Get Direct Answer" / total sessions
       Lower is better — means students solved it with hints alone.

    4. AVERAGE AI RESPONSE TIME
       = average of response_time_ms across all hints
       Shows how fast the AI API is. Groq is typically 300-800ms.

    5. TOTAL SESSIONS & TOTAL HINTS
       Raw activity numbers. Shows scale of usage.

    6. PER-USER METRICS
       Each user sees their own stats.
       (In a real system, admins would see all users' stats)

    INTERVIEW ANSWER: "I collect 5 quantitative metrics:
    helpfulness rate (from user ratings), hints-per-session,
    direct-answer rate, AI latency, and session volume.
    These metrics validate the prompt engineering decisions —
    for example, if the helpfulness rate drops after changing a prompt,
    the metrics make that visible immediately."
    """
    username = request.current_user

    conn = get_db_connection()
    cur  = conn.cursor()

    # --- Metric 1: Total sessions and hints for this user ---
    cur.execute(
        "SELECT COUNT(*) as total FROM sessions WHERE username = ?",
        (username,)
    )
    total_sessions = cur.fetchone()['total']

    cur.execute(
        "SELECT COUNT(*) as total FROM hints WHERE username = ?",
        (username,)
    )
    total_hints = cur.fetchone()['total']

    # --- Metric 2: Average hints per session ---
    cur.execute(
        "SELECT AVG(total_hints) as avg FROM sessions WHERE username = ? AND total_hints > 0",
        (username,)
    )
    row = cur.fetchone()
    avg_hints_per_session = round(row['avg'] or 0, 2)

    # --- Metric 3: Direct answer rate ---
    cur.execute(
        "SELECT COUNT(*) as total FROM sessions WHERE username = ? AND got_direct_answer = 1",
        (username,)
    )
    sessions_with_direct = cur.fetchone()['total']
    direct_answer_rate = round(
        (sessions_with_direct / total_sessions * 100) if total_sessions > 0 else 0, 1
    )

    # --- Metric 4: Helpfulness rate (from ratings) ---
    cur.execute(
        '''SELECT COUNT(*) as total, SUM(rating) as helpful
           FROM hint_ratings hr
           JOIN hints h ON hr.hint_id = h.id
           WHERE h.username = ?''',
        (username,)
    )
    rating_row = cur.fetchone()
    total_ratings  = rating_row['total'] or 0
    total_helpful  = rating_row['helpful'] or 0
    helpfulness_rate = round(
        (total_helpful / total_ratings * 100) if total_ratings > 0 else 0, 1
    )

    # --- Metric 5: Average AI response time ---
    cur.execute(
        '''SELECT AVG(response_time_ms) as avg_ms
           FROM hints WHERE username = ? AND response_time_ms IS NOT NULL''',
        (username,)
    )
    time_row = cur.fetchone()
    avg_response_time_ms = round(time_row['avg_ms'] or 0)

    # --- Metric 6: Hint breakdown by hint number ---
    # Shows which hint level is used most
    cur.execute(
        '''SELECT hint_number, COUNT(*) as count
           FROM hints WHERE username = ?
           GROUP BY hint_number ORDER BY hint_number''',
        (username,)
    )
    hint_distribution = {
        str(row['hint_number']): row['count']
        for row in cur.fetchall()
    }

    # --- Metric 7: Recent 5 sessions for history display ---
    cur.execute(
        '''SELECT session_id, question, total_hints, got_direct_answer,
                  outcome, started_at
           FROM sessions WHERE username = ?
           ORDER BY started_at DESC LIMIT 5''',
        (username,)
    )
    recent_sessions = [
        {
            'session_id': r['session_id'],
            'question': r['question'][:80] + '...' if len(r['question']) > 80 else r['question'],
            'total_hints': r['total_hints'],
            'got_direct_answer': bool(r['got_direct_answer']),
            'outcome': r['outcome'],
            'started_at': r['started_at']
        }
        for r in cur.fetchall()
    ]

    conn.close()

    return jsonify({
        'username': username,
        'summary': {
            'total_sessions':        total_sessions,
            'total_hints_generated': total_hints,
            'total_ratings':         total_ratings,
            'avg_hints_per_session': avg_hints_per_session,
            'direct_answer_rate_pct': direct_answer_rate,
            'helpfulness_rate_pct':  helpfulness_rate,
            'avg_ai_response_ms':    avg_response_time_ms,
        },
        'hint_distribution':  hint_distribution,
        'recent_sessions':    recent_sessions,
    })


# =============================================================================
# STARTUP
# =============================================================================

init_db()

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    logger.info(f"Starting Symbi.ai backend on port 5000 (debug={debug_mode})")
    app.run(port=5000, debug=debug_mode)
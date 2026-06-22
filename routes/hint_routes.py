# =============================================================================
# routes/hint_routes.py — Blueprint for /api/get_hint and /api/rate_hint
# =============================================================================
import time
import logging
from flask import Blueprint, request, jsonify, session
from models import db, Hint, Session, HintRating
from auth import require_auth
from rate_limiter import check_rate_limit, get_client_ip, HINT_LIMIT, HINT_WINDOW
from ai.chain import run_hint_graph

logger = logging.getLogger(__name__)

hint_bp = Blueprint('hints', __name__, url_prefix='/api')


@hint_bp.route('/get_hint', methods=['POST'])
@require_auth
def get_hint():
    ip = get_client_ip()
    limited, wait = check_rate_limit(ip, HINT_LIMIT, HINT_WINDOW)
    if limited:
        return jsonify({
            'error': f'Rate limit exceeded. Try again in {wait} seconds.',
            'retry_after': wait
        }), 429

    data               = request.json or {}
    question           = data.get('question', '').strip()[:2000]
    code               = data.get('code_context', '').strip()[:10000]
    hint_number        = data.get('hint_number', 1)
    want_direct_answer = data.get('want_direct_answer', False)
    session_id         = data.get('session_id') or \
                         f"{request.current_user}_{int(time.time())}"
    username           = request.current_user

    if not question:
        return jsonify({'error': 'Question is required'}), 400
    if not isinstance(hint_number, int) or not (1 <= hint_number <= 10):
        hint_number = 1

    # Run LangGraph hint state machine
    hint_text, response_time_ms = run_hint_graph(
        question=question,
        code=code,
        hint_number=hint_number,
        want_direct_answer=want_direct_answer,
    )

    if not hint_text:
        return jsonify({'error': 'AI service unavailable. Please try again.'}), 503

    # ORM: save hint
    hint = Hint(
        session_id=session_id,
        username=username,
        question=question,
        hint_number=hint_number,
        hint_text=hint_text,
        code_context=code,
        response_time_ms=response_time_ms,
    )
    db.session.add(hint)

    # ORM: upsert session
    session = Session.query.filter_by(session_id=session_id).first()
    if not session:
        session = Session(
            session_id=session_id,
            username=username,
            question=question,
        )
        db.session.add(session)

    session.total_hints        = (session.total_hints or 0) + 1
    session.ended_at           = time.time()
    session.got_direct_answer  = 1 if want_direct_answer else (session.got_direct_answer or 0)
    session.outcome            = 'requested_answer' if want_direct_answer else 'in_progress'

    db.session.commit()

    logger.info(f"Hint #{hint_number} for '{username}' in {response_time_ms}ms")

    return jsonify({
        'hint':                     hint_text,
        'hint_id':                  hint.id,
        'session_id':               session_id,
        'response_time_ms':         response_time_ms,
        'show_direct_answer_option': hint_number >= 3 and not want_direct_answer,
    })


@hint_bp.route('/rate_hint', methods=['POST'])
@require_auth
def rate_hint():
    data    = request.json or {}
    hint_id = data.get('hint_id')
    rating  = data.get('rating')
    username = request.current_user

    if not isinstance(hint_id, int) or hint_id < 1:
        return jsonify({'error': 'hint_id must be a positive integer'}), 400
    if rating not in (0, 1):
        return jsonify({'error': 'rating must be 0 or 1'}), 400

    # ORM: verify ownership
    hint = Hint.query.filter_by(id=hint_id, username=username).first()
    if not hint:
        return jsonify({'error': 'Hint not found or access denied'}), 404

    # Upsert rating (one rating per user per hint)
    existing = HintRating.query.filter_by(hint_id=hint_id, username=username).first()
    if existing:
        existing.rating = rating
    else:
        db.session.add(HintRating(hint_id=hint_id, username=username, rating=rating))

    db.session.commit()
    return jsonify({'success': True})
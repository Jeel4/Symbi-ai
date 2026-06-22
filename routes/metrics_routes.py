# =============================================================================
# routes/metrics_routes.py — Blueprint for /api/metrics
# =============================================================================
from flask import Blueprint, jsonify, request
from sqlalchemy import func
from models import db, Hint, Session, HintRating
from auth import require_auth

metrics_bp = Blueprint('metrics', __name__, url_prefix='/api')


@metrics_bp.route('/metrics', methods=['GET'])
@require_auth
def get_metrics():
    u = request.current_user

    # ORM aggregation queries using SQLAlchemy func
    total_sessions = Session.query.filter_by(username=u).count()
    total_hints    = Hint.query.filter_by(username=u).count()

    avg_hints_row = db.session.query(
        func.avg(Session.total_hints)
    ).filter(Session.username == u, Session.total_hints > 0).scalar()
    avg_hints = round(float(avg_hints_row or 0), 2)

    direct_count  = Session.query.filter_by(username=u, got_direct_answer=1).count()
    direct_rate   = round((direct_count / total_sessions * 100) if total_sessions else 0, 1)

    rating_row = db.session.query(
        func.count(HintRating.id),
        func.sum(HintRating.rating)
    ).join(Hint, HintRating.hint_id == Hint.id)\
     .filter(Hint.username == u).first()

    total_ratings  = rating_row[0] or 0
    total_helpful  = rating_row[1] or 0
    helpfulness    = round((total_helpful / total_ratings * 100) if total_ratings else 0, 1)

    avg_ms_row = db.session.query(
        func.avg(Hint.response_time_ms)
    ).filter(Hint.username == u, Hint.response_time_ms.isnot(None)).scalar()
    avg_ms = round(float(avg_ms_row or 0))

    dist_rows = db.session.query(
        Hint.hint_number, func.count(Hint.id)
    ).filter(Hint.username == u)\
     .group_by(Hint.hint_number).all()
    hint_dist = {str(r[0]): r[1] for r in dist_rows}

    recent = Session.query.filter_by(username=u)\
                   .order_by(Session.started_at.desc()).limit(5).all()
    recent_sessions = [{
        'session_id':        s.session_id,
        'question':          s.question[:80] + '…' if len(s.question) > 80 else s.question,
        'total_hints':       s.total_hints,
        'got_direct_answer': bool(s.got_direct_answer),
        'outcome':           s.outcome,
        'started_at':        s.started_at,
    } for s in recent]

    return jsonify({
        'username': u,
        'summary': {
            'total_sessions':         total_sessions,
            'total_hints_generated':  total_hints,
            'total_ratings':          total_ratings,
            'avg_hints_per_session':  avg_hints,
            'direct_answer_rate_pct': direct_rate,
            'helpfulness_rate_pct':   helpfulness,
            'avg_ai_response_ms':     avg_ms,
        },
        'hint_distribution': hint_dist,
        'recent_sessions':   recent_sessions,
    })
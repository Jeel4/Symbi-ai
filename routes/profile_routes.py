# =============================================================================
# routes/profile_routes.py — Blueprint for /api/profile
# =============================================================================
import logging
from flask import Blueprint, request, jsonify
from models import db, User, Hint, Session
from auth import require_auth, hash_password, verify_password

logger = logging.getLogger(__name__)
profile_bp = Blueprint('profile', __name__, url_prefix='/api')


@profile_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    """
    Returns the current user's profile data.
    Includes account info + summary stats for the profile page.
    """
    username = request.current_user
    user     = User.query.filter_by(username=username).first()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    total_hints    = Hint.query.filter_by(username=username).count()
    total_sessions = Session.query.filter_by(username=username).count()

    return jsonify({
        **user.to_dict(),
        'total_hints':    total_hints,
        'total_sessions': total_sessions,
    })


@profile_bp.route('/profile', methods=['PATCH'])
@require_auth
def update_profile():
    """
    Updates bio and/or avatar_url.
    PATCH means partial update — only fields sent get changed.
    """
    username = request.current_user
    user     = User.query.filter_by(username=username).first()
    data     = request.json or {}

    if 'bio' in data:
        user.bio = str(data['bio'])[:300]
    if 'avatar_url' in data:
        user.avatar_url = str(data['avatar_url'])[:500]

    db.session.commit()
    return jsonify({'success': True, 'message': 'Profile updated'})


@profile_bp.route('/profile/change-password', methods=['POST'])
@require_auth
def change_password():
    """
    Changes user password after verifying the current one.
    Security: user must know their current password to set a new one.
    """
    username     = request.current_user
    user         = User.query.filter_by(username=username).first()
    data         = request.json or {}
    current_pass = data.get('current_password', '')
    new_pass     = data.get('new_password', '')

    if not verify_password(current_pass, user.password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    if len(new_pass) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400

    user.password = hash_password(new_pass)
    db.session.commit()
    logger.info(f"Password changed for {username}")
    return jsonify({'success': True, 'message': 'Password updated successfully'})
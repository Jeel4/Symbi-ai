from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    username   = db.Column(db.String(30),  primary_key=True)
    email      = db.Column(db.String(254), unique=True, nullable=False)
    password   = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.Float, nullable=False,
                           default=lambda: datetime.now(timezone.utc).timestamp())
    bio        = db.Column(db.String(300), nullable=True)
    hints        = db.relationship('Hint',       back_populates='user', cascade='all, delete-orphan')
    sessions     = db.relationship('Session',    back_populates='user', cascade='all, delete-orphan')
    hint_ratings = db.relationship('HintRating', back_populates='user', cascade='all, delete-orphan')
    def to_dict(self):
        return {'username': self.username, 'email': self.email, 'bio': self.bio, 'created_at': self.created_at}

class Hint(db.Model):
    __tablename__ = 'hints'
    id               = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id       = db.Column(db.String(100))
    username         = db.Column(db.String(30), db.ForeignKey('users.username'), nullable=False)
    question         = db.Column(db.Text, nullable=False)
    hint_number      = db.Column(db.Integer, nullable=False)
    hint_text        = db.Column(db.Text, nullable=False)
    timestamp        = db.Column(db.Float, default=lambda: datetime.now(timezone.utc).timestamp())
    code_context     = db.Column(db.Text)
    response_time_ms = db.Column(db.Integer)
    user    = db.relationship('User', back_populates='hints')
    ratings = db.relationship('HintRating', back_populates='hint', cascade='all, delete-orphan')

class Session(db.Model):
    __tablename__ = 'sessions'
    session_id        = db.Column(db.String(100), primary_key=True)
    username          = db.Column(db.String(30), db.ForeignKey('users.username'), nullable=False)
    question          = db.Column(db.Text, nullable=False)
    started_at        = db.Column(db.Float, default=lambda: datetime.now(timezone.utc).timestamp())
    ended_at          = db.Column(db.Float)
    total_hints       = db.Column(db.Integer, default=0)
    got_direct_answer = db.Column(db.Integer, default=0)
    outcome           = db.Column(db.String(30), default='in_progress')
    user = db.relationship('User', back_populates='sessions')

class HintRating(db.Model):
    __tablename__ = 'hint_ratings'
    id        = db.Column(db.Integer, primary_key=True, autoincrement=True)
    hint_id   = db.Column(db.Integer, db.ForeignKey('hints.id'), nullable=False)
    username  = db.Column(db.String(30), db.ForeignKey('users.username'), nullable=False)
    rating    = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.Float, default=lambda: datetime.now(timezone.utc).timestamp())
    hint = db.relationship('Hint', back_populates='ratings')
    user = db.relationship('User', back_populates='hint_ratings')
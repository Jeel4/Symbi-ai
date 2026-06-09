<div align="center">

# symbi.ai

**A Socratic AI tutor that teaches through progressive hints, not instant answers.**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat&logo=flask)](https://flask.palletsprojects.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=flat)](https://groq.com)

[Live Demo](https://symbi-ai.vercel.app) · [Report Bug](../../issues)

</div>

---

## What is Symbi.ai?

Most AI tools give you the answer immediately. Symbi.ai doesn't.

Inspired by the **Socratic method**, it delivers **three calibrated, progressive hints** before revealing a direct answer. Each hint goes one layer deeper — first conceptual, then strategic, then implementation-level. Students who struggle productively retain solutions longer and build stronger problem-solving instincts.

The system tracks learning patterns, measures hint helpfulness through explicit user ratings, and surfaces analytics in a personal dashboard.

---

## Features

| Feature | Details |
|---|---|
| **Progressive hints** | 3-level Socratic hint system (conceptual → strategic → implementation) |
| **LLaMA 3.3 70B** | Primary model via Groq API (~400–800ms avg response time) |
| **Automatic fallback** | LLaMA 3.1 8B fallback with exponential backoff (3 retries) |
| **JWT authentication** | Stateless auth, 24-hour token expiry, 176-bit secret entropy |
| **bcrypt passwords** | Cost-factor 12 — 400,000× harder to crack than SHA-256 |
| **Rate limiting** | 10 hints/min per IP; 5 login attempts/5 min (brute-force protection) |
| **AI evaluation metrics** | Helpfulness rate, avg hints/session, direct-answer rate, AI latency |
| **User ratings** | Thumbs up/down on every hint feeds real-time analytics dashboard |
| **Session tracking** | Full session lifecycle stored across 4 relational SQLite tables |

---

## Tech Stack

**Frontend:** React 18, React Router v7, Custom CSS design system, DM Mono + DM Sans

**Backend:** Python, Flask, SQLite, bcrypt (cost=12), PyJWT, python-dotenv

**AI:** Groq API — LLaMA 3.3 70B (primary), LLaMA 3.1 8B (fallback)

---

## Getting Started

### Prerequisites
- Python 3.10+, Node.js 18+
- Free [Groq API key](https://console.groq.com)

### Setup

```bash
# 1. Clone
git clone https://github.com/Jeel4/symbi-ai.git
cd symbi-ai

# 2. Backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your GROQ_API_KEY and JWT_SECRET_KEY
python app.py

# 3. Frontend (new terminal)
cd frontend
npm install
npm start
```

Generate a secure JWT secret key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Project Structure

```
symbi-ai/
├── app.py                   # Flask backend — routes, AI logic, metrics
├── requirements.txt
├── .env.example             # Template — never commit .env
├── .gitignore
└── frontend/
    └── src/
        ├── App.jsx              # Root component, lifted conversation state
        ├── design-system.css    # Design tokens + global styles
        ├── components/Logo.jsx
        └── pages/
            ├── Login.jsx
            ├── SignUp.jsx
            ├── HintGenerator.jsx    # Chat interface
            └── MetricsDashboard.jsx # Analytics dashboard
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | None | Create account |
| POST | `/login` | None | Authenticate → JWT token |
| POST | `/api/get_hint` | Bearer JWT | Generate progressive hint |
| POST | `/api/rate_hint` | Bearer JWT | Submit helpfulness rating |
| GET | `/api/metrics` | Bearer JWT | Fetch personal analytics |

---

## Security

| Concern | Solution |
|---|---|
| Password storage | bcrypt cost=12 (~250ms/hash, 400,000× harder than SHA-256) |
| Authentication | JWT HS256, 24h expiry, verified via Python decorator on all protected routes |
| Brute force | 5 login attempts per 5 min per IP |
| API abuse | 10 requests per 60s per IP (sliding window algorithm) |
| Secrets | python-dotenv, never committed to version control |
| Input | Length limits + type validation on all endpoints |

---

## License

MIT — Built by [Jeel Patel](https://github.com/YOUR_USERNAME) · SIT Pune, 2025
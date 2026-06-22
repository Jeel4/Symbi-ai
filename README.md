<div align="center">

# Symbi.ai

**A Socratic AI tutor that teaches through progressive hints, not instant answers.**

[![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat&logo=flask)](https://flask.palletsprojects.com)
[![LangChain](https://img.shields.io/badge/LangChain-LCEL-1C3C3C?style=flat)](https://langchain.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-State_Machine-1C3C3C?style=flat)](https://langchain-ai.github.io/langgraph)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=flat)](https://groq.com)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat&logo=vercel)](https://vercel.com)
[![Deployed on Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat)](https://render.com)

[Live Demo](https://symbi-ai-7ng5.vercel.app) · [Report Bug](../../issues)

</div>

---

## What is Symbi.ai?

Most AI tools give you the answer immediately. Symbi.ai doesn't.

Inspired by the **Socratic method**, it delivers **three calibrated, progressive hints** before revealing a direct answer. Each hint goes one layer deeper - first conceptual, then strategic, then implementation-level. Students who struggle productively retain solutions longer and build stronger problem-solving instincts.

The system tracks learning patterns, measures hint helpfulness through explicit user ratings, and surfaces analytics in a personal dashboard.

> **Note:** Backend is hosted on Render free tier. First request after inactivity may take ~30 seconds to wake up. A cron job pings `/health` every 14 minutes to minimize cold starts.

---

## Features

| Feature | Details |
|---|---|
| **Progressive hints** | 3-level Socratic hint system (conceptual → strategic → implementation) |
| **LangGraph state machine** | Progressive hint flow modelled as a typed state graph with nodes and conditional edges |
| **LangChain LCEL** | Prompt composition via `prompt \| llm \| parser` pipeline |
| **LLaMA 3.3 70B** | Primary model via Groq API (~400–800ms avg response time) |
| **Automatic fallback** | LLaMA 3.1 8B fallback with exponential backoff (3 retries) |
| **JWT authentication** | Stateless auth, 24-hour token expiry, 176-bit secret entropy |
| **bcrypt passwords** | Cost-factor 12 — 400,000× harder to crack than SHA-256 |
| **localStorage persistence** | Auth state survives page refresh — no surprise logouts |
| **Rate limiting** | 10 hints/min per IP; 10 login attempts/15 min (sliding window algorithm) |
| **Rate limit countdown** | Frontend shows live countdown timer when rate limited |
| **AI evaluation metrics** | Helpfulness rate, avg hints/session, direct-answer rate, AI latency |
| **User ratings** | Thumbs up/down on every hint feeds real-time analytics dashboard |
| **Session tracking** | Full session lifecycle stored across 4 relational tables |
| **Profile page** | Edit bio, change password, view personal stats |
| **Health endpoint** | GET /health returns DB status + uptime for monitoring |
| **Cron job** | Pings /health every 14 minutes to prevent Render cold starts |

---

## Tech Stack

**Frontend**
- React 18, React Router v7
- Custom CSS design system (zero UI framework dependency)
- DM Mono + DM Sans typography
- localStorage auth persistence

**Backend**
- Python 3.13, Flask 3.x
- Flask Blueprints (auth, hints, metrics, profile)
- SQLAlchemy ORM + Flask-Migrate
- SQLite (dev) / PostgreSQL-ready (prod)
- bcrypt (cost=12), PyJWT, python-dotenv

**AI**
- LangChain LCEL chains
- LangGraph typed state machine
- Groq API — LLaMA 3.3 70B (primary), LLaMA 3.1 8B (fallback)

**Infrastructure**
- Frontend: Vercel (auto-deploy on push)
- Backend: Render (Python 3, gunicorn)
- Uptime: cron-job.org (pings /health every 14 min)

---

## Project Structure

```
symbi-ai/
├── app.py                    # Application factory — registers blueprints
├── models.py                 # SQLAlchemy ORM models
├── auth.py                   # JWT helpers + require_auth decorator
├── rate_limiter.py           # Sliding window rate limiter
├── requirements.txt
├── .env.example
├── .gitignore
├── render.yaml               # Render deployment config
├── migrations/               # Flask-Migrate schema versions
├── ai/
│   └── chain.py              # LangChain LCEL + LangGraph state machine
├── routes/
│   ├── auth_routes.py        # /register, /login
│   ├── hint_routes.py        # /api/get_hint, /api/rate_hint
│   ├── metrics_routes.py     # /api/metrics
│   └── profile_routes.py     # /api/profile
└── frontend/
    └── src/
        ├── App.jsx               # Root — lifted conversation state + localStorage
        ├── design-system.css     # Design tokens + global styles
        ├── components/
        │   ├── Logo.jsx
        │   └── Sidebar.jsx       # Shared sidebar with session history
        └── pages/
            ├── Login.jsx         # Rate limit countdown timer
            ├── SignUp.jsx
            ├── HintGenerator.jsx # Main chat interface
            ├── MetricsDashboard.jsx
            └── Profile.jsx       # Edit bio, change password
```

---

## Getting Started

### Prerequisites
- Python 3.13+, Node.js 18+
- Free [Groq API key](https://console.groq.com)

### Setup

```bash
# 1. Clone
git clone https://github.com/Jeel4/Symbi-ai.git
cd Symbi-ai

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Create environment file
cp .env.example .env
# Edit .env — add your GROQ_API_KEY and JWT_SECRET_KEY

# 4. Initialize database
flask db init
flask db migrate -m "initial schema"
flask db upgrade

# 5. Start backend
python app.py

# 6. Start frontend (new terminal)
cd frontend
npm install
npm start
```

Generate a secure JWT secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | None | Create account |
| POST | `/login` | None | Authenticate → JWT token |
| POST | `/api/get_hint` | Bearer JWT | Generate progressive hint via LangGraph |
| POST | `/api/rate_hint` | Bearer JWT | Submit helpfulness rating |
| GET | `/api/metrics` | Bearer JWT | Fetch personal analytics |
| PATCH | `/api/profile` | Bearer JWT | Update bio / avatar |
| POST | `/api/profile/change-password` | Bearer JWT | Change password |
| GET | `/health` | None | Health check — DB status + uptime |

---

## Security

| Concern | Solution |
|---|---|
| Password storage | bcrypt cost=12 (~250ms/hash, 400,000× harder than SHA-256) |
| Authentication | JWT HS256, 24h expiry, 176-bit entropy, verified via decorator |
| Brute force | 10 login attempts per 15 min per IP |
| API abuse | 10 hints per 60s per IP (sliding window rate limiter) |
| Rate limit UX | Frontend countdown timer shows exact seconds to retry |
| Secrets | python-dotenv — never committed to version control |
| Input validation | Length limits + type checks on all endpoints |
| Auth persistence | localStorage with lazy useState initializer |

---

## AI Architecture

```
User question
      ↓
LangGraph State Machine (HintState)
      ↓
hint_node() — calls LangChain LCEL chain
      ↓
  prompt | ChatGroq(llama-3.3-70b) | StrOutputParser
      ↓
should_continue() — conditional edge
      ↓
    END → hint text returned to user
```

**Fallback chain:** If LLaMA 3.3 70B fails → automatically retries with LLaMA 3.1 8B

---

## License

MIT — Built by [Jeel Patel](https://github.com/Jeel4) · SIT Pune, 2026
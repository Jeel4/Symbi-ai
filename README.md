# Symbi.ai - AI-Powered Programming Assistant

An intelligent programming assistant that provides progressive hints and explanations for coding questions. The system uses advanced language models to generate contextual hints and direct answers based on user questions and code context.

## Project Structure

```
.
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   ├── pages/         # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── SignUp.jsx
│   │   │   └── HintGenerator.jsx
│   │   └── theme.js       # UI theme configuration
│   └── package.json
├── app.py                 # Flask backend server
├── symbi.db              # SQLite database
└── requirements.txt      # Python dependencies
```

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend server:
```bash
python app.py
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

3. The application will be available at http://localhost:3000

## Features

- Progressive hint system (up to 3 hints per question)
- Direct answer option after 3 hints
- User authentication (login/signup)
- Code context support
- Dark/Light mode toggle
- Responsive UI with Chakra UI
- Automatic category detection for questions
- Fallback model support for reliability

## Usage

1. Sign up or log in to your account
2. Enter your programming question
3. Optionally provide relevant code context
4. Click "Get Hint" to receive progressive hints
5. After 3 hints, you can request a direct answer

## Technologies Used

- Frontend: React, Chakra UI
- Backend: Flask, SQLite
- AI Models: 
  - Primary: LLaMA-2-70B (via Together API)
  - Fallback: Mixtral-8x7B (via Together API)
- Authentication: Custom implementation with password hashing
- Database: SQLite for user data and hint history

## Hint Categories

The system automatically detects and categorizes questions into:
- Code Understanding & Debugging
- Code Writing & Implementation
- Logic & Problem-Solving
- Conceptual Questions
- Syntax Help
- Testing & Validation
- Web Development
- DBMS & Data Structures
- Interview Practice / DSA
- ELI5 (Explain Like I'm 5)
- Collaboration & GitHub

## Error Handling

- Exponential backoff retry for API calls
- Fallback model support
- Comprehensive error logging
- User-friendly error messages 
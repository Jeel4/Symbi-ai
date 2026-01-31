from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
import time
import requests
import os
import json
import backoff  # For exponential backoff retry
import logging
from datetime import datetime
import secrets

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Key for Together API
TOGETHER_API_KEY = "34d8027c0659700005e01f9548f9933740aa0911f55a5e4b45cf6c8f67b084d3"

CATEGORY_PROMPTS = {
    "debug": {
        "name": "Code Understanding & Debugging",
        "prompt": """You are an expert debugging mentor. A student needs help with their code.

Question: {question}
Code: {code_context}

{instruction}

Focus on:
1. Identifying bugs and issues
2. Explaining the root cause
3. Suggesting fixes with explanations
4. Providing best practices
5. Teaching debugging techniques"""
    },
    
    "implement": {
        "name": "Code Writing & Implementation",
        "prompt": """You are an experienced programming mentor. A student needs help implementing code.

Question: {question}
Context: {code_context}

{instruction}

Focus on:
1. Breaking down the problem
2. Providing a clear implementation approach
3. Explaining key concepts
4. Including code examples
5. Suggesting optimizations"""
    },
    
    "logic": {
        "name": "Logic & Problem-Solving",
        "prompt": """You are a problem-solving expert. A student needs help with algorithm design.

Question: {question}
Context: {code_context}

{instruction}

Focus on:
1. Problem breakdown
2. Algorithm design
3. Efficiency considerations
4. Edge cases
5. Testing strategies"""
    },
    
    "concept": {
        "name": "Conceptual Questions",
        "prompt": """You are a computer science professor. A student needs help understanding a concept.

Question: {question}

{instruction}

Focus on:
1. Clear explanations
2. Real-world analogies
3. Practical examples
4. Common misconceptions
5. Building on fundamentals"""
    },
    
    "syntax": {
        "name": "Conversions & Syntax Help",
        "prompt": """You are a programming language expert. A student needs help with syntax.

Question: {question}
Code: {code_context}

{instruction}

Focus on:
1. Correct syntax rules
2. Language-specific conventions
3. Common pitfalls
4. Best practices
5. Code readability"""
    },
    
    "test": {
        "name": "Testing & Validation",
        "prompt": """You are a software testing expert. A student needs help with testing.

Question: {question}
Code: {code_context}

{instruction}

Focus on:
1. Test case design
2. Testing methodologies
3. Edge cases
4. Test code examples
5. Validation techniques"""
    },
    
    "web": {
        "name": "Web Development",
        "prompt": """You are a web development expert. A student needs help with web technologies.

Question: {question}
Code: {code_context}

{instruction}

Focus on:
1. Web development best practices
2. Frontend/Backend concepts
3. Security considerations
4. Performance optimization
5. Modern web standards"""
    },
    
    "data": {
        "name": "DBMS & Data Structures",
        "prompt": """You are a data structures and database expert. A student needs help with data management.

Question: {question}
Code: {code_context}

{instruction}

Focus on:
1. Data structure selection
2. Algorithm efficiency
3. Database concepts
4. Query optimization
5. Best practices"""
    },
    
    "dsa": {
        "name": "Interview Practice / DSA",
        "prompt": """You are an interview preparation expert. A student needs help with DSA practice.

Question: {question}
Code: {code_context}

{instruction}

Focus on:
1. Problem-solving approach
2. Time/Space complexity
3. Optimization techniques
4. Interview strategies
5. Common patterns"""
    },
    
    "eli5": {
        "name": "ELI5 (Explain Like I'm 5)",
        "prompt": """You are a teacher skilled at explaining complex concepts in simple terms.

Question: {question}

{instruction}

Focus on:
1. Simple analogies
2. Real-world examples
3. Visual descriptions
4. Step-by-step breakdowns
5. Engaging explanations"""
    },
    
    "github": {
        "name": "Collaboration & GitHub",
        "prompt": """You are a Git and collaboration expert. A student needs help with version control.

Question: {question}
Context: {code_context}

{instruction}

Focus on:
1. Git commands and workflow
2. Collaboration best practices
3. Problem resolution
4. Project management
5. Code review tips"""
    }
}

def detect_category(question, code_context=""):
    """Detect the most appropriate category based on the question and code context"""
    question_lower = question.lower()
    
    # Keywords for each category
    keywords = {
        "debug": ["error", "bug", "fix", "wrong", "issue", "debug", "problem", "not working"],
        "implement": ["implement", "create", "write", "build", "develop", "make", "code for"],
        "logic": ["algorithm", "logic", "solve", "approach", "solution", "optimize"],
        "concept": ["what is", "how does", "explain", "understand", "concept", "mean", "difference between"],
        "syntax": ["syntax", "convert", "change", "transform", "format", "correct way"],
        "test": ["test", "validate", "verify", "check", "assert", "unit test"],
        "web": ["html", "css", "javascript", "api", "web", "frontend", "backend", "http"],
        "data": ["database", "sql", "data structure", "array", "list", "tree", "graph"],
        "dsa": ["interview", "leetcode", "complexity", "efficient", "optimize"],
        "eli5": ["explain like", "simple terms", "basic", "beginner"],
        "github": ["git", "github", "merge", "branch", "commit", "pull request"]
    }
    
    # Score each category
    scores = {category: 0 for category in keywords}
    
    for category, words in keywords.items():
        for word in words:
            if word in question_lower:
                scores[category] += 1
                
    # Add points based on code context
    if code_context:
        if "error" in code_context.lower() or "exception" in code_context.lower():
            scores["debug"] += 2
        if "test" in code_context.lower():
            scores["test"] += 2
        if "<html" in code_context.lower() or "css" in code_context.lower():
            scores["web"] += 2
            
    # Get category with highest score
    max_score = max(scores.values())
    if max_score == 0:
        return "concept"  # Default to conceptual if no clear category
        
    return max(scores.items(), key=lambda x: x[1])[0]

def get_hint_instruction(hint_number, want_direct_answer=False):
    if want_direct_answer:
        # Instruction for the complete solution
        return """You are a helpful programming tutor. The student wants the complete solution now.
Provide a clear, comprehensive explanation in English. Make sure to:
1. Explain the core concept clearly.
2. Give a step-by-step guide for implementation.
3. Include a well-commented code example.
4. Mention potential pitfalls or edge cases.
5. Ensure the explanation is practical and easy to follow."""

    # Instructions for progressive hints
    hint_templates = [
        # Hint 1: Conceptual Kickstart
        """You are a friendly programming tutor. The student needs their first hint.
Provide a conceptual hint in English. Your goal is to gently guide their thinking.
- Focus on the main idea or principle involved.
- Use a simple analogy or real-world example.
- Ask a guiding question to spark their thinking (e.g., 'What if you thought about it like...?').
- Keep the tone encouraging. Ensure the hint is complete.
- **Crucially: DO NOT provide the final answer, output, or complete code solution.**""",

        # Hint 2: Strategic Direction
        """You are a helpful programming tutor. The student needs a second hint.
Provide a more strategic hint in English, focusing on the approach or process.
- Suggest a general strategy or a way to break down the problem (e.g., how to trace code execution).
- Hint at relevant algorithms, data structures, or patterns without naming them explicitly if possible.
- Ask a guiding question to prompt them on the next step (e.g., 'What happens in the first iteration of the loop?', 'How might you track the variables?').
- Maintain an encouraging tone. Ensure the hint is complete.
- **Crucially: DO NOT provide the final answer, output, or complete code solution. Focus on the *how*, not the *what*.**""",

        # Hint 3: Implementation Nudge
        """You are a supportive programming tutor. The student needs a third hint.
Provide a hint focused on implementation details or a specific tricky part in English.
- Suggest a specific technique, function, or code structure that might be useful *without* giving the whole structure.
- Offer a small piece of pseudocode for a *part* of the logic, or point towards potential errors.
- Point towards potential tricky parts or common mistakes related to the implementation.
- Ask a question to make them think about specifics (e.g., 'How would you handle edge cases like...? ', 'What is the exact condition for the inner loop?').
- Be encouraging. Ensure the hint is detailed enough to be useful.
- **Crucially: DO NOT provide the final answer, output, or the complete code solution. Guide them on refining their implementation.**"""
    ]

    # Select the appropriate hint template
    if hint_number <= len(hint_templates):
        return hint_templates[hint_number - 1]
    else:
        # Fallback for hints beyond the defined templates
        return hint_templates[-1] # Return the last defined hint style

def get_db_connection():
    conn = sqlite3.connect('symbi.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists('symbi.db'):
        print("Initializing database...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS hints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                question TEXT,
                hint_number INTEGER,
                hint_text TEXT,
                timestamp REAL,
                code_context TEXT
            )
        ''')
        conn.commit()
        conn.close()
        print("Database initialized successfully!")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@backoff.on_exception(
    backoff.expo,
    (requests.exceptions.RequestException, requests.exceptions.Timeout),
    max_tries=3
)
def generate_ai_response(prompt, model_name):
    """Generate AI response with exponential backoff retry."""
    try:
        payload = {
            "model": model_name,
            "prompt": prompt,
            "max_tokens": 700,
            "temperature": 0.7,
            "top_p": 0.7,
            "stop": ["</s>", "Human:", "Assistant:"]
        }
        
        logger.info(f"Sending request to {model_name} with prompt: {prompt[:100]}...")
        response = requests.post(
            "https://api.together.xyz/v1/completions",
            headers={
                "Authorization": f"Bearer {TOGETHER_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=45
        )
        
        if response.status_code == 200:
            result = response.json()
            generated_text = result['choices'][0]['text'].strip()
            logger.info(f"Received successful response from {model_name}")
            return generated_text
        else:
            logger.error(f"API Error from {model_name}: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Error generating response with {model_name}: {str(e)}")
        raise

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        if not data or 'username' not in data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Missing required fields'}), 400

        username = data['username']
        email = data['email']
        password = hash_password(data['password'])

        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, email))
        if cur.fetchone():
            conn.close()
            return jsonify({'error': 'Username or email already exists'}), 400

        cur.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
                   (username, email, password))
        conn.commit()
        conn.close()

        # Removed welcome email sending
        
        return jsonify({'success': True, 'message': 'Registration successful. Welcome to Symbi.ai!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/verify/<token>', methods=['GET'])
def verify_email(token):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT username FROM users WHERE verification_token = ?", (token,))
        user = cur.fetchone()
        
        if user:
            cur.execute("UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ?", (token,))
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': 'Email verified successfully'})
        else:
            conn.close()
            return jsonify({'error': 'Invalid or expired verification token'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Missing email or password'}), 400

        email = data['email']
        password = hash_password(data['password'])

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT username FROM users WHERE email = ? AND password = ?", (email, password))
        user = cur.fetchone()
        conn.close()

        if user:
            return jsonify({'success': True, 'username': user['username']})
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_hint', methods=['POST'])
@app.route('/generate_hint', methods=['POST'])  # Add support for old endpoint
def generate_hint():
    try:
        data = request.json
        logger.info(f"Received hint request: {data}")
        
        # Add CORS headers
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
            return ('', 204, headers)

        # Set CORS headers for the main request
        headers = {'Access-Control-Allow-Origin': '*'}
        
        question = data.get('question', '')
        code_context = data.get('code_context', '')
        hint_number = data.get('hint_number', 1)
        want_direct_answer = data.get('want_direct_answer', False)
        username = data.get('username', '')  # Get username from request
        
        if not question:
            return jsonify({"error": "Question is required"}), 400, headers
            
        # Prepare the prompt
        instruction = get_hint_instruction(hint_number, want_direct_answer)
        prompt = f"""You are a helpful coding assistant. Based on the following question and code, {instruction}

Question: {question}

Code:
```
{code_context}
```

Provide your hint:""" if code_context else f"""You are a helpful coding assistant. The student asked the following question but provided no code. {instruction}

Question: {question}

No code provided.

Provide your hint based only on the question:"""

        # Try primary model first
        logger.info(f"Attempting to generate hint with togethercomputer/llama-2-70b-chat")
        response = generate_ai_response(prompt, "togethercomputer/llama-2-70b-chat")
        
        # If primary model fails, try fallback model
        if not response:
            logger.info(f"Falling back to mistralai/Mixtral-8x7B-Instruct-v0.1")
            response = generate_ai_response(prompt, "mistralai/Mixtral-8x7B-Instruct-v0.1")
            
        if not response:
            return jsonify({"error": "Failed to generate hint"}), 500, headers
            
        # Store the hint in the database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO hints (username, question, hint_number, hint_text, timestamp, code_context)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            username,
            question,
            hint_number,
            response,
            time.time(),
            code_context
        ))
        conn.commit()
        conn.close()
            
        # Log successful hint generation
        logger.info("Successfully generated and stored hint")
        return jsonify({
            "hint": response,
            "show_direct_answer_option": hint_number >= 3 and not want_direct_answer
        }), 200, headers
        
    except Exception as e:
        logger.error(f"Error in generate_hint: {str(e)}")
        return jsonify({"error": f"Failed to generate hint: {str(e)}"}), 500, headers

init_db()

if __name__ == '__main__':
    app.run(port=5000, debug=True) 
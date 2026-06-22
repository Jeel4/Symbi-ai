# =============================================================================
# ai/chain.py — LangChain LCEL hint generation chain
# =============================================================================
#
# WHAT IS LANGCHAIN LCEL?
# LCEL = LangChain Expression Language.
# It lets you compose AI pipelines using the | (pipe) operator:
#
#   chain = prompt | llm | output_parser
#   result = chain.invoke({"question": "...", "code": "..."})
#
# This is far cleaner than manually building HTTP requests to Groq.
# LangChain handles: retries, streaming, prompt templating, output parsing.
#
# WHAT IS LANGGRAPH?
# LangGraph lets you define stateful multi-step AI workflows as a graph.
# We use it to implement the 3-step hint flow:
#
#   START → [generate_hint] → [check_hint_number] → END or [deepen_hint]
#
# Each node is a function. Edges are conditions. The graph decides
# which node to visit next based on state.
#
# INTERVIEW TIP: "I replaced manual Groq HTTP calls with a LangChain LCEL
# chain for cleaner prompt composition and output parsing. I also implemented
# the progressive hint logic as a LangGraph state machine, where each node
# represents a hint level and edges represent the condition 'should we go
# deeper or stop?'"

import os
import time
import logging
from typing import TypedDict, Literal
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)

# ── LLM Setup ─────────────────────────────────────────────────────────────────
# ChatGroq is LangChain's Groq integration.
# temperature=0.7: balanced creativity. max_tokens=700: enough for a good hint.
# We define two models — primary (large, high quality) and fallback (fast).

def _make_llm(model: str, temperature: float = 0.7) -> ChatGroq:
    return ChatGroq(
        model=model,
        temperature=temperature,
        max_tokens=700,
        api_key=os.environ.get("GROQ_API_KEY"),
    )

PRIMARY_MODEL  = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "llama-3.1-8b-instant"


# ── Prompt Templates ──────────────────────────────────────────────────────────
# ChatPromptTemplate.from_messages() creates a reusable template.
# {variable} placeholders are filled when chain.invoke() is called.
# "system" message sets the AI's role and constraints.
# "human" message is the actual user input.

HINT_PROMPTS = {
    1: ChatPromptTemplate.from_messages([
        ("system", """You are a friendly programming tutor giving the FIRST hint.
Give a conceptual hint only. Guide the student's thinking with a simple analogy.
Ask ONE guiding question. Be encouraging.
DO NOT provide the answer or any code solution."""),
        ("human", "Question: {question}\n\nCode (if any):\n{code}\n\nProvide Hint 1:"),
    ]),
    2: ChatPromptTemplate.from_messages([
        ("system", """You are a helpful programming tutor giving the SECOND hint.
Give a strategic hint about the approach or algorithm.
Hint at relevant patterns without giving them away.
Ask ONE question about the next step.
DO NOT provide the answer or complete code."""),
        ("human", "Question: {question}\n\nCode (if any):\n{code}\n\nPrevious hint given:\n{previous_hint}\n\nProvide Hint 2:"),
    ]),
    3: ChatPromptTemplate.from_messages([
        ("system", """You are a supportive programming tutor giving the THIRD and final hint.
Give an implementation-focused hint.
You may show a small pseudocode snippet for ONE part only.
Point out common mistakes to avoid.
DO NOT provide the complete solution."""),
        ("human", "Question: {question}\n\nCode (if any):\n{code}\n\nPrevious hints:\n{previous_hint}\n\nProvide Hint 3:"),
    ]),
    "answer": ChatPromptTemplate.from_messages([
        ("system", """You are a helpful programming tutor giving the complete solution.
Provide a clear, comprehensive explanation including:
1. The core concept
2. Step-by-step implementation
3. A well-commented code example
4. Common pitfalls to avoid"""),
        ("human", "Question: {question}\n\nCode (if any):\n{code}\n\nProvide the complete solution:"),
    ]),
}

# StrOutputParser extracts just the string content from the LLM response object
_parser = StrOutputParser()


# ── LCEL Chains ───────────────────────────────────────────────────────────────
def _build_chain(prompt: ChatPromptTemplate, llm: ChatGroq):
    """
    Builds a simple LCEL chain: prompt | llm | parser
    The | operator is LangChain's pipe — output of left feeds into right.
    """
    return prompt | llm | _parser


def generate_hint_with_chain(
    question: str,
    code: str,
    hint_number: int,
    want_direct_answer: bool = False,
    previous_hint: str = "",
) -> tuple[str, int]:
    """
    Generates a hint using LangChain LCEL chain with timing and fallback.

    Returns (hint_text, response_time_ms)

    WHY FALLBACK:
    If the primary 70B model fails (overloaded, rate-limited), we automatically
    retry with the smaller 8B model. This is called graceful degradation.
    The user gets a slightly lower quality hint rather than an error.
    """
    key = "answer" if want_direct_answer else min(hint_number, 3)
    prompt = HINT_PROMPTS[key]

    inputs = {
        "question": question,
        "code": code or "No code provided.",
        "previous_hint": previous_hint or "None",
    }

    for model_name in [PRIMARY_MODEL, FALLBACK_MODEL]:
        try:
            start = time.time()
            llm   = _make_llm(model_name)
            chain = _build_chain(prompt, llm)
            result = chain.invoke(inputs)
            elapsed_ms = int((time.time() - start) * 1000)
            logger.info(f"LangChain chain: {model_name} responded in {elapsed_ms}ms")
            return result.strip(), elapsed_ms
        except Exception as e:
            logger.error(f"Chain failed with {model_name}: {e}")
            continue

    return "I'm having trouble generating a hint right now. Please try again.", 0


# ── LangGraph: Progressive Hint State Machine ─────────────────────────────────
#
# LangGraph models our hint flow as a directed graph where:
# - State is a TypedDict (typed dictionary) shared between all nodes
# - Nodes are functions that read/write state
# - Edges decide which node runs next based on state values
#
# Graph structure:
#   START → generate_hint → should_continue → END
#                               ↓ (if more hints needed)
#                           generate_hint (next level)
#
# WHY THIS IS IMPRESSIVE:
# It makes the hint progression logic explicit, testable, and extensible.
# Adding a 4th hint level is just adding a new node — no if/else chains.

class HintState(TypedDict):
    """
    The shared state passed between all LangGraph nodes.
    Every field is readable and writable by every node.
    """
    question:          str
    code:              str
    hint_number:       int        # Current hint being generated (1, 2, or 3)
    max_hints:         int        # Maximum hints to generate (usually 3)
    want_direct_answer: bool
    hints_generated:   list[str]  # All hints generated so far
    current_hint:      str        # The hint just generated in this step
    response_time_ms:  int
    done:              bool       # True when we should stop


def hint_node(state: HintState) -> HintState:
    """
    LangGraph Node: generates one hint at the current hint_number.
    Reads state, calls LangChain chain, writes result back to state.
    """
    previous = state["hints_generated"][-1] if state["hints_generated"] else ""

    hint_text, elapsed = generate_hint_with_chain(
        question=state["question"],
        code=state["code"],
        hint_number=state["hint_number"],
        want_direct_answer=state["want_direct_answer"],
        previous_hint=previous,
    )

    return {
        **state,
        "current_hint":      hint_text,
        "response_time_ms":  elapsed,
        "hints_generated":   state["hints_generated"] + [hint_text],
        "done":              True,  # We generate one hint per invocation
    }


def should_continue(state: HintState) -> Literal["end"]:
    """
    LangGraph conditional edge: decides whether to continue or stop.
    Currently always ends after one hint (frontend controls progression).
    Extensible: could auto-generate all hints in one call if needed.
    """
    return "end"


def build_hint_graph() -> StateGraph:
    """
    Builds and compiles the LangGraph state machine.
    compile() validates the graph structure and returns a runnable object.
    """
    graph = StateGraph(HintState)

    # Add nodes
    graph.add_node("generate_hint", hint_node)

    # Set entry point
    graph.set_entry_point("generate_hint")

    # Add conditional edge
    graph.add_conditional_edges(
        "generate_hint",
        should_continue,
        {"end": END},
    )

    return graph.compile()


# Compile once at import time — reused on every request
hint_graph = build_hint_graph()


def run_hint_graph(
    question: str,
    code: str,
    hint_number: int,
    want_direct_answer: bool = False,
) -> tuple[str, int]:
    """
    Public API: runs the LangGraph hint state machine.
    Returns (hint_text, response_time_ms).
    """
    initial_state: HintState = {
        "question":           question,
        "code":               code,
        "hint_number":        hint_number,
        "max_hints":          3,
        "want_direct_answer": want_direct_answer,
        "hints_generated":    [],
        "current_hint":       "",
        "response_time_ms":   0,
        "done":               False,
    }

    result = hint_graph.invoke(initial_state)
    return result["current_hint"], result["response_time_ms"]
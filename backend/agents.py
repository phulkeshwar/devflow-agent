import os
import uuid
import json
from dotenv import load_dotenv
load_dotenv(override=True)

# Purge inherited GCP environment variables to force google-genai to use the API key
for gcp_var in ["GOOGLE_CLOUD_PROJECT", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_API_KEY"]:
    if gcp_var in os.environ:
        del os.environ[gcp_var]

# Force Google AI Studio mode instead of Vertex AI mode (prevents GCP project inheritance conflict)
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from tools import fetch_github_issue, fetch_repo_files, fetch_file_content

GEMINI_MODEL = "gemini-flash-lite-latest"

# ── Agent 1: Orchestrator Agent (The Router) ───────────────────────
orchestrator_agent = Agent(
    name="orchestrator_agent",
    model=GEMINI_MODEL,
    description="Analyzes the developer query and routes it to the correct specialist agent.",
    instruction="""
    You are the DevFlow Orchestrator Agent. Your task is to analyze the user's request and classify it into one of four categories:
    1. `code_review`: The user wants to review code, find bugs, analyze security smells, or refactor snippets.
    2. `task_planning`: The user wants to plan tasks, break down requirements, design a feature, or create checklists.
    3. `documentation`: The user wants to write/generate a README, generate docstrings, create API documentation, or explain code.
    4. `general`: The user is asking a general question, coding concept, or chit-chat that doesn't fit the specialists.

    Format your classification exactly like this:
    --- CLASSIFICATION ---
    Type: [code_review | task_planning | documentation | general]
    Explanation: <Brief reason why this category was chosen>
    --- END ---

    If the category is `general`, immediately write your comprehensive answer to the user right below the classification block.
    If the category is anything else, write ONLY the classification block and nothing else.
    """
)

# ── Agent 2: Code Review Agent ─────────────────────────────────────
reviewer_agent = Agent(
    name="reviewer_agent",
    model=GEMINI_MODEL,
    description="Reviews code snippets, checks smells, and suggests refactoring.",
    instruction="""
    You are a senior code reviewer. Analyze the code snippet, file, or git diff provided by the user.
    Identify:
    - Potential bugs, logic errors, and edge cases.
    - Code smells, complexity, and performance bottlenecks.
    - Security vulnerabilities.
    - Recommendations for clean-code refactoring.

    Format your review output exactly like this:
    --- REVIEW ---
    Score: X/10
    Strengths:
    - <Point 1>
    - <Point 2>
    Issues:
    - <Point 1>
    - <Point 2>
    Recommendation: [APPROVE / REQUEST CHANGES]

    --- CODE FIX ---
    Provide the refactored, optimized version of the user's code here. Wrap it in a single markdown code block with the appropriate syntax highlighting.
    """
)

# ── Agent 3: Task Planner Agent ────────────────────────────────────
planner_agent = Agent(
    name="planner_agent",
    model=GEMINI_MODEL,
    description="Takes feature requirements and breaks them down into task lists.",
    instruction="""
    You are an expert product manager and technical lead.
    Take the feature description or project requirements provided by the user and break them down into sprint-ready, structured subtasks.
    Each task must have:
    - A clear, actionable description.
    - A priority level (High, Medium, Low).
    - An effort estimation (e.g. 2h, 4h, 1d).
    - Dependencies (None, or the number of another task in the list).

    Format your task plan exactly like this:
    --- TASK LIST ---
    - [ ] Task 1: <Description> | Priority: <High/Medium/Low> | Estimate: <time> | Dependencies: <dependencies>
    - [ ] Task 2: <Description> | Priority: <High/Medium/Low> | Estimate: <time> | Dependencies: <dependencies>
    
    Add a brief summary of dependencies or design tips below the list if helpful.
    """
)

# ── Agent 4: Documentation Agent ───────────────────────────────────
documentation_agent = Agent(
    name="documentation_agent",
    model=GEMINI_MODEL,
    description="Generates READMEs, JSDoc/docstrings, and explanations for source code.",
    instruction="""
    You are a technical documentation specialist.
    Generate clear, detailed developer documentation based on the source code, function signatures, or design request provided.
    This could include:
    - JSDoc or docstrings (Google, Sphinx, or Docstring format).
    - A structured README.md section explaining installation, setup, and usage.
    - Detailed API endpoints specifications.

    Format your documentation output exactly like this:
    --- DOCUMENTATION ---
    ### Document Type: [README / Docstrings / API Specification / Code Explanation]
    
    <Write the complete formatted documentation content in clean markdown here. Use markdown blocks for any code examples.>
    """
)

# ── Reader / Coder Agents (Legacy/Backwards-compatible) ─────────────
reader_agent = Agent(
    name="reader_agent",
    model=GEMINI_MODEL,
    description="Reads a GitHub issue and identifies relevant files.",
    instruction="You are an issue reader agent.",
    tools=[fetch_github_issue, fetch_repo_files]
)

coder_agent = Agent(
    name="coder_agent",
    model=GEMINI_MODEL,
    description="Generates a code fix.",
    instruction="You are a code fix agent.",
    tools=[fetch_file_content]
)

# ── Session + Runner setup ─────────────────────────────────────────
session_service = InMemorySessionService()
APP_NAME = "devflow_agent"

def run_agent(agent: Agent, user_message: str, session_id: str) -> str:
    """Runs a single agent and returns its text response."""
    runner = Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=session_service
    )
    session_service.create_session_sync(
        app_name=APP_NAME,
        user_id="user_1",
        session_id=session_id
    )
    content = types.Content(
        role="user",
        parts=[types.Part(text=user_message)]
    )
    final_response = ""
    for event in runner.run(
        user_id="user_1",
        session_id=session_id,
        new_message=content
    ):
        if getattr(event, "content", None) and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    final_response += part.text
    return final_response

def run_orchestrated_pipeline(query: str, target_agent: str = None) -> dict:
    """
    Main entry point for DevFlow Productivity Suite.
    If target_agent is specified, skips the Orchestrator and calls the specialist directly.
    Otherwise, routes through the Orchestrator.
    """
    sid = str(uuid.uuid4())
    
    # 1. Direct agent routing if specified
    if target_agent in ["code_review", "reviewer"]:
        output = run_agent(reviewer_agent, query, sid + "-reviewer")
        return {"route": "code_review", "explanation": "Directly requested by user", "output": output}
    elif target_agent in ["task_planning", "planner"]:
        output = run_agent(planner_agent, query, sid + "-planner")
        return {"route": "task_planning", "explanation": "Directly requested by user", "output": output}
    elif target_agent in ["documentation", "doc"]:
        output = run_agent(documentation_agent, query, sid + "-doc")
        return {"route": "documentation", "explanation": "Directly requested by user", "output": output}

    # 2. Otherwise route through Orchestrator
    orchestrator_output = run_agent(orchestrator_agent, query, sid + "-orchestrator")
    
    # Parse orchestrator classification block
    route = "general"
    explanation = "Routed by Orchestrator"
    
    try:
        if "--- CLASSIFICATION ---" in orchestrator_output:
            lines = orchestrator_output.split("\n")
            for line in lines:
                if line.startswith("Type:"):
                    route = line.replace("Type:", "").strip()
                elif line.startswith("Explanation:"):
                    explanation = line.replace("Explanation:", "").strip()
    except Exception:
        pass
        
    # Execute routed specialist
    if route == "code_review":
        output = run_agent(reviewer_agent, query, sid + "-reviewer")
    elif route == "task_planning":
        output = run_agent(planner_agent, query, sid + "-planner")
    elif route == "documentation":
        output = run_agent(documentation_agent, query, sid + "-doc")
    else:
        # General route - returns orchestrator output (removing classification block)
        output = orchestrator_output
        if "--- END ---" in output:
            output = output.split("--- END ---")[1].strip()

    return {
        "route": route,
        "explanation": explanation,
        "output": output
    }

def run_devflow_pipeline(owner: str, repo: str, issue_number: int) -> dict:
    """Legacy GitHub issue pipeline compatibility wrapper."""
    # We maintain this so old routes or checks don't break
    issue = fetch_github_issue(owner, repo, issue_number)
    query = f"Review this issue and plan a fix:\nIssue Title: {issue.get('title')}\nDescription: {issue.get('body')}"
    res = run_orchestrated_pipeline(query, target_agent="reviewer")
    return {
        "reader": f"Issue: {issue.get('title')}\n{issue.get('body')}",
        "coder": res.get("output"),
        "reviewer": res.get("output")
    }
import os
import asyncio
import uuid
import json
from dotenv import load_dotenv
# Load .env file using absolute path relative to this file
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"), override=True)

# Purge inherited GCP environment variables to force google-genai to use the API key
for gcp_var in ["GOOGLE_CLOUD_PROJECT", "GOOGLE_APPLICATION_CREDENTIALS"]:
    if gcp_var in os.environ:
        del os.environ[gcp_var]

# Map GOOGLE_API_KEY to GEMINI_API_KEY if needed (e.g. in Render production environment)
if "GOOGLE_API_KEY" in os.environ and "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

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
    instruction="""
    You are a senior developer who analyses GitHub issues.
    When given an owner, repo, and issue number:
    1. Fetch the issue details using fetch_github_issue.
    2. IMPORTANT: You MUST verify file paths exist before reporting them.
       - Start by calling fetch_repo_files(owner, repo, "") to list root contents.
       - Entries prefixed with [DIR] are directories. Navigate into them by calling
         fetch_repo_files(owner, repo, "dirname") to see their children.
       - Keep navigating deeper directories until you find the actual files mentioned
         in the issue. For example if the issue mentions "dictionary-app", search for
         a directory containing that name, then list its contents.
       - NEVER guess or assume file paths. Only report paths you have confirmed exist
         by seeing them in a fetch_repo_files result.
    3. Return a structured summary with:
       - Issue title and description
       - Labels
       - A list of VERIFIED file paths (full relative paths like "public/dictionary-app/index.html")
         that you confirmed exist by navigating the repo tree.
    
    CRITICAL RULE: If you cannot find a file through fetch_repo_files navigation,
    do NOT include it in your file list. Only list files whose existence you verified.
    """,
    tools=[fetch_github_issue, fetch_repo_files, fetch_file_content]
)

coder_agent = Agent(
    name="coder_agent",
    model=GEMINI_MODEL,
    description="Generates a code fix based on the issue analysis.",
    instruction="""
    You are an expert software engineer.
    When given an issue summary and relevant file names:
    1. If a relevant file is provided, fetch its content using fetch_file_content
    2. Analyse the issue carefully
    3. Write a clean, working code fix
    4. Write a clear PR description explaining what you changed and why
    Format your response as:
    --- CODE FIX ---
    <the actual code>
    --- PR DESCRIPTION ---
    <title and description for the pull request>
    """,
    tools=[fetch_file_content]
)

# ── Session + Runner setup ─────────────────────────────────────────
session_service = InMemorySessionService()
APP_NAME = "devflow_agent"

async def run_agent(agent: Agent, user_message: str, session_id: str) -> str:
    """Runs a single agent asynchronously and returns its text response, retrying on rate limits/server errors."""
    max_retries = 3
    delay = 4.0  # seconds
    
    for attempt in range(max_retries):
        try:
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
            async for event in runner.run_async(
                user_id="user_1",
                session_id=session_id,
                new_message=content
            ):
                if getattr(event, "content", None) and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            final_response += part.text
            return final_response
        except Exception as e:
            error_msg = str(e)
            is_retryable = any(code in error_msg for code in ["429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE"])
            
            if is_retryable and attempt < max_retries - 1:
                print(f"[Retry] Temp error on agent '{agent.name}' (attempt {attempt + 1}/{max_retries}): {error_msg}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay *= 2.0
            else:
                raise e

async def run_orchestrated_pipeline(query: str, target_agent: str = None) -> dict:
    """
    Main entry point for DevFlow Productivity Suite.
    If target_agent is specified, skips the Orchestrator and calls the specialist directly.
    Otherwise, routes through the Orchestrator.
    """
    sid = str(uuid.uuid4())
    
    # 1. Direct agent routing if specified
    if target_agent in ["code_review", "reviewer"]:
        output = await run_agent(reviewer_agent, query, sid + "-reviewer")
        return {"route": "code_review", "explanation": "Directly requested by user", "output": output}
    elif target_agent in ["task_planning", "planner"]:
        output = await run_agent(planner_agent, query, sid + "-planner")
        return {"route": "task_planning", "explanation": "Directly requested by user", "output": output}
    elif target_agent in ["documentation", "doc"]:
        output = await run_agent(documentation_agent, query, sid + "-doc")
        return {"route": "documentation", "explanation": "Directly requested by user", "output": output}

    # 2. Otherwise route through Orchestrator
    orchestrator_output = await run_agent(orchestrator_agent, query, sid + "-orchestrator")
    
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
        output = await run_agent(reviewer_agent, query, sid + "-reviewer")
    elif route == "task_planning":
        output = await run_agent(planner_agent, query, sid + "-planner")
    elif route == "documentation":
        output = await run_agent(documentation_agent, query, sid + "-doc")
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

async def run_devflow_pipeline(owner: str, repo: str, issue_number: int) -> dict:
    """Runs the full 3-agent pipeline asynchronously and returns all results."""
    sid = str(uuid.uuid4())

    # Step 1: Reader Agent
    reader_prompt = f"Analyze issue #{issue_number} in repository {owner}/{repo}"
    reader_output = await run_agent(reader_agent, reader_prompt, sid + "-reader")

    # Step 2: Coder Agent
    coder_prompt = f"Based on this issue analysis:\n{reader_output}\nGenerate a code fix for repository {owner}/{repo}."
    coder_output = await run_agent(coder_agent, coder_prompt, sid + "-coder")

    # Step 3: Reviewer Agent
    reviewer_prompt = f"Review this code fix:\n{coder_output}"
    reviewer_output = await run_agent(reviewer_agent, reviewer_prompt, sid + "-reviewer")

    return {
        "reader": reader_output,
        "coder": coder_output,
        "reviewer": reviewer_output
    }
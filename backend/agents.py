import os
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

GEMINI_MODEL = "gemini-2.5-flash"

# ── Agent 1: Reader Agent ──────────────────────────────────────────
reader_agent = Agent(
    name="reader_agent",
    model=GEMINI_MODEL,
    description="Reads a GitHub issue and identifies relevant files.",
    instruction="""
    You are a senior developer who analyses GitHub issues.
    When given an owner, repo, and issue number:
    1. Fetch the issue details using fetch_github_issue
    2. List the repo files using fetch_repo_files
    3. Identify which files are most likely related to the issue
    4. Return a structured summary: issue title, description, labels, and relevant files
    Be concise and precise.
    """,
    tools=[fetch_github_issue, fetch_repo_files]
)

# ── Agent 2: Coder Agent ───────────────────────────────────────────
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

# ── Agent 3: Reviewer Agent ────────────────────────────────────────
reviewer_agent = Agent(
    name="reviewer_agent",
    model=GEMINI_MODEL,
    description="Reviews the generated code fix and scores its quality.",
    instruction="""
    You are a strict but fair code reviewer.
    When given a code fix:
    1. Check for bugs, edge cases, security issues
    2. Check code quality and readability
    3. Score the fix out of 10
    4. List what's good and what needs improvement
    Format your response as:
    --- REVIEW ---
    Score: X/10
    Strengths: ...
    Issues: ...
    Recommendation: APPROVE / REQUEST CHANGES
    """
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

def run_devflow_pipeline(owner: str, repo: str, issue_number: int) -> dict:
    """Runs the full 3-agent pipeline and returns all results."""
    import uuid
    sid = str(uuid.uuid4())

    # Step 1: Reader Agent
    reader_prompt = f"""
    Analyse this GitHub issue:
    Owner: {owner}
    Repo: {repo}
    Issue Number: {issue_number}
    """
    reader_output = run_agent(reader_agent, reader_prompt, sid + "-reader")

    # Step 2: Coder Agent
    coder_prompt = f"""
    Based on this issue analysis, generate a code fix:
    {reader_output}
    Owner: {owner}, Repo: {repo}
    """
    coder_output = run_agent(coder_agent, coder_prompt, sid + "-coder")

    # Step 3: Reviewer Agent
    reviewer_prompt = f"""
    Review this code fix:
    {coder_output}
    """
    reviewer_output = run_agent(reviewer_agent, reviewer_prompt, sid + "-reviewer")

    return {
        "reader": reader_output,
        "coder": coder_output,
        "reviewer": reviewer_output
    }
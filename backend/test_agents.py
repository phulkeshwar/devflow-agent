# test_agents.py
# This script is a manual checkpoint to test our multi-agent pipeline in agents.py.

import os
from dotenv import load_dotenv

# Load env variables first
load_dotenv(override=True)

print("--- ENV VARIABLES ---")
print("GEMINI_API_KEY:", repr(os.environ.get("GEMINI_API_KEY")))
print("GOOGLE_API_KEY:", repr(os.environ.get("GOOGLE_API_KEY")))
print("GOOGLE_CLOUD_PROJECT:", repr(os.environ.get("GOOGLE_CLOUD_PROJECT")))
print("GOOGLE_CLOUD_LOCATION:", repr(os.environ.get("GOOGLE_CLOUD_LOCATION")))
print("----------------------")

from agents import run_orchestrated_pipeline

def run_pipeline_test():
    print("--- Starting Orchestrated Multi-Agent Suite Test ---")
    
    test_cases = [
        {
            "name": "Code Review Route Test",
            "query": "Review this javascript code block and check for leaks:\n\nfunction process() {\n  for(var i=0; i<10; i++) {\n    setTimeout(function() { console.log(i); }, 100);\n  }\n}",
            "expected_agent": "code_review"
        },
        {
            "name": "Task Planning Route Test",
            "query": "Create a sprint breakdown plan for adding Google OAuth log-in feature to our backend API.",
            "expected_agent": "task_planning"
        },
        {
            "name": "Documentation Route Test",
            "query": "Write JSDoc comments for this function: function calculateDistance(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)); }",
            "expected_agent": "documentation"
        },
        {
            "name": "General Query Route Test",
            "query": "What is the difference between var, let, and const in JavaScript?",
            "expected_agent": "general"
        }
    ]

    for tc in test_cases:
        print(f"\n==========================================")
        print(f"RUNNING TEST: {tc['name']}")
        print(f"==========================================")
        print(f"Prompt: {tc['query'][:100]}...")
        try:
            res = run_orchestrated_pipeline(query=tc["query"])
            print(f"-> Routed To: {res.get('route')}")
            print(f"-> Rationale: {res.get('explanation')}")
            print("\n--- Output ---")
            print(res.get("output", "").strip()[:400])
            print("--------------")
            print(f"[SUCCESS] Test '{tc['name']}' finished!")
        except Exception as e:
            print(f"[ERROR] Test '{tc['name']}' failed with error: {e}")

if __name__ == "__main__":
    run_pipeline_test()

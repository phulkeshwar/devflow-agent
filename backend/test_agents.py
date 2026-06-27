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

from agents import run_devflow_pipeline

def run_pipeline_test():
    print("--- Starting Multi-Agent Pipeline Test ---")
    owner = "octocat"
    repo = "Spoon-Knife"
    issue_number = 1
    
    print(f"Triggering pipeline for {owner}/{repo} #{issue_number}...")
    try:
        results = run_devflow_pipeline(owner=owner, repo=repo, issue_number=issue_number)
        
        print("\n==========================================")
        print("AGENT 1: READER AGENT OUTPUT")
        print("==========================================")
        print(results.get("reader", "No output from Reader Agent"))
        
        print("\n==========================================")
        print("AGENT 2: CODER AGENT OUTPUT")
        print("==========================================")
        print(results.get("coder", "No output from Coder Agent"))
        
        print("\n==========================================")
        print("AGENT 3: REVIEWER AGENT OUTPUT")
        print("==========================================")
        print(results.get("reviewer", "No output from Reviewer Agent"))
        print("\n==========================================")
        print("[SUCCESS] SUCCESS: Full multi-agent pipeline test finished!")
    except Exception as e:
        print(f"\n[ERROR] Error running the pipeline: {e}")

if __name__ == "__main__":
    run_pipeline_test()

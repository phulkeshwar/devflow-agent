# test_tools.py
# This script is a manual checkpoint to test our GitHub API helper functions.

import os
from tools import fetch_github_issue, fetch_repo_files, fetch_file_content

def run_tests():
    print("--- Starting GitHub Tools Test ---")
    
    # We will test using a public, simple repository
    # Owner: "octocat" (GitHub's mascot account)
    # Repo: "Spoon-Knife" (A famous public playground repo for testing forks)
    owner = "octocat"
    repo = "Spoon-Knife"
    
    # 1. Test fetching an issue
    # Issue number 1 in Spoon-Knife repository
    print(f"\n1. Testing fetch_github_issue on {owner}/{repo} #1...")
    issue = fetch_github_issue(owner, repo, 1)
    if "error" in issue:
        print(f"[ERROR] Error: {issue['error']}")
    else:
        print(f"[OK] Success! Title: '{issue.get('title')}'")
        print(f"   Labels: {issue.get('labels')}")
        
    # 2. Test listing files
    print(f"\n2. Testing fetch_repo_files on {owner}/{repo}...")
    files = fetch_repo_files(owner, repo)
    if not files:
        print("[ERROR] Error: Could not retrieve repository files.")
    else:
        print(f"[OK] Success! Found {len(files)} files.")
        print(f"   Top files: {files[:5]}")
        
    # 3. Test fetching specific file content
    print(f"\n3. Testing fetch_file_content for 'index.html'...")
    content = fetch_file_content(owner, repo, "index.html")
    if "Could not fetch file" in content:
        print("[ERROR] Error fetching file content.")
    else:
        print("[OK] Success! Read file content:")
        # Print the first 3 lines of index.html
        lines = content.splitlines()[:3]
        for line in lines:
            print(f"   | {line}")

if __name__ == "__main__":
    run_tests()

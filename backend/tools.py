import os
import requests
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def fetch_github_issue(owner: str, repo: str, issue_number: int) -> dict:
    """Fetches a GitHub issue by owner, repo and issue number."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        return {"error": f"Failed to fetch issue: {response.status_code}"}
    data = response.json()
    return {
        "title": data.get("title"),
        "body": data.get("body"),
        "labels": [l["name"] for l in data.get("labels", [])],
        "state": data.get("state"),
        "url": data.get("html_url")
    }

def fetch_repo_files(owner: str, repo: str) -> list:
    """Lists top-level files in a GitHub repo."""
    url = f"https://api.github.com/repos/{owner}/{repo}/contents"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        return []
    return [f["name"] for f in response.json() if f["type"] == "file"]

def fetch_file_content(owner: str, repo: str, filepath: str) -> str:
    """Fetches raw content of a specific file from GitHub repo."""
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{filepath}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        return f"Could not fetch file: {response.status_code}"
    import base64
    content = response.json().get("content", "")
    return base64.b64decode(content).decode("utf-8", errors="ignore")
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

def fetch_repo_files(owner: str, repo: str, path: str = "") -> list:
    """Lists files and directories in a GitHub repository path. Use path parameter to navigate into directories."""
    clean_path = path.strip("/")
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{clean_path}".rstrip("/")
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        return []
    
    items = []
    for item in response.json():
        if item["type"] == "dir":
            items.append(f"[DIR] {item['name']}")
        else:
            items.append(item["name"])
    return items

def fetch_file_content(owner: str, repo: str, filepath: str) -> str:
    """Fetches raw content of a specific file from GitHub repo."""
    if not filepath or not isinstance(filepath, str):
        return "Invalid filepath provided."
    clean_path = filepath.strip("/")
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{clean_path}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        return f"Could not fetch file: {response.status_code}"
    
    data = response.json()
    if isinstance(data, list):
        return "The path specified is a directory, not a file. Here are the contents:\n" + ", ".join([item.get("name", "") for item in data])
        
    if not isinstance(data, dict):
        return "Unexpected response format from GitHub."
        
    import base64
    content = data.get("content", "")
    try:
        return base64.b64decode(content).decode("utf-8", errors="ignore")
    except Exception as e:
        return f"Failed to decode file content: {str(e)}"
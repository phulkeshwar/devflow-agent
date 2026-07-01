import requests
import json

url = "http://127.0.0.1:8001/orchestrate"
payload = {
    "query": "Review this python code:\nprint('hello')",
    "agent": None
}
headers = {
    "Content-Type": "application/json"
}

try:
    print("Sending POST request to /orchestrate...")
    response = requests.post(url, json=payload, headers=headers)
    print("Status Code:", response.status_code)
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error:", e)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents import run_devflow_pipeline

app = FastAPI(title="DevFlow Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class IssueRequest(BaseModel):
    owner: str
    repo: str
    issue_number: int

@app.get("/")
def root():
    return {"status": "DevFlow Agent is running"}

@app.post("/analyse")
def analyse_issue(req: IssueRequest):
    try:
        result = run_devflow_pipeline(
            owner=req.owner,
            repo=req.repo,
            issue_number=req.issue_number
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
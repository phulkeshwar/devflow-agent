# ⚡ DevFlow Agentic Suite

DevFlow is an intelligent, multi-agent developer productivity dashboard that automates code reviews, task breakdown planning, and documentation generation. Using Google's **Agent Development Kit (ADK)**, **FastAPI**, and **React**, DevFlow coordinates multiple specialized agents through a dynamic orchestrator layer to boost developer throughput in real-time.

---

## ⚙️ Architecture & Agent Roles

DevFlow uses a federated multi-agent architecture. A central Orchestrator dynamically classifies your prompt and delegates tasks to specialized sub-agents:

```
                      ┌──────────────────────┐
                      │    Developer User    │
                      └──────────┬───────────┘
                                 │ Prompt / Code / File
                                 ▼
                      ┌──────────────────────┐
                      │   React Dashboard    │
                      └──────────┬───────────┘
                                 │ POST /api/orchestrate
                                 ▼
                      ┌──────────────────────┐
                      │   FastAPI Backend    │
                      └──────────┬───────────┘
                                 │ Invoke
                                 ▼
                      ┌──────────────────────┐
                      │  Orchestrator Agent  │
                      └──────────┬───────────┘
                                 │ Reroutes
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│Code Review Agent │   │  Task Planner    │   │  Documentation   │
│ (Bugs, Smells,   │   │  (Subtask Cards, │   │ (README, JSDocs, │
│ Refactoring, Diff│   │  Estimates, Gantt│   │ Code Explanation)│
│ Score out of 10) │   │  Dependencies)   │   │                  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

1. **Orchestrator Agent (The Router):** Analyzes the prompt to classify the developer's intent and routes it to the correct specialist, or directly answers general coding concepts.
2. **Code Review Agent (Reviewer):** Scans code snippets or diffs for security concerns, edge cases, and code smells, assigning a quality score and providing a side-by-side refactored code patch.
3. **Task Planner Agent (PM Lead):** Accepts feature requests and requirements, outputting prioritized sprint checklists with effort estimates and dependency tracking.
4. **Documentation Agent (Technical Writer):** Generates structured JSDoc/docstring annotations, JSDoc comment blocks, and README sections directly from source code signatures.

---

## 🚀 Key Features

* **Intent Auto-Routing:** Submit any text prompt, file, or instruction. The orchestrator automatically routes the query to the correct specialist.
* **Drag-and-Drop File Upload:** Load code files (`.py`, `.js`, `.ts`, `.css`, etc.) directly into the editor for instant review or documentation.
* **Interactive Kanban Board:** Task planner output is automatically rendered as interactive, checkable board cards complete with priority indicators.
* **Split Code Diff Viewer:** Side-by-side presentation of code changes.
* **Vercel Amber Theme:** Sleek dark-mode aesthetic built using Outfit font stack, custom neon-amber accents, and glassmorphic panels.

---

## 🛠️ Quick Start

### 1. Backend Setup (FastAPI)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the `backend` folder and add your credentials:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GITHUB_TOKEN=your_github_token_here
   ```
4. Start the FastAPI server on port `8001`:
   ```bash
   python -m uvicorn main:app --reload --port 8001
   ```

### 2. Frontend Setup (React + Vite)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the dev server on port `5174`:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5174/` to use the dashboard!

---

## ⚡ Cloud Hosting: Deploying on Kaggle
You can host the FastAPI agents on a free Kaggle CPU/GPU notebook (up to 12 hours) and connect it locally:
1. Open a new Kaggle notebook and enable **Internet**.
2. Save your API keys securely in **Add-ons -> Secrets** as `GEMINI_API_KEY` and `GITHUB_TOKEN`.
3. Clone the repo and expose the server using `localtunnel`:
   ```bash
   !pip install fastapi uvicorn requests python-dotenv google-genai google-adk
   !npm install -g localtunnel
   ```
4. Tunnel the local port 8001:
   ```python
   # Background process to expose port
   import subprocess
   subprocess.Popen(["lt", "--port", "8001"])
   ```
5. Set `VITE_API_URL` in your frontend environment to the public tunnel URL!


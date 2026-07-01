# ⚡ DevFlow Agentic Suite

DevFlow is an intelligent, multi-agent developer productivity dashboard that automates code reviews, task breakdown planning, and documentation generation. Built on top of Google's **Agent Development Kit (ADK)**, **FastAPI**, and **React**, DevFlow coordinates multiple specialized agents through a dynamic orchestrator layer to boost developer throughput in real-time.

---

## ⚙️ System Architecture

DevFlow implements a federated multi-agent architecture. A central Orchestrator Agent dynamically classifies developer prompts and delegates tasks to specialized sub-agents:

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

### Specialized Agents & Roles
1. **Orchestrator Agent (The Router):** Analyzes the prompt to classify the developer's intent and routes it to the correct specialist, or directly answers general coding concepts.
2. **Code Review Agent (Reviewer):** Scans code snippets or diffs for security concerns, edge cases, and code smells, assigning a quality score and providing a side-by-side refactored code patch.
3. **Task Planner Agent (PM Lead):** Accepts feature requests and requirements, outputting prioritized sprint checklists with effort estimates and dependency tracking.
4. **Documentation Agent (Technical Writer):** Generates structured JSDoc/docstring annotations, JSDoc comment blocks, and README sections directly from source code signatures.

---

## 🚀 Key Features

* **Intent Auto-Routing:** Submit any text prompt, file, or instruction. The orchestrator automatically routes the query to the correct specialist.
* **Drag-and-Drop File Upload:** Load code files from any language or framework (JS, TS, Python, Java, C++, Go, Rust, Ruby, HTML, CSS, and most others) directly into the editor for instant review or documentation.
* **Interactive Kanban Board:** Task planner output is automatically rendered as interactive, checkable board cards complete with priority indicators.
* **Split Code Diff Viewer:** Side-by-side presentation of code changes.
* **GitHub Issue Resolver Pipeline:** Direct pipeline execution using GitHub issue links or repo targets, utilizing the reader agent to identify target files and coder agent to write fixes.
* **GitHub Dark Theme:** Sleek dark-mode aesthetic built using custom font stacks, custom neon-orange accents, and glassmorphic panels.

---

## 📁 Repository Structure

```
devflow-agent/
├── backend/                  # FastAPI Application
│   ├── main.py               # API Endpoints & Server entry
│   ├── agents.py             # Agent definitions & ADK Runner setups
│   ├── tools.py              # GitHub API client & filesystem tools
│   ├── requirements.txt      # Backend Python dependencies
│   └── .env                  # Environment keys configuration
├── frontend/                 # React Vite Client
│   ├── src/
│   │   ├── App.jsx           # Main Dashboard component
│   │   ├── App.css           # Custom GitHub Dark stylesheet
│   │   ├── main.jsx          # Entry point
│   │   └── index.css         # Reset styles
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite config rules
└── DESIGN.md                 # Design specifications & system rules
```

---

## 🛠️ Quick Start

### Prerequisites
* Python 3.10+
* Node.js 18+
* A Gemini API key (from Google AI Studio)

---

### 1. Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and install dependencies:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the `backend` folder and add your credentials:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GITHUB_TOKEN=your_github_token_here
   ```

4. Start the FastAPI server:
   ```bash
   python -m uvicorn main:app --reload --port 8001
   ```
   The backend will be running on `http://127.0.0.1:8001`.

---

### 2. Frontend Setup (React + Vite)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install npm packages:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```
   The app will run locally on `http://localhost:5173/` (or port 5174). Open the URL in your browser to start using the dashboard.

---

## ⚡ Cloud Hosting: Running on Kaggle

You can host the FastAPI backend on a free Kaggle notebook and connect your local frontend to it remotely:

1. Open a new Kaggle notebook and enable **Internet** in the settings.
2. Store your API keys in the Kaggle notebook's **Add-ons -> Secrets** as `GEMINI_API_KEY` and `GITHUB_TOKEN`.
3. Install dependencies and localtunnel:
   ```bash
   !pip install fastapi uvicorn requests python-dotenv google-genai google-adk
   !npm install -g localtunnel
   ```
4. Expose port 8001 through a public tunnel:
   ```python
   import subprocess
   subprocess.Popen(["lt", "--port", "8001"])
   ```
5. Set `VITE_API_URL` in your frontend environment (or in `App.jsx` API configuration) to the public URL returned by `localtunnel`.

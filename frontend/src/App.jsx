import { useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:8000";

function App() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("reader");

  const handleAnalyse = async () => {
    if (!owner || !repo || !issueNumber) {
      setError("Please fill all fields.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/analyse`, {
        owner,
        repo,
        issue_number: parseInt(issueNumber),
      });
      setResult(res.data.result);
      setActiveTab("reader");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">DevFlow Agent</span>
        </div>
        <span className="badge">Powered by Gemini + ADK</span>
      </header>

      <main className="main">
        <div className="hero">
          <h1>GitHub Issue → Code Fix Pipeline</h1>
          <p>Paste any GitHub issue. Three AI agents will read it, fix it, and review it.</p>
        </div>

        <div className="input-card">
          <div className="input-row">
            <div className="input-group">
              <label>Owner</label>
              <input
                placeholder="e.g. facebook"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Repository</label>
              <input
                placeholder="e.g. react"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
            <div className="input-group small">
              <label>Issue #</label>
              <input
                placeholder="e.g. 1"
                value={issueNumber}
                onChange={(e) => setIssueNumber(e.target.value)}
                type="number"
              />
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <button
            className={`analyse-btn ${loading ? "loading" : ""}`}
            onClick={handleAnalyse}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Agents working...
              </>
            ) : (
              "Run DevFlow Pipeline →"
            )}
          </button>
        </div>

        {loading && (
          <div className="pipeline-status">
            <div className="pipeline-step active">
              <span className="step-dot"></span>
              <span>Reader Agent — fetching issue...</span>
            </div>
            <div className="pipeline-step">
              <span className="step-dot"></span>
              <span>Coder Agent — generating fix...</span>
            </div>
            <div className="pipeline-step">
              <span className="step-dot"></span>
              <span>Reviewer Agent — reviewing code...</span>
            </div>
          </div>
        )}

        {result && (
          <div className="result-card">
            <div className="tabs">
              {["reader", "coder", "reviewer"].map((tab) => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "reader" && "📖 Reader"}
                  {tab === "coder" && "💻 Coder"}
                  {tab === "reviewer" && "🔍 Reviewer"}
                </button>
              ))}
            </div>
            <div className="tab-content">
              <pre>{result[activeTab]}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
import { useState } from "react";
import axios from "axios";
import "./App.css";

// The API endpoint of our FastAPI backend uvicorn server
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  // Input fields state
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [issueNumber, setIssueNumber] = useState("");

  // Loading and result states
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  
  // Tab state: "reader", "coder", or "reviewer"
  const [activeTab, setActiveTab] = useState("reader");

  // Helper to copy code to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Code copied to clipboard!");
  };

  // Triggers the uvicorn multi-agent pipeline
  const handleAnalyse = async () => {
    if (!owner || !repo || !issueNumber) {
      setError("Please fill in all input fields.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/analyse`, {
        owner: owner.trim(),
        repo: repo.trim(),
        issue_number: parseInt(issueNumber),
      });

      if (res.data && res.data.success) {
        setResult(res.data.result);
        setActiveTab("reader"); // Open the first tab (Reader) when done
      } else {
        setError("Pipeline run completed, but returned unsuccessful status.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Could not connect to the backend server. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

  // ── Parsers for rendering outputs beautifully ───────────────────

  // Coder parser: splits code fix blocks and PR descriptions
  const parseCoderOutput = (output) => {
    if (!output) return { code: "", description: "" };
    
    // Split on standard headers
    const codeFixIndex = output.indexOf("--- CODE FIX ---");
    const prDescriptionIndex = output.indexOf("--- PR DESCRIPTION ---");
    
    let code = "";
    let description = output; // fallback

    if (codeFixIndex !== -1 && prDescriptionIndex !== -1) {
      if (codeFixIndex < prDescriptionIndex) {
        code = output.slice(codeFixIndex + 16, prDescriptionIndex).trim();
        description = output.slice(prDescriptionIndex + 22).trim();
      } else {
        description = output.slice(prDescriptionIndex + 22, codeFixIndex).trim();
        code = output.slice(codeFixIndex + 16).trim();
      }
    }
    
    // Clean up code block markup (e.g. ```html, ```css) if present
    code = code.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");

    return { code, description };
  };

  // Reviewer parser: parses score, verdict, and lists
  const parseReviewerOutput = (output) => {
    if (!output) return { score: "", verdict: "", content: "" };

    // Clean prefix header if present
    let cleaned = output.replace("--- REVIEW ---", "").trim();

    // Look for Score, e.g. "Score: 9.5/10"
    const scoreMatch = cleaned.match(/Score:\s*([0-9.]+\s*\/10)/i);
    let score = "";
    if (scoreMatch) {
      score = scoreMatch[1];
      cleaned = cleaned.replace(scoreMatch[0], "").trim();
    }

    // Look for Recommendation verdict, e.g. "Recommendation: APPROVE"
    const verdictMatch = cleaned.match(/Recommendation:\s*(APPROVE|REQUEST CHANGES)/i);
    let verdict = "";
    if (verdictMatch) {
      verdict = verdictMatch[1].toUpperCase();
      cleaned = cleaned.replace(verdictMatch[0], "").trim();
    }

    return { score, verdict, content: cleaned };
  };

  // Reader parser: attempts to find identified files and metadata
  const parseReaderOutput = (output) => {
    if (!output) return { files: [], raw: "" };

    // Scan for potential files list from repo contents
    const lines = output.split("\n");
    const files = [];
    
    // Simple regex to extract filenames that end in common extensions or resemble them
    const fileRegex = /`([^`\s]+\.[a-zA-Z0-9]+)`|(?:\s|^)([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)(?:\s|$)/g;
    
    lines.forEach(line => {
      let match;
      while ((match = fileRegex.exec(line)) !== null) {
        const file = match[1] || match[2];
        if (file && !files.includes(file) && !file.startsWith("http")) {
          files.push(file);
        }
      }
    });

    return { files, raw: output };
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">DevFlow <span>Agent</span></span>
        </div>
        <span className="badge">Powered by Gemini + ADK</span>
      </header>

      <main className="main">
        <div className="hero">
          <h1>GitHub Issue → Code Fix Pipeline</h1>
          <p>Paste any GitHub issue details. Our AI agents will analyze the scope, generate a robust code fix, draft a PR description, and evaluate it.</p>
        </div>

        <div className="input-card">
          <div className="input-row">
            <div className="input-group">
              <label>Repository Owner</label>
              <input
                placeholder="e.g. facebook"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Repository Name</label>
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

          {error && (
            <p className="error">
              <span>⚠️</span> {error}
            </p>
          )}

          <button
            className={`analyse-btn ${loading ? "loading" : ""}`}
            onClick={handleAnalyse}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Agents Collaborating...
              </>
            ) : (
              "Run DevFlow Agent Pipeline →"
            )}
          </button>
        </div>

        {loading && (
          <div className="pipeline-status">
            <div className="pipeline-step active">
              <span className="step-dot"></span>
              <span>Reader Agent — Fetching issue contents and scanning repository...</span>
            </div>
            <div className="pipeline-step">
              <span className="step-dot"></span>
              <span>Coder Agent — Analyzing code files and writing fix...</span>
            </div>
            <div className="pipeline-step">
              <span className="step-dot"></span>
              <span>Reviewer Agent — Testing edge cases and grading quality...</span>
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
                  {tab === "reader" && "📖 1. Reader Analysis"}
                  {tab === "coder" && "💻 2. Proposed Code Fix"}
                  {tab === "reviewer" && "🔍 3. Reviewer Verdict"}
                </button>
              ))}
            </div>
            
            <div className="tab-content">
              {/* READER TAB */}
              {activeTab === "reader" && (() => {
                const parsed = parseReaderOutput(result.reader);
                return (
                  <div className="split-layout">
                    <div className="sub-card">
                      <h3>Analysis Summary</h3>
                      <pre className="raw-text">{parsed.raw}</pre>
                    </div>
                    <div className="sub-card">
                      <h3>Identified Affected Files</h3>
                      {parsed.files.length > 0 ? (
                        <div className="file-timeline">
                          {parsed.files.map((file, i) => (
                            <div key={i} className="file-timeline-item">
                              <span>📁 {file}</span>
                              <span className="timeline-badge">Inspect Target</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#666", fontSize: "14px" }}>Scanning repository contents to identify targets...</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* CODER TAB */}
              {activeTab === "coder" && (() => {
                const { code, description } = parseCoderOutput(result.coder);
                return (
                  <div className="split-layout">
                    <div className="sub-card">
                      <h3>
                        Proposed Code Fix
                        {code && (
                          <button className="copy-btn" onClick={() => copyToClipboard(code)}>
                            Copy Code
                          </button>
                        )}
                      </h3>
                      {code ? (
                        <div className="code-viewer-container">
                          <pre><code>{code}</code></pre>
                        </div>
                      ) : (
                        <pre className="raw-text">{result.coder}</pre>
                      )}
                    </div>
                    <div className="sub-card">
                      <h3>PR Title & Description</h3>
                      <div className="markdown-body">
                        <pre className="raw-text" style={{ fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
                          {description}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* REVIEWER TAB */}
              {activeTab === "reviewer" && (() => {
                const { score, verdict, content } = parseReviewerOutput(result.reviewer);
                return (
                  <div className="reviewer-grid">
                    <div style={{ display: "grid", gridTemplateColumns: score || verdict ? "220px 1fr" : "1fr", gap: "24px" }}>
                      {(score || verdict) && (
                        <div className="score-gauge-card">
                          {score && (
                            <>
                              <div className="gauge-ring">
                                <div className="gauge-ring-content">
                                  <div className="score-val">{score.split("/")[0]}</div>
                                  <div className="score-label">/10</div>
                                </div>
                              </div>
                            </>
                          )}
                          {verdict && (
                            <div className={`verdict-banner ${verdict.includes("APPROVE") ? "approve" : "changes"}`}>
                              {verdict}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="reviewer-text-card">
                        <h3 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#ff6b00", marginBottom: "16px" }}>
                          Detailed Reviewer Report
                        </h3>
                        <pre className="raw-text">{content}</pre>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
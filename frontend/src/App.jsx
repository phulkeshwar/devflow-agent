import { useState } from "react";
import axios from "axios";
import "./App.css";

// The API endpoint of our FastAPI backend uvicorn server
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function App() {
  // Input option tab state
  const [inputOption, setInputOption] = useState("issue-url"); // "issue-url" | "repo-issue" | "manual"

  // Input fields state
  const [directIssueUrl, setDirectIssueUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [repoName, setRepoName] = useState("");
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

  // Helper to parse repo URL, path, or full issue link into owner, repo name, and issue number
  const parseGitHubInput = (input) => {
    let url = input.trim();
    // Remove trailing slashes
    url = url.replace(/\/+$/, "");
    
    let owner = "";
    let repo = "";
    let issueNo = "";

    // Check if it is a full issue link: e.g., https://github.com/owner/repo/issues/num
    const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i);
    if (issueMatch) {
      owner = issueMatch[1];
      repo = issueMatch[2];
      issueNo = issueMatch[3];
      return { owner, repo, issueNumber: issueNo };
    }
    
    // Check if it starts with http/https
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === "github.com" || urlObj.hostname === "www.github.com") {
          const parts = urlObj.pathname.split("/").filter(Boolean);
          if (parts.length >= 2) {
            owner = parts[0];
            repo = parts[1];
          }
        }
      } catch (e) {
        // ignore and fallback
      }
    } else {
      // Fallback: split by slash (e.g. owner/repo or github.com/owner/repo)
      const parts = url.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const githubIndex = parts.indexOf("github.com");
        if (githubIndex !== -1 && parts.length > githubIndex + 2) {
          owner = githubIndex + 1 < parts.length ? parts[githubIndex + 1] : "";
          repo = githubIndex + 2 < parts.length ? parts[githubIndex + 2] : "";
        } else {
          owner = parts[parts.length - 2];
          repo = parts[parts.length - 1];
        }
      }
    }
    
    return { owner, repo, issueNumber: "" };
  };

  // Event handler for repository input changes to trigger auto-fill
  const handleUrlChange = (val) => {
    setRepoUrl(val);
    const parsed = parseGitHubInput(val);
    if (parsed.issueNumber) {
      setIssueNumber(parsed.issueNumber);
    }
  };

  // Triggers the uvicorn multi-agent pipeline
  const handleAnalyse = async () => {
    let owner = "";
    let repo = "";
    let issueNum = "";

    if (inputOption === "issue-url") {
      if (!directIssueUrl) {
        setError("Please enter the GitHub Issue URL.");
        return;
      }
      const parsed = parseGitHubInput(directIssueUrl);
      if (!parsed.owner || !parsed.repo || !parsed.issueNumber) {
        setError("Could not parse the issue URL. Ensure it follows the format: https://github.com/owner/repo/issues/123");
        return;
      }
      owner = parsed.owner;
      repo = parsed.repo;
      issueNum = parsed.issueNumber;
    } else if (inputOption === "repo-issue") {
      if (!repoUrl || !issueNumber) {
        setError("Please fill in all input fields.");
        return;
      }
      const parsed = parseGitHubInput(repoUrl);
      if (!parsed.owner || !parsed.repo) {
        setError("Could not parse the repository owner and name from the URL or path.");
        return;
      }
      owner = parsed.owner;
      repo = parsed.repo;
      issueNum = issueNumber;
    } else if (inputOption === "manual") {
      if (!ownerName || !repoName || !issueNumber) {
        setError("Please fill in all input fields.");
        return;
      }
      owner = ownerName.trim();
      repo = repoName.trim();
      issueNum = issueNumber;
    }

    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/analyse`, {
        owner,
        repo,
        issue_number: parseInt(issueNum),
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
        <div className="header-actions">
          <a
            href="https://github.com/phulkeshwar/devflow-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="repo-link"
          >
            <svg className="github-icon" viewBox="0 0 16 16" width="14" height="14">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            phulkeshwar/devflow-agent
          </a>
          <span className="badge">Powered by Gemini + ADK</span>
        </div>
      </header>

      <main className="main">
        <div className="hero">
          <h1>GitHub Issue → Code Fix Pipeline</h1>
          <p>Paste any GitHub issue details. Our AI agents will analyze the scope, generate a robust code fix, draft a PR description, and evaluate it.</p>
        </div>

        <div className="input-card">
          <div className="input-options-selector">
            <button
              className={`option-tab ${inputOption === "issue-url" ? "active" : ""}`}
              onClick={() => setInputOption("issue-url")}
            >
              🔗 Direct Issue URL
            </button>
            <button
              className={`option-tab ${inputOption === "repo-issue" ? "active" : ""}`}
              onClick={() => setInputOption("repo-issue")}
            >
              📂 Repo Link + Issue #
            </button>
            <button
              className={`option-tab ${inputOption === "manual" ? "active" : ""}`}
              onClick={() => setInputOption("manual")}
            >
              ✍️ Manual Owner/Repo
            </button>
          </div>

          <div className="input-row">
            {inputOption === "issue-url" && (
              <div className="input-group">
                <label>GitHub Issue Link</label>
                <input
                  placeholder="e.g. https://github.com/facebook/react/issues/12345"
                  value={directIssueUrl}
                  onChange={(e) => setDirectIssueUrl(e.target.value)}
                />
              </div>
            )}

            {inputOption === "repo-issue" && (
              <>
                <div className="input-group">
                  <label>GitHub Repository Link or Path</label>
                  <input
                    placeholder="e.g. https://github.com/facebook/react or facebook/react"
                    value={repoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
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
              </>
            )}

            {inputOption === "manual" && (
              <>
                <div className="input-group">
                  <label>Repository Owner</label>
                  <input
                    placeholder="e.g. facebook"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Repository Name</label>
                  <input
                    placeholder="e.g. react"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
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
              </>
            )}
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
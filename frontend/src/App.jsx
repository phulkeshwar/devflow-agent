import { useState } from "react";
import axios from "axios";
import "./App.css";

// The API endpoint of our FastAPI backend uvicorn server
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function App() {
  // Developer Workspace / DevFlow Suite states
  const [workspaceMode, setWorkspaceMode] = useState("orchestrator"); // "orchestrator" | "code_review" | "task_planning" | "documentation" | "github_issue"
  const [userQuery, setUserQuery] = useState("");
  const [editorCode, setEditorCode] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [orchestrateRes, setOrchestrateRes] = useState(null);
  const [kanbanTasks, setKanbanTasks] = useState([]);

  // Legacy Input option states for Github Issue flow
  const [inputOption, setInputOption] = useState("issue-url");
  const [directIssueUrl, setDirectIssueUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [repoName, setRepoName] = useState("");
  const [issueNumber, setIssueNumber] = useState("");

  // Loading and result states
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("reader");
  const [showDocs, setShowDocs] = useState(false);

  // Helper to copy code to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Code copied to clipboard!");
  };

  // Helper to parse repo URL, path, or full issue link into owner, repo name, and issue number
  const parseGitHubInput = (input) => {
    let url = input.trim();
    url = url.replace(/\/+$/, "");
    let owner = "";
    let repo = "";
    let issueNo = "";

    const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i);
    if (issueMatch) {
      owner = issueMatch[1];
      repo = issueMatch[2];
      issueNo = issueMatch[3];
      return { owner, repo, issueNumber: issueNo };
    }
    
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

  const handleUrlChange = (val) => {
    setRepoUrl(val);
    const parsed = parseGitHubInput(val);
    if (parsed.issueNumber) {
      setIssueNumber(parsed.issueNumber);
    }
  };

  // ── Drag and Drop / File uploader handlers ───────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditorCode(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditorCode(event.target.result);
    };
    reader.readAsText(file);
  };

  // ── API request handler for general DevFlow pipeline ──────────────
  const handleOrchestrate = async () => {
    if (!userQuery.trim() && !editorCode.trim()) {
      setError("Please write a prompt or paste some code.");
      return;
    }

    setError("");
    setOrchestrateRes(null);
    setResult(null);
    setLoading(true);

    try {
      let fullQuery = userQuery;
      if (editorCode) {
        fullQuery = `${userQuery}\n\n[Code Context${uploadedFile ? ` from ${uploadedFile.name}` : ""}]\n\`\`\`\n${editorCode}\n\`\`\``;
      }

      let agentParam = null;
      if (workspaceMode === "code_review") agentParam = "code_review";
      else if (workspaceMode === "task_planning") agentParam = "task_planning";
      else if (workspaceMode === "documentation") agentParam = "documentation";

      const res = await axios.post(`${API}/orchestrate`, {
        query: fullQuery,
        agent: agentParam
      });

      if (res.data && res.data.success) {
        setOrchestrateRes({
          route: res.data.route,
          explanation: res.data.explanation,
          output: res.data.output
        });

        if (res.data.route === "task_planning") {
          const tasks = parseTaskPlannerOutput(res.data.output);
          setKanbanTasks(tasks);
        }
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

  // ── Legacy API request handler for GitHub issue flow ──────────────
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
    setOrchestrateRes(null);
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
        setActiveTab("reader");
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
  const parseCoderOutput = (output) => {
    if (!output) return { code: "", description: "" };
    const codeFixIndex = output.indexOf("--- CODE FIX ---");
    const prDescriptionIndex = output.indexOf("--- PR DESCRIPTION ---");
    let code = "";
    let description = output;

    if (codeFixIndex !== -1 && prDescriptionIndex !== -1) {
      if (codeFixIndex < prDescriptionIndex) {
        code = output.slice(codeFixIndex + 16, prDescriptionIndex).trim();
        description = output.slice(prDescriptionIndex + 22).trim();
      } else {
        description = output.slice(prDescriptionIndex + 22, codeFixIndex).trim();
        code = output.slice(codeFixIndex + 16).trim();
      }
    }
    code = code.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    return { code, description };
  };

  const parseReviewerOutput = (output) => {
    if (!output) return { score: "", verdict: "", content: "", codeFix: "" };
    let cleaned = output.replace("--- REVIEW ---", "").trim();

    // Separate Code Fix if reviewer agent returned it
    let codeFix = "";
    const codeFixIndex = cleaned.indexOf("--- CODE FIX ---");
    if (codeFixIndex !== -1) {
      codeFix = cleaned.slice(codeFixIndex + 16).trim();
      cleaned = cleaned.slice(0, codeFixIndex).trim();
    }

    const scoreMatch = cleaned.match(/Score:\s*([0-9.]+\s*\/10)/i);
    let score = "";
    if (scoreMatch) {
      score = scoreMatch[1];
      cleaned = cleaned.replace(scoreMatch[0], "").trim();
    }

    const verdictMatch = cleaned.match(/Recommendation:\s*(APPROVE|REQUEST CHANGES)/i);
    let verdict = "";
    if (verdictMatch) {
      verdict = verdictMatch[1].toUpperCase();
      cleaned = cleaned.replace(verdictMatch[0], "").trim();
    }

    codeFix = codeFix.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    return { score, verdict, content: cleaned, codeFix };
  };

  const parseReaderOutput = (output) => {
    if (!output) return { files: [], raw: "" };
    const lines = output.split("\n");
    const files = [];
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

  const parseTaskPlannerOutput = (output) => {
    if (!output) return [];
    const lines = output.split("\n");
    const tasks = [];
    let idCounter = 1;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
        const textPart = trimmed.replace(/^-\s*\[[ x]\]\s*/i, "").trim();
        const parts = textPart.split("|");
        const description = parts[0]?.trim() || "Untitled Task";
        
        let priority = "Medium";
        let estimate = "1h";
        let dependencies = "None";
        
        parts.slice(1).forEach(part => {
          const lower = part.toLowerCase();
          if (lower.includes("priority:")) {
            priority = part.replace(/priority:\s*/i, "").trim();
          } else if (lower.includes("estimate:")) {
            estimate = part.replace(/estimate:\s*/i, "").trim();
          } else if (lower.includes("dependencies:")) {
            dependencies = part.replace(/dependencies:\s*/i, "").trim();
          }
        });
        
        tasks.push({
          id: idCounter++,
          text: description,
          priority,
          estimate,
          dependencies,
          checked: false
        });
      }
    });
    return tasks;
  };

  const parseDocumentationOutput = (output) => {
    if (!output) return { type: "README", content: "" };
    let cleaned = output.replace("--- DOCUMENTATION ---", "").trim();
    const typeMatch = cleaned.match(/Document Type:\s*([^\n]+)/i);
    let docType = "README";
    if (typeMatch) {
      docType = typeMatch[1].trim();
      cleaned = cleaned.replace(typeMatch[0], "").trim();
    }
    return { type: docType, content: cleaned };
  };

  const parseInlineMarkdown = (text) => {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Parse checkbox formats [ ] and [x]
    html = html.replace(/\[\s*\]/g, '<input type="checkbox" disabled style="vertical-align: middle; margin-right: 6px; pointer-events: none;" />');
    html = html.replace(/\[[xX]\]/g, '<input type="checkbox" disabled checked style="vertical-align: middle; margin-right: 6px; pointer-events: none;" />');

    // Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Inline Code (`code`)
    html = html.replace(/`(.*?)`/g, '<code class="doc-inline-code">$1</code>');

    return html;
  };

  const renderMarkdownToHTML = (markdown) => {
    if (!markdown) return "";
    const lines = markdown.split("\n");
    let inList = false;
    let inCodeBlock = false;
    let resultHtml = [];

    lines.forEach(line => {
      let trimmed = line.trim();

      // Code blocks
      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) {
          resultHtml.push('<pre class="doc-code-block"><code>');
        } else {
          resultHtml.push('</code></pre>');
        }
        return;
      }

      if (inCodeBlock) {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        resultHtml.push(escaped + "\n");
        return;
      }

      // Horizontal Rule (--- or ***)
      if (/^[*-]{3,}$/.test(trimmed)) {
        resultHtml.push('<hr class="doc-hr" />');
        return;
      }

      // List points
      const isListItem = trimmed.startsWith("* ") || trimmed.startsWith("- ");
      if (isListItem) {
        if (!inList) {
          resultHtml.push('<ul class="doc-list">');
          inList = true;
        }
        const text = trimmed.substring(2);
        resultHtml.push(`<li>${parseInlineMarkdown(text)}</li>`);
        return;
      } else {
        if (inList) {
          resultHtml.push('</ul>');
          inList = false;
        }
      }

      // Heading regex matches (# to ######)
      if (trimmed.startsWith("#")) {
        const hashMatch = trimmed.match(/^(#+)\s*(.*)$/);
        if (hashMatch) {
          const level = Math.min(hashMatch[1].length, 6);
          const text = hashMatch[2] || "\u00a0";
          resultHtml.push(`<h${level}>${parseInlineMarkdown(text)}</h${level}>`);
          return;
        }
      }

      if (trimmed === "") {
        resultHtml.push('<br/>');
      } else {
        resultHtml.push(`<p>${parseInlineMarkdown(line)}</p>`);
      }
    });

    if (inList) {
      resultHtml.push('</ul>');
    }
    return resultHtml.join("");
  };

  const toggleTaskCheck = (taskId) => {
    setKanbanTasks(prev => 
      prev.map(t => t.id === taskId ? { ...t, checked: !t.checked } : t)
    );
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">DevFlow <span>Agentic Suite</span></span>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowDocs(true)} className="docs-btn">
            📚 Docs
          </button>
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

      <div className="workspace-selectors">
        <button
          className={`workspace-tab ${workspaceMode === "orchestrator" ? "active" : ""}`}
          onClick={() => { setWorkspaceMode("orchestrator"); setOrchestrateRes(null); setResult(null); setError(""); }}
        >
          🤖 Orchestrator (Auto)
        </button>
        <button
          className={`workspace-tab ${workspaceMode === "code_review" ? "active" : ""}`}
          onClick={() => { setWorkspaceMode("code_review"); setOrchestrateRes(null); setResult(null); setError(""); }}
        >
          🔍 Code Reviewer
        </button>
        <button
          className={`workspace-tab ${workspaceMode === "task_planning" ? "active" : ""}`}
          onClick={() => { setWorkspaceMode("task_planning"); setOrchestrateRes(null); setResult(null); setError(""); }}
        >
          📋 Task Planner
        </button>
        <button
          className={`workspace-tab ${workspaceMode === "documentation" ? "active" : ""}`}
          onClick={() => { setWorkspaceMode("documentation"); setOrchestrateRes(null); setResult(null); setError(""); }}
        >
          📝 Doc Writer
        </button>
        <button
          className={`workspace-tab ${workspaceMode === "github_issue" ? "active" : ""}`}
          onClick={() => { setWorkspaceMode("github_issue"); setOrchestrateRes(null); setResult(null); setError(""); }}
        >
          🔗 GitHub Issue Resolver
        </button>
      </div>

      <main className="main">
        {/* HERO TITLE BLOCK */}
        <div className="hero">
          {workspaceMode === "orchestrator" && (
            <>
              <h1>DevFlow Smart Orchestrator</h1>
              <p>Type any developer request or upload a file. The Orchestrator automatically routes it to the specialized agent.</p>
            </>
          )}
          {workspaceMode === "code_review" && (
            <>
              <h1>Code Review Specialist</h1>
              <p>Upload a file or paste code. The agent scans security bugs, syntax leaks, complexity smells, and suggests optimized refactoring.</p>
            </>
          )}
          {workspaceMode === "task_planning" && (
            <>
              <h1>Task Planner Specialist</h1>
              <p>Provide feature requirements, user stories, or design criteria. The agent generates sprint checklist cards with estimated complexity.</p>
            </>
          )}
          {workspaceMode === "documentation" && (
            <>
              <h1>Documentation Specialist</h1>
              <p>Generate detailed JSDoc comments, Sphinx docstrings, API specifications, or README guidelines directly from your code.</p>
            </>
          )}
          {workspaceMode === "github_issue" && (
            <>
              <h1>GitHub Issue → Code Fix Pipeline</h1>
              <p>Resolve issue tickets autonomously. The system reads the issue, locates targets, writes fixes, and executes code quality checks.</p>
            </>
          )}
        </div>

        {/* INPUT CONTAINER */}
        <div className="input-card">
          {workspaceMode === "github_issue" ? (
            <>
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

              {error && <p className="error"><span>⚠️</span> {error}</p>}

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
                  "Run DevFlow Issue Pipeline →"
                )}
              </button>
            </>
          ) : (
            // DEVELOPER WORKSPACE GENERAL MODES
            <>
              <div className="suite-input-grid">
                <div className="suite-input-column">
                  <label className="suite-label">
                    {workspaceMode === "orchestrator" && "Describe your task or paste instructions"}
                    {workspaceMode === "code_review" && "Review instructions (optional)"}
                    {workspaceMode === "task_planning" && "Explain feature requirements & goals"}
                    {workspaceMode === "documentation" && "Documentation instructions (optional)"}
                  </label>
                  <textarea
                    className="suite-textarea"
                    placeholder={
                      workspaceMode === "orchestrator"
                        ? "e.g. Write Sphinx docstrings for this python file, or review this code to optimize closures..."
                        : workspaceMode === "code_review"
                        ? "e.g. Scan this file for timing attacks and clean up code smells..."
                        : workspaceMode === "task_planning"
                        ? "e.g. We need to implement an MFA verification endpoint using Twilio API with 1-day sprint tasks..."
                        : "e.g. Write structured API endpoint documentation for this routes module..."
                    }
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                  />
                </div>

                <div className="suite-input-column">
                  <div className="dropzone-header">
                    <label className="suite-label">Code Sandbox Context</label>
                    {uploadedFile && (
                      <span className="uploaded-file-tag">
                        📄 {uploadedFile.name}
                        <button onClick={() => { setUploadedFile(null); setEditorCode(""); }} className="remove-file-btn">×</button>
                      </span>
                    )}
                  </div>
                  
                  <div
                    className="file-dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                  >
                    <textarea
                      className="suite-code-textarea"
                      placeholder="Paste source code snippet here, or drag & drop a file..."
                      value={editorCode}
                      onChange={(e) => setEditorCode(e.target.value)}
                    />
                    <div className="dropzone-footer">
                      <label className="file-upload-btn">
                        Upload File
                        <input type="file" onChange={handleFileUpload} style={{ display: "none" }} />
                      </label>
                      <span className="dropzone-tip">Supports JS, TS, Python, CSS, HTML</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && <p className="error"><span>⚠️</span> {error}</p>}

              <button
                className={`analyse-btn ${loading ? "loading" : ""}`}
                onClick={handleOrchestrate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Agents Collaborating...
                  </>
                ) : (
                  workspaceMode === "orchestrator"
                    ? "Orchestrate Workspace Query →"
                    : `Execute Specialist Agent →`
                )}
              </button>
            </>
          )}
        </div>

        {/* LOADING INDICATOR FOR ISSUES */}
        {loading && workspaceMode === "github_issue" && (
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

        {/* SUITE ORCHESTRATE OUTPUT VIEW */}
        {orchestrateRes && (
          <div className="suite-result-container">
            {/* Orchestrator Audit Path Logger */}
            <div className="orchestrator-audit-card">
              <div className="audit-header">
                <span className="audit-pulse"></span>
                <h3>Orchestrator Routing Decision</h3>
              </div>
              <div className="audit-body">
                <div className="audit-field">
                  <span className="audit-label">Routed Specialist:</span>
                  <span className={`audit-value route-${orchestrateRes.route}`}>
                    {orchestrateRes.route === "code_review" && "💻 Code Review Agent"}
                    {orchestrateRes.route === "task_planning" && "📋 Task Planner Agent"}
                    {orchestrateRes.route === "documentation" && "📝 Documentation Agent"}
                    {orchestrateRes.route === "general" && "💬 General Knowledge Agent"}
                  </span>
                </div>
                <div className="audit-field">
                  <span className="audit-label">Routing Rationale:</span>
                  <span className="audit-desc">{orchestrateRes.explanation}</span>
                </div>
              </div>
            </div>

            {/* Specialist Output Content Blocks */}
            <div className="specialist-output-card">
              {orchestrateRes.route === "code_review" && (
                (() => {
                  const { score, verdict, content, codeFix } = parseReviewerOutput(orchestrateRes.output);
                  return (
                    <div className="reviewer-suite-layout">
                      <div className="reviewer-grid">
                        <div className={`reviewer-dashboard-grid ${!(score || verdict) ? "single-column" : ""}`}>
                          {(score || verdict) && (
                            <div className="score-gauge-card">
                              {score && (
                                <div className="gauge-ring">
                                  <div className="gauge-ring-content">
                                    <div className="score-val">{score.split("/")[0]}</div>
                                    <div className="score-label">/10</div>
                                  </div>
                                </div>
                              )}
                              {verdict && (
                                <div className={`verdict-banner ${verdict.includes("APPROVE") ? "approve" : "changes"}`}>
                                  {verdict}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="reviewer-text-card">
                            <h3 className="section-title">Detailed Reviewer Report</h3>
                            <pre className="raw-text">{content}</pre>
                          </div>
                        </div>
                      </div>
                      
                      {codeFix && (
                        <div className="sub-card" style={{ marginTop: "24px" }}>
                          <h3>
                            Refactored Code Fix Suggestion
                            <button className="copy-btn" onClick={() => copyToClipboard(codeFix)}>
                              Copy Code
                            </button>
                          </h3>
                          <div className="code-viewer-container">
                            <pre><code>{codeFix}</code></pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {orchestrateRes.route === "task_planning" && (
                <div className="planner-suite-layout">
                  <h3 className="section-title">Sprint Kanban Board</h3>
                  {kanbanTasks.length > 0 ? (
                    <div className="kanban-board">
                      <div className="kanban-column">
                        <h4>📋 To Do ({kanbanTasks.filter(t => !t.checked).length})</h4>
                        <div className="kanban-cards">
                          {kanbanTasks.filter(t => !t.checked).map(task => (
                            <div key={task.id} className="kanban-card">
                              <div className="kanban-card-header">
                                <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                                  {task.priority}
                                </span>
                                <span className="estimate-badge">{task.estimate}</span>
                              </div>
                              <p className="kanban-card-text">{task.text}</p>
                              {task.dependencies !== "None" && (
                                <div className="dependency-tag">🔗 Dep: {task.dependencies}</div>
                              )}
                              <label className="kanban-checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={task.checked} 
                                  onChange={() => toggleTaskCheck(task.id)}
                                />
                                Mark Complete
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="kanban-column">
                        <h4>✅ Completed ({kanbanTasks.filter(t => t.checked).length})</h4>
                        <div className="kanban-cards">
                          {kanbanTasks.filter(t => t.checked).map(task => (
                            <div key={task.id} className="kanban-card completed">
                              <div className="kanban-card-header">
                                <span className="priority-badge done">Done</span>
                                <span className="estimate-badge">{task.estimate}</span>
                              </div>
                              <p className="kanban-card-text">{task.text}</p>
                              <label className="kanban-checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={task.checked} 
                                  onChange={() => toggleTaskCheck(task.id)}
                                />
                                Completed
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="no-tasks-fallback">
                      <p>The planner could not parse task list blocks. Below is the raw breakdown:</p>
                    </div>
                  )}
                  
                  <div className="sub-card" style={{ marginTop: "24px" }}>
                    <h3>
                      Planning Output & Notes
                      <button className="copy-btn" onClick={() => copyToClipboard(orchestrateRes.output)}>
                        Copy Output
                      </button>
                    </h3>
                    <pre className="raw-text" style={{ whiteSpace: "pre-wrap" }}>{orchestrateRes.output}</pre>
                  </div>
                </div>
              )}

              {orchestrateRes.route === "documentation" && (
                (() => {
                  const parsed = parseDocumentationOutput(orchestrateRes.output);
                  return (
                    <div className="split-layout">
                      {/* Left: Raw Markdown Code */}
                      <div className="sub-card">
                        <h3>
                          Raw Documentation Markdown
                          <button className="copy-btn" onClick={() => copyToClipboard(parsed.content)}>
                            Copy Markdown
                          </button>
                        </h3>
                        <div className="code-viewer-container">
                          <pre><code>{parsed.content}</code></pre>
                        </div>
                      </div>

                      {/* Right: Rendered HTML Preview */}
                      <div className="sub-card">
                        <h3>Rendered Preview ({parsed.type})</h3>
                        <div className="markdown-preview">
                          <div
                            className="markdown-rendered-view"
                            dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(parsed.content) }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {orchestrateRes.route === "general" && (
                <div className="general-suite-layout">
                  <h3 className="section-title">Agent Response</h3>
                  <div className="general-response-bubble">
                    <pre className="raw-text" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                      {orchestrateRes.output}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEGACY PIPELINE OUTPUT VIEW */}
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
                      ) : loading ? (
                        <p style={{ color: "#888", fontSize: "14px" }}>Scanning repository contents to identify targets...</p>
                      ) : (
                        <p style={{ color: "#888", fontSize: "14px" }}>No specific files identified. Analysis complete.</p>
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
                const { score, verdict, content, codeFix } = parseReviewerOutput(result.reviewer);
                return (
                  <div className="reviewer-suite-layout">
                    <div className="reviewer-grid">
                      <div className={`reviewer-dashboard-grid ${!(score || verdict) ? "single-column" : ""}`}>
                        {(score || verdict) && (
                          <div className="score-gauge-card">
                            {score && (
                              <div className="gauge-ring">
                                <div className="gauge-ring-content">
                                  <div className="score-val">{score.split("/")[0]}</div>
                                  <div className="score-label">/10</div>
                                </div>
                              </div>
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
                    
                    {codeFix && (
                      <div className="sub-card" style={{ marginTop: "24px" }}>
                        <h3>
                          Refactored Code Fix Suggestion
                          <button className="copy-btn" onClick={() => copyToClipboard(codeFix)}>
                            Copy Code
                          </button>
                        </h3>
                        <div className="code-viewer-container">
                          <pre><code>{codeFix}</code></pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {showDocs && (
        <div className="docs-modal-overlay" onClick={() => setShowDocs(false)}>
          <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
            <header className="docs-header">
              <h2>📚 DevFlow Agentic Suite Documentation</h2>
              <button className="close-btn" onClick={() => setShowDocs(false)}>×</button>
            </header>
            <div className="docs-body">
              <section className="docs-section">
                <h3>🔍 1. How It Works</h3>
                <p>DevFlow is an intelligent multi-agent environment powered by Gemini + ADK:</p>
                <ul>
                  <li><strong>Orchestrator Mode:</strong> Intelligently classifies the query and routes it to the matching agent module, returning a routing audit description.</li>
                  <li><strong>Code Reviewer:</strong> Analyzes raw files or code snippets. Checks variables, memory loops, imports, and outputs an assessment rating out of 10.</li>
                  <li><strong>Task Planner:</strong> Formulates Sprint planning checklist cards based on high-level feature requirements, which rendering into interactive Kanban Boards.</li>
                  <li><strong>Doc Writer:</strong> Automatically writes high-quality Markdown descriptions or code docstrings from functions.</li>
                </ul>
              </section>

              <section className="docs-section">
                <h3>🚀 2. Workspace Integration</h3>
                <ul>
                  <li><strong>File Sandbox:</strong> Drag any code file directly over the editor sandbox. The contents will be loaded instantly to assist your query.</li>
                  <li><strong>Dynamic Kanban:</strong> planner cards can be toggled interactively to track sprint checklists.</li>
                </ul>
              </section>

              <section className="docs-section">
                <h3>💡 3. Setup Specifications</h3>
                <ul>
                  <li><strong>FastAPI backend:</strong> Starts on port <code>8001</code>.</li>
                  <li><strong>Frontend Vite:</strong> Starts on port <code>5174</code>.</li>
                  <li><strong>Localtunnel for Cloud Hosting:</strong> Execute uvicorn and expose port 8001 using <code>lt --port 8001</code> inside your Kaggle container workspace.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
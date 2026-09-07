import { useEffect, useMemo, useState } from "react";
import { fetchModules, syncRecords } from "./lib/api";
import { clearRecords, loadProgress, loadRecords, replaceRecords, saveProgress, saveRecord } from "./lib/storage";
import { modules as fallbackModules } from "./data/modules";
import type { ActivityRecord, LearningModule, ProgressState, Role, Screen, Stage, ViewMode } from "./types/domain";
import { ScienceScene } from "./components/ScienceScene";

const progressKeys = ["prediction", "observation", "explanation", "result"] as const;
const offlineAssets = ["/", "/index.html", "/manifest.webmanifest", "/service-worker.js", "/assets/tuklas-marker.svg"];

function App() {
  const [role, setRole] = useState<Role | "">(() => (localStorage.getItem("tuklas-role") as Role | null) || "");
  const [screen, setScreen] = useState<Screen>("home");
  const [history, setHistory] = useState<Screen[]>([]);
  const [modules, setModules] = useState<LearningModule[]>(fallbackModules);
  const [activeModule, setActiveModule] = useState<LearningModule>(fallbackModules[0]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [progress, setProgressState] = useState<ProgressState>(() => loadProgress());
  const [query, setQuery] = useState("");
  const [selectedPrediction, setSelectedPrediction] = useState("");
  const [predictionNote, setPredictionNote] = useState("");
  const [predictionReview, setPredictionReview] = useState("");
  const [evidence, setEvidence] = useState("");
  const [explanation, setExplanation] = useState("");
  const [reflection, setReflection] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("tuklas-view-mode") as ViewMode | null) || "ar");
  const [force, setForce] = useState(2);
  const [mass, setMass] = useState(1);
  const [cartDistance, setCartDistance] = useState(0);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineStatus, setOfflineStatus] = useState("Cache app shell, six modules, marker, and local records support.");
  const [deviceStatus, setDeviceStatus] = useState("Camera, WebGL, service worker, and storage readiness.");
  const [updateStatus, setUpdateStatus] = useState("Last checked: Today");

  const visibleModules = useMemo(
    () => modules.filter((item) => `${item.title} ${item.subtitle} ${item.quarter}`.toLowerCase().includes(query.toLowerCase())),
    [modules, query],
  );
  const progressCount = progressKeys.filter((key) => progress[activeModule.id]?.[key]).length;
  const percent = Math.round((progressCount / progressKeys.length) * 100);
  const acceleration = force / mass;

  const nextTask =
    progressCount === 0
      ? ["Predict: Identify the variables", "Set your prediction before observing the marker-based activity."]
      : progressCount === 1
        ? ["Observe: Collect evidence", "Run the AR or 3D activity and record data."]
        : progressCount === 2
          ? ["Explain: Use evidence", "Connect observations to scientific ideas."]
          : ["Result: Review work", "Read feedback and write a reflection."];

  useEffect(() => {
    loadRecords().then(setRecords);
    fetchModules().then(setModules).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("tuklas-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    document.body.classList.toggle("login-open", !role);
  }, [role]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function goTo(nextScreen: Screen, push = true) {
    if (push && screen !== nextScreen) setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    const previous = history.at(-1) || "home";
    setHistory((current) => current.slice(0, -1));
    goTo(previous, false);
  }

  function applyRole(nextRole: Role) {
    setRole(nextRole);
    localStorage.setItem("tuklas-role", nextRole);
    showToast(nextRole === "teacher" ? "Teacher / Demo Mode opened." : "Student Mode opened.");
  }

  async function addRecord(stage: Stage, text: string) {
    const record: ActivityRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: role || "student",
      module: activeModule.title,
      moduleId: activeModule.id,
      mode: viewMode,
      stage,
      text,
      createdAt: new Date().toISOString(),
    };

    const next = [...records, record];
    setRecords(next);
    await saveRecord(record);
  }

  function markProgress(key: (typeof progressKeys)[number]) {
    setProgressState((current) => {
      const next = { ...current, [activeModule.id]: { ...(current[activeModule.id] || {}), [key]: true } };
      saveProgress(next);
      return next;
    });
  }

  async function prepareOffline() {
    try {
      if ("caches" in window) {
        const cache = await caches.open("tuklas-webar-runtime");
        await cache.addAll(offlineAssets);
      }
      const registration = await navigator.serviceWorker?.ready;
      registration?.active?.postMessage({ type: "CACHE_NOW" });
      const estimate = await navigator.storage?.estimate?.();
      const quotaMb = estimate?.quota ? `${Math.round(estimate.quota / 1024 / 1024)} MB storage quota` : "storage ready";
      setOfflineStatus(`Ready: ${modules.length} modules cached; ${quotaMb}.`);
      showToast("Offline files prepared. Reopen once in airplane mode to verify.");
    } catch {
      setOfflineStatus("Offline preparation failed. Check connection and browser storage.");
      showToast("Offline preparation failed.");
    }
  }

  async function checkDevice() {
    const secure = location.protocol === "https:" || location.hostname === "localhost";
    const hasCameraApi = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const camera = hasCameraApi ? (secure ? "camera permission available" : "HTTPS needed for camera") : "camera API unavailable";
    const webgl = document.createElement("canvas").getContext("webgl") ? "WebGL ready" : "WebGL unavailable";
    const serviceWorker = "serviceWorker" in navigator ? "service worker ready" : "service worker unavailable";
    const estimate = await navigator.storage?.estimate?.();
    const storage = estimate?.quota ? `${Math.round(estimate.quota / 1024 / 1024)} MB storage quota` : "storage ready";
    const result = `${camera}; ${webgl}; ${serviceWorker}; ${storage}`;
    setDeviceStatus(result);
    showToast(result);
  }

  async function handleSync() {
    try {
      const unsynced = records.filter((record) => !record.syncedAt);
      const result = await syncRecords(unsynced);
      const syncedIds = new Set(result.records.map((record) => record.id));
      const next = records.map((record) => (syncedIds.has(record.id) ? { ...record, syncedAt: new Date().toISOString() } : record));
      setRecords(next);
      await replaceRecords(next);
      showToast(`${result.records.length} records synced.`);
    } catch {
      showToast("Sync failed. Records are still saved offline.");
    }
  }

  const titles: Record<Screen, [string, string]> = {
    home: ["Home", "Tuklas AR Science Lab"],
    modules: ["Modules", "Six Module Library"],
    detail: ["Predict", activeModule.title],
    observe: [viewMode === "ar" ? "Marker AR" : "3D Fallback", activeModule.title],
    explain: ["Explain", activeModule.title],
    result: ["Result", "Activity Result"],
    settings: ["Settings", "Offline Access"],
  };

  return (
    <div className={role ? `${role}-mode` : "login-open"}>
      {!role && (
        <section className="login-screen" aria-labelledby="loginTitle">
          <div className="brand-bars" aria-hidden="true"><span /><span /><span /></div>
          <div className="login-card">
            <div className="ar-badge" aria-hidden="true">AR</div>
            <p className="eyebrow">Marker-Based WebAR PWA</p>
            <h1 id="loginTitle">Tuklas AR Science Lab</h1>
            <p>Offline-capable POE experiments for browser-based science activities.</p>
            <button className="primary-button" onClick={() => applyRole("student")}>Continue as Student</button>
            <button className="secondary-button" onClick={() => applyRole("teacher")}>Teacher / Demo Mode</button>
          </div>
        </section>
      )}

      <header className="app-header">
        <button className={`back-button ${history.length > 0 && screen !== "home" ? "visible" : ""}`} onClick={goBack} aria-label="Go back">&lt;</button>
        <div>
          <p className="eyebrow">{titles[screen][0]}</p>
          <h1>{titles[screen][1]}</h1>
        </div>
        <button className="status-button">{online ? "Online" : "Offline"}</button>
      </header>

      <main className="screen-stack">
        {screen === "home" && (
          <section className="screen active">
            <article className="hero-card">
              <p className="eyebrow">Recommended Build</p>
              <div className="module-summary">
                <div className="module-icon">PWA</div>
                <div>
                  <h2>React + TypeScript + Three.js + AR.js</h2>
                  <p>Students use a browser, one reusable printed marker, and a 3D fallback when camera AR is weak.</p>
                  <small>Offline-capable after initial download and setup.</small>
                </div>
              </div>
            </article>
            <article className="panel-card marker-panel">
              <div>
                <p className="eyebrow">Reusable Group Marker</p>
                <h2>Print one marker per group</h2>
                <p>Choose any module in the app, then keep this marker visible while observing the experiment.</p>
              </div>
              <a className="marker-preview" href="/assets/tuklas-marker.svg" target="_blank" rel="noreferrer" aria-label="Open printable Tuklas AR marker"><span>TUKLAS</span></a>
            </article>
            <article className="panel-card">
              <div className="row-between">
                <h2>Progress Summary</h2>
                <strong>{percent}% Complete</strong>
              </div>
              <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
              <p>Completed: {progressCount} of {progressKeys.length} activity stages</p>
            </article>
            <button className="task-card" onClick={() => goTo(progressCount === 0 ? "detail" : progressCount === 1 ? "observe" : progressCount === 2 ? "explain" : "result")}>
              <div className="task-icon">P</div>
              <div><strong>{nextTask[0]}</strong><span>{nextTask[1]}</span></div>
              <span aria-hidden="true">&gt;</span>
            </button>
          </section>
        )}

        {screen === "modules" && (
          <section className="screen active">
            <label className="search-box">
              <span>Search modules</span>
              <input type="search" placeholder="Search modules..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="module-list">
              {visibleModules.map((item) => (
                <button className="module-card" key={item.id} onClick={() => { setActiveModule(item); goTo("detail"); }}>
                  <span className="module-icon">{item.icon}</span>
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <span aria-hidden="true">&gt;</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {screen === "detail" && (
          <section className="screen active">
            <article className="panel-card">
              <div className="module-summary">
                <div className="module-icon">{activeModule.icon}</div>
                <div><h2>{activeModule.title}</h2><p>{activeModule.quarter}</p><small>Estimated time: {activeModule.time}</small></div>
              </div>
            </article>
            <article className="panel-card"><p className="eyebrow">Learning Task</p><p>{activeModule.task}</p></article>
            <article className="panel-card">
              <p className="eyebrow">POE Steps</p>
              <div className="poe-steps">{["Predict", "Observe", "Explain"].map((label, index) => <span className={index === 0 ? "active" : ""} key={label}>{index + 1}<small>{label}</small></span>)}</div>
            </article>
            <article className="panel-card">
              <p className="eyebrow">Prediction Question</p>
              <h2>{activeModule.prediction}</h2>
              <div className="choice-list">
                {activeModule.choices.map((choice) => (
                  <label key={choice}><input type="radio" name="predictionChoice" value={choice} checked={selectedPrediction === choice} onChange={(event) => setSelectedPrediction(event.target.value)} /><span>{choice}</span></label>
                ))}
              </div>
              <textarea rows={4} placeholder="Why do you think so?" value={predictionNote} onChange={(event) => setPredictionNote(event.target.value)} />
              <button className="primary-button" onClick={async () => {
                if (!selectedPrediction) return showToast("Choose a prediction to continue.");
                const text = `${selectedPrediction}${predictionNote.trim() ? ` - ${predictionNote.trim()}` : ""}`;
                await addRecord("Predict", text);
                setPredictionReview(`${selectedPrediction}${predictionNote.trim() ? `\n${predictionNote.trim()}` : ""}`);
                markProgress("prediction");
                setCartDistance(0);
                goTo("observe");
              }}>Next</button>
            </article>
          </section>
        )}

        {screen === "observe" && (
          <section className="screen active">
            <article className="ar-panel">
              <div className="row-between">
                <div><p className="eyebrow">{viewMode === "ar" ? "Marker AR Mode" : "Interactive 3D Mode"}</p><h2>{viewMode === "ar" ? "Point the camera at the group marker" : "Use when camera AR is unavailable"}</h2></div>
                <button className="text-button compact-button" onClick={() => setViewMode(viewMode === "ar" ? "fallback" : "ar")}>{viewMode === "ar" ? "Use 3D" : "Use AR"}</button>
              </div>
              <div className={`ar-frame ${viewMode === "fallback" ? "fallback-mode" : ""}`}>
                <div className="camera-layer" aria-hidden="true" />
                <div className="marker-target"><span>TUKLAS</span></div>
                <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
                <ScienceScene acceleration={acceleration} force={force} mass={mass} viewMode={viewMode} />
                <div className="track" />
                <div className="cart" style={{ transform: `translateX(${cartDistance}px)` }}><span>{mass} kg</span></div>
                <div className="force-arrow" style={{ transform: `scaleX(${Math.max(0.2, force / 3)})` }} />
                <div className="hand" aria-hidden="true" />
              </div>
              <div className="tool-grid">{["Labels", "Graph", "Data"].map((label) => <button key={label} onClick={() => showToast(`${label} view selected.`)}>{label}</button>)}</div>
            </article>
            <article className="panel-card">
              <p className="eyebrow">Observation Prompt</p>
              <p>{activeModule.observe}</p>
              <div className="control-grid">
                <label>Force<input type="range" min={0} max={6} step={1} value={force} onChange={(event) => setForce(Number(event.target.value))} /></label>
                <label>Mass<input type="range" min={1} max={4} step={1} value={mass} onChange={(event) => setMass(Number(event.target.value))} /></label>
              </div>
              <div className="data-readout">
                <span>Force <strong>{force} N</strong></span>
                <span>Acceleration <strong>{acceleration.toFixed(1)} m/s^2</strong></span>
              </div>
              <button className="primary-button" onClick={async () => {
                setCartDistance(Math.min(210, 26 + acceleration * 46));
                await addRecord("Observe", `Mode: ${viewMode}; Force: ${force} N; Mass: ${mass} kg; Acceleration: ${acceleration.toFixed(1)} m/s^2`);
                markProgress("observation");
              }}>Run Trial</button>
              <button className="secondary-button" onClick={() => progress[activeModule.id]?.observation ? goTo("explain") : showToast("Run at least one AR or 3D trial first.")}>Continue</button>
            </article>
          </section>
        )}

        {screen === "explain" && (
          <section className="screen active">
            <article className="panel-card">
              <p>Use your observations to explain the results.</p>
              <label className="field-label">My prediction<textarea rows={4} value={predictionReview} onChange={(event) => setPredictionReview(event.target.value)} /></label>
              <label className="field-label">Evidence from observation<textarea rows={5} placeholder="What did you observe? Include data or patterns." value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
              <label className="field-label">Scientific explanation<textarea rows={5} placeholder="Explain why this happened using scientific ideas." value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
              <button className="primary-button" onClick={async () => {
                if (!evidence.trim() || !explanation.trim()) return showToast("Add evidence and a scientific explanation.");
                await addRecord("Explain", `Evidence: ${evidence.trim()} / Explanation: ${explanation.trim()}`);
                markProgress("explanation");
                markProgress("result");
                goTo("result");
              }}>Submit</button>
            </article>
          </section>
        )}

        {screen === "result" && (
          <section className="screen active">
            <article className="result-card"><div className="score-ring"><strong>{Math.max(25, percent)}%</strong><span>Complete</span></div><h2>Great work!</h2><p>Prediction, Observation, and Explanation completed.</p></article>
            <article className="panel-card"><p className="eyebrow">Teacher Review</p><p>Good use of evidence in your observations. Try to explain the relationship between force and acceleration more clearly.</p></article>
            <article className="panel-card">
              <p className="eyebrow">Reflection Prompt</p>
              <p>What did you learn from this activity? How can this be applied in real life?</p>
              <textarea rows={4} placeholder="Write your reflection..." value={reflection} onChange={(event) => setReflection(event.target.value)} />
              <button className="secondary-button" onClick={async () => {
                if (!reflection.trim()) return showToast("Write a reflection before saving.");
                await addRecord("Reflection", reflection.trim());
                setReflection("");
                showToast("Reflection saved.");
              }}>Save Reflection</button>
            </article>
          </section>
        )}

        {screen === "settings" && (
          <section className="screen active">
            <button className="settings-row" onClick={prepareOffline}><span className="settings-icon">DL</span><span><strong>Prepare for Offline Use</strong><small>{offlineStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={handleSync}><span className="settings-icon">SY</span><span><strong>Sync Saved Work</strong><small>{records.filter((record) => !record.syncedAt).length} records waiting for PostgreSQL sync.</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={() => setUpdateStatus("Last checked: just now")}><span className="settings-icon">UP</span><span><strong>Content Updates</strong><small>{updateStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={checkDevice}><span className="settings-icon">OK</span><span><strong>Device Check</strong><small>{deviceStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <article className="panel-card offline-checklist"><p className="eyebrow">Offline Setup</p><ol><li>Open this HTTPS app while connected.</li><li>Tap Prepare for Offline Use.</li><li>Add the app to the home screen.</li><li>Reopen in airplane mode and run one trial.</li></ol></article>
            <article className="panel-card teacher-tools">
              <div className="row-between"><h2>Saved Work</h2><button className="text-button compact-button" onClick={async () => { await clearRecords(); setRecords([]); showToast("Saved progress cleared."); }}>Clear</button></div>
              <div className="records-list">
                {records.length ? records.slice().reverse().map((record) => <article className="record-card" key={record.id}><small>{record.role} / {record.module} / {record.stage} / {new Date(record.createdAt).toLocaleString()} {record.syncedAt ? "/ synced" : "/ offline"}</small><p>{record.text}</p></article>) : <p className="muted">No saved progress on this device yet.</p>}
              </div>
              <button className="secondary-button" onClick={() => {
                const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "tuklas-saved-progress.json";
                link.click();
                URL.revokeObjectURL(url);
              }}>Export JSON</button>
            </article>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {(["home", "modules", "settings"] as Screen[]).map((item) => (
          <button key={item} className={screen === item || (screen === "detail" && item === "modules") ? "active" : ""} onClick={() => goTo(item)}>
            <span>{item[0].toUpperCase()}</span>{item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

export default App;

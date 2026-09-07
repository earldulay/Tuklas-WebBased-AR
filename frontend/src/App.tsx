import { useEffect, useMemo, useState } from "react";
import { fetchModules, syncRecords } from "./lib/api";
import { clearRecords, loadProgress, loadRecords, replaceRecords, saveProgress, saveRecord } from "./lib/storage";
import { modules as fallbackModules } from "./data/modules";
import type { ActivityRecord, LearningModule, ProgressState, Role, Screen, Stage, ViewMode } from "./types/domain";
import { ScienceScene } from "./components/ScienceScene";

const progressKeys = ["prediction", "observation", "explanation", "result"] as const;
const offlineAssets = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/assets/camera_para.dat",
  "/assets/tuklas-marker.patt",
  "/assets/tuklas-marker.png",
  "/assets/tuklas-marker.svg",
];

interface ObservationModel {
  title: string;
  controlA: {
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  };
  controlB: {
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  };
  readouts: { label: string; value: string }[];
  recordText: string;
}

function effectLevel(value: number) {
  if (value < 3) return "Low";
  if (value < 7) return "Moderate";
  return "High";
}

function getObservationModel(moduleId: string, controlA: number, controlB: number): ObservationModel {
  if (moduleId === "electricity") {
    const current = controlA / controlB;
    return {
      title: "Series Circuit Model",
      controlA: { label: "Voltage", min: 3, max: 12, step: 1, unit: "V" },
      controlB: { label: "Resistance", min: 1, max: 10, step: 1, unit: "ohm" },
      readouts: [
        { label: "Voltage", value: `${controlA} V` },
        { label: "Resistance", value: `${controlB} ohm` },
        { label: "Current", value: `${current.toFixed(2)} A` },
      ],
      recordText: `Voltage: ${controlA} V; Resistance: ${controlB} ohm; Current: ${current.toFixed(2)} A`,
    };
  }

  if (moduleId === "materials") {
    const evidence = controlA + controlB >= 7 ? "Gas or precipitate visible" : "No strong new-substance evidence";
    return {
      title: "Reaction Evidence Model",
      controlA: { label: "Heat level", min: 0, max: 5, step: 1, unit: "" },
      controlB: { label: "Mixing level", min: 0, max: 5, step: 1, unit: "" },
      readouts: [
        { label: "Heat", value: `${controlA}/5` },
        { label: "Mixing", value: `${controlB}/5` },
        { label: "Evidence", value: evidence },
      ],
      recordText: `Heat level: ${controlA}/5; Mixing level: ${controlB}/5; Evidence: ${evidence}`,
    };
  }

  if (moduleId === "life") {
    const traitEffect = effectLevel(controlA + controlB);
    return {
      title: "DNA and Trait Model",
      controlA: { label: "DNA changes", min: 0, max: 5, step: 1, unit: "" },
      controlB: { label: "Expression strength", min: 1, max: 5, step: 1, unit: "" },
      readouts: [
        { label: "Changed bases", value: String(controlA) },
        { label: "Expression", value: `${controlB}/5` },
        { label: "Trait effect", value: traitEffect },
      ],
      recordText: `DNA changes: ${controlA}; Expression strength: ${controlB}/5; Trait effect: ${traitEffect}`,
    };
  }

  if (moduleId === "earth-space") {
    const daylight = 12 + Math.round(Math.cos((controlA * Math.PI) / 180) * controlB) / 2;
    return {
      title: "Earth-Sun Pattern Model",
      controlA: { label: "Earth tilt", min: 0, max: 45, step: 5, unit: "deg" },
      controlB: { label: "Sun angle", min: 0, max: 8, step: 1, unit: "" },
      readouts: [
        { label: "Tilt", value: `${controlA} deg` },
        { label: "Sun angle", value: `${controlB}/8` },
        { label: "Daylight", value: `about ${daylight.toFixed(1)} h` },
      ],
      recordText: `Earth tilt: ${controlA} deg; Sun angle: ${controlB}/8; Daylight pattern: about ${daylight.toFixed(1)} h`,
    };
  }

  if (moduleId === "ecosystems") {
    const consumers = Math.round(controlA * (1 - controlB / 12));
    const stability = consumers >= 55 ? "Stable" : consumers >= 30 ? "At risk" : "Disrupted";
    return {
      title: "Food Web Energy Model",
      controlA: { label: "Producers", min: 20, max: 100, step: 10, unit: "%" },
      controlB: { label: "Consumer pressure", min: 0, max: 8, step: 1, unit: "" },
      readouts: [
        { label: "Producers", value: `${controlA}%` },
        { label: "Pressure", value: `${controlB}/8` },
        { label: "Consumers", value: stability },
      ],
      recordText: `Producer population: ${controlA}%; Consumer pressure: ${controlB}/8; Consumer response: ${consumers}% (${stability})`,
    };
  }

  const acceleration = controlA / controlB;
  return {
    title: "Force and Motion Model",
    controlA: { label: "Force", min: 0, max: 6, step: 1, unit: "N" },
    controlB: { label: "Mass", min: 1, max: 4, step: 1, unit: "kg" },
    readouts: [
      { label: "Force", value: `${controlA} N` },
      { label: "Mass", value: `${controlB} kg` },
      { label: "Acceleration", value: `${acceleration.toFixed(1)} m/s^2` },
    ],
    recordText: `Force: ${controlA} N; Mass: ${controlB} kg; Acceleration: ${acceleration.toFixed(1)} m/s^2`,
  };
}

function getObservationDefaults(moduleId: string) {
  if (moduleId === "electricity") return { controlA: 6, controlB: 3 };
  if (moduleId === "materials") return { controlA: 2, controlB: 2 };
  if (moduleId === "life") return { controlA: 1, controlB: 3 };
  if (moduleId === "earth-space") return { controlA: 25, controlB: 4 };
  if (moduleId === "ecosystems") return { controlA: 80, controlB: 2 };
  return { controlA: 2, controlB: 1 };
}

function ActivityVisual({ moduleId, controlA, controlB, trialPulse }: { moduleId: string; controlA: number; controlB: number; trialPulse: number }) {
  if (moduleId === "motion") {
    const acceleration = controlA / controlB;
    const cartDistance = Math.min(210, 26 + acceleration * 46);
    return (
      <>
        <ScienceScene acceleration={acceleration} force={controlA} mass={controlB} viewMode="fallback" />
        <div className="track" />
        <div className="cart" style={{ transform: `translateX(${trialPulse ? cartDistance : 0}px)` }}><span>{controlB} kg</span></div>
        <div className="force-arrow" style={{ transform: `scaleX(${Math.max(0.2, controlA / 3)})` }} />
        <div className="hand" aria-hidden="true" />
      </>
    );
  }

  if (moduleId === "electricity") {
    const glow = Math.min(1, controlA / controlB / 4);
    return (
      <div className="activity-visual circuit-visual" data-pulse={trialPulse}>
        <div className="battery"><span>{controlA} V</span></div>
        <div className="wire-loop" />
        <div className="resistor"><span>{controlB} ohm</span></div>
        <div className="bulb" style={{ opacity: 0.35 + glow }} />
      </div>
    );
  }

  if (moduleId === "materials") {
    const reaction = controlA + controlB;
    return (
      <div className="activity-visual reaction-visual" data-pulse={trialPulse}>
        <div className="beaker">
          <span className="liquid" style={{ height: `${38 + reaction * 4}%` }} />
          {Array.from({ length: Math.min(10, reaction + 1) }).map((_, index) => <i key={index} />)}
        </div>
        <div className="sample-card">{reaction >= 7 ? "Visible evidence formed" : "Compare control and treatment"}</div>
      </div>
    );
  }

  if (moduleId === "life") {
    return (
      <div className="activity-visual dna-visual" data-pulse={trialPulse}>
        {Array.from({ length: 8 }).map((_, index) => <span className={index < controlA ? "changed" : ""} key={index} />)}
        <div className="trait-meter"><span style={{ width: `${Math.min(100, (controlA + controlB) * 10)}%` }} /></div>
      </div>
    );
  }

  if (moduleId === "earth-space") {
    return (
      <div className="activity-visual space-visual" data-pulse={trialPulse}>
        <div className="sun" />
        <div className="earth" style={{ transform: `rotate(${controlA - 20}deg)` }}><span /></div>
        <div className="orbit-line" style={{ opacity: 0.3 + controlB / 14 }} />
      </div>
    );
  }

  return (
    <div className="activity-visual ecosystem-visual" data-pulse={trialPulse}>
      <div className="producer-bar"><span style={{ height: `${controlA}%` }} /></div>
      <div className="food-web">
        <span>Producers</span>
        <span>Consumers</span>
        <span>Predators</span>
      </div>
      <div className="pressure-meter"><span style={{ width: `${controlB * 12.5}%` }} /></div>
    </div>
  );
}

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
  const [controlA, setControlA] = useState(2);
  const [controlB, setControlB] = useState(1);
  const [trialPulse, setTrialPulse] = useState(0);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineStatus, setOfflineStatus] = useState("Cache app shell, six modules, marker, and local records support.");
  const [deviceStatus, setDeviceStatus] = useState("Camera, WebGL, service worker, and storage readiness.");
  const [cameraStatus, setCameraStatus] = useState("Camera is off.");
  const [cameraReady, setCameraReady] = useState(false);

  const visibleModules = useMemo(
    () => modules.filter((item) => `${item.title} ${item.subtitle} ${item.quarter}`.toLowerCase().includes(query.toLowerCase())),
    [modules, query],
  );
  const progressCount = progressKeys.filter((key) => progress[activeModule.id]?.[key]).length;
  const percent = Math.round((progressCount / progressKeys.length) * 100);
  const observationModel = getObservationModel(activeModule.id, controlA, controlB);

  const nextTask =
    progressCount === 0
      ? ["Start with Predict", "Choose an answer and explain your reasoning before observing."]
      : progressCount === 1
        ? ["Continue to Observe", "Use the camera view or 3D model, then save trial evidence."]
        : progressCount === 2
          ? ["Finish with Explain", "Connect your data to the science concept."]
          : ["Review Results", "Check your saved work and write a reflection."];

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

  useEffect(() => {
    const defaults = getObservationDefaults(activeModule.id);
    setControlA(defaults.controlA);
    setControlB(defaults.controlB);
    setTrialPulse(0);
  }, [activeModule.id]);

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

  function logout() {
    setRole("");
    setScreen("home");
    setHistory([]);
    localStorage.removeItem("tuklas-role");
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
    home: ["Workspace", "Tuklas AR Science Lab"],
    modules: ["Lessons", "Grade 9 Science Modules"],
    detail: ["Predict", activeModule.title],
    observe: [viewMode === "ar" ? "Camera Observation" : "3D Observation", activeModule.title],
    explain: ["Explain", activeModule.title],
    result: ["Results", "Activity Summary"],
    settings: ["Setup", "Device and Saved Work"],
  };

  if (!role) {
    return (
      <main className="landing-screen" aria-labelledby="landingTitle">
        <section className="landing-hero">
          <p className="eyebrow">Grade 9 WebAR Science Learning</p>
          <h1 id="landingTitle">Tuklas AR Science Lab</h1>
          <p>Predict, observe, and explain science concepts using camera-based classroom activities and offline-ready learning records.</p>
          <div className="landing-actions">
            <button className="primary-button" onClick={() => applyRole("student")}>Continue as Student</button>
            <button className="secondary-button" onClick={() => applyRole("teacher")}>Open Teacher Review</button>
          </div>
        </section>
        <section className="landing-flow" aria-label="Learning flow">
          {["Predict", "Observe", "Explain"].map((step) => <article key={step}><strong>{step}</strong></article>)}
        </section>
        <section className="landing-marker">
          <div>
            <p className="eyebrow">Reusable Group Marker</p>
            <h2>One printed marker per group</h2>
            <p>Students use the same marker across lessons during camera observation.</p>
          </div>
          <a className="marker-preview" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer" aria-label="Open printable Tuklas AR marker"><span>TUKLAS</span></a>
        </section>
      </main>
    );
  }

  return (
    <div className={`${role}-mode`}>
      <header className="app-header">
        <button className={`back-button ${history.length > 0 && screen !== "home" ? "visible" : ""}`} onClick={goBack} aria-label="Go back">&lt;</button>
        <div>
          <p className="eyebrow">{titles[screen][0]}</p>
          <h1>{titles[screen][1]}</h1>
        </div>
        <div className="header-actions">
          <button className="status-button">{online ? "Online" : "Offline"}</button>
          <button className="logout-button" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="screen-stack">
        {screen === "home" && (
          <section className="screen active">
            <article className="hero-card">
              <p className="eyebrow">Current Activity</p>
              <div className="module-summary no-icon">
                <div>
                  <h2>{activeModule.title}</h2>
                  <p>{activeModule.task}</p>
                  <small>{activeModule.quarter} / {activeModule.time}</small>
                </div>
              </div>
            </article>
            <article className="panel-card marker-panel">
              <div>
                <p className="eyebrow">Reusable Group Marker</p>
                <h2>Print one marker per group</h2>
                <p>Use this marker during camera observation so each group can anchor the activity in the same classroom setup.</p>
              </div>
              <a className="marker-preview" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer" aria-label="Open printable Tuklas AR marker"><span>TUKLAS</span></a>
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
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <small>{item.quarter}</small>
                  <span aria-hidden="true">&gt;</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {screen === "detail" && (
          <section className="screen active">
            <article className="panel-card">
              <div className="module-summary no-icon">
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
                setTrialPulse(0);
                goTo("observe");
              }}>Next</button>
            </article>
          </section>
        )}

        {screen === "observe" && (
          <section className="screen active">
            <article className="ar-panel">
              <div className="row-between">
                <div><p className="eyebrow">{viewMode === "ar" ? "Camera Mode" : "3D Model Mode"}</p><h2>{viewMode === "ar" ? "Start the camera and observe the trial" : "Use the model when camera access is unavailable"}</h2></div>
                <button className="text-button compact-button" onClick={() => setViewMode(viewMode === "ar" ? "fallback" : "ar")}>{viewMode === "ar" ? "Use 3D Model" : "Use Camera"}</button>
              </div>
              <div className={`ar-frame ${viewMode === "fallback" ? "fallback-mode" : ""}`}>
                {viewMode === "ar" && (
                  <ScienceScene
                    acceleration={controlA / controlB}
                    force={controlA}
                    mass={controlB}
                    viewMode="ar"
                    onArReady={setCameraReady}
                    onArStatus={setCameraStatus}
                  />
                )}
                {viewMode === "fallback" && <ActivityVisual moduleId={activeModule.id} controlA={controlA} controlB={controlB} trialPulse={trialPulse} />}
              </div>
              {viewMode === "ar" && (
                <>
                  <p className="camera-status">{cameraStatus}</p>
                </>
              )}
            </article>
            <article className="panel-card">
              <p className="eyebrow">Observation Prompt</p>
              <p>{activeModule.observe}</p>
              <div className="control-grid">
                <label>{observationModel.controlA.label}<input type="range" min={observationModel.controlA.min} max={observationModel.controlA.max} step={observationModel.controlA.step} value={controlA} onChange={(event) => setControlA(Number(event.target.value))} /></label>
                <label>{observationModel.controlB.label}<input type="range" min={observationModel.controlB.min} max={observationModel.controlB.max} step={observationModel.controlB.step} value={controlB} onChange={(event) => setControlB(Number(event.target.value))} /></label>
              </div>
              <div className="data-readout">
                {observationModel.readouts.map((readout) => <span key={readout.label}>{readout.label} <strong>{readout.value}</strong></span>)}
              </div>
              <button className="primary-button" disabled={viewMode === "ar" && !cameraReady} onClick={async () => {
                if (viewMode === "ar" && !cameraReady) return showToast("Start the camera before saving an AR trial.");
                setTrialPulse((current) => current + 1);
                await addRecord("Observe", `Mode: ${viewMode}; ${observationModel.recordText}`);
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
            <button className="settings-row" onClick={prepareOffline}><span><strong>Prepare for Offline Use</strong><small>{offlineStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={handleSync}><span><strong>Sync Saved Work</strong><small>{records.filter((record) => !record.syncedAt).length} records waiting for teacher review.</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={checkDevice}><span><strong>Device Check</strong><small>{deviceStatus}</small></span><span aria-hidden="true">&gt;</span></button>
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
            {item === "modules" ? "Lessons" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

export default App;

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError, createSection, createSectionStudent, fetchClassProgress, fetchModules, getSection, listSections, login as apiLogin, registerTeacher, syncRecords } from "./lib/api";
import { clearSession, getStoredUser, setSession } from "./lib/auth";
import { clearRecords, loadProgress, loadRecords, replaceRecords, saveProgress, saveRecord } from "./lib/storage";
import { modules as fallbackModules } from "./data/modules";
import type { ActivityRecord, AuthUser, ClassProgressRecord, LearningModule, ProgressState, Role, Screen, Section, SectionSummary, Stage, ViewMode } from "./types/domain";
import { ScienceScene } from "./components/ScienceScene";
import { Activity, CircuitBoard, Download, Earth, Microscope, Printer, Thermometer, type LucideIcon } from "lucide-react";

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

interface ExperimentTrial {
  id: number;
  values: string[];
}

const organelleNames = ["None", "Nucleus", "Mitochondria", "Chloroplast", "Cell membrane"];
const earthLayerNames = ["Crust", "Mantle", "Outer core", "Inner core"];
const moduleIcons: Record<string, LucideIcon> = {
  motion: Activity,
  electricity: CircuitBoard,
  materials: Thermometer,
  life: Microscope,
  "earth-space": Earth,
};

function ModuleIcon({ moduleId }: { moduleId: string }) {
  const Icon = moduleIcons[moduleId] || Activity;
  return <span className="module-icon" aria-hidden="true"><Icon size={24} strokeWidth={2.2} /></span>;
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
    const state = controlA <= 0 ? "Solid" : controlA < 100 ? "Liquid" : "Gas";
    const arrangement = state === "Solid" ? "Tightly packed, ordered" : state === "Liquid" ? "Close, able to flow" : "Far apart";
    const motion = state === "Solid" ? "Vibrating" : state === "Liquid" ? "Sliding" : "Fast and random";
    return {
      title: "States of Matter Model",
      controlA: { label: "Temperature", min: -20, max: 120, step: 10, unit: "C" },
      controlB: { label: "Particles", min: 12, max: 30, step: 6, unit: "" },
      readouts: [
        { label: "Temperature", value: `${controlA} C` },
        { label: "State", value: state },
        { label: "Arrangement", value: arrangement },
        { label: "Particle motion", value: motion },
      ],
      recordText: `Temperature: ${controlA} C; State: ${state}; Arrangement: ${arrangement}; Motion: ${motion}`,
    };
  }

  if (moduleId === "life") {
    const removed = organelleNames[controlA] || organelleNames[0];
    const functions = ["All major functions available", "Controls cell activities", "Releases usable energy", "Makes food using light", "Controls entry and exit"];
    return {
      title: "Cell Parts Model",
      controlA: { label: "Removed organelle", min: 0, max: 4, step: 1, unit: "" },
      controlB: { label: "Model rotation", min: 0, max: 3, step: 1, unit: "turn" },
      readouts: [
        { label: "Removed", value: removed },
        { label: "Normal function", value: functions[controlA] },
        { label: "Cell result", value: controlA === 0 ? "Functioning normally" : "Function impaired" },
      ],
      recordText: `Removed: ${removed}; Normal function: ${functions[controlA]}; Result: ${controlA === 0 ? "Functioning normally" : "Function impaired"}`,
    };
  }

  if (moduleId === "earth-space") {
    const layer = earthLayerNames[controlB] || earthLayerNames[0];
    const compositions = ["Solid rock", "Hot, slowly flowing rock", "Liquid iron and nickel", "Solid iron and nickel"];
    return {
      title: "Earth Layers Model",
      controlA: { label: "Layer separation", min: 0, max: 3, step: 1, unit: "" },
      controlB: { label: "Selected layer", min: 0, max: 3, step: 1, unit: "" },
      readouts: [
        { label: "Selected layer", value: layer },
        { label: "Composition", value: compositions[controlB] },
        { label: "Position", value: `${controlB + 1} of 4, outside to inside` },
      ],
      recordText: `Selected layer: ${layer}; Composition: ${compositions[controlB]}; Separation: ${controlA}/3`,
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
  if (moduleId === "materials") return { controlA: 20, controlB: 24 };
  if (moduleId === "life") return { controlA: 0, controlB: 0 };
  if (moduleId === "earth-space") return { controlA: 0, controlB: 0 };
  return { controlA: 2, controlB: 1 };
}

function formatControlValue(moduleId: string, control: "a" | "b", value: number, unit: string) {
  if (moduleId === "life" && control === "a") return organelleNames[value];
  if (moduleId === "earth-space" && control === "b") return earthLayerNames[value];
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function ActivityVisual({
  moduleId,
  controlA,
  controlB,
  trialPulse,
  onControlAChange,
  onControlBChange,
}: {
  moduleId: string;
  controlA: number;
  controlB: number;
  trialPulse: number;
  onControlAChange?: (value: number) => void;
  onControlBChange?: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (moduleId === "motion") {
    const acceleration = controlA / controlB;
    const cartDistance = Math.min(210, 26 + acceleration * 46);
    const setForceFromPointer = (clientX: number) => {
      const track = trackRef.current;
      if (!track || !onControlAChange) return;
      const bounds = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
      onControlAChange(Math.round(ratio * 6));
    };

    return (
      <>
        <ScienceScene moduleId={moduleId} controlA={controlA} controlB={controlB} acceleration={acceleration} force={controlA} mass={controlB} viewMode="fallback" />
        <div className="track" ref={trackRef} onPointerDown={(event) => setForceFromPointer(event.clientX)} />
        <div
          className="cart draggable-cart"
          role="slider"
          aria-label="Force"
          aria-valuemin={0}
          aria-valuemax={6}
          aria-valuenow={controlA}
          tabIndex={0}
          style={{ transform: `translateX(${trialPulse ? cartDistance : Math.max(0, controlA * 16)}px)` }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") onControlAChange?.(Math.min(6, controlA + 1));
            if (event.key === "ArrowLeft") onControlAChange?.(Math.max(0, controlA - 1));
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setForceFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) setForceFromPointer(event.clientX);
          }}
        >
          <span>{controlB} kg</span>
        </div>
        <div className="force-arrow" style={{ transform: `scaleX(${Math.max(0.2, controlA / 3)})` }} />
        <div className="hand" aria-hidden="true" />
        <div className="mass-stack" aria-label="Mass blocks">
          {[1, 2, 3, 4].map((mass) => (
            <button className={controlB === mass ? "active" : ""} key={mass} onClick={() => onControlBChange?.(mass)}>
              {mass}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <ScienceScene
      moduleId={moduleId}
      controlA={controlA}
      controlB={controlB}
      acceleration={controlA / Math.max(1, controlB)}
      force={controlA}
      mass={controlB}
      viewMode="fallback"
    />
  );
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const role: Role | "" = user?.role ?? "";
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [students, setStudents] = useState<AuthUser[]>([]);
  const [classRecords, setClassRecords] = useState<ClassProgressRecord[]>([]);
  const [studentUsername, setStudentUsername] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentFormError, setStudentFormError] = useState("");
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [sectionStudents, setSectionStudents] = useState<AuthUser[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [sectionFormError, setSectionFormError] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [history, setHistory] = useState<Screen[]>([]);
  const [modules, setModules] = useState<LearningModule[]>(fallbackModules);
  const [activeModule, setActiveModule] = useState<LearningModule>(fallbackModules[0]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [progress, setProgressState] = useState<ProgressState>(() => loadProgress());
  const [query, setQuery] = useState("");
  const [selectedPredictions, setSelectedPredictions] = useState<string[]>([]);
  const [predictionNote, setPredictionNote] = useState("");
  const [predictionReview, setPredictionReview] = useState("");
  const [evidence, setEvidence] = useState("");
  const [explanation, setExplanation] = useState("");
  const [reflection, setReflection] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("tuklas-view-mode") as ViewMode | null) || "ar");
  const [controlA, setControlA] = useState(2);
  const [controlB, setControlB] = useState(1);
  const [trialPulse, setTrialPulse] = useState(0);
  const [experimentTrials, setExperimentTrials] = useState<ExperimentTrial[]>([]);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineStatus, setOfflineStatus] = useState("Cache app shell, five experiments, marker, and local records support.");
  const [deviceStatus, setDeviceStatus] = useState("Camera, WebGL, service worker, and storage readiness.");
  const [cameraStatus, setCameraStatus] = useState("Camera is off.");
  const [cameraReady, setCameraReady] = useState(false);

  const visibleModules = useMemo(
    () => modules.filter((item) => `${item.title} ${item.subtitle} ${item.quarter}`.toLowerCase().includes(query.toLowerCase())),
    [modules, query],
  );
  const progressCount = progressKeys.filter((key) => progress[activeModule.id]?.[key]).length;
  const percent = Math.round((progressCount / progressKeys.length) * 100);
  const moduleProgress = modules.map((module) => {
    const completed = progressKeys.filter((key) => progress[module.id]?.[key]).length;
    return { module, completed, percent: Math.round((completed / progressKeys.length) * 100) };
  });
  const overallCompleted = moduleProgress.reduce((total, item) => total + item.completed, 0);
  const overallTotal = modules.length * progressKeys.length;
  const overallPercent = overallTotal ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  const observationModel = getObservationModel(activeModule.id, controlA, controlB);
  const isTeacherPreview = role === "teacher";
  const classSummary = useMemo(() => {
    const stagesPerModule = 4; // Predict, Observe, Explain, Reflection
    return students.map((student) => {
      const studentRecords = classRecords.filter((record) => record.userId === student.id);
      const completedStages = modules.reduce((sum, module) => {
        const stages = new Set(studentRecords.filter((record) => record.moduleId === module.id).map((record) => record.stage));
        return sum + stages.size;
      }, 0);
      const totalPossible = modules.length * stagesPerModule;
      return {
        student,
        recordCount: studentRecords.length,
        percent: totalPossible ? Math.round((completedStages / totalPossible) * 100) : 0,
      };
    });
  }, [students, classRecords, modules]);

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

  // Auto-sync: catches records saved while offline (or in a previous
  // session) as soon as the device is online and logged in, instead of
  // relying on the student to remember the manual "Sync Saved Work"
  // button in Settings. Each Predict/Observe/Explain submission also
  // triggers an immediate sync of its own, below.
  useEffect(() => {
    if (online && user) {
      syncUnsyncedRecords(records).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user, records]);

  useEffect(() => {
    localStorage.setItem("tuklas-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (screen === "home" && role === "teacher") {
      fetchClassProgress()
        .then((result) => {
          setStudents(result.students);
          setClassRecords(result.records);
        })
        .catch(() => undefined);
    }
  }, [screen, role]);

  useEffect(() => {
    if (screen === "classes" && role === "teacher") {
      listSections().then((result) => setSections(result.sections)).catch(() => undefined);
    }
  }, [screen, role]);

  useEffect(() => {
    if (screen === "section" && activeSectionId) {
      getSection(activeSectionId)
        .then((result) => {
          setActiveSection(result.section);
          setSectionStudents(result.students);
        })
        .catch(() => undefined);
    }
  }, [screen, activeSectionId]);

  useEffect(() => {
    document.body.classList.toggle("login-open", !role);
  }, [role]);

  useEffect(() => {
    const defaults = getObservationDefaults(activeModule.id);
    setControlA(defaults.controlA);
    setControlB(defaults.controlB);
    setTrialPulse(0);
    setExperimentTrials([]);
    setPredictionNote("");
    setPredictionReview("");

    if (isTeacherPreview) {
      // Teacher Preview answers Predict and Explain correctly up front so a
      // teacher can walk through the "ideal" run without re-deriving the
      // science each time. Observe stays fully manual (see below).
      setSelectedPredictions(activeModule.predictions.map((prediction) => prediction.choices[0]));
      setEvidence(getObservationModel(activeModule.id, defaults.controlA, defaults.controlB).recordText);
      setExplanation(activeModule.overview);
    } else {
      setSelectedPredictions([]);
    }
  }, [activeModule.id, isTeacherPreview]);

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

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await apiLogin(loginUsername.trim(), loginPassword);
      setSession(result.token, result.user);
      setUser(result.user);
      setLoginPassword("");
      showToast(result.user.role === "teacher" ? "Teacher Mode opened." : "Student Mode opened.");
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : "Login failed. Check your connection.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleTeacherSignup(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await registerTeacher(signupUsername.trim(), signupPassword, signupName.trim());
      setSession(result.token, result.user);
      setUser(result.user);
      setSignupPassword("");
      showToast("Teacher account created.");
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : "Sign up failed. Check your connection.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreateSection(event: FormEvent) {
    event.preventDefault();
    setSectionFormError("");
    if (!newSectionName.trim()) {
      setSectionFormError("Section name is required.");
      return;
    }
    try {
      const result = await createSection(newSectionName.trim());
      setSections((current) => [{ ...result.section, studentCount: 0 }, ...current]);
      setNewSectionName("");
      showToast(`Section "${result.section.name}" created.`);
    } catch (error) {
      setSectionFormError(error instanceof ApiError ? error.message : "Could not create section.");
    }
  }

  function openSection(sectionId: string) {
    setActiveSectionId(sectionId);
    setActiveSection(null);
    setSectionStudents([]);
    setShowAddStudent(false);
    goTo("section");
  }

  async function handleCreateSectionStudent(event: FormEvent) {
    event.preventDefault();
    setStudentFormError("");
    if (!activeSectionId) return;
    if (!studentUsername.trim() || !studentPassword || !studentName.trim()) {
      setStudentFormError("Username, password, and name are required.");
      return;
    }
    try {
      const result = await createSectionStudent(activeSectionId, studentUsername.trim(), studentPassword, studentName.trim());
      setSectionStudents((current) => [result.user, ...current]);
      setSections((current) => current.map((section) => (section.id === activeSectionId ? { ...section, studentCount: section.studentCount + 1 } : section)));
      setStudentUsername("");
      setStudentPassword("");
      setStudentName("");
      setShowAddStudent(false);
      showToast(`Student account "${result.user.username}" created.`);
    } catch (error) {
      setStudentFormError(error instanceof ApiError ? error.message : "Could not create student account.");
    }
  }

  function logout() {
    clearSession();
    setUser(null);
    setScreen("home");
    setHistory([]);
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
    return next;
  }

  // Pushes any unsynced records to the server. Takes the records array
  // explicitly (rather than reading the `records` state) so a caller that
  // just added a record can sync it immediately without waiting for a
  // re-render. Fails silently - the records stay saved locally either way
  // and a later sync attempt (manual, reconnect, or next submission) will
  // pick them up.
  async function syncUnsyncedRecords(currentRecords: ActivityRecord[]) {
    if (!navigator.onLine) return currentRecords;
    const unsynced = currentRecords.filter((record) => !record.syncedAt);
    if (!unsynced.length) return currentRecords;

    try {
      const result = await syncRecords(unsynced);
      const syncedIds = new Set(result.records.map((record) => record.id));
      const next = currentRecords.map((record) => (syncedIds.has(record.id) ? { ...record, syncedAt: new Date().toISOString() } : record));
      setRecords(next);
      await replaceRecords(next);
      return next;
    } catch {
      return currentRecords;
    }
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
    const before = records.filter((record) => !record.syncedAt).length;
    if (!before) {
      showToast("Nothing to sync - everything is already saved to your account.");
      return;
    }
    const next = await syncUnsyncedRecords(records);
    const after = next.filter((record) => !record.syncedAt).length;
    if (after === 0) showToast(`${before} record${before === 1 ? "" : "s"} synced.`);
    else if (after < before) showToast(`${before - after} of ${before} records synced. The rest will retry automatically.`);
    else showToast("Sync failed. Records are still saved offline and will retry automatically.");
  }

  function getExperimentTrial() {
    return {
      id: experimentTrials.length + 1,
      values: observationModel.readouts.map((readout) => readout.value),
    };
  }

  const titles: Record<Screen, [string, string]> = {
    home: ["Workspace", "Tuklas AR Science Lab"],
    modules: ["Lessons", "Grade 9 Science Experiments"],
    detail: ["Predict", activeModule.title],
    observe: [viewMode === "ar" ? "Camera Observation" : "3D Observation", activeModule.title],
    explain: ["Explain", activeModule.title],
    result: ["Results", "Activity Summary"],
    settings: ["Setup", isTeacherPreview ? "Device Setup" : "Device and Saved Work"],
    classes: ["Classes", "Sections You Handle"],
    section: ["Section", activeSection?.name || "Section"],
  };

  if (!user) {
    return (
      <main className="landing-screen" aria-labelledby="landingTitle">
        <section className="landing-hero">
          <p className="eyebrow">Grade 9 WebAR Science Learning</p>
          <h1 id="landingTitle">Tuklas AR Science Lab</h1>
          <p>Predict, observe, and explain science concepts using camera-based classroom activities and offline-ready learning records.</p>
        </section>
        <section className="auth-card panel-card">
          <div className="auth-tabs">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log In</button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Teacher Sign Up</button>
          </div>

          {authMode === "login" && (
            <form className="auth-form" onSubmit={handleLogin}>
              <label className="field-label">Username<input type="text" autoComplete="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} required /></label>
              <label className="field-label">Password<input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="primary-button" type="submit" disabled={authLoading}>{authLoading ? "Logging in..." : "Log In"}</button>
              <p className="auth-hint">Students: ask your teacher for a username and password.</p>
            </form>
          )}

          {authMode === "signup" && (
            <form className="auth-form" onSubmit={handleTeacherSignup}>
              <label className="field-label">Full name<input type="text" autoComplete="name" value={signupName} onChange={(event) => setSignupName(event.target.value)} required /></label>
              <label className="field-label">Username<input type="text" autoComplete="username" value={signupUsername} onChange={(event) => setSignupUsername(event.target.value)} required minLength={3} /></label>
              <label className="field-label">Password<input type="password" autoComplete="new-password" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} required minLength={8} /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="primary-button" type="submit" disabled={authLoading}>{authLoading ? "Creating account..." : "Create Teacher Account"}</button>
              <p className="auth-hint">Teacher accounts can create student logins after signing in.</p>
            </form>
          )}
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
            {isTeacherPreview ? (
              <>
                <article className="panel-card overall-progress">
                  <div className="row-between">
                    <div><p className="eyebrow">My Class</p><h2>Class Progress</h2></div>
                    <strong className="overall-percent">{students.length}</strong>
                  </div>
                  <p>{students.length} student account{students.length === 1 ? "" : "s"} - {classRecords.length} submission{classRecords.length === 1 ? "" : "s"} synced</p>
                  <div className="home-actions">
                    <button className="secondary-button compact-button" onClick={() => goTo("classes")}>Manage Classes</button>
                    <button className="text-button compact-button" onClick={() => goTo("modules")}>Preview Lessons</button>
                  </div>
                </article>
                <article className="panel-card class-roster">
                  <p className="eyebrow">Student Progress</p>
                  <div className="module-progress-list">
                    {classSummary.length ? classSummary.map(({ student, recordCount, percent: studentPercent }) => (
                      <div className="module-progress-row" key={student.id}>
                        <span className="student-avatar" aria-hidden="true">{student.name.trim().slice(0, 2).toUpperCase() || "ST"}</span>
                        <div>
                          <div className="row-between"><strong>{student.name}</strong><span>{studentPercent}%</span></div>
                          <div className="progress-track"><span style={{ width: `${studentPercent}%` }} /></div>
                          <small>{recordCount} submission{recordCount === 1 ? "" : "s"} synced</small>
                        </div>
                      </div>
                    )) : <p className="muted">No students yet. Add one from the Classes tab.</p>}
                  </div>
                </article>
              </>
            ) : (
              <article className="panel-card overall-progress">
                <div className="row-between">
                  <div><p className="eyebrow">All Modules</p><h2>Progress Summary</h2></div>
                  <strong className="overall-percent">{overallPercent}%</strong>
                </div>
                <div className="progress-track overall-track"><span style={{ width: `${overallPercent}%` }} /></div>
                <p>{overallCompleted} of {overallTotal} activity stages completed</p>
                <div className="module-progress-list">
                  {moduleProgress.map(({ module, completed, percent: modulePercent }) => (
                    <div className="module-progress-row" key={module.id}>
                      <ModuleIcon moduleId={module.id} />
                      <div>
                        <div className="row-between"><strong>{module.quarter}: {module.title}</strong><span>{modulePercent}%</span></div>
                        <div className="progress-track"><span style={{ width: `${modulePercent}%` }} /></div>
                        <small>{completed} of {progressKeys.length} stages</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}
            <article className="panel-card marker-access">
              <div className="marker-access-copy">
                <div><p className="eyebrow">AR Marker</p><h2>Printable and downloadable marker</h2><p>Open the marker for printing or download a copy for offline classroom use.</p></div>
                <a className="marker-preview" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer" aria-label="Open printable Tuklas AR marker"><span>TUKLAS</span></a>
              </div>
              <div className="marker-actions">
                <a className="primary-button" href="/assets/tuklas-marker.png" target="_blank" rel="noreferrer"><Printer size={18} />Open to Print</a>
                <a className="secondary-button" href="/assets/tuklas-marker.png" download="tuklas-ar-marker.png"><Download size={18} />Download Marker</a>
              </div>
            </article>
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
                  <ModuleIcon moduleId={item.id} />
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
            {isTeacherPreview && <p className="teacher-preview-note">Teacher Preview - explore this lesson before assigning it. Nothing here is saved as student work.</p>}
            <article className="panel-card">
              <div className="module-summary">
                <ModuleIcon moduleId={activeModule.id} />
                <div><h2>{activeModule.title}</h2><p>{activeModule.quarter}</p><small>Estimated time: {activeModule.time}</small></div>
              </div>
            </article>
            <article className="panel-card"><p className="eyebrow">Learning Task</p><p>{activeModule.task}</p></article>
            <article className="panel-card">
              <p className="eyebrow">POE Steps</p>
              <div className="poe-steps">{["Predict", "Observe", "Explain"].map((label, index) => <span className={index === 0 ? "active" : ""} key={label}>{index + 1}<small>{label}</small></span>)}</div>
            </article>
            <article className="panel-card">
              <p className="eyebrow">Prediction Questions</p>
              <div className="prediction-questions">
                {activeModule.predictions.map((prediction, questionIndex) => (
                  <fieldset className="prediction-question" key={prediction.question}>
                    <legend><span>{questionIndex + 1}</span>{prediction.question}</legend>
                    <div className="choice-list">
                      {prediction.choices.map((choice) => (
                        <label key={choice}><input type="radio" name={`prediction-${questionIndex}`} value={choice} checked={selectedPredictions[questionIndex] === choice} onChange={(event) => setSelectedPredictions((current) => { const next = [...current]; next[questionIndex] = event.target.value; return next; })} /><span>{choice}</span></label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <textarea rows={3} placeholder="Why do you think so? (optional)" value={predictionNote} onChange={(event) => setPredictionNote(event.target.value)} />
              <button className="primary-button" onClick={async () => {
                if (activeModule.predictions.some((_, index) => !selectedPredictions[index])) return showToast("Answer all three prediction questions.");
                const answers = activeModule.predictions.map((prediction, index) => `${index + 1}. ${prediction.question}\nAnswer: ${selectedPredictions[index]}`).join("\n\n");
                const text = `${answers}${predictionNote.trim() ? `\n\nReasoning: ${predictionNote.trim()}` : ""}`;
                if (!isTeacherPreview) {
                  const next = await addRecord("Predict", text);
                  await syncUnsyncedRecords(next);
                  markProgress("prediction");
                }
                setPredictionReview(text);
                setTrialPulse(0);
                goTo("observe");
              }}>Next</button>
            </article>
          </section>
        )}

        {screen === "observe" && (
          <section className="screen active">
            {isTeacherPreview && <p className="teacher-preview-note">Teacher Preview - trials run normally but aren't saved as student work.</p>}
            <article className="ar-panel">
              <div className="row-between">
                <div><p className="eyebrow">{viewMode === "ar" ? "Camera Mode" : "3D Model Mode"}</p><h2>{viewMode === "ar" ? "Start the camera and observe the trial" : "Use the model when camera access is unavailable"}</h2></div>
                <button className="text-button compact-button" onClick={() => setViewMode(viewMode === "ar" ? "fallback" : "ar")}>{viewMode === "ar" ? "Use 3D Model" : "Use Camera"}</button>
              </div>
              <div className={`ar-frame ${viewMode === "fallback" ? "fallback-mode" : ""}`}>
                {viewMode === "ar" && (
                  <ScienceScene
                    moduleId={activeModule.id}
                    controlA={controlA}
                    controlB={controlB}
                    acceleration={controlA / controlB}
                    force={controlA}
                    mass={controlB}
                    viewMode="ar"
                    onArReady={setCameraReady}
                    onArStatus={setCameraStatus}
                  />
                )}
                {viewMode === "fallback" && (
                  <ActivityVisual
                    moduleId={activeModule.id}
                    controlA={controlA}
                    controlB={controlB}
                    trialPulse={trialPulse}
                    onControlAChange={setControlA}
                    onControlBChange={setControlB}
                  />
                )}
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
                <label><span>{observationModel.controlA.label} <strong>{formatControlValue(activeModule.id, "a", controlA, observationModel.controlA.unit)}</strong></span><input type="range" min={observationModel.controlA.min} max={observationModel.controlA.max} step={observationModel.controlA.step} value={controlA} onChange={(event) => setControlA(Number(event.target.value))} /></label>
                <label><span>{observationModel.controlB.label} <strong>{formatControlValue(activeModule.id, "b", controlB, observationModel.controlB.unit)}</strong></span><input type="range" min={observationModel.controlB.min} max={observationModel.controlB.max} step={observationModel.controlB.step} value={controlB} onChange={(event) => setControlB(Number(event.target.value))} /></label>
              </div>
              {activeModule.id === "materials" && (
                <div className="experiment-presets" aria-label="Temperature presets">
                  {[[-10, "Cool to solid"], [20, "Warm to liquid"], [110, "Heat to gas"]].map(([value, label]) => (
                    <button className={controlA === value ? "active" : ""} key={label} onClick={() => setControlA(Number(value))}>{label}</button>
                  ))}
                </div>
              )}
              {activeModule.id === "life" && (
                <div className="experiment-presets" aria-label="Organelle removal choices">
                  {organelleNames.map((name, index) => <button className={controlA === index ? "active" : ""} key={name} onClick={() => setControlA(index)}>{index === 0 ? "Restore all" : `Remove ${name}`}</button>)}
                </div>
              )}
              {activeModule.id === "earth-space" && (
                <>
                  <div className="experiment-presets" aria-label="Earth layer separation">
                    {[[0, "Close layers"], [1, "Open slightly"], [3, "Separate fully"]].map(([value, label]) => <button className={controlA === value ? "active" : ""} key={label} onClick={() => setControlA(Number(value))}>{label}</button>)}
                  </div>
                  <div className="experiment-presets" aria-label="Earth layer choices">
                    {earthLayerNames.map((name, index) => <button className={controlB === index ? "active" : ""} key={name} onClick={() => setControlB(index)}>{name}</button>)}
                  </div>
                </>
              )}
              <div className="data-readout">
                {observationModel.readouts.map((readout) => <span key={readout.label}>{readout.label} <strong>{readout.value}</strong></span>)}
              </div>
              <div className="motion-trials" aria-label="Experiment trial results">
                <div className="motion-trial-header" style={{ gridTemplateColumns: `48px repeat(${observationModel.readouts.length}, minmax(110px, 1fr))` }}>
                  <span>Trial</span>{observationModel.readouts.map((readout) => <span key={readout.label}>{readout.label}</span>)}
                </div>
                {experimentTrials.length ? experimentTrials.map((trial) => (
                  <div className="motion-trial-row" style={{ gridTemplateColumns: `48px repeat(${observationModel.readouts.length}, minmax(110px, 1fr))` }} key={trial.id}>
                    <span>{trial.id}</span>{trial.values.map((value, index) => <span key={`${trial.id}-${observationModel.readouts[index]?.label}`}>{value}</span>)}
                  </div>
                )) : <p className="muted">No trials yet. Change a variable, then run a trial.</p>}
              </div>
              <button className="primary-button" disabled={viewMode === "ar" && !cameraReady} onClick={async () => {
                if (viewMode === "ar" && !cameraReady) return showToast("Start the camera before saving an AR trial.");
                setTrialPulse((current) => current + 1);
                setExperimentTrials((current) => [...current, getExperimentTrial()]);
                if (!isTeacherPreview) {
                  const next = await addRecord("Observe", `Mode: ${viewMode}; ${observationModel.recordText}`);
                  await syncUnsyncedRecords(next);
                  markProgress("observation");
                }
              }}>Run Trial</button>
              <button className="secondary-button" onClick={() => (isTeacherPreview || progress[activeModule.id]?.observation) ? goTo("explain") : showToast("Run at least one AR or 3D trial first.")}>Continue</button>
            </article>
          </section>
        )}

        {screen === "explain" && (
          <section className="screen active">
            {isTeacherPreview && <p className="teacher-preview-note">Teacher Preview - your write-up here isn't saved as student work.</p>}
            <article className="panel-card">
              <p>Use your observations to explain the results.</p>
              <label className="field-label">My predictions<textarea className="readonly-field" rows={10} value={predictionReview} readOnly aria-readonly="true" /></label>
              <label className="field-label">Evidence from observation<textarea rows={5} placeholder="What did you observe? Include data or patterns." value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
              <label className="field-label">Scientific explanation<textarea rows={5} placeholder="Explain why this happened using scientific ideas." value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
              <button className="primary-button" onClick={async () => {
                if (!evidence.trim() || !explanation.trim()) return showToast("Add evidence and a scientific explanation.");
                if (!isTeacherPreview) {
                  const next = await addRecord("Explain", `Evidence: ${evidence.trim()} / Explanation: ${explanation.trim()}`);
                  await syncUnsyncedRecords(next);
                  markProgress("explanation");
                  markProgress("result");
                }
                goTo("result");
              }}>Submit</button>
            </article>
          </section>
        )}

        {screen === "result" && (
          <section className="screen active">
            {isTeacherPreview ? (
              <article className="result-card"><div className="score-ring"><strong>OK</strong><span>Preview</span></div><h2>Preview complete</h2><p>Prediction, Observation, and Explanation steps previewed.</p></article>
            ) : (
              <article className="result-card"><div className="score-ring"><strong>{Math.max(25, percent)}%</strong><span>Complete</span></div><h2>Great work!</h2><p>Prediction, Observation, and Explanation completed.</p></article>
            )}
            <article className="panel-card look-back"><p className="eyebrow">Look Back</p><h2>{activeModule.title}</h2><p>{activeModule.overview}</p></article>
            <article className="panel-card">
              <p className="eyebrow">Reflection Prompt</p>
              <p>What did you learn from this activity? How can this be applied in real life?</p>
              <textarea rows={4} placeholder="Write your reflection..." value={reflection} onChange={(event) => setReflection(event.target.value)} />
              <button className="secondary-button" onClick={async () => {
                if (!reflection.trim()) return showToast("Write a reflection before saving.");
                if (!isTeacherPreview) {
                  const next = await addRecord("Reflection", reflection.trim());
                  await syncUnsyncedRecords(next);
                }
                setReflection("");
                showToast(isTeacherPreview ? "Reflection previewed (not saved)." : "Reflection saved.");
              }}>Save Reflection</button>
            </article>
          </section>
        )}

        {screen === "settings" && (
          <section className="screen active">
            <button className="settings-row" onClick={prepareOffline}><span><strong>Prepare for Offline Use</strong><small>{offlineStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={handleSync}><span><strong>Sync Saved Work</strong><small>{records.filter((record) => !record.syncedAt).length} records waiting to sync.</small></span><span aria-hidden="true">&gt;</span></button>
            <button className="settings-row" onClick={checkDevice}><span><strong>Device Check</strong><small>{deviceStatus}</small></span><span aria-hidden="true">&gt;</span></button>
            <article className="panel-card offline-checklist"><p className="eyebrow">Offline Setup</p><ol><li>Open this HTTPS app while connected.</li><li>Tap Prepare for Offline Use.</li><li>Add the app to the home screen.</li><li>Reopen in airplane mode and run one trial.</li></ol></article>
            {!isTeacherPreview && (
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
            )}
          </section>
        )}

        {screen === "classes" && (
          <section className="screen active">
            <article className="panel-card">
              <p className="eyebrow">New Section</p>
              <form className="auth-form compact-form" onSubmit={handleCreateSection}>
                <label className="field-label">Section name<input type="text" placeholder="e.g. Grade 9 - Rizal" value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} required /></label>
                {sectionFormError && <p className="auth-error" role="alert">{sectionFormError}</p>}
                <button className="secondary-button" type="submit">Create Section</button>
              </form>
            </article>
            <div className="module-list">
              {sections.length ? sections.map((section) => (
                <button className="module-card" key={section.id} onClick={() => openSection(section.id)}>
                  <span className="student-avatar" aria-hidden="true">{section.name.trim().slice(0, 2).toUpperCase() || "SC"}</span>
                  <span><strong>{section.name}</strong><small>{section.studentCount} student{section.studentCount === 1 ? "" : "s"}</small></span>
                  <small aria-hidden="true" />
                  <span aria-hidden="true">&gt;</span>
                </button>
              )) : <p className="muted">No sections yet. Create one above.</p>}
            </div>
          </section>
        )}

        {screen === "section" && (
          <section className="screen active">
            <article className="panel-card">
              <p className="eyebrow">Section</p>
              <h2>{activeSection?.name || "Loading..."}</h2>
              <p>{sectionStudents.length} student{sectionStudents.length === 1 ? "" : "s"} enrolled</p>
            </article>
            <article className="panel-card">
              <button type="button" className="row-between disclosure-toggle" onClick={() => setShowAddStudent((current) => !current)} aria-expanded={showAddStudent}>
                <span className="eyebrow">Add Student</span>
                <span className={`disclosure-chevron ${showAddStudent ? "open" : ""}`} aria-hidden="true">&gt;</span>
              </button>
              {showAddStudent && (
                <form className="auth-form compact-form" onSubmit={handleCreateSectionStudent}>
                  <label className="field-label">Full name<input type="text" value={studentName} onChange={(event) => setStudentName(event.target.value)} required /></label>
                  <label className="field-label">Username<input type="text" value={studentUsername} onChange={(event) => setStudentUsername(event.target.value)} required minLength={3} /></label>
                  <label className="field-label">Password<input type="password" value={studentPassword} onChange={(event) => setStudentPassword(event.target.value)} required minLength={8} /></label>
                  {studentFormError && <p className="auth-error" role="alert">{studentFormError}</p>}
                  <button className="secondary-button" type="submit">Add Student</button>
                </form>
              )}
            </article>
            <article className="panel-card">
              <p className="eyebrow">Enrolled Students</p>
              <div className="records-list">
                {sectionStudents.length ? sectionStudents.map((student) => (
                  <article className="record-card" key={student.id}>
                    <small>{student.username}</small>
                    <p>{student.name}</p>
                  </article>
                )) : <p className="muted">No students enrolled yet.</p>}
              </div>
            </article>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {(isTeacherPreview ? (["home", "classes", "settings"] as Screen[]) : (["home", "modules", "settings"] as Screen[])).map((item) => {
          const previewFlowScreens: Screen[] = ["modules", "detail", "observe", "explain", "result"];
          const isActive =
            screen === item ||
            (screen === "detail" && item === "modules") ||
            (screen === "section" && item === "classes") ||
            (isTeacherPreview && item === "home" && previewFlowScreens.includes(screen));
          return (
            <button key={item} className={isActive ? "active" : ""} onClick={() => goTo(item)}>
              {item === "modules" ? "Lessons" : item === "classes" ? "Classes" : item[0].toUpperCase() + item.slice(1)}
            </button>
          );
        })}
      </nav>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

export default App;

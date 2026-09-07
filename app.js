const modules = [
  {
    id: "motion",
    icon: "F",
    title: "Forces and Motion",
    subtitle: "Explore forces, motion, and energy transfer.",
    quarter: "Module 1",
    time: "15-20 min",
    task: "Predict how changing the force applied to an object affects its motion.",
    prediction: "If the force pushing the cart is increased, what will happen to its speed?",
    choices: ["It will increase", "It will stay the same", "It will decrease"],
    observe: "Observe the motion of the cart. What do you notice as the force changes?",
  },
  {
    id: "earth-space",
    icon: "E",
    title: "Earth and Space Science",
    subtitle: "Study Earth systems, weather, and space.",
    quarter: "Module 2",
    time: "20-25 min",
    task: "Use evidence cards to compare models of Earth and space systems.",
    prediction: "Which model will best explain the observed pattern?",
    choices: ["Model A", "Model B", "More evidence is needed"],
    observe: "Compare the evidence cards and record which pattern appears most often.",
  },
  {
    id: "life",
    icon: "L",
    title: "Life Science",
    subtitle: "Understand living things and their interactions.",
    quarter: "Module 3",
    time: "15-20 min",
    task: "Predict how a change in genetic information can affect a trait.",
    prediction: "What might happen when a DNA sequence changes?",
    choices: ["The trait may change", "Nothing can change", "The organism disappears"],
    observe: "Inspect the before-and-after model and record the visible change.",
  },
  {
    id: "materials",
    icon: "M",
    title: "Science of Materials",
    subtitle: "Investigate properties and uses of materials.",
    quarter: "Module 4",
    time: "15-20 min",
    task: "Predict which observations show that a new substance formed.",
    prediction: "Which evidence best suggests a chemical change?",
    choices: ["Gas or precipitate forms", "The object changes position", "The light is brighter"],
    observe: "Compare the control and treatment observations in the simulated reaction.",
  },
];

const screens = ["home", "modules", "detail", "observe", "explain", "result", "settings"];
const progressKeys = ["prediction", "observation", "explanation", "result"];

let role = localStorage.getItem("tuklas-role") || "";
let activeModule = modules[0];
let activeScreen = "home";
let historyStack = [];
let selectedPrediction = "";
let records = JSON.parse(localStorage.getItem("tuklas-records") || "[]");
let progress = JSON.parse(localStorage.getItem("tuklas-progress") || "{}");

const $ = (selector) => document.querySelector(selector);
const els = {
  loginScreen: $("#loginScreen"),
  screenKicker: $("#screenKicker"),
  screenTitle: $("#screenTitle"),
  backButton: $("#backButton"),
  connectionStatus: $("#connectionStatus"),
  homeModuleTitle: $("#homeModuleTitle"),
  homeModuleDesc: $("#homeModuleDesc"),
  homeModuleTime: $("#homeModuleTime"),
  progressPercent: $("#progressPercent"),
  progressBar: $("#progressBar"),
  progressText: $("#progressText"),
  currentTaskTitle: $("#currentTaskTitle"),
  currentTaskDesc: $("#currentTaskDesc"),
  moduleSearch: $("#moduleSearch"),
  moduleList: $("#moduleList"),
  detailIcon: $("#detailIcon"),
  detailTitle: $("#detailTitle"),
  detailQuarter: $("#detailQuarter"),
  detailTime: $("#detailTime"),
  learningTask: $("#learningTask"),
  poeSteps: $("#poeSteps"),
  predictionQuestion: $("#predictionQuestion"),
  predictionChoices: $("#predictionChoices"),
  predictionNote: $("#predictionNote"),
  predictionReview: $("#predictionReview"),
  observationPrompt: $("#observationPrompt"),
  evidenceInput: $("#evidenceInput"),
  explanationInput: $("#explanationInput"),
  reflectionInput: $("#reflectionInput"),
  forceInput: $("#forceInput"),
  massInput: $("#massInput"),
  forceReadout: $("#forceReadout"),
  accelReadout: $("#accelReadout"),
  massLabel: $("#massLabel"),
  cart: $("#cart"),
  forceArrow: $("#forceArrow"),
  scoreText: $("#scoreText"),
  savedCount: $("#savedCount"),
  offlineStatus: $("#offlineStatus"),
  deviceStatus: $("#deviceStatus"),
  updateStatus: $("#updateStatus"),
  recordsList: $("#recordsList"),
  toast: $("#toast"),
};

function saveState() {
  localStorage.setItem("tuklas-records", JSON.stringify(records));
  localStorage.setItem("tuklas-progress", JSON.stringify(progress));
}

function getProgressCount() {
  const state = progress[activeModule.id] || {};
  return progressKeys.filter((key) => state[key]).length;
}

function setProgress(key, value = true) {
  progress[activeModule.id] = { ...(progress[activeModule.id] || {}), [key]: value };
  saveState();
  renderProgress();
}

function goTo(screen, push = true) {
  if (push && activeScreen !== screen) historyStack.push(activeScreen);
  activeScreen = screen;

  for (const name of screens) {
    $(`#${name}Screen`)?.classList.toggle("active", name === screen);
  }

  for (const button of document.querySelectorAll("[data-nav]")) {
    const nav = button.dataset.nav;
    button.classList.toggle("active", nav === screen || (screen === "detail" && nav === "modules"));
  }

  const titles = {
    home: ["Home", "Tuklas AR Science Lab"],
    modules: ["Modules", "Modules Library"],
    detail: ["Predict", activeModule.title],
    observe: ["Observe in AR", activeModule.title],
    explain: ["Explain", activeModule.title],
    result: ["Result", "Activity Result"],
    settings: ["Settings", "Offline Access"],
  };
  els.screenKicker.textContent = titles[screen][0];
  els.screenTitle.textContent = titles[screen][1];
  els.backButton.classList.toggle("visible", historyStack.length > 0 && screen !== "home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyRole(nextRole) {
  role = nextRole;
  localStorage.setItem("tuklas-role", role);
  document.body.classList.remove("login-open", "student-mode", "teacher-mode");
  document.body.classList.add(`${role}-mode`);
  els.loginScreen.classList.add("hidden");
  showToast(role === "teacher" ? "Teacher / Demo Mode opened." : "Student Mode opened.");
  renderRecords();
}

function renderModules() {
  const query = els.moduleSearch.value.trim().toLowerCase();
  const visible = modules.filter((item) =>
    `${item.title} ${item.subtitle}`.toLowerCase().includes(query),
  );

  els.moduleList.innerHTML = visible
    .map(
      (item) => `
        <button class="module-card" data-module="${item.id}">
          <span class="module-icon">${item.icon}</span>
          <span>
            <strong>${item.title}</strong>
            <small>${item.subtitle}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      `,
    )
    .join("");
}

function renderDetail() {
  els.detailIcon.textContent = activeModule.icon;
  els.detailTitle.textContent = activeModule.title;
  els.detailQuarter.textContent = activeModule.quarter;
  els.detailTime.textContent = `Estimated time: ${activeModule.time}`;
  els.learningTask.textContent = activeModule.task;
  els.predictionQuestion.textContent = activeModule.prediction;
  els.observationPrompt.textContent = activeModule.observe;
  els.predictionNote.value = "";
  selectedPrediction = "";

  els.poeSteps.innerHTML = ["Predict", "Observe", "Explain"]
    .map((label, index) => `<span class="${index === 0 ? "active" : ""}">${index + 1}<small>${label}</small></span>`)
    .join("");

  els.predictionChoices.innerHTML = activeModule.choices
    .map(
      (choice) => `
        <label>
          <input type="radio" name="predictionChoice" value="${choice}" />
          <span>${choice}</span>
        </label>
      `,
    )
    .join("");
}

function renderHome() {
  els.homeModuleTitle.textContent = activeModule.title;
  els.homeModuleDesc.textContent = activeModule.subtitle;
  els.homeModuleTime.textContent = `Estimated time: ${activeModule.time}`;
  renderProgress();
}

function renderProgress() {
  const count = getProgressCount();
  const percent = Math.round((count / progressKeys.length) * 100);
  els.progressPercent.textContent = `${percent}% Complete`;
  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = `Completed: ${count} of ${progressKeys.length} activity stages`;
  els.scoreText.textContent = `${Math.max(25, percent)}%`;

  const next =
    count === 0
      ? ["Predict: Identify the variables", "Set your prediction before observing the AR simulation."]
      : count === 1
        ? ["Observe: Collect evidence", "Run the AR activity and record data."]
        : count === 2
          ? ["Explain: Use evidence", "Connect observations to scientific ideas."]
          : ["Result: Review work", "Read feedback and write a reflection."];
  els.currentTaskTitle.textContent = next[0];
  els.currentTaskDesc.textContent = next[1];
}

function renderRecords() {
  els.savedCount.textContent = `${records.length} ${records.length === 1 ? "activity" : "activities"} saved`;
  if (!records.length) {
    els.recordsList.innerHTML = `<p class="muted">No saved progress on this device yet.</p>`;
    return;
  }

  els.recordsList.innerHTML = records
    .slice()
    .reverse()
    .map(
      (record) => `
        <article class="record-card">
          <small>${record.role || "student"} / ${record.module} / ${record.stage || record.step || "Activity"} / ${record.createdAt}</small>
          <p>${record.text || record.response || ""}</p>
        </article>
      `,
    )
    .join("");
}

function updateSimulation(reset = false) {
  const force = Number(els.forceInput.value);
  const mass = Number(els.massInput.value);
  const acceleration = force / mass;
  els.forceReadout.textContent = `${force} N`;
  els.accelReadout.textContent = `${acceleration.toFixed(1)} m/s2`;
  els.massLabel.textContent = `${mass} kg`;
  els.forceArrow.style.transform = `scaleX(${Math.max(0.2, force / 3)})`;
  if (reset) els.cart.style.transform = "translateX(0)";
}

function addRecord(stage, text) {
  records.push({
    role: role || "student",
    module: activeModule.title,
    stage,
    text,
    createdAt: new Date().toLocaleString(),
  });
  saveState();
  renderRecords();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function updateConnectionStatus() {
  els.connectionStatus.textContent = navigator.onLine ? "Online" : "Offline";
}

document.querySelectorAll("[data-role]").forEach((button) => {
  button.addEventListener("click", () => applyRole(button.dataset.role));
});

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => goTo(button.dataset.nav));
});

els.backButton.addEventListener("click", () => {
  const previous = historyStack.pop() || "home";
  goTo(previous, false);
});

$("#continueTask").addEventListener("click", () => {
  const count = getProgressCount();
  goTo(count === 0 ? "detail" : count === 1 ? "observe" : count === 2 ? "explain" : "result");
});

els.moduleSearch.addEventListener("input", renderModules);

els.moduleList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-module]");
  if (!card) return;
  activeModule = modules.find((item) => item.id === card.dataset.module) || modules[0];
  renderHome();
  renderDetail();
  goTo("detail");
});

els.predictionChoices.addEventListener("change", (event) => {
  selectedPrediction = event.target.value;
});

$("#savePrediction").addEventListener("click", () => {
  const note = els.predictionNote.value.trim();
  if (!selectedPrediction) {
    showToast("Choose a prediction to continue.");
    return;
  }
  addRecord("Predict", `${selectedPrediction}${note ? ` - ${note}` : ""}`);
  els.predictionReview.value = `${selectedPrediction}${note ? `\n${note}` : ""}`;
  setProgress("prediction");
  updateSimulation(true);
  goTo("observe");
});

$("#runTrial").addEventListener("click", () => {
  updateSimulation();
  const force = Number(els.forceInput.value);
  const mass = Number(els.massInput.value);
  const distance = Math.min(210, 26 + (force / mass) * 46);
  els.cart.style.transform = `translateX(${distance}px)`;
  addRecord("Observe", `Force: ${force} N; Mass: ${mass} kg; Acceleration: ${(force / mass).toFixed(1)} m/s2`);
  setProgress("observation");
});

$("#continueExplain").addEventListener("click", () => {
  if (!progress[activeModule.id]?.observation) {
    showToast("Run at least one AR trial first.");
    return;
  }
  goTo("explain");
});

$("#submitExplanation").addEventListener("click", () => {
  const evidence = els.evidenceInput.value.trim();
  const explanation = els.explanationInput.value.trim();
  if (!evidence || !explanation) {
    showToast("Add evidence and a scientific explanation.");
    return;
  }
  addRecord("Explain", `Evidence: ${evidence} / Explanation: ${explanation}`);
  setProgress("explanation");
  setProgress("result");
  goTo("result");
});

$("#saveReflection").addEventListener("click", () => {
  const reflection = els.reflectionInput.value.trim();
  if (!reflection) {
    showToast("Write a reflection before saving.");
    return;
  }
  addRecord("Reflection", reflection);
  els.reflectionInput.value = "";
  showToast("Reflection saved.");
});

$("#prepareOffline").addEventListener("click", async () => {
  if (!("serviceWorker" in navigator)) {
    showToast("Offline cache is unavailable in this browser.");
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "CACHE_NOW" });
  els.offlineStatus.textContent = "Downloaded: 4 modules";
  showToast("Offline assets prepared.");
});

$("#showSaved").addEventListener("click", () => {
  $("#savedPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#checkUpdates").addEventListener("click", () => {
  els.updateStatus.textContent = "Last checked: just now";
  showToast("No content updates in this draft.");
});

$("#deviceCheck").addEventListener("click", () => {
  const storage = "storage" in navigator ? "storage ready" : "storage limited";
  const camera = location.protocol === "https:" || location.hostname === "localhost" ? "camera ready" : "HTTPS needed for camera";
  els.deviceStatus.textContent = `${camera}; ${storage}`;
  showToast(els.deviceStatus.textContent);
});

$("#clearRecords").addEventListener("click", () => {
  records = [];
  saveState();
  renderRecords();
  showToast("Saved progress cleared.");
});

$("#exportWork").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tuklas-saved-progress.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.dataset.tool} view selected.`));
});

[els.forceInput, els.massInput].forEach((input) => input.addEventListener("input", () => updateSimulation()));
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    showToast("Service worker registration failed.");
  });
}

renderModules();
renderHome();
renderDetail();
renderRecords();
updateSimulation(true);
updateConnectionStatus();

if (role) {
  applyRole(role);
} else {
  els.loginScreen.classList.remove("hidden");
}

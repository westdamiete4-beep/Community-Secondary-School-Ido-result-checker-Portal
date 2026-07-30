// ============================================================
// common.js — shared, framework-free helpers used on every page.
// No Firebase imports here on purpose: keep this module pure so
// it's trivially testable and reusable.
// ============================================================

/** Grade boundaries per the school's grading policy. */
export const GRADE_SCALE = [
  { min: 70, max: 100, grade: "A", remark: "Excellent" },
  { min: 60, max: 69, grade: "B", remark: "Very Good" },
  { min: 50, max: 59, grade: "C", remark: "Good" },
  { min: 45, max: 49, grade: "D", remark: "Fair" },
  { min: 40, max: 44, grade: "E", remark: "Pass" },
  { min: 0, max: 39, grade: "F", remark: "Fail" },
];

/** Convert a numeric total (0-100) into a letter grade + remark. */
export function gradeFor(total) {
  const score = Number(total) || 0;
  const band = GRADE_SCALE.find((b) => score >= b.min && score <= b.max);
  return band ? { grade: band.grade, remark: band.remark } : { grade: "-", remark: "-" };
}

// ------------------------------------------------------------
// Icon set — small inline SVGs (stroke-based, feather-style) used
// everywhere instead of emoji, so the UI looks consistent across
// every OS/browser instead of relying on platform emoji fonts.
// ------------------------------------------------------------
const ICON_PATHS = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  alertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  arrowUpCircle: '<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>',
  key: '<path d="M21 2l-9.6 9.6"/><circle cx="7.5" cy="16.5" r="4.5"/><path d="M15.5 8.5 18 11l3-3-3.5-3.5"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  volume2: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  volumeX: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
};

/** Build a small inline stroke-icon SVG. Use instead of emoji for a consistent, professional look. */
export function icon(name, size = 18) {
  const path = ICON_PATHS[name] || "";
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

// ------------------------------------------------------------
// Admission number + PIN generation
// ------------------------------------------------------------
/** Fixed school admission-number prefix — every student ID follows CSS/IDO/### */
export const ADMISSION_PREFIX = "CSS/IDO/";

/** Given a list of existing admission numbers (any class), return the next free sequence number. */
export function nextSequenceNumber(existingNumbers) {
  let max = 0;
  (existingNumbers || []).forEach((no) => {
    const match = String(no || "").match(/(\d+)\s*$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return max + 1;
}

/** Format a sequence number into the school's standard admission number, e.g. 7 -> "CSS/IDO/007". */
export function formatAdmissionNo(seq) {
  return `${ADMISSION_PREFIX}${String(seq).padStart(3, "0")}`;
}

/** Generate a random 4-digit student PIN (1000-9999), returned as a string so leading digits are never dropped. */
export function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Ordinal suffix for positions: 1st, 2nd, 3rd, 4th... */
export function ordinal(n) {
  const num = Number(n);
  if (!num || num < 1) return "-";
  const rem100 = num % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}

/** Round to 2 decimal places, trimming trailing zeros for display. */
export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ------------------------------------------------------------
// Toast notifications (success / error / info)
// ------------------------------------------------------------
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a small notification in the corner of the screen.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 */
export function notify(message, type = "info") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const iconName = type === "success" ? "check" : type === "error" ? "x" : "info";
  toast.innerHTML = `<span class="toast-icon">${icon(iconName, 16)}</span><span class="toast-msg"></span>`;
  toast.querySelector(".toast-msg").textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-show"));

  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

// ------------------------------------------------------------
// Confirmation dialog (replacement for window.confirm)
// ------------------------------------------------------------
/**
 * Show a styled confirm dialog. Resolves true/false.
 * @param {string} message
 * @param {string} confirmLabel
 */
export function confirmDialog(message, confirmLabel = "Delete") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal confirm-modal">
        <p class="confirm-message"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-action="cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-action="confirm"></button>
        </div>
      </div>
    `;
    overlay.querySelector(".confirm-message").textContent = message;
    overlay.querySelector('[data-action="confirm"]').textContent = confirmLabel;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("modal-show"));

    function close(result) {
      overlay.classList.remove("modal-show");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    }

    overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
  });
}

// ------------------------------------------------------------
// Simple field validators
// ------------------------------------------------------------
export function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function isValidScore(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0 && n <= 100;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

/** Apply school branding (name/logo/motto/contact) from a settings doc to matching [data-brand="x"] elements. */
export function applyBranding(settings) {
  if (!settings) return;
  const map = {
    name: settings.name,
    motto: settings.motto,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    principal: settings.principal,
  };
  Object.entries(map).forEach(([key, val]) => {
    if (val === undefined) return;
    document.querySelectorAll(`[data-brand="${key}"]`).forEach((el) => {
      el.textContent = val;
    });
  });
  if (settings.logoUrl) {
    document.querySelectorAll('[data-brand="logo"]').forEach((el) => {
      el.src = settings.logoUrl;
    });
  }
}

/** Escape user-supplied text before dropping it into innerHTML. */
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/** Read a File (e.g. from an <input type="file">) into a base64 data URL. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ------------------------------------------------------------
// Generic, reusable Add/Edit modal form builder.
// Used by every admin CRUD screen (students, teachers, classes,
// subjects, sessions) so each one doesn't hand-roll its own modal.
// ------------------------------------------------------------
/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {Array}  opts.fields - [{ key, label, type, options?, required?, placeholder?, value? }]
 * @param {string} [opts.submitLabel]
 * @param {(values: Object, form: HTMLFormElement) => Promise<boolean|void>} opts.onSubmit
 *        Return `false` to keep the modal open (e.g. validation failed elsewhere); anything
 *        else (including throwing, which is caught) closes it on success.
 */
export function openFormModal({ title, fields, submitLabel = "Save", onSubmit }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const fieldsHtml = fields
    .map((f) => {
      const id = `mf-${f.key}`;
      const requiredAttr = f.required ? "required" : "";
      let control = "";
      if (f.type === "select") {
        control = `<select id="${id}" ${requiredAttr}>
          <option value="">Select…</option>
          ${(f.options || [])
            .map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(f.value ?? "") ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
            .join("")}
        </select>`;
      } else if (f.type === "textarea") {
        control = `<textarea id="${id}" rows="3" placeholder="${escapeHtml(f.placeholder || "")}" ${requiredAttr}>${escapeHtml(f.value || "")}</textarea>`;
      } else if (f.type === "file") {
        control = `<input type="file" id="${id}" accept="image/*" />
          ${f.value ? `<img src="${f.value}" alt="preview" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin-top:8px;border:2px solid var(--gold);" />` : ""}`;
      } else {
        control = `<input type="${f.type || "text"}" id="${id}" placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(f.value ?? "")}" ${requiredAttr} />`;
      }
      return `<div class="form-group"><label for="${id}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label>${control}<div class="field-error" id="err-${id}"></div></div>`;
    })
    .join("");

  overlay.innerHTML = `
    <div class="modal">
      <h3></h3>
      <form id="dynamicForm" novalidate>
        ${fieldsHtml}
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" data-action="submit"></button>
        </div>
      </form>
    </div>
  `;
  overlay.querySelector("h3").textContent = title;
  overlay.querySelector('[data-action="submit"]').textContent = submitLabel;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("modal-show"));

  function close() {
    overlay.classList.remove("modal-show");
    setTimeout(() => overlay.remove(), 200);
  }
  overlay.querySelector('[data-action="cancel"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const form = overlay.querySelector("#dynamicForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Clear previous errors
    fields.forEach((f) => {
      const errEl = overlay.querySelector(`#err-mf-${f.key}`);
      if (errEl) errEl.textContent = "";
      const inputEl = overlay.querySelector(`#mf-${f.key}`);
      if (inputEl) inputEl.classList.remove("invalid");
    });

    // Collect + validate required fields
    const values = {};
    let hasError = false;
    for (const f of fields) {
      const el = overlay.querySelector(`#mf-${f.key}`);
      if (f.type === "file") {
        values[f.key] = el.files && el.files[0] ? await fileToDataUrl(el.files[0]) : f.value || "";
        continue;
      }
      const val = el.value.trim();
      if (f.required && isEmpty(val)) {
        overlay.querySelector(`#err-mf-${f.key}`).textContent = `${f.label} is required.`;
        el.classList.add("invalid");
        hasError = true;
      }
      if (f.type === "number" && !isEmpty(val) && Number.isNaN(Number(val))) {
        overlay.querySelector(`#err-mf-${f.key}`).textContent = `${f.label} must be a number.`;
        el.classList.add("invalid");
        hasError = true;
      }
      if (f.type === "email" && !isEmpty(val) && !isValidEmail(val)) {
        overlay.querySelector(`#err-mf-${f.key}`).textContent = `Enter a valid email address.`;
        el.classList.add("invalid");
        hasError = true;
      }
      values[f.key] = val;
    }
    if (hasError) return;

    const submitBtn = overlay.querySelector('[data-action="submit"]');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Saving…";

    try {
      const result = await onSubmit(values, form);
      if (result === false) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        return;
      }
      close();
    } catch (err) {
      console.error(err);
      notify(err.message || "Something went wrong. Please try again.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  return { close };
}

// ------------------------------------------------------------
// Voice synthesis — reads page instructions aloud using the
// browser's built-in Web Speech API (no external service, no
// API key). Used to narrate directions/concepts on every page
// for accessibility and for people who prefer listening.
// ------------------------------------------------------------
/** Whether this browser supports speech synthesis at all. */
export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Stop any speech currently playing. Safe to call even if nothing is playing. */
export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

/**
 * Speak a block of text aloud, replacing anything currently playing.
 * @param {string} text
 * @param {Object} [opts]
 * @param {number} [opts.rate] speech rate, default 0.95 (slightly slower, clearer)
 * @param {Function} [opts.onstart]
 * @param {Function} [opts.onend]
 * @param {Function} [opts.onerror]
 */
export function speakText(text, opts = {}) {
  if (!isSpeechSupported()) {
    notify("Voice narration isn't supported in this browser.", "error");
    return null;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = opts.rate ?? 0.95;
  utterance.pitch = opts.pitch ?? 1;
  if (opts.onstart) utterance.onstart = opts.onstart;
  utterance.onend = () => { if (opts.onend) opts.onend(); };
  utterance.onerror = () => { if (opts.onerror) opts.onerror(); };
  window.speechSynthesis.speak(utterance);
  return utterance;
}

/**
 * Create a floating "Listen" button (fixed bottom-right) that reads a
 * script aloud with one click, and turns into a "Stop" button while
 * speaking. Pass a function for `getScript` if the text should change
 * (e.g. the admin dashboard reads whichever section is currently open).
 * @param {string | (() => string)} getScript
 * @param {string} [label] initial button label, default "Listen"
 * @returns {{ stop: () => void, button: HTMLButtonElement }}
 */
export function createVoiceGuide(getScript, label = "Listen") {
  if (!isSpeechSupported()) return { stop: () => {}, button: null };

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "voice-guide-btn";
  btn.setAttribute("aria-label", "Read page instructions aloud");

  function renderIdle() {
    btn.classList.remove("speaking");
    btn.innerHTML = `${icon("volume2", 19)}<span>${label}</span>`;
  }
  function renderSpeaking() {
    btn.classList.add("speaking");
    btn.innerHTML = `${icon("volumeX", 19)}<span>Stop</span>`;
  }
  renderIdle();

  btn.addEventListener("click", () => {
    if (window.speechSynthesis.speaking) {
      stopSpeaking();
      renderIdle();
      return;
    }
    const text = typeof getScript === "function" ? getScript() : getScript;
    if (!text) return;
    speakText(text, { onstart: renderSpeaking, onend: renderIdle, onerror: renderIdle });
  });

  document.body.appendChild(btn);
  return {
    stop: () => { stopSpeaking(); renderIdle(); },
    button: btn,
  };
}

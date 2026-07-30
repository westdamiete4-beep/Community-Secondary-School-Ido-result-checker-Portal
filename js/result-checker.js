// ============================================================
// result-checker.js — public page, no auth required.
// Students supply Admission Number + Class + PIN + Session + Term.
// ============================================================
import {
  db, doc, getDoc, collection, getDocs, query, where, COLLECTIONS, runTransaction, serverTimestamp,
} from "./firebase.js";
import { gradeFor, ordinal, notify, isEmpty, escapeHtml, applyBranding, icon, createVoiceGuide } from "./common.js";

document.getElementById("year").textContent = new Date().getFullYear();

// Voice guide: explains how to fill in the form, field by field.
createVoiceGuide(
  "This page lets you check your academic result. First, enter your admission number exactly " +
  "as given to you by the school, in the format C S S slash I D O slash and your number. " +
  "Next, select your class from the dropdown list. Then, enter your four digit PIN, which was " +
  "issued to you along with your admission number. After that, choose the academic session and " +
  "the term you want to check. Once every field is filled in, click the Check Result button. " +
  "If your result has been published by the school, your full report sheet will appear, showing " +
  "your subjects, scores, grades, class position, and remarks. You can then print the result or " +
  "download it as a PDF using the buttons at the bottom of the report."
);

const form = document.getElementById("checkerForm");
const sessionSelect = document.getElementById("session");
const classSelect = document.getElementById("className");
const admissionInput = document.getElementById("admissionNo");
const pinInput = document.getElementById("pin");
const termSelect = document.getElementById("term");
const checkBtn = document.getElementById("checkBtn");
const resultArea = document.getElementById("resultArea");

let schoolSettings = {};

// ------------------------------------------------------------
// Rate limiting: at most DAILY_LIMIT successful result lookups per
// admission number per rolling 24-hour window. Only counted once a
// lookup has fully succeeded (student found, class matches, PIN
// correct, and a published result exists) — see where this is
// called in fetchAndRenderResult below. The count lives in
// Firestore (not localStorage/sessionStorage/cookies), and can only
// change in ways the security rules permit — see the rateLimits
// rules in the README — so it can't be reset by clearing browser
// data, using Incognito, switching browsers, or switching devices.
// ------------------------------------------------------------
const DAILY_LIMIT = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Atomically checks and, if allowed, consumes one of today's successful-
 * lookup attempts for this admission number. Uses a Firestore transaction
 * so two near-simultaneous requests (e.g. two browser tabs) can't both
 * slip through and double-count. Returns { allowed: true } or
 * { allowed: false, resetInMs } if the daily cap has been reached.
 */
async function checkAndConsumeRateLimit(admissionNo) {
  const docId = admissionNo.replace(/[^a-zA-Z0-9]/g, "_");
  const ref = doc(db, COLLECTIONS.rateLimits, docId);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const now = Date.now();

    if (!snap.exists()) {
      transaction.set(ref, { count: 1, windowStart: serverTimestamp() });
      return { allowed: true };
    }

    const data = snap.data();
    const windowStartMs = data.windowStart?.toMillis ? data.windowStart.toMillis() : 0;
    const elapsed = now - windowStartMs;

    if (elapsed >= WINDOW_MS) {
      // The 24-hour window has fully passed — start a fresh one.
      transaction.set(ref, { count: 1, windowStart: serverTimestamp() });
      return { allowed: true };
    }

    if (data.count >= DAILY_LIMIT) {
      return { allowed: false, resetInMs: WINDOW_MS - elapsed };
    }

    transaction.update(ref, { count: data.count + 1 });
    return { allowed: true };
  });
}

/** Formats a millisecond duration as a friendly "X hours Y minutes" string. */
function formatCountdown(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} and ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------
// Load school branding + available classes/sessions on page load
// ------------------------------------------------------------
(async function init() {
  try {
    const settingsSnap = await getDoc(doc(db, COLLECTIONS.settings, "school"));
    if (settingsSnap.exists()) {
      schoolSettings = settingsSnap.data();
      applyBranding(schoolSettings);
    }
  } catch (err) {
    console.warn("Could not load settings", err);
  }

  try {
    const classesSnap = await getDocs(collection(db, COLLECTIONS.classes));
    const classes = [];
    classesSnap.forEach((d) => classes.push({ id: d.id, ...d.data() }));
    classes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    classSelect.innerHTML = classes.length
      ? `<option value="">Select class</option>` + classes.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("")
      : `<option value="">No classes available yet</option>`;
  } catch (err) {
    console.warn("Could not load classes", err);
    classSelect.innerHTML = `<option value="">Unable to load classes</option>`;
  }

  try {
    const sessionsSnap = await getDocs(collection(db, COLLECTIONS.sessions));
    const sessions = [];
    sessionsSnap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
    sessions.sort((a, b) => (b.name || "").localeCompare(a.name || ""));

    if (sessions.length === 0) {
      sessionSelect.innerHTML = `<option value="">No sessions available yet</option>`;
      return;
    }
    sessionSelect.innerHTML =
      `<option value="">Select session</option>` +
      sessions
        .filter((s) => s.status !== "archived")
        .map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`)
        .join("");
  } catch (err) {
    console.warn("Could not load sessions", err);
    sessionSelect.innerHTML = `<option value="">Unable to load sessions</option>`;
  }
})();

// ------------------------------------------------------------
// Form validation + submit
// ------------------------------------------------------------
function clearErrors() {
  document.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
  document.querySelectorAll("input, select").forEach((e) => e.classList.remove("invalid"));
}

function setError(id, message) {
  const el = document.getElementById(`err-${id}`);
  if (el) el.textContent = message;
  const field = document.getElementById(id);
  if (field) field.classList.add("invalid");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  resultArea.innerHTML = "";

  const admissionNo = admissionInput.value.trim();
  const className = classSelect.value;
  const pin = pinInput.value.trim();
  const session = sessionSelect.value;
  const term = termSelect.value;

  let valid = true;
  if (isEmpty(admissionNo)) { setError("admissionNo", "Please enter your admission number."); valid = false; }
  if (isEmpty(className)) { setError("className", "Please select your class."); valid = false; }
  if (isEmpty(pin) || !/^\d{4}$/.test(pin)) { setError("pin", "Enter your 4-digit PIN."); valid = false; }
  if (isEmpty(session)) { setError("session", "Please select a session."); valid = false; }
  if (isEmpty(term)) { setError("term", "Please select a term."); valid = false; }
  if (!valid) return;

  checkBtn.disabled = true;
  checkBtn.textContent = "Checking…";

  try {
    await fetchAndRenderResult(admissionNo, className, pin, session, term);
  } catch (err) {
    console.error(err);
    notify("Something went wrong while checking your result. Please try again.", "error");
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = "Check Result";
  }
});

async function fetchAndRenderResult(admissionNo, className, pin, session, term) {
  // 1. Find the student by admission number + class
  const studentsQ = query(
    collection(db, COLLECTIONS.students),
    where("admissionNo", "==", admissionNo),
    where("className", "==", className)
  );
  const studentsSnap = await getDocs(studentsQ);

  if (studentsSnap.empty) {
    renderNotFound("We couldn't find a student with that admission number and class. Please check and try again.");
    return;
  }
  const studentDoc = studentsSnap.docs[0];
  const student = { id: studentDoc.id, ...studentDoc.data() };

  // 2. Verify the PIN matches (generic error on mismatch — don't reveal which field was wrong)
  if (String(student.pin || "") !== pin) {
    renderNotFound("The admission number, class or PIN you entered did not match our records.");
    return;
  }

  // 3. Find a published result for this student/session/term
  const resultsQ = query(
    collection(db, COLLECTIONS.results),
    where("studentId", "==", student.id),
    where("session", "==", session),
    where("term", "==", term)
  );
  const resultsSnap = await getDocs(resultsQ);

  const publishedDoc = resultsSnap.docs.find((d) => d.data().published === true);

  if (!publishedDoc) {
    renderNotFound("No published result found for this session and term yet. Please check back later or contact the school office.");
    return;
  }

  // 4. Only NOW — once admission number, class, PIN and a published result
  // have all genuinely checked out — does this count as a "successful
  // lookup" against the daily limit. Wrong PINs or nonexistent students
  // never consume an attempt, so the cap can't be burned through by
  // someone fishing for a valid combination.
  const rateResult = await checkAndConsumeRateLimit(admissionNo);
  if (!rateResult.allowed) {
    renderRateLimited(rateResult.resetInMs);
    return;
  }

  renderResultSheet(student, { id: publishedDoc.id, ...publishedDoc.data() });
}

function renderNotFound(message) {
  resultArea.innerHTML = `
    <div class="not-found">
      <div class="icon-tile" style="margin:0 auto 14px;">${icon("alertTriangle", 22)}</div>
      <h3>Result Not Available</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderRateLimited(resetInMs) {
  resultArea.innerHTML = `
    <div class="not-found">
      <div class="icon-tile" style="margin:0 auto 14px;">${icon("clock", 22)}</div>
      <h3>Daily Check Limit Reached</h3>
      <p>You have reached your maximum of 2 result checks in the last 24 hours. Please try again later.</p>
      <p style="margin-top:10px;font-size:0.85rem;">Your check will be available again in about ${escapeHtml(formatCountdown(resetInMs))}.</p>
    </div>
  `;
  resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResultSheet(student, result) {
  const subjects = result.subjects || [];

  const subjectRows = subjects
    .map((s) => {
      const ca = Number(s.ca) || 0;
      const exam = Number(s.exam) || 0;
      const total = ca + exam;
      const { grade } = gradeFor(total);
      return `
        <tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${ca}</td>
          <td>${exam}</td>
          <td>${total}</td>
          <td><span class="grade-pill grade-${grade}">${grade}</span></td>
        </tr>
      `;
    })
    .join("");

  const totalOfTotals = subjects.reduce((sum, s) => sum + (Number(s.ca) || 0) + (Number(s.exam) || 0), 0);
  const studentAverage = result.studentAverage ?? (subjects.length ? Math.round((totalOfTotals / subjects.length) * 100) / 100 : 0);
  const overallGrade = result.grade || gradeFor(studentAverage).grade;
  const classAverage = result.classAverage ?? "-";
  const position = result.position ? ordinal(result.position) : "-";

  resultArea.innerHTML = `
    <div class="result-sheet" id="printSheet">
      <div class="sheet-head">
        <img class="logo" src="${schoolSettings.logoUrl || "assets/logo-placeholder.svg"}" alt="School logo" />
        <div>
          <h2>${escapeHtml(schoolSettings.name || "Community Secondary School, Ido")}</h2>
          <div class="sheet-motto">${escapeHtml(schoolSettings.motto || "Knowledge, Character, Excellence")}</div>
        </div>
        <div class="sheet-title">Student Report Sheet<br/>${escapeHtml(result.session)} &middot; ${escapeHtml(result.term)}</div>
      </div>

      <div class="sheet-student">
        <img class="passport" src="${student.passportUrl || "assets/logo-placeholder.svg"}" alt="Student passport" />
        <div class="student-meta">
          <div class="meta-item"><span class="label">Full Name</span><span class="value">${escapeHtml(student.fullName)}</span></div>
          <div class="meta-item"><span class="label">Admission No.</span><span class="value">${escapeHtml(student.admissionNo)}</span></div>
          <div class="meta-item"><span class="label">Class</span><span class="value">${escapeHtml(result.className || student.className || "-")}</span></div>
          <div class="meta-item"><span class="label">Gender</span><span class="value">${escapeHtml(student.gender || "-")}</span></div>
          <div class="meta-item"><span class="label">Date of Birth</span><span class="value">${escapeHtml(student.dob || "-")}</span></div>
          <div class="meta-item"><span class="label">House</span><span class="value">${escapeHtml(student.house || "-")}</span></div>
          <div class="meta-item"><span class="label">Session</span><span class="value">${escapeHtml(result.session)}</span></div>
          <div class="meta-item"><span class="label">Term</span><span class="value">${escapeHtml(result.term)}</span></div>
          <div class="meta-item"><span class="label">Attendance</span><span class="value">${escapeHtml(result.attendance || "-")}</span></div>
        </div>
      </div>

      <table class="sheet-table">
        <thead>
          <tr><th>Subject</th><th>C.A.</th><th>Exam</th><th>Total</th><th>Grade</th></tr>
        </thead>
        <tbody>
          ${subjectRows || `<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);">No subjects recorded</td></tr>`}
        </tbody>
      </table>

      <div class="summary-grid">
        <div class="summary-box"><div class="num">${studentAverage}</div><div class="lbl">Student Average</div></div>
        <div class="summary-box"><div class="num">${classAverage}</div><div class="lbl">Class Average</div></div>
        <div class="summary-box"><div class="num">${position}</div><div class="lbl">Position in Class</div></div>
        <div class="summary-box"><div class="num">${overallGrade}</div><div class="lbl">Overall Grade</div></div>
      </div>

      <div class="remarks">
        <div class="remark-box">
          <div class="lbl">Teacher's Remark</div>
          <div>${escapeHtml(result.teacherRemark || "No remark provided yet.")}</div>
        </div>
        <div class="remark-box">
          <div class="lbl">Principal's Remark</div>
          <div>${escapeHtml(result.principalRemark || "No remark provided yet.")}</div>
        </div>
      </div>

      <div class="sheet-actions">
        <button type="button" class="btn btn-outline" id="printBtn">${icon("printer", 17)} Print Result</button>
        <button type="button" class="btn btn-primary" id="pdfBtn">${icon("download", 17)} Download as PDF</button>
      </div>
    </div>
  `;

  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("pdfBtn").addEventListener("click", () => downloadAsPdf(student));
  resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------
// PDF export via html2canvas + jsPDF (loaded from CDN in the HTML)
// ------------------------------------------------------------
async function downloadAsPdf(student) {
  const sheet = document.getElementById("printSheet");
  const actions = sheet.querySelector(".sheet-actions");
  actions.style.display = "none";

  try {
    const canvas = await window.html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
    pdf.save(`Result-${student.admissionNo || "student"}.pdf`);
    notify("Result downloaded as PDF.", "success");
  } catch (err) {
    console.error(err);
    notify("Could not generate PDF. Please try printing instead.", "error");
  } finally {
    actions.style.display = "";
  }
}

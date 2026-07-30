// ============================================================
// admin-dashboard.js
// Protected page: redirects to admin-login.html if not authenticated.
// Everything here talks to Firestore in real time via onSnapshot.
// ============================================================
import {
  db, auth, COLLECTIONS,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp,
  onAuthStateChanged, signOut,
} from "./firebase.js";
import {
  notify, confirmDialog, openFormModal, round2, icon,
  isEmpty, isValidScore, escapeHtml, fileToDataUrl, applyBranding,
  gradeFor, ordinal, generatePin, nextSequenceNumber, formatAdmissionNo,
  createVoiceGuide,
} from "./common.js";

// ------------------------------------------------------------
// Auth gate
// ------------------------------------------------------------
const authGate = document.getElementById("authGate");
const dashShell = document.getElementById("dashShell");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "admin-login.html";
    return;
  }
  document.getElementById("adminEmail").textContent = user.email;
  authGate.style.display = "none";
  dashShell.style.display = "flex";
  startDashboard();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const ok = await confirmDialog("You will be signed out of the admin dashboard.", "Logout");
  if (!ok) return;
  await signOut(auth);
  window.location.href = "admin-login.html";
});

// ------------------------------------------------------------
// Sidebar navigation
// ------------------------------------------------------------
const navButtons = document.querySelectorAll(".dash-nav button");
const sections = document.querySelectorAll(".dash-section");
const sectionTitle = document.getElementById("sectionTitle");
const sidebar = document.getElementById("sidebar");

const TITLES = {
  overview: "Dashboard Overview",
  students: "Student Management",
  results: "Result Management",
  teachers: "Teacher Management",
  classes: "Class Management",
  subjects: "Subject Management",
  sessions: "Academic Session Management",
  promote: "Promote Students",
  settings: "School Settings",
};

// Voice guide: one short explanation per section, read aloud on demand.
// The floating button always speaks whichever section is currently open.
const SECTION_GUIDES = {
  overview: "This is the Dashboard Overview. It shows key statistics at a glance: total students, " +
    "total teachers, total classes, total subjects, published results, and pending results. Use the " +
    "menu on the left to manage each part of the school's records.",
  students: "This is Student Management. Here you can add a new student, edit an existing student's " +
    "details, delete a student, and search by name, admission number, or class. Each student is " +
    "automatically given a permanent admission number and a four digit PIN, which they use to check " +
    "their results.",
  results: "This is Result Management. Here you can add a result for a student by selecting their " +
    "subjects and entering continuous assessment and examination scores. Class position, class " +
    "average, and grade are calculated automatically every time a result is saved. Use the check " +
    "button to publish a result so students can see it, or the cross button to unpublish it again.",
  teachers: "This is Teacher Management. Here you can add, edit, or delete teacher records, including " +
    "their name, email, phone number, and the subjects they teach.",
  classes: "This is Class Management. Here you can create new classes, such as J S S 1 A, edit an " +
    "existing class name or form teacher, or delete a class.",
  subjects: "This is Subject Management. Here you can add, edit, or delete the subjects offered at " +
    "the school, along with their subject codes.",
  sessions: "This is Academic Session Management. Here you can create a new academic session, such " +
    "as 2025 slash 2026, edit its name or status, and archive sessions that are no longer active.",
  promote: "This is the Promote Students page. Choose the class students are currently in, choose " +
    "the class you want to move them into, select the students to promote, and click Promote " +
    "Selected Students. Their admission numbers and PINs will not change, only their class.",
  settings: "This is School Settings. Here you can update the school's name, motto, address, phone " +
    "number, email address, principal's name, and logo. These details automatically update across " +
    "the entire website.",
};

let currentSection = "overview";
const voiceGuide = createVoiceGuide(() => SECTION_GUIDES[currentSection], "Explain this page");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.section;
    sections.forEach((s) => (s.hidden = s.id !== `section-${target}`));
    sectionTitle.textContent = TITLES[target] || "Dashboard";
    sidebar.classList.remove("open");
    currentSection = target;
    voiceGuide.stop(); // stop any narration from the previous section rather than let it run on
    if (target === "promote") renderPromotePanel();
  });
});

document.getElementById("hamburger").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// ------------------------------------------------------------
// In-memory caches, kept in sync via onSnapshot
// ------------------------------------------------------------
const state = {
  students: [],
  teachers: [],
  classes: [],
  subjects: [],
  sessions: [],
  results: [],
  settings: {},
};

function startDashboard() {
  loadSettings();
  listenStudents();
  listenTeachers();
  listenClasses();
  listenSubjects();
  listenSessions();
  listenResults();
}

// ==================================================================
// SCHOOL SETTINGS
// ==================================================================
async function loadSettings() {
  const ref = doc(db, COLLECTIONS.settings, "school");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    state.settings = snap.data();
    applyBranding(state.settings);
    fillSettingsForm(state.settings);
  }
}

function fillSettingsForm(s) {
  document.getElementById("set-name").value = s.name || "";
  document.getElementById("set-motto").value = s.motto || "";
  document.getElementById("set-address").value = s.address || "";
  document.getElementById("set-phone").value = s.phone || "";
  document.getElementById("set-email").value = s.email || "";
  document.getElementById("set-principal").value = s.principal || "";
  if (s.logoUrl) document.getElementById("set-logo-preview").src = s.logoUrl;
}

document.getElementById("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("set-name").value.trim();
  if (isEmpty(name)) {
    notify("School name is required.", "error");
    return;
  }
  const logoFile = document.getElementById("set-logo").files[0];
  const payload = {
    name,
    motto: document.getElementById("set-motto").value.trim(),
    address: document.getElementById("set-address").value.trim(),
    phone: document.getElementById("set-phone").value.trim(),
    email: document.getElementById("set-email").value.trim(),
    principal: document.getElementById("set-principal").value.trim(),
    updatedAt: serverTimestamp(),
  };
  if (logoFile) payload.logoUrl = await fileToDataUrl(logoFile);

  try {
    await setDoc(doc(db, COLLECTIONS.settings, "school"), payload, { merge: true });
    notify("School settings saved.", "success");
    applyBranding(payload);
    if (payload.logoUrl) document.getElementById("set-logo-preview").src = payload.logoUrl;
  } catch (err) {
    console.error(err);
    notify("Could not save settings.", "error");
  }
});

// ==================================================================
// CLASSES
// ==================================================================
function listenClasses() {
  onSnapshot(collection(db, COLLECTIONS.classes), (snap) => {
    state.classes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.classes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderClasses();
    refreshStats();
  }, (err) => console.error("classes listener", err));
}

function renderClasses() {
  const tbody = document.getElementById("classesTbody");
  if (state.classes.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No classes yet. Click "Add Class" to create one.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.classes
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.formTeacher || "-")}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${c.id}" title="Edit" aria-label="Edit class">${icon("edit")}</button>
          <button class="icon-btn danger" data-delete="${c.id}" title="Delete" aria-label="Delete class">${icon("trash")}</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openClassModal(state.classes.find((c) => c.id === btn.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteRecord(COLLECTIONS.classes, btn.dataset.delete, "class"))
  );
}

function openClassModal(existing) {
  openFormModal({
    title: existing ? "Edit Class" : "Add Class",
    submitLabel: existing ? "Save Changes" : "Add Class",
    fields: [
      { key: "name", label: "Class Name", type: "text", required: true, placeholder: "e.g. JSS1A", value: existing?.name },
      { key: "formTeacher", label: "Form Teacher", type: "text", placeholder: "e.g. Mrs. Adebayo", value: existing?.formTeacher },
    ],
    onSubmit: async (values) => {
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.classes, existing.id), values);
        notify("Class updated.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.classes), values);
        notify("Class added.", "success");
      }
    },
  });
}
document.getElementById("addClassBtn").addEventListener("click", () => openClassModal(null));

// ==================================================================
// SUBJECTS
// ==================================================================
function listenSubjects() {
  onSnapshot(collection(db, COLLECTIONS.subjects), (snap) => {
    state.subjects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.subjects.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderSubjects();
    refreshStats();
  }, (err) => console.error("subjects listener", err));
}

function renderSubjects() {
  const tbody = document.getElementById("subjectsTbody");
  if (state.subjects.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No subjects yet. Click "Add Subject" to create one.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.subjects
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.code || "-")}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${s.id}" title="Edit" aria-label="Edit subject">${icon("edit")}</button>
          <button class="icon-btn danger" data-delete="${s.id}" title="Delete" aria-label="Delete subject">${icon("trash")}</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openSubjectModal(state.subjects.find((s) => s.id === btn.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteRecord(COLLECTIONS.subjects, btn.dataset.delete, "subject"))
  );
}

function openSubjectModal(existing) {
  openFormModal({
    title: existing ? "Edit Subject" : "Add Subject",
    submitLabel: existing ? "Save Changes" : "Add Subject",
    fields: [
      { key: "name", label: "Subject Name", type: "text", required: true, placeholder: "e.g. Mathematics", value: existing?.name },
      { key: "code", label: "Subject Code", type: "text", placeholder: "e.g. MTH", value: existing?.code },
    ],
    onSubmit: async (values) => {
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.subjects, existing.id), values);
        notify("Subject updated.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.subjects), values);
        notify("Subject added.", "success");
      }
    },
  });
}
document.getElementById("addSubjectBtn").addEventListener("click", () => openSubjectModal(null));

// ==================================================================
// SESSIONS
// ==================================================================
function listenSessions() {
  onSnapshot(collection(db, COLLECTIONS.sessions), (snap) => {
    state.sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.sessions.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    renderSessions();
    refreshStats();
  }, (err) => console.error("sessions listener", err));
}

function renderSessions() {
  const tbody = document.getElementById("sessionsTbody");
  if (state.sessions.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No sessions yet. Click "Add Session" to create one.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.sessions
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td><span class="badge ${s.status === "archived" ? "badge-pending" : "badge-published"}">${s.status === "archived" ? "Archived" : "Active"}</span></td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${s.id}" title="Edit" aria-label="Edit session">${icon("edit")}</button>
          <button class="icon-btn" data-archive="${s.id}" title="${s.status === "archived" ? "Unarchive" : "Archive"}" aria-label="Archive or unarchive session">${icon("archive")}</button>
          <button class="icon-btn danger" data-delete="${s.id}" title="Delete" aria-label="Delete session">${icon("trash")}</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openSessionModal(state.sessions.find((s) => s.id === btn.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteRecord(COLLECTIONS.sessions, btn.dataset.delete, "session"))
  );
  tbody.querySelectorAll("[data-archive]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const s = state.sessions.find((x) => x.id === btn.dataset.archive);
      const newStatus = s.status === "archived" ? "active" : "archived";
      await updateDoc(doc(db, COLLECTIONS.sessions, s.id), { status: newStatus });
      notify(`Session ${newStatus === "archived" ? "archived" : "reactivated"}.`, "success");
    })
  );
}

function openSessionModal(existing) {
  openFormModal({
    title: existing ? "Edit Session" : "Add Session",
    submitLabel: existing ? "Save Changes" : "Add Session",
    fields: [
      { key: "name", label: "Session", type: "text", required: true, placeholder: "e.g. 2025/2026", value: existing?.name },
      {
        key: "status", label: "Status", type: "select", required: true,
        options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }],
        value: existing?.status || "active",
      },
    ],
    onSubmit: async (values) => {
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.sessions, existing.id), values);
        notify("Session updated.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.sessions), values);
        notify("Session created.", "success");
      }
    },
  });
}
document.getElementById("addSessionBtn").addEventListener("click", () => openSessionModal(null));

// ==================================================================
// TEACHERS
// ==================================================================
function listenTeachers() {
  onSnapshot(collection(db, COLLECTIONS.teachers), (snap) => {
    state.teachers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.teachers.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    renderTeachers();
    refreshStats();
  }, (err) => console.error("teachers listener", err));
}

function renderTeachers(filterText = "") {
  const tbody = document.getElementById("teachersTbody");
  const filtered = state.teachers.filter((t) =>
    `${t.fullName} ${t.email} ${t.subjects}`.toLowerCase().includes(filterText.toLowerCase())
  );
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No teachers found.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.fullName)}</td>
        <td>${escapeHtml(t.email || "-")}</td>
        <td>${escapeHtml(t.phone || "-")}</td>
        <td>${escapeHtml(t.subjects || "-")}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${t.id}" title="Edit" aria-label="Edit teacher">${icon("edit")}</button>
          <button class="icon-btn danger" data-delete="${t.id}" title="Delete" aria-label="Delete teacher">${icon("trash")}</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openTeacherModal(state.teachers.find((t) => t.id === btn.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteRecord(COLLECTIONS.teachers, btn.dataset.delete, "teacher"))
  );
}

function openTeacherModal(existing) {
  openFormModal({
    title: existing ? "Edit Teacher" : "Add Teacher",
    submitLabel: existing ? "Save Changes" : "Add Teacher",
    fields: [
      { key: "fullName", label: "Full Name", type: "text", required: true, value: existing?.fullName },
      { key: "email", label: "Email Address", type: "email", value: existing?.email },
      { key: "phone", label: "Phone Number", type: "text", value: existing?.phone },
      { key: "subjects", label: "Subject(s) Taught", type: "text", placeholder: "e.g. Mathematics, Physics", value: existing?.subjects },
    ],
    onSubmit: async (values) => {
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.teachers, existing.id), values);
        notify("Teacher updated.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.teachers), values);
        notify("Teacher added.", "success");
      }
    },
  });
}
document.getElementById("addTeacherBtn").addEventListener("click", () => openTeacherModal(null));
document.getElementById("teacherSearch").addEventListener("input", (e) => renderTeachers(e.target.value));

// ==================================================================
// STUDENTS
// Each student gets a permanent admission number in the pattern
// CSS/IDO/001, generated automatically from the class they're
// registered into (sequence restarts at 001 per class) and a
// random 4-digit PIN used alongside it on the public checker.
// Global uniqueness of the admission number is always re-verified
// at save time, since that's what the checker looks students up by.
// ==================================================================
function listenStudents() {
  onSnapshot(collection(db, COLLECTIONS.students), (snap) => {
    state.students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.students.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    renderStudents();
    refreshStats();
  }, (err) => console.error("students listener", err));
}

function renderStudents(filterText = "") {
  const tbody = document.getElementById("studentsTbody");
  const filtered = state.students.filter((s) =>
    `${s.fullName} ${s.admissionNo} ${s.className}`.toLowerCase().includes(filterText.toLowerCase())
  );
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No students found.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered
    .map(
      (s) => `
      <tr>
        <td><img class="avatar-thumb" src="${s.passportUrl || "assets/logo-placeholder.svg"}" alt="" /></td>
        <td>${escapeHtml(s.fullName)}</td>
        <td><span class="mono-tag">${escapeHtml(s.admissionNo)}</span></td>
        <td>${escapeHtml(s.className || "-")}</td>
        <td><span class="pin-badge">${escapeHtml(s.pin || "----")}</span></td>
        <td>${escapeHtml(s.gender || "-")}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${s.id}" title="Edit" aria-label="Edit student">${icon("edit")}</button>
          <button class="icon-btn" data-reset-limit="${escapeHtml(s.admissionNo)}" title="Reset daily check limit" aria-label="Reset daily check limit">${icon("refresh")}</button>
          <button class="icon-btn danger" data-delete="${s.id}" title="Delete" aria-label="Delete student">${icon("trash")}</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openStudentModal(state.students.find((s) => s.id === btn.dataset.edit)))
  );
  tbody.querySelectorAll("[data-reset-limit]").forEach((btn) =>
    btn.addEventListener("click", () => resetCheckLimit(btn.dataset.resetLimit))
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteRecord(COLLECTIONS.students, btn.dataset.delete, "student"))
  );
}

/** Compute the next free, globally-unique admission number for a given class. */
function generateAdmissionNoForClass(className, excludeStudentId = null) {
  const classNumbers = state.students
    .filter((s) => s.className === className && s.id !== excludeStudentId)
    .map((s) => s.admissionNo);
  let seq = nextSequenceNumber(classNumbers);
  let candidate = formatAdmissionNo(seq);
  const allNumbers = new Set(state.students.filter((s) => s.id !== excludeStudentId).map((s) => s.admissionNo));
  // Guard against a cross-class collision (e.g. after a promotion frees up a number).
  while (allNumbers.has(candidate)) {
    seq += 1;
    candidate = formatAdmissionNo(seq);
  }
  return candidate;
}

function openStudentModal(existing) {
  if (!existing && state.classes.length === 0) {
    notify("Please create at least one class before adding students.", "error");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const classOptionsHtml = state.classes
    .map((c) => `<option value="${escapeHtml(c.name)}" ${existing?.className === c.name ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");

  const initialAdmissionNo = existing ? existing.admissionNo : generateAdmissionNoForClass(state.classes[0]?.name);
  const initialPin = existing ? existing.pin || generatePin() : generatePin();

  overlay.innerHTML = `
    <div class="modal">
      <h3>${existing ? "Edit Student" : "Add Student"}</h3>
      <form id="studentForm" novalidate>
        <div class="form-group">
          <label for="s-fullName">Full Name *</label>
          <input id="s-fullName" type="text" required value="${escapeHtml(existing?.fullName || "")}" />
          <div class="field-error" id="err-s-fullName"></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="s-className">Class *</label>
            <select id="s-className" required ${existing ? "disabled" : ""}>${classOptionsHtml}</select>
            <div class="field-error" id="err-s-className"></div>
            ${existing ? `<div class="field-hint">Use "Promote Students" to move a student to another class.</div>` : ""}
          </div>
          <div class="form-group">
            <label for="s-gender">Gender</label>
            <select id="s-gender">
              <option value="">Select…</option>
              <option value="Male" ${existing?.gender === "Male" ? "selected" : ""}>Male</option>
              <option value="Female" ${existing?.gender === "Female" ? "selected" : ""}>Female</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="s-dob">Date of Birth</label>
            <input id="s-dob" type="date" value="${escapeHtml(existing?.dob || "")}" />
          </div>
          <div class="form-group">
            <label for="s-house">House</label>
            <input id="s-house" type="text" value="${escapeHtml(existing?.house || "")}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="s-admissionNo">Admission Number</label>
            <input id="s-admissionNo" type="text" class="readonly-field" value="${escapeHtml(initialAdmissionNo)}" readonly />
            <div class="field-hint">Generated automatically. It becomes permanent once the student is saved.</div>
          </div>
          <div class="form-group">
            <label for="s-pin">Student PIN</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="s-pin" type="text" class="readonly-field pin-display" value="${escapeHtml(initialPin)}" readonly style="flex:1;" />
              <button type="button" class="btn btn-outline btn-sm" id="regenPinBtn">Regenerate</button>
            </div>
            <div class="field-hint">Students use this with their Admission Number to check results.</div>
          </div>
        </div>

        <div class="form-group">
          <label for="s-passport">Passport Photo</label>
          <input id="s-passport" type="file" accept="image/*" />
          ${existing?.passportUrl ? `<img src="${existing.passportUrl}" alt="Current passport" style="width:56px;height:64px;object-fit:cover;border-radius:8px;margin-top:8px;border:2px solid var(--gold);" />` : ""}
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" data-action="submit">${existing ? "Save Changes" : "Add Student"}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("modal-show"));

  function close() {
    overlay.classList.remove("modal-show");
    setTimeout(() => overlay.remove(), 200);
  }
  overlay.querySelector('[data-action="cancel"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  // New students: regenerate the previewed admission number whenever the class changes.
  const classSelect = overlay.querySelector("#s-className");
  if (!existing) {
    classSelect.addEventListener("change", () => {
      overlay.querySelector("#s-admissionNo").value = generateAdmissionNoForClass(classSelect.value);
    });
  }

  overlay.querySelector("#regenPinBtn").addEventListener("click", () => {
    overlay.querySelector("#s-pin").value = generatePin();
  });

  const form = overlay.querySelector("#studentForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    overlay.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));

    const fullName = overlay.querySelector("#s-fullName").value.trim();
    const className = existing ? existing.className : classSelect.value;
    let valid = true;
    if (isEmpty(fullName)) { overlay.querySelector("#err-s-fullName").textContent = "Full name is required."; valid = false; }
    if (isEmpty(className)) { overlay.querySelector("#err-s-className").textContent = "Please select a class."; valid = false; }
    if (!valid) return;

    let admissionNo = overlay.querySelector("#s-admissionNo").value.trim();
    // Re-verify global uniqueness right before saving (guards against concurrent registrations).
    const clash = state.students.find((s) => s.admissionNo === admissionNo && s.id !== existing?.id);
    if (clash) admissionNo = generateAdmissionNoForClass(className, existing?.id);

    const payload = {
      fullName,
      className,
      gender: overlay.querySelector("#s-gender").value,
      dob: overlay.querySelector("#s-dob").value,
      house: overlay.querySelector("#s-house").value.trim(),
      admissionNo,
      pin: overlay.querySelector("#s-pin").value.trim(),
    };
    const passportFile = overlay.querySelector("#s-passport").files[0];
    if (passportFile) payload.passportUrl = await fileToDataUrl(passportFile);

    const submitBtn = overlay.querySelector('[data-action="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.students, existing.id), payload);
        notify("Student updated.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.students), payload);
        notify(`Student added. Admission No: ${admissionNo}, PIN: ${payload.pin}`, "success");
      }
      close();
    } catch (err) {
      console.error(err);
      notify("Could not save student.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = existing ? "Save Changes" : "Add Student";
    }
  });
}
document.getElementById("addStudentBtn").addEventListener("click", () => openStudentModal(null));
document.getElementById("studentSearch").addEventListener("input", (e) => renderStudents(e.target.value));

// ==================================================================
// PROMOTE STUDENTS
// Move a batch of students from one class to another. Admission
// numbers and PINs are never changed by a promotion — only className.
// ==================================================================
function renderPromotePanel() {
  const fromSelect = document.getElementById("promoteFrom");
  const toSelect = document.getElementById("promoteTo");
  const classOptionsHtml = `<option value="">Select class…</option>` +
    state.classes.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  fromSelect.innerHTML = classOptionsHtml;
  toSelect.innerHTML = classOptionsHtml;
  document.getElementById("promoteList").innerHTML = `<p style="color:var(--ink-soft);padding:10px;">Select a source class to see its students.</p>`;
  document.getElementById("promoteBtn").disabled = true;
}

document.getElementById("promoteFrom").addEventListener("change", (e) => {
  const className = e.target.value;
  const listEl = document.getElementById("promoteList");
  const promoteBtn = document.getElementById("promoteBtn");

  if (!className) {
    listEl.innerHTML = `<p style="color:var(--ink-soft);padding:10px;">Select a source class to see its students.</p>`;
    promoteBtn.disabled = true;
    return;
  }
  const studentsInClass = state.students.filter((s) => s.className === className);
  if (studentsInClass.length === 0) {
    listEl.innerHTML = `<p style="color:var(--ink-soft);padding:10px;">No students found in ${escapeHtml(className)}.</p>`;
    promoteBtn.disabled = true;
    return;
  }
  listEl.innerHTML = studentsInClass
    .map(
      (s) => `
      <label class="promote-item">
        <input type="checkbox" class="promote-check" value="${s.id}" checked />
        <span>${escapeHtml(s.fullName)} <span class="mono-tag">${escapeHtml(s.admissionNo)}</span></span>
      </label>`
    )
    .join("");
  promoteBtn.disabled = false;
});

document.getElementById("promoteBtn").addEventListener("click", async () => {
  const fromClass = document.getElementById("promoteFrom").value;
  const toClass = document.getElementById("promoteTo").value;
  const checked = [...document.querySelectorAll(".promote-check:checked")].map((c) => c.value);

  if (isEmpty(toClass)) {
    notify("Please select a class to promote students into.", "error");
    return;
  }
  if (fromClass === toClass) {
    notify("The source and target class must be different.", "error");
    return;
  }
  if (checked.length === 0) {
    notify("Select at least one student to promote.", "error");
    return;
  }

  const ok = await confirmDialog(
    `Promote ${checked.length} student(s) from ${fromClass} to ${toClass}? Their admission numbers and PINs stay the same.`,
    "Promote"
  );
  if (!ok) return;

  const promoteBtn = document.getElementById("promoteBtn");
  promoteBtn.disabled = true;
  promoteBtn.textContent = "Promoting…";

  try {
    await Promise.all(checked.map((id) => updateDoc(doc(db, COLLECTIONS.students, id), { className: toClass })));
    notify(`${checked.length} student(s) promoted to ${toClass}.`, "success");
    document.getElementById("promoteFrom").value = "";
    document.getElementById("promoteList").innerHTML = `<p style="color:var(--ink-soft);padding:10px;">Select a source class to see its students.</p>`;
  } catch (err) {
    console.error(err);
    notify("Could not promote students. Please try again.", "error");
  } finally {
    promoteBtn.disabled = false;
    promoteBtn.textContent = "Promote Selected Students";
  }
});

// ==================================================================
// RESULTS  (Add / Edit / Delete / Publish / Unpublish)
// Position, grade and class average are recalculated automatically
// every time a result in a class/session/term group is saved — not
// only when it's published — so admins see live rankings as they work.
// ==================================================================
function listenResults() {
  onSnapshot(collection(db, COLLECTIONS.results), (snap) => {
    state.results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderResults();
    refreshStats();
  }, (err) => console.error("results listener", err));
}

function renderResults(filterText = "") {
  const tbody = document.getElementById("resultsTbody");
  const filtered = state.results.filter((r) =>
    `${r.studentName} ${r.className}`.toLowerCase().includes(filterText.toLowerCase())
  );
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No results recorded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered
    .map((r) => {
      const grade = r.studentAverage != null ? gradeFor(r.studentAverage).grade : "-";
      return `
      <tr>
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(r.className || "-")}</td>
        <td>${escapeHtml(r.session)}</td>
        <td>${escapeHtml(r.term)}</td>
        <td>${r.studentAverage ?? "-"}</td>
        <td>${r.position ? ordinal(r.position) : "-"}</td>
        <td><span class="grade-pill grade-${grade}">${grade}</span></td>
        <td><span class="badge ${r.published ? "badge-published" : "badge-pending"}">${r.published ? "Published" : "Pending"}</span></td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${r.id}" title="Edit" aria-label="Edit result">${icon("edit")}</button>
          <button class="icon-btn" data-toggle="${r.id}" title="${r.published ? "Unpublish" : "Publish"}" aria-label="Toggle publish">${icon(r.published ? "x" : "check")}</button>
          <button class="icon-btn danger" data-delete="${r.id}" title="Delete" aria-label="Delete result">${icon("trash")}</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openResultModal(state.results.find((r) => r.id === btn.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteRecord(COLLECTIONS.results, btn.dataset.delete, "result"))
  );
  tbody.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => togglePublish(state.results.find((r) => r.id === btn.dataset.toggle)))
  );
}
document.getElementById("resultSearch").addEventListener("input", (e) => renderResults(e.target.value));

/** Publish (or unpublish) a result. Class ranking is already kept current on every save, so this just flips visibility. */
async function togglePublish(result) {
  if (!result) return;
  const willPublish = !result.published;
  const ok = await confirmDialog(
    willPublish
      ? `Publish ${result.studentName}'s result? Students will be able to view it immediately.`
      : `Unpublish ${result.studentName}'s result? Students will no longer be able to view it.`,
    willPublish ? "Publish" : "Unpublish"
  );
  if (!ok) return;

  try {
    await updateDoc(doc(db, COLLECTIONS.results, result.id), { published: willPublish });
    notify(`Result ${willPublish ? "published" : "unpublished"}.`, "success");
  } catch (err) {
    console.error(err);
    notify("Could not update publish status.", "error");
  }
}

/** Recompute studentAverage-based class average, grade and position across every result in the same class/session/term — draft or published. */
async function recalculateClassRanking(className, session, term) {
  const q = query(
    collection(db, COLLECTIONS.results),
    where("className", "==", className),
    where("session", "==", session),
    where("term", "==", term)
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (docs.length === 0) return;

  const withAverages = docs.map((d) => {
    const subjects = d.subjects || [];
    const totalSum = subjects.reduce((sum, s) => sum + (Number(s.ca) || 0) + (Number(s.exam) || 0), 0);
    const average = subjects.length ? round2(totalSum / subjects.length) : 0;
    return { ...d, studentAverage: average };
  });

  const classAverage = round2(withAverages.reduce((sum, d) => sum + d.studentAverage, 0) / withAverages.length);

  // Dense ranking: equal averages share a position; the next distinct score continues correctly.
  const sorted = [...withAverages].sort((a, b) => b.studentAverage - a.studentAverage);
  let lastScore = null;
  let lastRank = 0;
  let seen = 0;
  const ranked = sorted.map((d) => {
    seen += 1;
    if (d.studentAverage !== lastScore) {
      lastRank = seen;
      lastScore = d.studentAverage;
    }
    return { ...d, position: lastRank, grade: gradeFor(d.studentAverage).grade };
  });

  await Promise.all(
    ranked.map((d) =>
      updateDoc(doc(db, COLLECTIONS.results, d.id), {
        studentAverage: d.studentAverage,
        classAverage,
        position: d.position,
        grade: d.grade,
      })
    )
  );
}

function openResultModal(existing) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const studentOptions = state.students
    .map((s) => `<option value="${s.id}" data-name="${escapeHtml(s.fullName)}" data-class="${escapeHtml(s.className || "")}" ${existing?.studentId === s.id ? "selected" : ""}>${escapeHtml(s.fullName)} (${escapeHtml(s.admissionNo)})</option>`)
    .join("");
  const sessionOptions = state.sessions
    .map((s) => `<option value="${escapeHtml(s.name)}" ${existing?.session === s.name ? "selected" : ""}>${escapeHtml(s.name)}</option>`)
    .join("");
  const termOptions = ["First Term", "Second Term", "Third Term"]
    .map((t) => `<option value="${t}" ${existing?.term === t ? "selected" : ""}>${t}</option>`)
    .join("");

  const initialSubjects = existing?.subjects?.length ? existing.subjects : [{ name: "", ca: "", exam: "" }];

  overlay.innerHTML = `
    <div class="modal" style="max-width:680px;">
      <h3>${existing ? "Edit Result" : "Add Result"}</h3>
      <form id="resultForm" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="r-student">Student *</label>
            <select id="r-student" required ${existing ? "disabled" : ""}>
              <option value="">Select student…</option>
              ${studentOptions}
            </select>
            <div class="field-error" id="err-r-student"></div>
          </div>
          <div class="form-group">
            <label for="r-attendance">Attendance</label>
            <input id="r-attendance" type="text" placeholder="e.g. 115/120 days" value="${escapeHtml(existing?.attendance || "")}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="r-session">Session *</label>
            <select id="r-session" required><option value="">Select…</option>${sessionOptions}</select>
            <div class="field-error" id="err-r-session"></div>
          </div>
          <div class="form-group">
            <label for="r-term">Term *</label>
            <select id="r-term" required><option value="">Select…</option>${termOptions}</select>
            <div class="field-error" id="err-r-term"></div>
          </div>
        </div>

        <label style="font-size:0.83rem;font-weight:600;color:var(--ink-soft);">Subjects &amp; Scores *</label>
        <div id="subjectRows" style="margin:8px 0;"></div>
        <button type="button" class="btn btn-outline btn-sm" id="addSubjectRow">${icon("plus", 14)} Add Subject</button>

        <div class="form-group" style="margin-top:16px;">
          <label for="r-teacherRemark">Teacher's Remark</label>
          <textarea id="r-teacherRemark" rows="2">${escapeHtml(existing?.teacherRemark || "")}</textarea>
        </div>
        <div class="form-group">
          <label for="r-principalRemark">Principal's Remark</label>
          <textarea id="r-principalRemark" rows="2">${escapeHtml(existing?.principalRemark || "")}</textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" data-action="submit">${existing ? "Save Changes" : "Add Result"}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("modal-show"));

  function close() {
    overlay.classList.remove("modal-show");
    setTimeout(() => overlay.remove(), 200);
  }
  overlay.querySelector('[data-action="cancel"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const subjectRowsEl = overlay.querySelector("#subjectRows");
  const subjectOptionsHtml = state.subjects.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("");

  function addSubjectRow(subject = { name: "", ca: "", exam: "" }) {
    const row = document.createElement("div");
    row.className = "form-row subject-row";
    row.innerHTML = `
      <div class="form-group">
        <select class="subj-name">
          <option value="">Select subject…</option>
          ${subjectOptionsHtml}
        </select>
      </div>
      <div class="form-group"><input class="subj-ca" type="number" min="0" max="100" placeholder="C.A. (0-100)" /></div>
      <div class="form-group"><input class="subj-exam" type="number" min="0" max="100" placeholder="Exam (0-100)" /></div>
      <button type="button" class="icon-btn danger remove-row" title="Remove" aria-label="Remove subject row">${icon("x", 15)}</button>
    `;
    row.querySelector(".subj-name").value = subject.name || "";
    row.querySelector(".subj-ca").value = subject.ca ?? "";
    row.querySelector(".subj-exam").value = subject.exam ?? "";
    row.querySelector(".remove-row").addEventListener("click", () => row.remove());
    subjectRowsEl.appendChild(row);
  }
  initialSubjects.forEach((s) => addSubjectRow(s));
  overlay.querySelector("#addSubjectRow").addEventListener("click", () => addSubjectRow());

  const form = overlay.querySelector("#resultForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    overlay.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));

    const studentSelect = overlay.querySelector("#r-student");
    const studentId = existing ? existing.studentId : studentSelect.value;
    const studentName = existing ? existing.studentName : studentSelect.selectedOptions[0]?.dataset.name;
    const className = existing ? existing.className : studentSelect.selectedOptions[0]?.dataset.class;
    const session = overlay.querySelector("#r-session").value;
    const term = overlay.querySelector("#r-term").value;

    let valid = true;
    if (isEmpty(studentId)) { overlay.querySelector("#err-r-student").textContent = "Please select a student."; valid = false; }
    if (isEmpty(session)) { overlay.querySelector("#err-r-session").textContent = "Please select a session."; valid = false; }
    if (isEmpty(term)) { overlay.querySelector("#err-r-term").textContent = "Please select a term."; valid = false; }

    // Prevent duplicate result for the same student/session/term
    const duplicate = state.results.find(
      (r) => r.studentId === studentId && r.session === session && r.term === term && r.id !== existing?.id
    );
    if (duplicate) {
      notify("A result already exists for this student, session and term. Edit that one instead.", "error");
      valid = false;
    }

    const subjectRows = [...subjectRowsEl.querySelectorAll(".subject-row")];
    const subjects = subjectRows.map((row) => ({
      name: row.querySelector(".subj-name").value,
      ca: row.querySelector(".subj-ca").value,
      exam: row.querySelector(".subj-exam").value,
    }));

    if (subjects.length === 0 || subjects.some((s) => isEmpty(s.name))) {
      notify("Every subject row needs a subject selected.", "error");
      valid = false;
    }
    if (subjects.some((s) => !isValidScore(s.ca) || !isValidScore(s.exam))) {
      notify("All C.A. and Exam scores must be numbers between 0 and 100.", "error");
      valid = false;
    }

    if (!valid) return;

    const cleanSubjects = subjects.map((s) => ({ name: s.name, ca: Number(s.ca), exam: Number(s.exam) }));
    const totalSum = cleanSubjects.reduce((sum, s) => sum + s.ca + s.exam, 0);
    const studentAverage = round2(totalSum / cleanSubjects.length);

    const payload = {
      studentId,
      studentName,
      className,
      session,
      term,
      subjects: cleanSubjects,
      attendance: overlay.querySelector("#r-attendance").value.trim(),
      teacherRemark: overlay.querySelector("#r-teacherRemark").value.trim(),
      principalRemark: overlay.querySelector("#r-principalRemark").value.trim(),
      studentAverage,
      grade: gradeFor(studentAverage).grade,
      published: existing?.published || false,
    };

    const submitBtn = overlay.querySelector('[data-action="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.results, existing.id), payload);
        notify("Result updated.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.results), { ...payload, createdAt: serverTimestamp() });
        notify("Result added as a draft. Publish it when ready.", "success");
      }
      // Automatic grading: recompute class average, grade and position for the whole group immediately.
      await recalculateClassRanking(className, session, term);
      close();
    } catch (err) {
      console.error(err);
      notify("Could not save result.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = existing ? "Save Changes" : "Add Result";
    }
  });
}

document.getElementById("addResultBtn").addEventListener("click", () => {
  if (state.students.length === 0) {
    notify("Please add at least one student before recording results.", "error");
    return;
  }
  if (state.subjects.length === 0) {
    notify("Please add at least one subject before recording results.", "error");
    return;
  }
  if (state.sessions.length === 0) {
    notify("Please create an academic session before recording results.", "error");
    return;
  }
  openResultModal(null);
});

// ==================================================================
// Shared delete helper
// ==================================================================
async function deleteRecord(collectionName, id, label) {
  const ok = await confirmDialog(`This will permanently delete this ${label}. This cannot be undone.`, "Delete");
  if (!ok) return;
  try {
    await deleteDoc(doc(db, collectionName, id));
    notify(`${label[0].toUpperCase()}${label.slice(1)} deleted.`, "success");
  } catch (err) {
    console.error(err);
    notify(`Could not delete ${label}.`, "error");
  }
}

/** Clears a student's daily result-check counter early, in case they legitimately need another look before the 24-hour window resets on its own. */
async function resetCheckLimit(admissionNo) {
  const ok = await confirmDialog(`Reset the daily result-check limit for ${admissionNo}? They'll be able to check their result again right away.`, "Reset Limit");
  if (!ok) return;
  const docId = admissionNo.replace(/[^a-zA-Z0-9]/g, "_");
  try {
    await deleteDoc(doc(db, COLLECTIONS.rateLimits, docId));
    notify("Check limit reset for this student.", "success");
  } catch (err) {
    console.error(err);
    notify("Could not reset the check limit. It may already be clear.", "error");
  }
}

// ==================================================================
// OVERVIEW STATS
// ==================================================================
function refreshStats() {
  const totalStudents = state.students.length;
  const totalTeachers = state.teachers.length;
  const totalClasses = state.classes.length;
  const totalSubjects = state.subjects.length;
  const published = state.results.filter((r) => r.published).length;
  const pending = state.results.filter((r) => !r.published).length;

  const cards = [
    { label: "Total Students", num: totalStudents },
    { label: "Total Teachers", num: totalTeachers },
    { label: "Total Classes", num: totalClasses },
    { label: "Total Subjects", num: totalSubjects },
    { label: "Published Results", num: published, gold: true },
    { label: "Pending Results", num: pending, gold: true },
  ];

  document.getElementById("statCards").innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card ${c.gold ? "gold-accent" : ""}">
        <div class="stat-num">${c.num}</div>
        <div class="stat-lbl">${c.label}</div>
      </div>`
    )
    .join("");
}

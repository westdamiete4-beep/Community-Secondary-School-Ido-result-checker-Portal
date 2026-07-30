// ============================================================
// admin-login.js
// ============================================================
import {
  auth, db, doc, getDoc, COLLECTIONS,
  signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged,
} from "./firebase.js";
import { notify, isEmpty, isValidEmail, applyBranding, createVoiceGuide } from "./common.js";

// Voice guide: explains how to sign in and reset a forgotten password.
createVoiceGuide(
  "This is the administrator login page. Enter your registered email address and password, " +
  "then click Login to Dashboard to access the admin panel. If you have forgotten your password, " +
  "type your email address above, then click the Forgot your password link to receive a password reset link by email."
);

// Apply branding on the login page too, and redirect straight to the
// dashboard if the admin is already signed in.
(async function init() {
  try {
    const settingsSnap = await getDoc(doc(db, COLLECTIONS.settings, "school"));
    if (settingsSnap.exists()) applyBranding(settingsSnap.data());
  } catch (err) {
    console.warn("Could not load settings", err);
  }
})();

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "admin-dashboard.html";
});

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

function clearErrors() {
  document.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
  document.querySelectorAll("input").forEach((e) => e.classList.remove("invalid"));
}
function setError(id, message) {
  document.getElementById(`err-${id}`).textContent = message;
  document.getElementById(id).classList.add("invalid");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let valid = true;
  if (isEmpty(email) || !isValidEmail(email)) { setError("email", "Enter a valid email address."); valid = false; }
  if (isEmpty(password)) { setError("password", "Enter your password."); valid = false; }
  if (!valid) return;

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    notify("Welcome back!", "success");
    window.location.href = "admin-dashboard.html";
  } catch (err) {
    console.error(err);
    const message = friendlyAuthError(err.code);
    notify(message, "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login to Dashboard";
  }
});

document.getElementById("forgotLink").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (isEmpty(email) || !isValidEmail(email)) {
    setError("email", "Enter your email above first, then click 'Forgot password?' again.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    notify(`Password reset link sent to ${email}.`, "success");
  } catch (err) {
    console.error(err);
    notify(friendlyAuthError(err.code), "error");
  }
});

function friendlyAuthError(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No administrator account found with that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/invalid-email":
      return "That email address looks invalid.";
    default:
      return "Login failed. Please check your details and try again.";
  }
}

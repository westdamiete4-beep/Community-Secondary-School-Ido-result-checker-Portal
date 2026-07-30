# Community Secondary School, Ido — Result Checker Portal

A complete, responsive result checker portal built with plain HTML, CSS, JavaScript and Firebase (Firestore + Authentication).

## File structure

```
index.html              Landing / home page
result-checker.html      Student result checker (no login required)
admin-login.html         Admin sign-in + password reset
admin-dashboard.html     Protected dashboard (students, results, teachers, classes, subjects, sessions, settings)
privacy-policy.html      Privacy policy
css/style.css            All styling (design tokens at the top of the file)
js/firebase.js           Firebase initialization + App Check (uses the config you provided)
js/common.js             Shared helpers: grading, toasts, confirm dialogs, the reusable modal form builder
js/result-checker.js     Public result lookup + print/PDF + daily rate limit
js/admin-login.js        Admin authentication
js/admin-dashboard.js    All CRUD + realtime listeners + result publishing/ranking engine
assets/                  Default logo placeholder + homepage photos
```

**Import map, not a bundler:** `js/firebase.js` imports from bare specifiers (`"firebase/app"`, `"firebase/app-check"`, `"firebase/firestore"`, `"firebase/auth"`) — the same modular v9+ syntax you'd get from `npm install firebase`. Since this project has no build step, those specifiers are resolved by a `<script type="importmap">` block placed in the `<head>` of every HTML page, right after the `<meta charset>` tag, mapping each one to Google's CDN URL. This keeps the exact modular import syntax while staying a plain static site — no npm, no bundler, deploys to Netlify (or any static host) with zero configuration. If you ever add a new page, copy that same `<script type="importmap">` block into its `<head>` before any `<script type="module">` tag, or its Firebase imports won't resolve.

Open `index.html` in a browser (or host the folder on any static web server / Firebase Hosting) — no build step required.

## One-time Firebase setup

### 1. Enable Authentication
In the Firebase console → **Authentication → Sign-in method**, enable **Email/Password**.

Then create your first administrator account:
**Authentication → Users → Add user**, enter an email and password. That's the account you'll use to log in at `admin-login.html`.

### 2. Enable Firestore
In the Firebase console → **Firestore Database**, click **Create database** (production mode is fine).

### 3. Firestore security rules
The portal separates **public read** (for the result checker and branding) from **admin-only write**. Paste this into **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Public result checker needs to read students, results and settings.
    match /students/{id}      { allow read: if true; allow write: if request.auth != null; }
    match /results/{id}       { allow read: if true; allow write: if request.auth != null; }
    match /settings/{id}      { allow read: if true; allow write: if request.auth != null; }
    match /classes/{id}       { allow read: if true; allow write: if request.auth != null; }
    match /sessions/{id}      { allow read: if true; allow write: if request.auth != null; }

    // These are only ever touched from the admin dashboard.
    match /teachers/{id}      { allow read, write: if request.auth != null; }
    match /subjects/{id}      { allow read, write: if request.auth != null; }

    // Daily result-check rate limit — one doc per admission number.
    // Read is public because the checker page needs to see the current
    // count before deciding whether to allow another attempt; the data
    // itself is harmless (just a number and a timestamp, no student
    // details). What matters is that count can only move in ways these
    // rules allow: +1 within the current 24-hour window, or a full
    // reset back to 1 once that window has passed. A student poking at
    // the browser console cannot write any other value — Firestore
    // rejects it server-side regardless of what the page's JavaScript sends.
    match /rateLimits/{id} {
      allow read: if true;
      allow create: if request.resource.data.count == 1
                    && request.resource.data.windowStart == request.time
                    && request.resource.data.keys().hasOnly(['count', 'windowStart']);
      allow update: if
        (
          resource.data.count < 2 &&
          request.time < resource.data.windowStart + duration.value(24, 'h') &&
          request.resource.data.count == resource.data.count + 1 &&
          request.resource.data.windowStart == resource.data.windowStart &&
          request.resource.data.keys().hasOnly(['count', 'windowStart'])
        ) ||
        (
          request.time >= resource.data.windowStart + duration.value(24, 'h') &&
          request.resource.data.count == 1 &&
          request.resource.data.windowStart == request.time &&
          request.resource.data.keys().hasOnly(['count', 'windowStart'])
        );
      allow delete: if request.auth != null;
    }
  }
}
```

> Anyone can *read* students/results, but a student can only see a result if they know the exact Admission Number, Class, PIN, Session and Term — and only once an admin has set `published: true` on it. All writes everywhere require an authenticated admin, except the two narrow, tightly-validated exceptions above (the rate-limit counter) that the public checker needs to write to on its own.

## Daily result-check limit
Students are capped at **2 successful result checks per admission number every 24 hours** — attempts only count once a lookup fully succeeds (admission number, class and PIN all correct, and a published result exists). Wrong PINs or typos don't burn through the cap. This is enforced in Firestore itself, not just in the page's JavaScript, so it can't be bypassed by clearing browser storage, using Incognito mode, switching browsers, or switching devices — the security rules above only allow the counter to increase by exactly 1 within the current window, or reset to 1 once a full 24 hours has passed.

If a student has a legitimate reason to check again sooner (picked the wrong term, needs to help a parent look right away), an admin can clear it early: open **Student Management**, find the student, and click the refresh icon next to their row (**Reset daily check limit**).

## App Check (verifying requests come from your real site)
App Check adds a second, independent layer of protection on top of the security rules above: it proves a request to Firestore actually came from this deployed website (running in a real browser, passing an invisible reCAPTCHA v3 check), not a script hitting your project directly with a copied Firebase config. The site key is already configured in `js/firebase.js` and initializes before any other module can issue a Firestore request, so it's active from the very first page load — one manual step remains in the Firebase Console before it actually blocks anything (see below).

**Already done for you:** the reCAPTCHA v3 site key is registered in `js/firebase.js`, and App Check registration for this web app in the Firebase Console should already be in place if you've completed that step there. What's left is entirely on the Firebase Console side:

1. Redeploy the site with this updated `js/firebase.js`.
2. **Wait before enforcing.** In Firebase Console -> App Check, leave Cloud Firestore in monitor-only mode for a few days and watch the metrics — you should see the large majority of requests coming through as "verified." This confirms the key is wired up correctly and your domain matches what you registered with reCAPTCHA.
3. Only once you're seeing healthy verified traffic, go to App Check -> APIs -> Cloud Firestore and switch it to **Enforce**. From that point on, Firestore will reject any request that doesn't carry a valid App Check token.

Skipping step 2 and enforcing immediately is the most common way this locks real users out — a domain mismatch between your reCAPTCHA site key and where the site is actually hosted will silently fail otherwise legitimate traffic, so always confirm in monitor mode first.

If you ever need to test locally (`localhost`), the code already handles this: it registers a debug token automatically and prints it to the browser console the first time you load the page locally. Copy that token into Firebase Console -> App Check -> Manage debug tokens to let your local environment through without a real reCAPTCHA pass.

### 4. First-time data
Once logged in to the dashboard, create records in this order for everything to link up correctly:
1. **School Settings** — name, motto, logo, contact info
2. **Academic Sessions** (e.g. `2025/2026`)
3. **Classes** (e.g. `JSS1A`)
4. **Subjects** (e.g. `Mathematics`, `English Language`)
5. **Students** (assigned to a class) — see admission numbers below
6. **Results** — pick a student, session and term, add subject scores, then click **Publish** so it appears on the public checker. Class average, position and grade are recalculated automatically every time *any* result in that class/session/term group is saved (draft or published), so rankings are always current.

## Admission numbers & PINs
- Every student gets a permanent admission number in the pattern **CSS/IDO/001**, generated automatically when they're added — the sequence restarts at `001` for each class. The dashboard re-checks global uniqueness at save time (in case a number is ever freed up by a promotion), so no two students ever share a number.
- A random **4-digit PIN** is generated alongside it. Both are shown in the Add Student confirmation and in the Students table; use "Regenerate" in the student's edit screen to issue a new PIN if a student forgets theirs.
- The public result checker requires **Admission Number + Class + PIN + Session + Term** together — this keeps a student's result private even if someone guesses their admission number.
- Admission numbers and PINs never change automatically. If a student needs a new PIN, an admin regenerates it manually.

## Promoting students
Open **Promote Students** in the sidebar, choose a **From Class** and **To Class**, tick the students to move (all are ticked by default), then confirm. Only the student's class changes — their admission number, PIN and result history stay exactly as they were.

## Grading scale
| Score   | Grade | Remark    |
|---------|-------|-----------|
| 70–100  | A     | Excellent |
| 60–69   | B     | Very Good |
| 50–59   | C     | Good      |
| 45–49   | D     | Fair      |
| 40–44   | E     | Pass      |
| 0–39    | F     | Fail      |

## Notes
- Student and school-logo photos are stored as base64 data URLs directly in Firestore documents to keep the setup to Firestore + Auth only (no Storage bucket rules to configure). For a very large school this could be swapped for Firebase Storage with minimal changes to `fileToDataUrl` usage in `js/common.js`.
- "Download as PDF" renders the result sheet with html2canvas + jsPDF (loaded from CDN) — no server-side rendering needed.
- There is intentionally no loading splash screen; the admin dashboard shows a minimal "Checking your session…" gate only until Firebase confirms the auth state, per the brief.

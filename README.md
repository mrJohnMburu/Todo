# Minimal Two-Tab Todo App

Lightweight task manager with two focused contexts (Work and Personal). Built with vanilla HTML, CSS, and JavaScript so it can deploy exactly like your `Workout_app` project while also shipping the same Firebase Auth + Firestore sync layer for cross-device persistence.

## Features
- Two tabs (Work / Personal) with persisted filter state
- Add, complete/uncomplete, and delete tasks with instant updates
- Toggle to hide completed items per tab
- Keyboard shortcut (`n`) that focuses the input for quick capture
- Guest mode uses `localStorage`; signing in switches to Firebase-backed sync (Firestore + Auth)
- User menu with manual "Sync now", reset, and sign-out controls
- Responsive, minimalist UI designed for phones and desktops

## Tech Stack
| Layer | Choice | Notes |
| --- | --- | --- |
| Markup | HTML5 | Single `index.html` entry point like `Workout_app` |
| Styles | Plain CSS + CSS custom properties | No build step; easy to keep consistent with Tailwind CDN if desired |
| Logic | Vanilla script (`app.js`) | Works when opened from disk or any static host |
| Persistence | `localStorage` (guest) + Firebase Auth/Firestore | Same deployment-friendly pattern described in `Workout_app/FIREBASE_SETUP.md` |
| Deployment | GitHub Pages (main branch / root) | Identical workflow to the workout app |

## Project Structure
```
index.html        # root document, renders tabs + layout
styles.css        # minimalist theme, focus states, responsive rules
app.js            # state, rendering, auth, sync bridge
firebase-auth.js  # fill with your Firebase config + helper glue
assets/           # icons or placeholder graphics
```

## Running Locally
Open `index.html` directly in a browser to test guest mode. For Firebase auth to work (required for cross-device sync), serve the folder over HTTP/HTTPS:

```bash
npx serve .
```

Sign in/out from the modal to confirm Firestore updates propagate.

## Firebase Setup (required for sync)
1. Create a Firebase project (or reuse the Workout_app one) and enable **Email/Password** auth plus **Firestore** (rules identical to `FIREBASE_SETUP.md`).
2. In `firebase-auth.js`, replace the `firebaseConfig` placeholder values with your real keys (apiKey, authDomain, etc.).
3. Add your hosting origin (GitHub Pages domain or Firebase Hosting domain) under **Authentication → Settings → Authorized domains**.
4. Optional: reuse the same `users/{uid}/tasks` collection so both apps share credentials but store separate data.
5. Deploy—once the page loads over HTTPS, sign in to trigger realtime sync.

## Deployment (GitHub Pages)
Follow the same flow you used for `Workout_app`:
1. Initialize a repository and push to GitHub (`main` branch).
2. In the GitHub UI, go to **Settings → Pages**.
3. Under **Build and deployment**, pick **Deploy from a branch**.
4. Select `main` and **/ (root)**, then Save.
5. Wait up to a minute for Pages to publish at `https://<username>.github.io/<repo>/`.
6. Visit the URL and confirm tasks persist; pushes to `main` redeploy automatically.

## Deployment (Firebase Hosting)
If you prefer a single Firebase workflow:
1. Install the CLI (`npm install -g firebase-tools`) and run `firebase login`.
2. Inside this folder run `firebase init hosting`, select your project, and set `public` to `.` (current directory). Decline SPA rewrites (not needed) and overwriting `index.html`.
3. Deploy whenever ready:
	```bash
	firebase deploy --only hosting
	```
4. Add the new hosting domain to Firebase Auth authorized domains.

## Roadmap
- [x] Implement base UI + tab switching
- [x] Persist tasks in `localStorage`
- [x] Add keyboard and accessibility enhancements
- [x] Integrate Firebase auth modal + sync (mirrors Workout_app)
- [ ] Polish styles and micro-animations
- [ ] Document tests and QA checklist

For a deeper execution breakdown, see `IMPLEMENTATION_PLAN.md`.

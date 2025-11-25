# Implementation Plan

Plan for building the minimalist two-tab todo app while keeping deployment identical to `Workout_app` (static GitHub Pages site with optional Firebase enhancements).

## 1. Goals & Principles
- **Minimal surface area**: ship a no-build stack (HTML + CSS + JS) for fast iteration and simple hosting.
- **Two-context focus**: Work and Personal tabs replace multiple lists/filters.
- **Offline-first**: rely on `localStorage` so tasks persist without a network connection.
- **Optional sync**: mirror `Workout_app`'s Firebase Auth + Firestore setup for cross-device data.
- **Accessibility**: keyboard navigation, clear focus states, sufficient contrast, ARIA labels for tabs.

## 2. Architecture Overview
```
index.html
 └─ app.js        # Initializes state, handles events, renders UI
    ├─ storage.js # localStorage CRUD + in-memory cache
    ├─ ui.js      # templating helpers (optional split if needed)
    └─ firebase-auth.js (optional) # wraps Firebase SDK for auth + Firestore sync
styles.css        # layout, theme, animations
assets/           # icons/placeholders
```
- **State shape**: `{ activeTab: 'work' | 'personal', tasks: Task[] }`
- **Task**: `{ id, title, note?, completed, tab, createdAt, due? }`
- **Persistence**: store `state.tasks` JSON in `localStorage` under `todo-tabs-v1`.
- **Sync bridge** (optional): when auth is enabled, load remote tasks into state, merge conflicts by timestamps, and push local changes to Firestore collections (`users/{uid}/tasks`).

## 3. UI / UX Plan
1. **Header + Tabs**
   - Pill buttons for Work / Personal, `aria-pressed` or `role="tab"` semantics.
   - Persist `activeTab` in storage.
2. **Task Composer**
   - Single-line input + add button, placeholder text updating with active tab.
   - Keyboard: Enter adds task; `n` shortcut focuses the input.
3. **Task List**
   - Checkbox to toggle completion, inline delete button.
   - Filter: show/hide completed toggle.
   - Empty-state message per tab.
4. **Responsive Layout**
   - Max width ~640px, centered card; stack gracefully on mobile.
5. **Auth Modal (optional)**
   - Duplicate the pattern from `Workout_app`: modal with sign-in, register, guest options, user badge in header.

## 4. Development Phases
### Phase 1 – Foundation
- Scaffold `index.html`, `styles.css`, `app.js` with static markup and placeholder tasks.
- Implement tab switching, task rendering, and localStorage persistence.

### Phase 2 – UX Polish
- Add keyboard shortcuts, focus states, subtle animations, and empty states.
- Harden accessibility (ARIA roles, skip-to-content, labels).

### Phase 3 – Optional Firebase Sync
- Copy Firebase setup steps from `FIREBASE_SETUP.md` (Workout_app) into new `firebase-auth.js`.
- Add auth modal, user menu, and sync logic (push/pull tasks, conflict handling).
- Gate network features behind auth; keep guest mode fully local.

### Phase 4 – Testing & Deployment
- Manual regression checklist (desktop/mobile, add/delete, tab persistence, offline).
- Document quick smoke tests in README.
- Deploy to GitHub Pages via `main` branch root; validate hosted URL.

## 5. Deployment Strategy (GitHub Pages)
- Keep repo root structured just like `Workout_app` so Pages can serve `index.html` directly.
- Scripts:
  1. `git init && git add . && git commit -m "feat: todo app"`
  2. `git branch -M main`
  3. `git remote add origin git@github.com:<user>/<repo>.git`
  4. `git push -u origin main`
- Configure Pages: Settings → Pages → Deploy from a branch → `main` / root.
- For Firebase features, add hosted URL (`https://<user>.github.io/<repo>/`) to Firebase authorized domains, same as `Workout_app`.

## 6. Testing Checklist
- [ ] Add/complete/delete tasks in both tabs
- [ ] Refresh page to confirm persistence
- [ ] Toggle "show completed" and verify filtering per tab
- [ ] Keyboard: `n` focuses input, Enter submits
- [ ] Screen reader tab navigation reads labels correctly
- [ ] Mobile viewport check (Chrome dev tools)
- [ ] (Optional) Firebase sign-in/out, cross-device sync, and security rule enforcement

## 7. Future Enhancements
- Date-based sorting or due reminders
- Drag-and-drop ordering per tab
- PWA manifest + service worker for installable experience
- Analytics event logging (optional)

This plan keeps the workflow aligned with `Workout_app` so you can reuse the same deployment muscle memory while layering in new functionality incrementally.

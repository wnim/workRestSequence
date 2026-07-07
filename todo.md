# Improvements

Work through these one at a time. After each one, mark it as done before moving to the next.

---

## 1. [ ] GitHub Gist setup — replace PAT input with Device Flow OAuth
**Difficulty: 3/5** — The reference implementation exists and can be ported directly, but involves OAuth polling, network error handling, and non-trivial UX state (waiting → success → error).

The current `GistSetupModal.jsx` asks users to manually create and paste a Personal Access Token. Replace this with GitHub Device Flow OAuth: auto-request a device code, open GitHub's verification page in a new tab, display the code with a one-click-copy button, poll for the token in the background, then auto-discover and auto-select existing gists.

Reference: `/home/nimw/experiments/skillTree/src/GistSetupModal.jsx` and `/home/nimw/experiments/skillTree/src/gist.js` (look at `requestDeviceCode`, `pollForToken`, `findSkillTreeGists`).

---

## 2. [x] Undo/redo — move history arrays from Zustand state to refs
**Difficulty: 2/5** — Mechanical refactor within a single file, low risk of breakage.

In `workoutStore.js`, the `past` and `future` arrays are stored in Zustand state, causing a full re-render on every edit even though these arrays are never read during rendering. Move them to refs so that history operations don't trigger re-renders. Also increase the history limit from 30 to 50.

Reference: `/home/nimw/experiments/skillTree/src/useSkillTree.js` — look at how `pastRef` and `futureRef` are used.

---

## 3. [ ] Playback engine — add tab-visibility fallback, prestart countdown, and phaseState
**Difficulty: 5/5** — The most complex item. Touches the core timer loop, introduces a new state machine, and requires coordinating audio cues with the new phaseState. High risk of regressions.

`usePlayback.js` uses a plain `requestAnimationFrame` loop which stops firing when the tab is hidden, causing audio cues to be missed. Switch to `setTimeout` as a fallback when `document.hidden` is true. Also add: a prestart 3-2-1 countdown state before the first interval, `seekRelative(±1)` to skip to the next/previous interval while paused, a `phaseState` abstraction (e.g. `idle/prestart/work/rest/completed/paused`) that drives audio and UI separately from the raw running state, and a `destroy()` that removes the `visibilitychange` listener.

Reference: `/home/nimw/experiments/jumpRopePlanner/workout-runtime.js`.

---

## 4. [x] Audio — disconnect nodes after stop, add rapid-repeat guard
**Difficulty: 1/5** — Small, self-contained, additive changes to a single file. No risk of breaking unrelated things.

In `useAudio.js`, oscillator and gain nodes are never disconnected after `.stop()` is called, causing them to accumulate. Fix this by disconnecting both in an `osc.onended` callback. Also add a ~100ms deduplication guard so the same sound triggered twice in rapid succession only plays once (prevents audio glitches when events fire close together). Wrap `AudioContext` construction in a `try/catch`.

Reference: `/home/nimw/experiments/jumpRopePlanner/sound-bank.js`.

---

## 5. [ ] Keyboard shortcuts — add a discoverable help panel
**Difficulty: 2/5** — A new self-contained component with some CSS animation. Reference is directly portable.

`useKeyboard.js` registers several shortcuts (Delete, Ctrl+C/V, Ctrl+Z/Y, Space) but there's no way for users to discover them. Add a help panel component that opens on `?` keypress, displays shortcuts grouped by category using styled `<Kbd>` chips, animates open/close with scale+opacity, and closes on click-outside or any other key.

Reference: `/home/nimw/experiments/skillTree/src/KeyboardShortcutsHelp.jsx`.

---

## 6. [x] Delete confirmation — two-click pattern with auto-timeout
**Difficulty: 1/5** — Simple, self-contained UI pattern. No external dependencies or state complexity.

Destructive delete actions currently have no confirmation. Add a non-modal two-click confirm pattern: the first click arms the button (change its appearance to a warning state) and starts a ~2.6s auto-cancel timeout; a second click within that window confirms the deletion. If the timeout expires, the button resets to its default state. No browser dialogs, no modals.

Reference: `/home/nimw/experiments/jumpRopePlanner/workout-history.js` — look at `setPendingDelete`.

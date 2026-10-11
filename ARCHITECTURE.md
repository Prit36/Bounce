# Browser architecture

## Runtime

The original game executes locally in JS2ME, which converts Java
bytecode into JavaScript and implements Java ME APIs in the browser. There
is no backend API, database service, Java process, or gameplay server.

The JavaScript VM handles bytecode execution, rendering, and game state
locally. The browser runs the source files directly; WASM is unnecessary.

| Component | Browser implementation |
| --- | --- |
| Startup | Root `index.html`, opened directly or delivered by a static host |
| JVM core | Classic scripts from `vendor/js2me/js/` |
| Engine and Java APIs | Lazy local script loading, preserving VM callback timing and compatibility patches |
| Handset glyphs | `src/fonts.js`, loaded as a classic script with no fetch |
| UI and typography | Local HTML, CSS, SVG, and licensed TTF |
| Game content | User-selected File API data, passed to the VM as a verified Blob |
| Verification | Web Crypto SHA-256, with a tested JavaScript implementation for contexts without SubtleCrypto |
| Remembered JAR | IndexedDB; reverified before every launch |
| Progress and preferences | localStorage and JSON backup import/export |
| Sound and input | Web Audio, keyboard, pointer, and Gamepad APIs |
| Tests | A browser HTML runner with isolated storage doubles |

The source files are the application, with `index.html` as its entry point.
All player assets are local. No installation, build step, game content,
or runtime CDN is required.

Classic scripts work from file URLs without module or fetch CORS
requirements. The VM loads its native APIs only when needed, keeping the
original `classBucket` consumption order and handset patch behavior. The
unchanged game JAR is decompressed with the bundled JavaScript inflater.

## Validation

Open `tests/index.html`. Tests cover SHA-256 reference vectors and padding
boundaries, JAR rejection, preserved handset glyphs, overlapping input,
gamepad neutral gating, save round trips, corrupt backup rejection, save
rollback, and audio preferences. Test writes use a dedicated in-memory
storage double and never change real game saves. The optional file picker
checks your JAR with both hash implementations and verifies byte preservation.

For end-to-end checks:

1. Open root `index.html` with network access disabled.
2. Try an unsupported JAR, then the supported original. Start a game and check
   keyboard movement/jumping, sound, touch controls, and the pause menu.
3. Save progress, change a preference, and reload. Check the remembered JAR,
   progress, and preference. Export a save and check import validation.
4. Forget the JAR and reload; the picker should return and progress should stay.
5. Check a mobile viewport and a static hosted copy under a subdirectory.
6. In DevTools, check for uncaught errors and external requests. Direct-file
   use should make zero HTTP requests.

## Storage and release boundaries

File URL persistence varies by browser. Keep the same folder path and export
backups before moving the app or changing origin/browser. Clearing browser
data removes saves and the remembered JAR. The JAR is never uploaded, included
in a backup, or distributed with the player.

Local offline use requires the entire player folder. Static hosting only
delivers files and executes no application logic. Hosted offline reloads are
not guaranteed; there is no service worker. Distribution uses the explicit
frontend file list in `RELEASING.md`.

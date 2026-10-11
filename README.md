# Bounce

A browser-only player for a **user-provided Nokia Bounce 1.24 JAR**. Open
`index.html` in a modern browser, or double-click `PLAY-BOUNCE.cmd` on Windows.
Choose **Choose JAR file** to start. No installation, build, package manager,
Java installation, backend, CDN, or local server is needed.

The original Java bytecode runs locally in the bundled JavaScript JS2ME
runtime. WASM is unnecessary. The player includes no game JAR, artwork,
levels, sounds, decompiled game code, or gameplay screenshots.

## Supported game

Bring a copy you are authorized to use. The supported Nokia Bounce 1.24
release has this SHA-256:

```text
77a24bf1de10ad8a1c440fc96aa1ed2e4b29f2102771f268eaa93ff910b55ee8
```

File names may differ; the bytes must match. Other games, modified files,
empty files, and files over 1 MB are rejected before the VM starts. File
verification uses Web Crypto when available and a local JavaScript SHA-256
implementation otherwise, so direct file URLs also work. No game download
links are provided.

## Privacy and saves

The browser reads and verifies your selected JAR locally. It is never uploaded.
**Remember on this device** stores it in IndexedDB and verifies it again before
every launch. Uncheck this option to play for the current session only.
**Controls → Saves → About → Forget JAR** removes the remembered file and keeps
your progress. If the browser prevents remembering the file, select it again
after refreshing.

Progress and preferences use localStorage. Export/import JSON backups from
**Controls → Saves**. Browser storage depends on the browser profile and
origin; file URL behavior varies by browser. Keep the player folder at the
same path, and export a backup before moving it or switching from localhost
to direct file use or a hosted URL. Private browsing and browser storage
policies can limit persistence. There are no analytics or telemetry.

## Controls

- Move: **Left / Right**, **A / D**, or **4 / 6**.
- Jump: **Up**, **W**, **Space**, or **2**.
- Select: **Enter** or the center button.
- Menu/back: **Escape**, **X**, or a soft key.
- Controllers: D-pad / left stick to move, A/Cross to jump, B to go back, Start for menu.
- Touch: classic phone keypad or two-thumb arcade controls.

Themes, faceplates, display filters, integer pixel scaling, fullscreen,
volume, optional keypad tones and haptics, save backups, and original cheat
codes are available in Controls. Settings pause play and block game input.

The game canvas stays 128 × 128. The selected JAR supplies the original
artwork, HUD, levels, game logic, and sounds. Handset text uses Přemysl Eric
Janouch's Nokia 3310 font reconstruction. Browser timing and emulated phone
hardware can differ from an original handset.

## Edit and test

Edit the HTML, CSS, or JavaScript and refresh the browser. There is no build
step or generated application directory.

- `index.html`: the only player entry point.
- `src/`: interface, input, audio, local verification, glyphs, and handset compatibility.
- `vendor/`: browser runtime and licensed font reference sources.
- `tests/index.html`: browser test runner with isolated in-memory save storage.

Open `tests/index.html` to run the tests. Optionally select your JAR there to
check verification and byte preservation; the test page does not store or
upload it. See [ARCHITECTURE.md](ARCHITECTURE.md) for the browser architecture
and manual gameplay checks.

## Static hosting

Upload `index.html`, `src/`, `vendor/`, `LICENSE`, and `THIRD_PARTY_NOTICES.md`
to any static host. Relative URLs support hosting under a subdirectory. Serve
`.js` as JavaScript and `.css` as CSS. All computation and storage run in the
browser; the host only delivers files.

For offline use, keep the whole player folder together and open its
`index.html`. A hosted URL needs access to its static files; there is no
service worker. Read [RELEASING.md](RELEASING.md) before distributing files.

## License and rights

Wrapper code: [MIT](LICENSE). Third-party runtime and font terms:
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Nokia Bounce and its game content belong to their respective rights holders.
The wrapper license grants no rights to the game. This project is independent
of, and is not affiliated with or endorsed by, Nokia.

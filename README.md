# Bounce

An independent browser player for a **user-provided Nokia Bounce 1.24 JAR**. The original Java bytecode runs in a bundled JS2ME runtime. No game, game artwork, levels, sounds, decompiled game code, or gameplay screenshots are included in the public release.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm start
```

On Windows, you can also double-click `PLAY-BOUNCE.cmd` (or use `npm.cmd start`). Open [localhost:4173](http://localhost:4173) and click **Choose JAR file**. There are no npm dependencies to install, no Java installation requirement, and no external runtime CDN.

Bring a copy you are authorized to use. This player supports one verified Nokia Bounce 1.24 release with this SHA-256:

```text
77a24bf1de10ad8a1c440fc96aa1ed2e4b29f2102771f268eaa93ff910b55ee8
```

File names may differ; the bytes must match. Other games, other versions, modified files, empty files, and files over 1 MB are rejected before the VM starts. Verification requires HTTPS or localhost; opening `index.html` directly is unsupported. No game download links are provided.

## Privacy and saves

Your selected JAR is read with the browser File API and verified locally. **Remember on this device** is enabled by default: it stores the verified file in this browser's IndexedDB so refreshes, restarts, and later visits can load it again. The stored bytes are verified again before every launch. The file is never sent to a server or included in save backups.

Uncheck **Remember on this device** to play for the current session only. **Controls → Saves → About → Forget JAR** deletes the remembered file and returns to the picker, keeping your progress. Clearing site data also removes it. Browser storage is separate for each hostname and port; private browsing or storage restrictions may prevent remembering the file. If saving fails, play still works and the player tells you to select the JAR again after refreshing.

The original game's RMS progress and player preferences are stored in localStorage for this browser and origin. Export/import JSON backups from **Controls → Saves**. A new hostname or port has separate saves. The interface does not contain analytics or telemetry.

## Controls and features

- Move: **Left / Right**, **A / D**, or **4 / 6**.
- Jump: **Up**, **W**, **Space**, or **2**.
- Select: **Enter** or the center button.
- Menu/back: **Escape**, **X**, or a soft key.
- Standard controllers: D-pad / left stick to move, A/Cross to jump, B to go back, Start for menu.
- Touch: classic phone keypad or two-thumb arcade controls.

The player includes themes, faceplates, display filters, integer pixel scaling, fullscreen, volume, optional keypad tones and haptics, save backups, and the game's original optional cheat codes. Settings pause play. Keyboard and controller input are blocked while choosing a JAR or editing settings.

The original game canvas remains 128 × 128, with its original artwork, HUD, level data, game logic, and sounds supplied by the selected JAR. The game's timer requests 25 ticks per second; browser scheduling can vary. Handset/system text uses Přemysl Eric Janouch's Nokia 3310 font reconstruction, with the permissive notice from its source headers retained. The glyph data matches the earlier player. Original phone firmware, display hardware, and speaker output are emulated, so this is not a hardware-identical reproduction.

After the JAR loads, its original icon becomes the browser tab icon. The image is read locally from the JAR and is not included in the public source or static build.

## Develop and test

```sh
npm run build
npm test
npm run release:prepare
```

- `src/`: wrapper interface, input, audio decoding, and handset compatibility code.
- `vendor/`: redistributable runtime and licensed handset font source, with notices.
- `dist/`: generated static player, containing **no game files**. Serve this directory over localhost or HTTPS.
- `release/github-source/`: audited source export for a **fresh** public repository, without this checkout's Git history.
- `release/manifest.json`: list of exported files for review.

The build clears stale output before copying the player, so an old bundled JAR cannot remain in `dist/`. The release command builds, tests, and audits exported files. CI performs the same checks without a game. Optional private preservation tests run only when a local JAR is available (`BOUNCE_TEST_JAR` can point to one); the fixture is never included in an export.

## Release packaging

**Read [RELEASING.md](RELEASING.md) first.** This public repository starts from an audited source export with fresh Git history. The original development checkout contained game files; its history was excluded. Keep game files and private analysis out of commits and release assets. `.gitignore` and deleting files from the latest commit do not remove earlier copies from Git history.

No remote repository, deployment, or hosting credentials are created by these commands. The included GitHub workflow validates the build only; it does not deploy.

## License and rights

Wrapper code: [MIT](LICENSE). Third-party runtime and font terms: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Nokia Bounce and its game content belong to their respective rights holders. The wrapper license grants no rights to the game. This project is independent of, and is not affiliated with or endorsed by, Nokia. Requiring a user-provided JAR reduces distributed game content; it does not guarantee immunity from copyright or trademark claims. GitHub describes its process in its [DMCA Takedown Policy](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy).

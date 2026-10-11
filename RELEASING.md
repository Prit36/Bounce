# Browser player distribution

There is no build or packaging script. Test the browser files directly by
opening `tests/index.html`, then check gameplay through root `index.html`.

Copy only these paths into a clean distribution folder:

- `index.html`
- `src/`
- `vendor/`
- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- `README.md` and `ARCHITECTURE.md`
- `PLAY-BOUNCE.cmd` for the optional Windows shortcut
- `tests/` if distributing the browser test runner

The resulting folder can be opened directly, zipped for users, or uploaded
to a static host. Keep its relative paths intact. There are no installation
commands, backend processes, package dependencies, or deployment credentials.

Do not copy the whole development checkout. Exclude `.git/`, `.private/`,
release archives, local game JARs and ZIPs, extracted assets,
private analysis, and gameplay screenshots. Users supply their own supported
JAR; the player's license does not grant rights to the game.

Keep private fixtures and game material out of repository history as well as
release assets. Review the files and commit before publishing; the frontend
allowlist above defines the public player.

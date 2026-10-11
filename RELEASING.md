# Public release preparation

## Use a fresh source export

The public repository starts with fresh history from an audited source export. The original development checkout's history contains a bundled Nokia game JAR and extracted game material. Never merge or push that old history, its branches, or its tags into the public repository. Ignoring or deleting files in a later commit does not remove those earlier blobs.

Before a release, run:

```sh
npm run release:prepare
```

This creates `release/github-source/` using an explicit source allowlist and checks for game archives, Java classes, sounds, extracted artwork, screenshots, private analysis, credentials, and disguised ZIP/class files. It never copies `.git`. The audit is a packaging guard, not a legal clearance or an exhaustive secrets scanner. Review `release/manifest.json` and the exported files before publication.

For the first public import or when working from a checkout with private history, copy the **contents of `release/github-source/`** into a new, empty directory outside that checkout. Include the hidden `.github`, `.gitignore`, and `.gitattributes` files. Do not copy the parent project, `.private/`, `tools/`, `analysis/`, `dist/`, game files, or `.git/`.

In that new directory, verify the game-free source and initialize a new local repository:

```sh
npm run build
npm test
git init -b main
git add .
git diff --cached --stat
git commit -m "Initial public player release"
```

Only after reviewing that fresh commit should you connect it to your intended GitHub repository and publish it. For subsequent releases from the clean public repository, review the committed tree and tag the reviewed commit. Release assets must come from the audited export or build, never the original project folder. This project's scripts create no remote resources. If game files were previously published elsewhere, a fresh repository does not remove those existing copies; address that repository and any old release assets separately.

## Included and excluded content

The public source includes the browser wrapper, JS2ME and legacy zip.js runtime with their notices, Outfit under OFL 1.1, and Přemysl Eric Janouch's Nokia 3310 font reconstruction under the permissive terms in its source headers. The complete font notice is included in `vendor/nokia-font/LICENSE.txt`. The original game JAR, extracted sprites/icon/splash screen, level and sound files, decompiled game source and bytecode dumps, and gameplay screenshots are excluded.

On the original development machine, the original JAR stays untouched in an ignored local file. Previous analysis and backups were preserved under `.private/`; these are not release inputs. The public font is generated from the licensed C tables in `vendor/nokia-font/`. Keeping private files locally does not make them safe to publish. Avoid attaching gameplay screenshots or game files to releases unless you have the necessary rights.

The wrapper uses MIT, as selected by the project owner; third-party licenses apply independently. Verify any material you add later. The game and Nokia trademarks are excluded from the wrapper license. User-provided files do not by themselves eliminate legal risk; see GitHub's [DMCA policy](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy).

## Static build

`dist/` is the complete generated browser player. It does not contain a JAR, and the interface provides no JAR download link. A static server needs only to serve this directory over HTTPS (or localhost for development); there is no upload endpoint. Users can remember their selected JAR in their own browser's IndexedDB; this does not add it to the static build or source export. Paths are relative so the player can work under a repository subpath. Nothing in the project deploys the app automatically.

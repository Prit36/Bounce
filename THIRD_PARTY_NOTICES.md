# Third-party notices

The wrapper code is licensed under MIT; see `LICENSE`. Third-party components retain their own notices and terms. The wrapper license does not cover Nokia's game, trademarks, code, artwork, levels, or sounds.

## JS2ME

- Project: https://github.com/szatkus/js2me
- Copyright (c) 2020 Tomasz Szatkowski and contributors.
- License: MIT, reproduced in `vendor/js2me/LICENSE`.
- The bundled runtime provides Java ME APIs. The wrapper's compatibility adjustments are in `src/platform.js`; no decompiled Nokia game implementation is included.

## ZIP reader and inflater

- Project: https://github.com/gildas-lormeau/zip.js (legacy implementation bundled with JS2ME).
- Copyright (c) 2013 Gildas Lormeau.
- License: BSD-style redistribution terms, retained in the headers of `vendor/js2me/js/zip/zip.js`, `zip-ext.js`, and `inflate.js`.
- The inflater credits JZlib 1.0.2 / JCraft and zlib authors Jean-loup Gailly and Mark Adler. The full upstream source headers are retained.

## Outfit

- Project: https://github.com/Outfitio/Outfit-Fonts
- Copyright: The Outfit Project Authors, as stated in `src/ui-fonts/OFL.txt`.
- License: SIL Open Font License 1.1, reproduced in `src/ui-fonts/OFL.txt` (also `ui-fonts/OFL.txt` in the static build).
- Used for the surrounding player interface.

## Nokia 3310 font reconstruction

- Project: https://github.com/pjanx/nokia-3310-fonts
- Copyright (c) 2013, Přemysl Eric Janouch <p@janouch.name>.
- License: the source headers explicitly permit use, copying, modification, and distribution for any purpose, with or without fee. The full notice and warranty disclaimer are reproduced in `vendor/nokia-font/LICENSE.txt` and retained in `nokia-fonts.c` and `nokia-fonts.h`.
- Converted by `scripts/fonts.mjs` for emulated handset text, preserving the earlier player's glyph data. The author reconstructed the glyphs by observing a handset; these files are not Nokia firmware or game assets.

## User-supplied game

Nokia Bounce belongs to its respective rights holders. No game JAR, extracted game images, levels, sounds, decompiled code, or gameplay screenshots are supplied. Users must provide a copy they are authorized to use. This independent project is not affiliated with, endorsed by, or sponsored by Nokia.

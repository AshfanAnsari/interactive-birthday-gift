# Interactive Birthday Gift

A tap-through interactive birthday website, rebuilt in React from a reference reel
(@code_wars_official). Three scenes loop: pull & release the heart, a tree that
grows and blooms with hearts, and a magenta greeting card with a typewriter wish.

**Live site:** https://ashfanansari.github.io/interactive-birthday-gift/

## Stack
React + Vite + TypeScript + Tailwind CSS. All artwork is hand-drawn SVG
(the glossy heart, the slingshot, the growing tree). The script font
(Great Vibes) is self-hosted in `src/assets` so the single-file build is
fully self-contained. The production build GitHub Pages serves lives in
`/docs` (regenerate with `npm run build:preview`, copy `dist-preview/` into `docs/`).

## Run locally
```
npm install
npm run dev
```

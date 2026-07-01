<p align="center">
  <img src="icon.svg" width="128" alt="Pixel Studio Logo"/>
</p>

<h1 align="center">Pixel Studio</h1>

<p align="center">
  <strong>A modern pixel art editor with an integrated palette generator</strong>
  <br>
  Progressive Web App &mdash; no installation required
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0-blue?style=flat-square" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/PWA-ready-4fc3f7?style=flat-square" alt="PWA"/>
  <img src="https://img.shields.io/badge/no-deps-important?style=flat-square" alt="No Dependencies"/>
  <img src="https://img.shields.io/badge/IndexedDB-yes-2ed573?style=flat-square" alt="IndexedDB"/>
</p>

---

## Features

- **10 Drawing Tools** &mdash; Pencil, Eraser, Eyedropper, Flood Fill, Line, Rectangle, Circle, Select, Spray, Replace Color
- **Brush Size** &mdash; 1x1 / 2x2 / 3x3 pixel brush support
- **Selection** &mdash; Select, move, cut, copy, paste, delete regions
- **Canvas Controls** &mdash; Mouse wheel zoom, Space+drag pan, grid toggle
- **Resize Canvas** &mdash; Stretch, crop, or pad modes
- **Export** &mdash; 1x/2x/4x/8x scale PNG export with optional transparent bg and grid
- **Undo/Redo** &mdash; 50-step history
- **Palette Generator** &mdash; 6 harmony modes (Complementary, Split Comp, Analogous, Triadic, Tetradic, Monochromatic)
- **Color Extraction** &mdash; Upload images to extract 8 dominant colors
- **Palette Management** &mdash; Save/load palettes via IndexedDB
- **UI Preview** &mdash; See your palette on UI elements (Dark/Light/High Contrast themes)
- **Drag & Drop** &mdash; Import images as reference layers
- **PWA** &mdash; Installable on desktop and mobile, works offline

## Quick Start

Open index.html in any modern browser.

`ash
git clone https://github.com/REDrighthand05/pixel-studio.git
# No build step needed
cd pixel-studio
# Open index.html in your browser
`

## Keyboard Shortcuts

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| P | Pencil | E | Eraser |
| I | Eyedropper | F | Fill |
| L | Line | R | Rectangle |
| C | Circle | M | Select |
| S | Spray | K | Replace Color |
| G | Toggle Grid | ? | Help |
| Ctrl+Z | Undo | Ctrl+Shift+Z | Redo |
| Ctrl+E | Export | Ctrl+A | Select All |
| Delete | Delete selection | Esc | Deselect / Close |
| Space+Drag | Pan canvas | Scroll | Zoom in/out |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | HTML5 Canvas |
| Styling | CSS Custom Properties (Dark theme) |
| Storage | IndexedDB (palette persistence) |
| Architecture | Single Page Application with tab navigation |
| Distribution | PWA (Service Worker + Manifest) |
| Color Engine | HSL-based palette generation |

## Roadmap

- [x] Basic pixel editor (Pencil, Eraser, Fill, Eyedropper)
- [x] Advanced tools (Line, Rectangle, Circle, Select, Spray, Replace)
- [x] Palette generator (6 harmony modes, CSS export)
- [x] PWA support (offline, installable)
- [x] Canvas resize, zoom, pan
- [x] Image drag & drop, palette persistence (IndexedDB)
- [x] Color extraction from images
- [ ] Multi-layer canvas
- [ ] Animation timeline
- [ ] Symmetry & dithering tools
- [ ] Export as GIF / sprite sheet
- [ ] Tauri desktop app

## License

MIT License

---

<p align="center"><em>Built with Codex, one pixel at a time.</em></p>

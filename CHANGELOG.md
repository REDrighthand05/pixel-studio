# Changelog

All notable changes to Pixel Studio will be documented here.

## [1.6.0] - 2026-07-02
### Changed
- CSS: inline reduced to ~300B (variables only), full 19KB in styles.css
### Added
- MIT License file
- 404.html for GitHub Pages
- .nojekyll for proper SPA routing
- SVG + PNG favicon links

## [1.5.0] - 2026-07-02
### Added
- Symmetry drawing: Vertical, Horizontal, Both, Radial modes
- Plugin system: PixelStudioPlugin API with tool/filter/export registration
- GitHub Pages deployment workflow
- Lighthouse CI performance audit
- Plugin loader + 2 example plugins (dither, palette)
- SEO tags (Open Graph, Twitter Card, structured data)
### Fixed
- Emoji corruption: garbled bytes in layer panel buttons replaced with Unicode escapes

## [1.1.0] - 2026-07-02
### Added
- PWA hardening: SVG icons, maskable icons, categories
- Service worker rewrite: stale-while-revalidate strategy
- Apple touch icon and iOS meta tags
- Proper favicon SVG support

## [1.0.0] - 2026-07-02
### Added
- .pxs project file format (Save/Load)
- Auto-recovery (30s localStorage)
- Keyboard shortcuts: Ctrl+N/O/S
- New/Open/Save toolbar buttons

## [0.7.0] - 2026-07-02
### Added
- Animation engine: frames, timeline, onion skinning
- GIF export via gif.js
- Sprite sheet export with JSON metadata
- Playback: forward and ping-pong loop modes

## [0.5.0] - 2026-07-02
### Added
- Layer system: add, delete, duplicate, merge, reorder
- 7 blend modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Difference
- Layer panel with thumbnails, visibility, lock, opacity
- Composite rendering engine
- Undo/redo upgraded for layer-awareness

## [0.3.1] - 2026-07-02
### Added
- TESTING.md: non-visual verification guide
- .gitignore for temp scripts and OS junk

## [0.3.0] - 2026-07-02
### Added
- 10 drawing tools: Pencil, Eraser, Eyedropper, Fill, Line, Rectangle, Circle, Select, Spray, Replace
- Brush size: 1x1, 2x2, 3x3
- Canvas: wheel zoom, space+pan, resize dialog
- Enhanced export: 1x/2x/4x/8x scale
- UI: help overlay, status bar, context menu, stacked toasts
- Palette generator: 6 harmony modes with IndexedDB persistence
- Image palette extraction
- Dark/Light/High Contrast theme preview
- Drag and drop image import

# Pixel Studio — Non-Visual Verification Guide

> **Why this exists:** Pixel Studio's canvas rendering cannot be visually inspected through standard DOM text-based browser tools. This document describes how to verify every feature works correctly using only console commands, data inspection, and structured assertions — no eyeballs required.

---

## Quick Start

Open index.html, then open the browser DevTools Console (F12 > Console).

`js
// Check everything is loaded
__debug.isReady();  // -> true
`

---

## The window.__debug API

All verification is done through window.__debug, a global object exposed at the end of pp.js.

### Data Access

| Method | Returns | Description |
|--------|---------|-------------|
| __debug.getData() | string[][] | Full pixel data array. peData[y][x] returns color hex string or "#ffffff00" (transparent). |
| __debug.getPixel(x, y) | string | Single pixel color at (x, y). Returns undefined if out of bounds. |
| __debug.getCanvasSize() | {w, h, zoom} | Canvas dimensions (grid cells) and current zoom level (pixels per cell). |
| __debug.getHistory() | {history, idx} | Undo history length and current position index. |
| __debug.getSelection() | {x, y, w, h} or 
ull | Current selection rectangle, or 
ull if none. |
| __debug.getTool() | string | Active tool name: "pencil", "eraser", "eyedropper", "fill", "line", "rect", "circle", "select", "spray", "replace". |
| __debug.getBrushSize() | 
umber | Current brush size: 1, 2, or 3. |
| __debug.getSpray() | {density, radius} | Spray tool parameters. |

> **All array data is a direct reference to the internal state.** Mutations via __debug.setPixel() are not provided to prevent corruption — use the UI tools to paint, then inspect.

---

## Verification Checklists

### 1. Canvas Rendering

`js
// Verify canvas exists and has correct dimensions
__debug.getCanvasSize();
// -> { w: 16, h: 16, zoom: 24 }

// Verify all pixels start transparent
__debug.getData().every(row => row.every(cell => cell === '#ffffff00'));
// -> true

// After painting a pixel, verify it stored correctly
// (Paint with pencil at 0,0, then run:)
__debug.getPixel(0, 0);
// -> '#ff0040' (or whatever color you used)
`

### 2. Tool System

`js
// Verify tool switching affects internal state
// Click Pencil button, then:
__debug.getTool() === 'pencil';
// -> true

// Press 'E' key, then:
__debug.getTool() === 'eraser';
// -> true

// Verify spray controls visibility
// When spray is active, document.getElementById('sprayDensityRow')
// should have class 'show'
`

### 3. Selection Tool (M)

`js
// After dragging a selection:
__debug.getSelection();
// -> { x: 2, y: 3, w: 5, h: 4 }

// After pressing Escape:
__debug.getSelection();
// -> null

// After Ctrl+A:
__debug.getSelection();
// -> { x: 0, y: 0, w: 16, h: 16 }
`

### 4. Undo / Redo

`js
// Before any action
__debug.getHistory();
// -> { history: 1, idx: 0 }   // initial save state

// Paint some pixels, then:
__debug.getHistory();
// -> { history: 2, idx: 1 }   // one undo step available

// Undo (Ctrl+Z):
__debug.getHistory();
// -> { history: 2, idx: 0 }   // back to initial state

// Redo (Ctrl+Shift+Z):
__debug.getHistory();
// -> { history: 2, idx: 1 }   // forward again
`

### 5. Brush Size

`js
// Click 2x2 brush button:
__debug.getBrushSize();
// -> 2

// Paint at (5, 5) and check that cells are filled in a 2x2 block:
__debug.getPixel(5, 5);   // -> painted
__debug.getPixel(5, 6);   // -> painted
__debug.getPixel(6, 5);   // -> painted
__debug.getPixel(6, 6);   // -> painted
`

### 6. Color Replacement (K)

`js
// Prerequisite: paint several pixels with a specific color like '#ff0040'
// Then select a new color (e.g., '#40c057'), switch to Replace tool,
// and click on a '#ff0040' pixel:

// Verify all '#ff0040' pixels are now '#40c057':
__debug.getData().every((row, y) =>
  row.every((cell, x) => cell !== '#ff0040')
);
// -> true (unless there were pixels of that color outside the replaced ones)
`

### 7. Circle Tool (C)

`js
// Click at center (5, 5), drag to radius ~4, release:

// Verify pixels at expected circle perimeter have color:
__debug.getPixel(1, 5);  // left edge - should be painted
__debug.getPixel(9, 5);  // right edge - should be painted
__debug.getPixel(5, 1);  // top edge - should be painted
__debug.getPixel(5, 9);  // bottom edge - should be painted

// Verify pixels outside radius are NOT painted:
__debug.getPixel(0, 5);  // outside - should be '#ffffff00'
`

### 8. Spray Tool (S)

`js
// Set density=10, radius=5, spray at (8, 8):
const before = __debug.getData().flat().filter(c => c !== '#ffffff00').length;
// Spray 10 times at the same point, then:
const after = __debug.getData().flat().filter(c => c !== '#ffffff00').length;
console.log(Pixels added: ); // should be roughly 50-150

// Verify no pixels painted beyond spray radius:
// All cells with |x-8| > 5 or |y-8| > 5 should be transparent
`

### 9. Canvas Resize

`js
// Open resize dialog, set to 8x8, mode "crop"
// (simulate by running the apply logic):
// After resize, verify:
__debug.getCanvasSize();
// -> { w: 8, h: 8, zoom: 24 }

// Verify old content is centered-cropped:
__debug.getPixel(0, 0);  // was center of original canvas
`

### 10. Export

`js
// Export generates a download link with a data URL.
// Verify the data URL starts with 'data:image/png':
// (check the console for "Exported NxM PNG" toast message)
`

### 11. Zoom

`js
// After mouse wheel or slider change:
const size = __debug.getCanvasSize();
// size.zoom should be within [4, 64]

// Verify canvas element dimensions match:
const canvas = document.getElementById('pixelCanvas');
console.assert(canvas.width === size.w * size.zoom);
console.assert(canvas.height === size.h * size.zoom);
`

### 12. Palette Generator

`js
// After entering a hex color:
// Verify pvColors array is populated (check in console):
typeof pvColors;
// -> 'object'
pvColors.length;
// -> 8 or more (base + generated colors)

// Verify CSS variables block is rendered:
document.getElementById('pvCss').textContent.includes(':root');
// -> true
`

### 13. IndexedDB Persistence

`js
// After saving a palette:
// Check IndexedDB in DevTools > Application > IndexedDB > PixelStudioDB > palettes

// Programmatic check:
const checkDB = async () => {
  const db = await new Promise(r => {
    const req = indexedDB.open('PixelStudioDB', 1);
    req.onsuccess = e => r(e.target.result);
  });
  const tx = db.transaction('palettes', 'readonly');
  const all = await new Promise(r => {
    const req = tx.objectStore('palettes').getAll();
    req.onsuccess = () => r(req.result);
  });
  db.close();
  console.log(Saved palettes: );
  return all;
};
checkDB();
`

### 14. Drag & Drop Image Import

`js
// After dropping an image onto the canvas area:
// Verify some pixels changed from transparent to colors:
const hasColor = __debug.getData().some(row =>
  row.some(cell => cell !== '#ffffff00')
);
console.log(Image data loaded: );
`

---

## Automated Assertion Template

Copy this into the browser console for a quick health check:

`js
(function runChecks() {
  const fail = (msg) => console.error('FAIL: ' + msg);
  const pass = (msg) => console.log('PASS: ' + msg);
  let ok = 0, err = 0;

  // Canvas initialized
  const cs = __debug.getCanvasSize();
  if (cs.w === 16 && cs.h === 16 && cs.zoom === 24) { ok++; pass('Canvas init'); }
  else { err++; fail('Canvas init: ' + JSON.stringify(cs)); }

  // Tool defaults to pencil
  if (__debug.getTool() === 'pencil') { ok++; pass('Default tool'); }
  else { err++; fail('Default tool: ' + __debug.getTool()); }

  // Selection starts null
  if (__debug.getSelection() === null) { ok++; pass('No selection'); }
  else { err++; fail('Selection not null'); }

  // Brush size starts at 1
  if (__debug.getBrushSize() === 1) { ok++; pass('Brush size 1'); }
  else { err++; fail('Brush size: ' + __debug.getBrushSize()); }

  // History has 1 entry (initial save)
  const h = __debug.getHistory();
  if (h.history >= 1) { ok++; pass('History available (' + h.history + ' steps)'); }
  else { err++; fail('No history'); }

  // All pixels transparent initially
  const allTransparent = __debug.getData().every(r => r.every(c => c === '#ffffff00'));
  if (allTransparent) { ok++; pass('All pixels transparent'); }
  else { err++; fail('Pixels not all transparent'); }

  // Palette generator DOM exists
  if (document.getElementById('pvCss')) { ok++; pass('Palette gen DOM'); }
  else { err++; fail('Palette gen DOM missing'); }

  // Export dialog DOM exists
  if (document.getElementById('exportDialog')) { ok++; pass('Export dialog DOM'); }
  else { err++; fail('Export dialog DOM missing'); }

  // Help overlay DOM exists
  if (document.getElementById('helpOverlay')) { ok++; pass('Help overlay DOM'); }
  else { err++; fail('Help overlay DOM missing'); }

  // Status bar DOM exists
  if (document.getElementById('sbTool')) { ok++; pass('Status bar DOM'); }
  else { err++; fail('Status bar DOM missing'); }

  // PWA manifest loaded
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) { ok++; pass('PWA manifest'); }
  else { err++; fail('PWA manifest missing'); }

  console.log(\nResults:  passed,  failed);
  return { passed: ok, failed: err };
})();
`

---

## Console Logging Architecture

The codebase is instrumented with console.log at critical lifecycle points:

| Location | Log Output |
|----------|-----------|
| End of pp.js | "Pixel Studio v0.3.0 loaded. Use window.__debug for verification." |
| Export action | Show toast "Exported NxM PNG" (visible in DOM) |
| Color replace | Show toast "Replaced #XXXXXX" |
| Canvas resize | Show toast "Canvas resized to NxN" |
| Palette save/load | Toast feedback for every operation |
| Image extract | Toast "Extracted N colors" |

---

## Testing New Features

When implementing a new feature, follow this pattern:

1. **Add the feature** in pp.js
2. **Expose state** through __debug if it represents user-visible state
3. **Add a toast** for action confirmation
4. **Verify** using the checklists above
5. **Run the health check** assertion template

This ensures the feature is verifiable without visual inspection of the canvas.

---

_Last updated: 2026-07-02 | Pixel Studio v0.3.0_

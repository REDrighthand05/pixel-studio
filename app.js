// === Shared App State ===
const AppState = {
  currentColor: '#4fc3f7', sharedPalette: null, activeView: 'pixel'
};

// === Toast Stack ===
function showToast(msg, duration) {
  duration = duration || 1500;
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
}

// === Tab Navigation ===
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const id = 'view' + btn.dataset.view.charAt(0).toUpperCase() + btn.dataset.view.slice(1);
    const view = document.getElementById(id);
    if (view) view.classList.add('active');
    AppState.activeView = btn.dataset.view;
    if (AppState.activeView === 'pixel') peUpdateStatusBar();
  });
});

// === PIXEL EDITOR ===
const PE_COLORS = [
  '#000000','#1a1a2e','#333','#555','#8899aa','#aaa','#ddd','#fff',
  '#ff0040','#ff4d4d','#ff6b6b','#ff9f43','#ffd43b','#fcc419','#f59f00','#ffec99',
  '#40c057','#2b8a3e','#0ca678','#20c997','#22b8cf','#339af0','#4fc3f7','#748ffc',
  '#7950f2','#ae3ec9','#d6336c','#c2255c','#e64980','#f06595','#e599f7','#b197fc'
];
const PE_MAX_HISTORY = 50, PE_MAX_HIST_COLORS = 10;
let peGridSize = 16, pePixelSize = 24, peShowGrid = true;
let peTool = 'pencil', peColor = AppState.currentColor, peDrawing = false;
let peHistory = [], peHistoryIdx = -1, peColorHistory = [];
let peBrushSize = 1;
let peStartX = 0, peStartY = 0, pePrevData = null;
let peSelection = null;
let peSelecting = false, peSelStartX = 0, peSelStartY = 0;
let peClipboard = null;
let pePanning = false, pePanStartX = 0, pePanStartY = 0, pePanCX = 0, pePanCY = 0;
let peSprayDensity = 8, peSprayRadius = 4;
const peCanvas = document.getElementById('pixelCanvas');
const peCtx = peCanvas.getContext('2d');
const peCanvasArea = document.getElementById('peCanvasArea');
const peSelOverlay = document.getElementById('selectionOverlay');
let peData = [];

function peInit() {
  peCanvas.width = peGridSize * pePixelSize;
  peCanvas.height = peGridSize * pePixelSize;
  peData = Array(peGridSize).fill().map(() => Array(peGridSize).fill('#ffffff00'));
  peSelection = null; peHideSelection();
  peSaveState(); peRender(); peUpdateStatusBar();
}

function peRender() {
  if (!peCtx) return;
  peCtx.clearRect(0, 0, peCanvas.width, peCanvas.height);
  const cs = pePixelSize / 2;
  for (let y = 0; y < peGridSize; y++)
    for (let x = 0; x < peGridSize; x++) {
      const px = x * pePixelSize, py = y * pePixelSize, p = peData[y][x];
      if (!p || p === '#ffffff00' || p === '') {
        for (let cy = 0; cy < 2; cy++)
          for (let cx = 0; cx < 2; cx++) {
            peCtx.fillStyle = ((x*2+cx)+(y*2+cy))%2===0?'#ccc':'#888';
            peCtx.fillRect(px+cx*cs, py+cy*cs, cs, cs);
          }
      } else { peCtx.fillStyle = p; peCtx.fillRect(px, py, pePixelSize, pePixelSize); }
    }
  if (peShowGrid && pePixelSize >= 6) {
    peCtx.strokeStyle = 'rgba(0,0,0,0.2)'; peCtx.lineWidth = 1;
    for (let i = 0; i <= peGridSize; i++) {
      const pos = i * pePixelSize - 0.5;
      peCtx.beginPath(); peCtx.moveTo(pos, 0); peCtx.lineTo(pos, peCanvas.height); peCtx.stroke();
      peCtx.beginPath(); peCtx.moveTo(0, pos); peCtx.lineTo(peCanvas.width, pos); peCtx.stroke();
    }
  }
  peUpdateSelectionOverlay();
}

function peSaveState() {
  const s = peData.map(r=>[...r]);
  peHistory = peHistory.slice(0, peHistoryIdx + 1);
  peHistory.push(s); if (peHistory.length > PE_MAX_HISTORY) peHistory.shift();
  peHistoryIdx = peHistory.length - 1; peUpdateBtn();
}

function peSaveCurrent() { pePrevData = peData.map(r=>[...r]); }
function peRestorePreview() { if (pePrevData) peData = pePrevData.map(r=>[...r]); }

function peGetPixel(ex, ey) {
  const r = peCanvas.getBoundingClientRect();
  const x = Math.floor((ex - r.left) / r.width * peGridSize);
  const y = Math.floor((ey - r.top) / r.height * peGridSize);
  if (x < 0 || x >= peGridSize || y < 0 || y >= peGridSize) return null;
  return {x, y};
}

function peSet(x, y, c) { if (x>=0&&x<peGridSize&&y>=0&&y<peGridSize) peData[y][x]=c; }

function peSetBrush(x, y, c) {
  const bs = peBrushSize;
  const half = Math.floor(bs / 2);
  for (let dy = 0; dy < bs; dy++)
    for (let dx = 0; dx < bs; dx++)
      peSet(x + dx - half, y + dy - half, c);
}
function peDrawLine(x0, y0, x1, y1, c) {
  let dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    peSetBrush(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function peDrawCircle(cx, cy, r, c, fill) {
  if (fill) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x*x + y*y <= r*r) peSetBrush(cx + x, cy + y, c);
    return;
  }
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    peSetBrush(cx + x, cy + y, c); peSetBrush(cx - x, cy + y, c);
    peSetBrush(cx + x, cy - y, c); peSetBrush(cx - x, cy - y, c);
    peSetBrush(cx + y, cy + x, c); peSetBrush(cx - y, cy + x, c);
    peSetBrush(cx + y, cy - x, c); peSetBrush(cx - y, cy - x, c);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

function peDrawRect(x0, y0, x1, y1, c) {
  let minX = Math.min(x0,x1), maxX = Math.max(x0,x1);
  let minY = Math.min(y0,y1), maxY = Math.max(y0,y1);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      peSet(x, y, c);
}

function peFloodFill(sx, sy, fc) {
  const tc = peData[sy][sx]; if (tc === fc) return;
  const vis = new Set(), stack = [[sx, sy]];
  while (stack.length) {
    const [cx, cy] = stack.pop(), k = cx+','+cy;
    if (vis.has(k)) continue; vis.add(k);
    if (cx<0||cx>=peGridSize||cy<0||cy>=peGridSize||peData[cy][cx]!==tc) continue;
    peData[cy][cx] = fc;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
}

function peReplaceColor(targetColor, newColor) {
  if (targetColor === newColor) return false;
  let count = 0;
  for (let y = 0; y < peGridSize; y++)
    for (let x = 0; x < peGridSize; x++)
      if (peData[y][x] === targetColor) { peData[y][x] = newColor; count++; }
  return count > 0;
}
function peShowSelection(x, y, w, h) {
  peSelOverlay.style.display = 'block';
  peSelOverlay.style.left = (x * pePixelSize) + 'px';
  peSelOverlay.style.top = (y * pePixelSize) + 'px';
  peSelOverlay.style.width = (w * pePixelSize) + 'px';
  peSelOverlay.style.height = (h * pePixelSize) + 'px';
  peSelection = {x, y, w, h};
}
function peHideSelection() { peSelOverlay.style.display = 'none'; peSelection = null; }
function peUpdateSelectionOverlay() { if (peSelection) peShowSelection(peSelection.x, peSelection.y, peSelection.w, peSelection.h); }
function peNormalizeSel(x0, y0, x1, y1) {
  return {x: Math.min(x0,x1), y: Math.min(y0,y1), w: Math.abs(x1-x0)+1, h: Math.abs(y1-y0)+1};
}
function peCopySelection() {
  if (!peSelection) return;
  const {x,y,w,h} = peSelection; peClipboard = [];
  for (let sy = y; sy < y+h && sy < peGridSize; sy++) { const row=[]; for (let sx=x; sx<x+w && sx<peGridSize; sx++) row.push(peData[sy][sx]); peClipboard.push(row); }
}
function peCutSelection() {
  if (!peSelection) return; peCopySelection();
  const {x,y,w,h} = peSelection;
  for (let sy=y; sy<y+h && sy<peGridSize; sy++) for (let sx=x; sx<x+w && sx<peGridSize; sx++) peData[sy][sx]='#ffffff00';
  peRender(); peSaveState();
}
function pePasteSelection() {
  if (!peClipboard) return;
  let px=0, py=0; if (peSelection) { px=peSelection.x; py=peSelection.y; }
  for (let sy=0; sy<peClipboard.length && py+sy<peGridSize; sy++)
    for (let sx=0; sx<peClipboard[sy].length && px+sx<peGridSize; sx++)
      if (peClipboard[sy][sx]) peData[py+sy][px+sx]=peClipboard[sy][sx];
  peRender(); peSaveState();
}
function peDeleteSelection() {
  if (!peSelection) return;
  const {x,y,w,h} = peSelection;
  for (let sy=y; sy<y+h && sy<peGridSize; sy++) for (let sx=x; sx<x+w && sx<peGridSize; sx++) peData[sy][sx]='#ffffff00';
  peRender(); peSaveState();
}
function peSelectAll() { peShowSelection(0,0,peGridSize,peGridSize); }
function peSpray(cx, cy, color, density, radius) {
  for (let i=0; i<density; i++) {
    const angle = Math.random()*2*Math.PI;
    const dist = Math.random()*radius;
    const x = Math.round(cx+Math.cos(angle)*dist), y = Math.round(cy+Math.sin(angle)*dist);
    peSet(x, y, color);
  }
}
function peUndo() {
  if (peHistoryIdx <= 0) return;
  peHistoryIdx--; peData = peHistory[peHistoryIdx].map(r=>[...r]); peRender(); peUpdateBtn();
}
function peRedo() {
  if (peHistoryIdx >= peHistory.length - 1) return;
  peHistoryIdx++; peData = peHistory[peHistoryIdx].map(r=>[...r]); peRender(); peUpdateBtn();
}
function peUpdateBtn() {
  const u = document.getElementById('peUndo'), r = document.getElementById('peRedo');
  if (u) u.style.opacity = peHistoryIdx <= 0 ? '0.3' : '1';
  if (r) r.style.opacity = peHistoryIdx >= peHistory.length - 1 ? '0.3' : '1';
}
function peBuildPalette() {
  const container = document.getElementById('pePalette'); if (!container) return;
  container.innerHTML = '';
  const colors = AppState.sharedPalette || PE_COLORS;
  colors.forEach(c => {
    const d = document.createElement('div');
    d.className = 'pe-swatch' + (c === peColor ? ' active' : '');
    d.style.background = c; d.dataset.color = c;
    d.addEventListener('click', () => peSelectColor(c));
    container.appendChild(d);
  });
}
function peBuildHistory() {
  const container = document.getElementById('peColorHistory'); if (!container) return;
  container.innerHTML = '';
  peColorHistory.forEach(c => {
    const d = document.createElement('div');
    d.className = 'pe-swatch'; d.style.background = c; d.dataset.color = c;
    d.addEventListener('click', () => peSelectColor(c));
    container.appendChild(d);
  });
}
function peAddHistory(c) {
  peColorHistory = peColorHistory.filter(x => x !== c);
  peColorHistory.unshift(c);
  if (peColorHistory.length > PE_MAX_HIST_COLORS) peColorHistory.pop();
}
function peSelectColor(c) {
  peColor = c; AppState.currentColor = c;
  const cur = document.getElementById('peCurColor');
  if (cur) cur.style.background = c;
  const picker = document.getElementById('peColorPicker');
  if (picker) picker.value = c;
  document.querySelectorAll('#pePalette .pe-swatch').forEach(el => el.classList.toggle('active', el.dataset.color === c));
  peAddHistory(c); peBuildHistory();
}
function peUpdateStatusBar() {
  const sbTool = document.getElementById('sbTool');
  const sbPos = document.getElementById('sbPos');
  const sbZoom = document.getElementById('sbZoom');
  const sbSize = document.getElementById('sbSize');
  const toolNames = {pencil:'Pencil',eraser:'Eraser',eyedropper:'EyeDrop',fill:'Fill',line:'Line',rect:'Rect',circle:'Circle',select:'Select',spray:'Spray',replace:'Replace'};
  if (sbTool) sbTool.textContent = toolNames[peTool] || peTool;
  if (sbSize) sbSize.textContent = peGridSize + 'x' + peGridSize;
  if (sbZoom) sbZoom.textContent = Math.round(pePixelSize / peGridSize * 100 * peGridSize) + '%';
}
function peSetZoom(newZoom) {
  pePixelSize = Math.max(4, Math.min(64, newZoom));
  const zoomSlider = document.getElementById('peZoom');
  if (zoomSlider) zoomSlider.value = pePixelSize;
  const zoomVal = document.getElementById('peZoomVal');
  if (zoomVal) zoomVal.textContent = pePixelSize + 'x';
  peCanvas.width = peGridSize * pePixelSize;
  peCanvas.height = peGridSize * pePixelSize;
  peRender(); peUpdateStatusBar();
}
peCanvas.addEventListener('mousedown', e => {
  if (peTool === 'select') {
    const pos = peGetPixel(e.clientX, e.clientY); if (!pos) return;
    if (peSelection && pos.x >= peSelection.x && pos.x < peSelection.x + peSelection.w &&
        pos.y >= peSelection.y && pos.y < peSelection.y + peSelection.h) {
      peDrawing = true; peSaveCurrent();
      peSelStartX = pos.x - peSelection.x; peSelStartY = pos.y - peSelection.y;
      return;
    }
    peSelecting = true; peSelStartX = pos.x; peSelStartY = pos.y;
    return;
  }
  const pos = peGetPixel(e.clientX, e.clientY); if (!pos) return;
  peDrawing = true;
  if (peTool === 'fill') { peFloodFill(pos.x,pos.y,peColor); peSaveState(); peRender(); return; }
  if (peTool === 'eyedropper') { const c=peData[pos.y][pos.x]; if(c&&c!=='#ffffff00') peSelectColor(c); peDrawing=false; return; }
  if (peTool === 'replace') {
    const c=peData[pos.y][pos.x];
    if(c&&c!=='#ffffff00'&&c!==peColor){peReplaceColor(c,peColor);peSaveState();peRender();showToast('Replaced '+c);}
    peDrawing=false; return;
  }
  if (peTool === 'spray') { peSpray(pos.x,pos.y,peColor,peSprayDensity,peSprayRadius); peRender(); return; }
  if (peTool === 'line'||peTool==='rect'||peTool==='circle'){peStartX=pos.x;peStartY=pos.y;peSaveCurrent();return;}
  peSetBrush(pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor); peRender();
});

peCanvas.addEventListener('mousemove', e => {
  const pos = peGetPixel(e.clientX, e.clientY);
  const cursorEl = document.getElementById('peCursor');
  const sbPos = document.getElementById('sbPos');
  if (pos) {
    if (cursorEl) cursorEl.textContent = '('+pos.x+', '+pos.y+')';
    if (sbPos) sbPos.textContent = pos.x+', '+pos.y;
  }
  if (pePanning) {
    const dx=e.clientX-pePanStartX, dy=e.clientY-pePanStartY;
    peCanvasArea.scrollLeft=pePanCX-dx; peCanvasArea.scrollTop=pePanCY-dy;
    return;
  }
  if (!peDrawing||!pos) return;
  if (peTool==='fill'||peTool==='eyedropper'||peTool==='replace') return;
  if (peTool==='spray'){peSpray(pos.x,pos.y,peColor,peSprayDensity,peSprayRadius);peRender();return;}
  if (peTool==='select'&&peSelecting&&pos){const sel=peNormalizeSel(peSelStartX,peSelStartY,pos.x,pos.y);peShowSelection(sel.x,sel.y,sel.w,sel.h);return;}
  if (peTool==='line'){peRestorePreview();peDrawLine(peStartX,peStartY,pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor);peRender();return;}
  if (peTool==='rect'){peRestorePreview();peDrawRect(peStartX,peStartY,pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor);peRender();return;}
  if (peTool==='circle'){
    peRestorePreview();
    const dx=pos.x-peStartX,dy=pos.y-peStartY;
    const radius=e.shiftKey?Math.max(Math.abs(dx),Math.abs(dy)):Math.round(Math.sqrt(dx*dx+dy*dy));
    peDrawCircle(peStartX,peStartY,radius,peColor,false);peRender();return;
  }
  peSetBrush(pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor);peRender();
});
document.addEventListener('mouseup', () => {
  if (pePanning) { pePanning = false; document.body.style.cursor = ''; return; }
  if (peDrawing && peTool === 'select') { peDrawing = false; if(pePrevData){peSaveState();pePrevData=null;} return; }
  if (peSelecting && peTool === 'select') { peSelecting = false; if(peSelection&&(peSelection.w<1||peSelection.h<1))peHideSelection(); return; }
  if (peDrawing && (peTool==='line'||peTool==='rect'||peTool==='circle')){peDrawing=false;peSaveState();pePrevData=null;return;}
  if (peDrawing && peTool==='spray'){peDrawing=false;peSaveState();return;}
  if(peDrawing){peDrawing=false;if(peTool!=='fill'&&peTool!=='eyedropper'&&peTool!=='replace')peSaveState();}
});
peCanvas.addEventListener('mouseleave', () => {
  const cursorEl=document.getElementById('peCursor'); if(cursorEl) cursorEl.textContent='Click to paint - Drag to draw';
  if(peDrawing&&(peTool==='line'||peTool==='rect'||peTool==='circle')){peDrawing=false;peRestorePreview();peRender();pePrevData=null;}
  if(peSelecting)peSelecting=false;
});

document.querySelectorAll('[data-pe-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-pe-tool]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); peTool=btn.dataset.peTool;
    peCanvas.style.cursor = {fill:'cell',line:'crosshair',rect:'crosshair',circle:'crosshair',select:'crosshair',spray:'crosshair',replace:'crosshair',eraser:'crosshair',eyedropper:'crosshair'}[peTool]||'crosshair';
    const sr1=document.getElementById('sprayDensityRow'),sr2=document.getElementById('sprayRadiusRow');
    if(peTool==='spray'){if(sr1)sr1.classList.add('show');if(sr2)sr2.classList.add('show');}else{if(sr1)sr1.classList.remove('show');if(sr2)sr2.classList.remove('show');}
    peUpdateStatusBar();
  });
});
document.querySelectorAll('[data-bs]').forEach(btn => {
  btn.addEventListener('click',()=>{document.querySelectorAll('[data-bs]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');peBrushSize=parseInt(btn.dataset.bs);});
});
document.getElementById('peUndo')?.addEventListener('click',peUndo);
document.getElementById('peRedo')?.addEventListener('click',peRedo);
document.getElementById('peClear')?.addEventListener('click',()=>{if(!confirm('Clear the canvas?'))return;peData=Array(peGridSize).fill().map(()=>Array(peGridSize).fill('#ffffff00'));peSaveState();peRender();});
document.getElementById('peResizeBtn')?.addEventListener('click',()=>{document.getElementById('resizeWidth').value=peGridSize;document.getElementById('resizeHeight').value=peGridSize;document.getElementById('resizeCurrent').textContent=peGridSize+'x'+peGridSize;document.getElementById('resizeDialog').classList.add('show');});
document.getElementById('resizeApply')?.addEventListener('click',()=>{
  const nw=parseInt(document.getElementById('resizeWidth').value),nh=parseInt(document.getElementById('resizeHeight').value),mode=document.getElementById('resizeMode').value;
  if(isNaN(nw)||isNaN(nh)||nw<1||nh<1||nw>256||nh>256)return;
  const oldSize=peGridSize,oldData=peData; peGridSize=nw; peData=Array(peGridSize).fill().map(()=>Array(peGridSize).fill('#ffffff00'));
  if(mode==='stretch'){for(let y=0;y<peGridSize;y++)for(let x=0;x<peGridSize;x++){const sx=Math.floor(x/peGridSize*oldSize),sy=Math.floor(y/peGridSize*oldSize);if(sx<oldSize&&sy<oldSize)peData[y][x]=oldData[sy][sx];}}
  else if(mode==='crop'){const ox=Math.max(0,Math.floor((oldSize-peGridSize)/2)),oy=Math.max(0,Math.floor((oldSize-peGridSize)/2));for(let y=0;y<Math.min(peGridSize,oldSize-oy);y++)for(let x=0;x<Math.min(peGridSize,oldSize-ox);x++)if(oy+y<oldSize&&ox+x<oldSize)peData[y][x]=oldData[oy+y][ox+x];}
  else{const ox=Math.max(0,Math.floor((peGridSize-oldSize)/2)),oy=Math.max(0,Math.floor((peGridSize-oldSize)/2));for(let y=0;y<oldSize&&oy+y<peGridSize;y++)for(let x=0;x<oldSize&&ox+x<peGridSize;x++)peData[oy+y][ox+x]=oldData[y][x];}
  peHideSelection();document.getElementById('resizeDialog').classList.remove('show');
  const gsSlider=document.getElementById('peGridSize');if(gsSlider)gsSlider.value=peGridSize;
  document.getElementById('peGridSizeVal').textContent=peGridSize;
  peCanvas.width=peGridSize*pePixelSize;peCanvas.height=peGridSize*pePixelSize;
  peSaveState();peRender();peUpdateStatusBar();showToast('Canvas resized to '+peGridSize+'x'+peGridSize);
});
document.getElementById('peExport')?.addEventListener('click',()=>{document.getElementById('exportScale').value='4';document.getElementById('exportPreview').textContent='Output: '+(peGridSize*4)+'x'+(peGridSize*4)+' px';document.getElementById('exportDialog').classList.add('show');});
document.getElementById('exportScale')?.addEventListener('change',function(){const s=parseInt(this.value);document.getElementById('exportPreview').textContent='Output: '+(peGridSize*s)+'x'+(peGridSize*s)+' px';});
document.getElementById('exportApply')?.addEventListener('click',()=>{
  const scale=parseInt(document.getElementById('exportScale').value);
  const transparent=document.getElementById('exportTransparent').checked;
  const showGrid=document.getElementById('exportShowGrid').checked;
  const ec=document.createElement('canvas');ec.width=peGridSize*scale;ec.height=peGridSize*scale;
  const ex=ec.getContext('2d');
  if(!transparent){ex.fillStyle='#fff';ex.fillRect(0,0,ec.width,ec.height);}
  for(let y=0;y<peGridSize;y++)for(let x=0;x<peGridSize;x++){const c=peData[y][x];if(c&&c!=='#ffffff00'){ex.fillStyle=c;ex.fillRect(x*scale,y*scale,scale,scale);}}
  if(showGrid&&scale>=4){ex.strokeStyle='rgba(0,0,0,0.15)';ex.lineWidth=1;for(let i=0;i<=peGridSize;i++){ex.beginPath();ex.moveTo(i*scale,0);ex.lineTo(i*scale,ec.height);ex.stroke();ex.beginPath();ex.moveTo(0,i*scale);ex.lineTo(ec.width,i*scale);ex.stroke();}}
  document.getElementById('exportDialog').classList.remove('show');
  const lnk=document.createElement('a');lnk.download='pixel-art.png';lnk.href=ec.toDataURL();lnk.click();
  showToast('Exported '+ec.width+'x'+ec.height+' PNG');
});
let peGridVisible=true;
document.getElementById('peGrid')?.addEventListener('click',()=>{peGridVisible=!peGridVisible;peShowGrid=peGridVisible;document.getElementById('peGrid').classList.toggle('active');peRender();});
document.getElementById('peColorPicker')?.addEventListener('input',e=>peSelectColor(e.target.value));
document.getElementById('peGridSize')?.addEventListener('input',e=>{peGridSize=parseInt(e.target.value);document.getElementById('peGridSizeVal').textContent=peGridSize;peInit();});
document.getElementById('peZoom')?.addEventListener('input',e=>{peSetZoom(parseInt(e.target.value));});
document.getElementById('sprayDensity')?.addEventListener('input',e=>{peSprayDensity=parseInt(e.target.value);document.getElementById('sprayDensityVal').textContent=peSprayDensity;});
document.getElementById('sprayRadius')?.addEventListener('input',e=>{peSprayRadius=parseInt(e.target.value);document.getElementById('sprayRadiusVal').textContent=peSprayRadius;});
peCanvasArea.addEventListener('wheel',e=>{e.preventDefault();peSetZoom(pePixelSize+(e.deltaY>0?-1:1)*2);},{passive:false});
document.addEventListener('keydown',e=>{if(e.key===' '&&!e.repeat){pePanning=true;pePanStartX=0;pePanStartY=0;pePanCX=peCanvasArea.scrollLeft;pePanCY=peCanvasArea.scrollTop;document.body.style.cursor='grab';e.preventDefault();}});
document.addEventListener('keyup',e=>{if(e.key===' '){pePanning=false;document.body.style.cursor='';}});
peCanvasArea.addEventListener('mousedown',e=>{if(e.button===0&&pePanning){pePanStartX=e.clientX;pePanStartY=e.clientY;pePanCX=peCanvasArea.scrollLeft;pePanCY=peCanvasArea.scrollTop;document.body.style.cursor='grabbing';e.preventDefault();}});

peCanvas.addEventListener('contextmenu',e=>{e.preventDefault();const m=document.getElementById('contextMenu');m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';m.classList.add('show');});
document.addEventListener('click',e=>{if(!e.target.closest('.context-menu'))document.getElementById('contextMenu').classList.remove('show');});
document.querySelectorAll('[data-cm]').forEach(item=>{
  item.addEventListener('click',()=>{
    const action=item.dataset.cm;document.getElementById('contextMenu').classList.remove('show');
    if(action==='cut')peCutSelection();
    else if(action==='copy')peCopySelection();
    else if(action==='paste')pePasteSelection();
    else if(action==='clear')peDeleteSelection();
    else if(action==='deselect')peHideSelection();
    else if(action==='fill-selection'){if(peSelection){const{x,y,w,h}=peSelection;for(let sy=y;sy<y+h&&sy<peGridSize;sy++)for(let sx=x;sx<x+w&&sx<peGridSize;sx++)peData[sy][sx]=peColor;peRender();peSaveState();}}
  });
});
document.getElementById('peHelpBtn')?.addEventListener('click',()=>{document.getElementById('helpOverlay').classList.add('show');});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();peUndo();}
  if(e.ctrlKey&&(e.key==='Z'||(e.key==='z'&&e.shiftKey))){e.preventDefault();peRedo();}
  if(e.ctrlKey&&e.key==='e'){e.preventDefault();document.getElementById('peExport')?.click();}
  if(e.ctrlKey&&e.key==='a'){e.preventDefault();peSelectAll();}
  if(e.key==='Delete'||e.key==='Del'){peDeleteSelection();}
  if(e.key==='Escape'){peHideSelection();document.getElementById('helpOverlay').classList.remove('show');document.getElementById('resizeDialog').classList.remove('show');document.getElementById('exportDialog').classList.remove('show');document.getElementById('contextMenu').classList.remove('show');}
  if(e.key==='?'){document.getElementById('helpOverlay').classList.toggle('show');}
  const toolMap={'p':'pencil','P':'pencil','e':'eraser','E':'eraser','i':'eyedropper','I':'eyedropper','f':'fill','F':'fill','l':'line','L':'line','r':'rect','R':'rect','c':'circle','C':'circle','m':'select','M':'select','s':'spray','S':'spray','k':'replace','K':'replace','g':'grid','G':'grid'};
  if(toolMap[e.key]){if(toolMap[e.key]==='grid'){document.getElementById('peGrid')?.click();}else{const btn=document.querySelector('[data-pe-tool="'+toolMap[e.key]+'"]');if(btn)btn.click();}e.preventDefault();}
});
peCanvasArea.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
peCanvasArea.addEventListener('drop',e=>{
  e.preventDefault();const file=e.dataTransfer.files[0];if(!file||!file.type.startsWith('image/'))return;
  const img=new Image();
  img.onload=()=>{
    const tempC=document.createElement('canvas');tempC.width=peCanvas.width;tempC.height=peCanvas.height;
    const tCtx=tempC.getContext('2d');tCtx.drawImage(img,0,0,peCanvas.width,peCanvas.height);
    const imgData=tCtx.getImageData(0,0,peCanvas.width,peCanvas.height);
    for(let y=0;y<peGridSize;y++)for(let x=0;x<peGridSize;x++){
      const idx=(y*pePixelSize+Math.floor(pePixelSize/2))*peCanvas.width*4+(x*pePixelSize+Math.floor(pePixelSize/2))*4;
      const r=imgData.data[idx],g=imgData.data[idx+1],b=imgData.data[idx+2],a=imgData.data[idx+3];
      if(a>128){const existing=peData[y][x];if(existing&&existing!=='#ffffff00'){}else{const hex='#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');peData[y][x]=hex;}}
    }
    peRender();peSaveState();showToast('Image imported as reference');
  };
  img.onerror=()=>showToast('Failed to load image');
  img.src=URL.createObjectURL(file);
});
function hexToHSL(hex){hex=hex.replace('#','');const r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return{h:h*360,s:s*100,l:l*100};}
function hslToHex(h,s,l){h/=360;s/=100;l/=100;if(s===0){const n=Math.round(l*255).toString(16).padStart(2,'0');return'#'+n+n+n}const hue2=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;const r=hue2(p,q,h+1/3),g=hue2(p,q,h),b=hue2(p,q,h-1/3);return'#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');}
function luminance(hex){hex=hex.replace('#','');return 0.2126*parseInt(hex.slice(0,2),16)/255+0.7152*parseInt(hex.slice(2,4),16)/255+0.0722*parseInt(hex.slice(4,6),16)/255;}
function textColor(hex){return luminance(hex)>0.5?'#222':'#eee';}
function genPalettes(hex){const{h,s,l}=hexToHSL(hex);return{complementary:[hex,hslToHex((h+180)%360,s,l)],splitComplementary:[hex,hslToHex((h+150)%360,s,l),hslToHex((h+210)%360,s,l)],analogous:[hex,hslToHex((h+30)%360,s,Math.max(30,l-5)),hslToHex((h-30+360)%360,s,Math.min(85,l+5))],triadic:[hex,hslToHex((h+120)%360,s,l),hslToHex((h+240)%360,s,l)],tetradic:[hex,hslToHex((h+90)%360,s,l),hslToHex((h+180)%360,s,l),hslToHex((h+270)%360,s,l)],monochromatic:(()=>{const r=[];for(let i=0;i<5;i++)r.push(hslToHex(h,Math.max(20,s-10+i*2),15+i*(70/4)));return r})()};}
const pvMeta=[{key:'complementary',label:'Complementary',desc:'h+180'},{key:'splitComplementary',label:'Split Comp',desc:'h+/-150'},{key:'analogous',label:'Analogous',desc:'h+/-30'},{key:'triadic',label:'Triadic',desc:'h+/-120'},{key:'tetradic',label:'Tetradic',desc:'+90/180/270'},{key:'monochromatic',label:'Monochromatic',desc:'l15-85%'}];
let pvColors=[],pvTheme='dark';
function pvRender(hex){
  const palettes=genPalettes(hex);pvColors=[hex,...new Set(Object.values(palettes).flat())];
  const pc=document.getElementById('pvPalettes');pc.innerHTML='';
  pvMeta.forEach(meta=>{
    const colors=palettes[meta.key];if(!colors)return;
    const card=document.createElement('div');card.className='pv-card';
    const hdr=document.createElement('div');hdr.className='pv-card-header';
    hdr.innerHTML='<h2>'+meta.label+'</h2><span class="desc">'+meta.desc+'</span>';card.appendChild(hdr);
    const cd=document.createElement('div');cd.className='pv-colors'+(meta.key==='monochromatic'?' pv-mono':'');
    colors.forEach(c=>{
      const sw=document.createElement('div');sw.className='pv-swatch';sw.style.background=c;sw.dataset.color=c;
      const lbl=document.createElement('span');lbl.className='hex-lbl';lbl.style.color=textColor(c);lbl.textContent=c.toUpperCase();
      const chk=document.createElement('span');chk.className='check';chk.textContent='\u2713';chk.style.color=textColor(c);
      sw.append(lbl,chk);
      sw.addEventListener('click',e=>{e.stopPropagation();navigator.clipboard.writeText(c).then(()=>{sw.classList.add('copied');setTimeout(()=>sw.classList.remove('copied'),800);showToast('Copied '+c.toUpperCase());});});
      cd.appendChild(sw);
    });card.appendChild(cd);pc.appendChild(card);
  });
  pvUpdatePreview(hex,palettes);pvUpdateCSS(hex,palettes);
}
function pvUpdatePreview(hex,palettes){
  const all=[hex,...new Set(Object.values(palettes).flat())];
  const accent=all.find(c=>{const l=luminance(c);return l>0.15&&l<0.85&&c!==hex;})||all[1]||hex;
  const{h,s,l}=hexToHSL(hex);const comp=hslToHex((h+180)%360,s,Math.min(85,l+15));
  const sb=document.getElementById('pvPswatches');if(sb){sb.innerHTML='';const uniq=[...new Set(all)].slice(0,8);uniq.forEach(c=>{const sw=document.createElement('div');sw.className='pv-pswatch';sw.style.background=c;if(c===hex)sw.classList.add('active');sw.title=c;sb.appendChild(sw);});}
  const pbar=document.getElementById('pvPbar');if(pbar)pbar.style.background='linear-gradient(90deg,'+hex+','+accent+')';
  const pbtn=document.getElementById('pvPbtn');if(pbtn){pbtn.style.background=accent;pbtn.style.color=textColor(accent);}
  const pgrad=document.getElementById('pvPgrad');if(pgrad)pgrad.style.background='linear-gradient(135deg,'+hex+' 0%,'+comp+' 50%,'+(all[all.length-1]||hex)+' 100%)';
  const themeColors={dark:{bg:'#1a1a2e',fg:'#e0e0e0',card:'#16213e',border:'#0f3460'},light:{bg:'#f5f5f5',fg:'#222',card:'#fff',border:'#ddd'},highcontrast:{bg:'#000',fg:'#fff',card:'#111',border:'#ff0'}};
  const t=themeColors[pvTheme]||themeColors.dark;
  document.querySelectorAll('.pv-preview-card').forEach(c=>{c.style.background=t.card;c.style.borderColor=t.border;c.style.color=t.fg;});
  document.querySelectorAll('.pv-ptext').forEach(el=>el.style.color=t.fg);
}
function pvUpdateCSS(hex,palettes){
  const lines=[':root {','  --primary: '+hex+';'];
  pvMeta.forEach(meta=>{const cols=palettes[meta.key];if(cols)cols.forEach((c,i)=>{lines.push('  --'+meta.key.replace('Complementary','comp').replace('SplitComp','split')+'-'+(i+1)+': '+c+';');});});
  lines.push('}');
  const cssBox=document.getElementById('pvCss');if(cssBox)cssBox.textContent=lines.join('\n');
}
document.getElementById('pvColorPicker')?.addEventListener('input',e=>{const hex=e.target.value;document.getElementById('pvHexInput').value=hex;document.getElementById('pvColorPreview').style.background=hex;pvRender(hex);AppState.currentColor=hex;});
document.getElementById('pvHexInput')?.addEventListener('input',e=>{let val=e.target.value.trim();if(!val.startsWith('#'))val='#'+val;if(/^#[0-9a-fA-F]{6}$/.test(val)){document.getElementById('pvColorPicker').value=val;document.getElementById('pvColorPreview').style.background=val;pvRender(val);AppState.currentColor=val;}});
document.getElementById('pvHexInput')?.addEventListener('blur',()=>{let val=document.getElementById('pvHexInput').value.trim();if(!val.startsWith('#'))val='#'+val;if(!/^#[0-9a-fA-F]{6}$/.test(val))document.getElementById('pvHexInput').value=document.getElementById('pvColorPicker').value;});
document.getElementById('pvCss')?.addEventListener('click',()=>{navigator.clipboard.writeText(document.getElementById('pvCss').textContent).then(()=>showToast('Copied CSS'));});
document.getElementById('pvSendToEditor')?.addEventListener('click',()=>{if(pvColors.length>0){AppState.sharedPalette=pvColors;showToast('Sent '+pvColors.length+' colors to Editor');document.getElementById('navPixel')?.click();peBuildPalette();}});
document.querySelectorAll('[data-pvtheme]').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('[data-pvtheme]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');pvTheme=btn.dataset.pvtheme;const hex=document.getElementById('pvColorPicker').value;pvRender(hex);});});

const DB_NAME='PixelStudioDB',DB_VER=1,STORE='palettes';
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VER);req.onupgradeneeded=(e)=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});};req.onsuccess=e=>resolve(e.target.result);req.onerror=e=>reject(e.target.error);});}
function dbSavePalette(colors,name){return dbOpen().then(db=>{return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add({name:name||'Palette '+new Date().toLocaleString(),colors:colors,created:Date.now()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=e=>reject(e.target.error);});});}
function dbLoadPalettes(){return dbOpen().then(db=>{return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>{db.close();resolve(req.result);};req.onerror=e=>reject(e.target.error);});});}
function dbDeletePalette(id){return dbOpen().then(db=>{return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=e=>reject(e.target.error);});});}

document.getElementById('pvSavePalette')?.addEventListener('click',()=>{if(!pvColors.length)return;const name=prompt('Palette name:','My Palette');if(!name)return;dbSavePalette(pvColors,name).then(()=>showToast('Palette saved!')).catch(()=>showToast('Failed to save'));});
document.getElementById('pvLoadPalettes')?.addEventListener('click',()=>{
  const area=document.getElementById('pvSavedArea');
  if(area.style.display==='block'){area.style.display='none';return;}
  dbLoadPalettes().then(palettes=>{
    const list=document.getElementById('pvSavedList');list.innerHTML='';
    if(!palettes||palettes.length===0){list.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:8px">No saved palettes</div>';}
    else{palettes.forEach(p=>{
      const item=document.createElement('div');item.className='pv-saved-item';
      const minis=document.createElement('div');minis.className='s-minis';
      (p.colors||[]).slice(0,8).forEach(c=>{const m=document.createElement('div');m.className='s-mini';m.style.background=c;minis.appendChild(m);});
      const name=document.createElement('span');name.className='s-name';name.textContent=p.name||'Palette';
      const del=document.createElement('span');del.className='s-del';del.textContent='x';
      del.addEventListener('click',e=>{e.stopPropagation();dbDeletePalette(p.id).then(()=>{item.remove();showToast('Deleted');});});
      item.append(minis,name,del);
      item.addEventListener('click',()=>{if(p.colors&&p.colors.length>0){AppState.sharedPalette=p.colors;document.getElementById('navPixel')?.click();peBuildPalette();showToast('Loaded palette with '+p.colors.length+' colors');area.style.display='none';}});
      list.appendChild(item);
    });}
    area.style.display='block';
  }).catch(()=>showToast('Failed to load'));
});
document.getElementById('pvImageInput')?.addEventListener('change',function(){
  const file=this.files[0];if(!file)return;
  const img=new Image();
  img.onload=()=>{
    const c=document.createElement('canvas');c.width=64;c.height=64;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0,64,64);
    const data=ctx.getImageData(0,0,64,64).data;
    const colorMap={};
    for(let i=0;i<data.length;i+=16){
      const r=Math.round(data[i]/32)*32,g=Math.round(data[i+1]/32)*32,b=Math.round(data[i+2]/32)*32,a=data[i+3];
      if(a<128)continue;
      colorMap[r+','+g+','+b]=(colorMap[r+','+g+','+b]||0)+1;
    }
    const sorted=Object.entries(colorMap).sort((a,b)=>b[1]-a[1]);
    const top8=sorted.slice(0,8).map(([key])=>{const[r,g,b]=key.split(',').map(Number);return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');});
    if(top8.length>0){AppState.sharedPalette=top8;showToast('Extracted '+top8.length+' colors');document.getElementById('navPixel')?.click();peBuildPalette();}
  };
  img.onerror=()=>showToast('Failed to read image');
  img.src=URL.createObjectURL(file);this.value='';
});

if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
var deferredPrompt;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.add('show');});
document.getElementById('installBtn')?.addEventListener('click',function(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;document.getElementById('installBtn').classList.remove('show');}});

peInit();peBuildPalette();peSelectColor('#4fc3f7');
document.getElementById('peGrid')?.classList.add('active');peUpdateBtn();
document.getElementById('pvColorPreview').style.background='#4fc3f7';
pvRender('#4fc3f7');

window.__debug={
  getData:()=>peData,
  getHistory:()=>({history:peHistory.length,idx:peHistoryIdx}),
  getSelection:()=>peSelection,
  getPixel:(x,y)=>peData[y]?.[x],
  getCanvasSize:()=>({w:peGridSize,h:peGridSize,zoom:pePixelSize}),
  getTool:()=>peTool,
  getBrushSize:()=>peBrushSize,
  getSpray:()=>({density:peSprayDensity,radius:peSprayRadius})
};
console.log('Pixel Studio v0.3.0 loaded. Use window.__debug for verification.');

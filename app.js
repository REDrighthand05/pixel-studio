// === Shared App State ===
const AppState = {
  currentColor: '#4fc3f7', sharedPalette: null, activeView: 'pixel'
};

function showToast(msg, duration) {
  duration = duration || 1500;
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
}

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
const BLEND_MODES = ['normal','multiply','screen','overlay','darken','lighten','difference'];
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
let peSymmetry = false;
let peSymmetryMode = 'vertical';
// Layer system
let peLayers = [], peActiveLayer = 0;
let peFrames = [];
let peCurrentFrame = 0;
let peAnimPlaying = false;
let peAnimTimer = null;
let peAnimDirection = 1;
let peOnionEnabled = false;
let peOnionPrevAlpha = 0.5;
let peOnionNextAlpha = 0.25;
const PE_DEFAULT_FRAME_DELAY = 100;

const peCanvas = document.getElementById('pixelCanvas');
const peCtx = peCanvas.getContext('2d');
const peCanvasArea = document.getElementById('peCanvasArea');
const peSelOverlay = document.getElementById('selectionOverlay');

function peCreateLayer(name) {
  return {
    name: name || 'Layer ' + (peLayers.length + 1),
    visible: true, locked: false,
    opacity: 1.0, blendMode: 'normal',
    data: Array(peGridSize).fill().map(() => Array(peGridSize).fill('#ffffff00'))
  };
}

function peInit() {
  peLayers = []; peLayers.push(peCreateLayer('Background'));
  peActiveLayer = 0;
  peCanvas.width = peGridSize * pePixelSize;
  peCanvas.height = peGridSize * pePixelSize;
  peSelection = null; peHideSelection();
  peSaveState(); peRender(); peUpdateStatusBar();
  peRenderLayerPanel();
}

// === Hex utilities ===
function hexToRgb(hex) {
  hex = hex.replace('#','');
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}
function rgbToHex(r,g,b) {
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
// === Composite rendering ===
function peBlend(base, overlay, mode, opacity) {
  if (!overlay || overlay === '#ffffff00') return base;
  if (!base || base === '#ffffff00') return overlay;
  const [br,bg,bb] = hexToRgb(base);
  const [or,og,ob] = hexToRgb(overlay);
  let r=or,g=og,b=ob;
  switch(mode) {
    case 'multiply': r=br*or/255; g=bg*og/255; b=bb*ob/255; break;
    case 'screen': r=255-(255-br)*(255-or)/255; g=255-(255-bg)*(255-og)/255; b=255-(255-bb)*(255-ob)/255; break;
    case 'overlay': r=br<128?2*br*or/255:255-2*(255-br)*(255-or)/255; g=bg<128?2*bg*og/255:255-2*(255-bg)*(255-og)/255; b=bb<128?2*bb*ob/255:255-2*(255-bb)*(255-ob)/255; break;
    case 'darken': r=Math.min(br,or); g=Math.min(bg,og); b=Math.min(bb,ob); break;
    case 'lighten': r=Math.max(br,or); g=Math.max(bg,og); b=Math.max(bb,ob); break;
    case 'difference': r=Math.abs(br-or); g=Math.abs(bg-og); b=Math.abs(bb-ob); break;
    default: break;
  }
  // Apply opacity: blend(o) * opacity + base * (1-opacity)
  if (opacity < 1) {
    r = r * opacity + br * (1 - opacity);
    g = g * opacity + bg * (1 - opacity);
    b = b * opacity + bb * (1 - opacity);
  }
  return rgbToHex(r, g, b);
}

function peGetComposite() {
  const composite = Array(peGridSize).fill().map(() => Array(peGridSize).fill('#ffffff00'));
  for (let i = 0; i < peLayers.length; i++) {
    const layer = peLayers[i];
    if (!layer.visible) continue;
    for (let y = 0; y < peGridSize; y++)
      for (let x = 0; x < peGridSize; x++) {
        const overlay = layer.data[y][x];
        if (!overlay || overlay === '#ffffff00') continue;
        const base = composite[y][x];
        composite[y][x] = peBlend(base, overlay, layer.blendMode, layer.opacity);
      }
  }
  return composite;
}

function peGetCompositePixel(x, y) {
  if (x < 0 || x >= peGridSize || y < 0 || y >= peGridSize) return '#ffffff00';
  let result = '#ffffff00';
  for (let i = 0; i < peLayers.length; i++) {
    const layer = peLayers[i];
    if (!layer.visible) continue;
    const overlay = layer.data[y][x];
    if (!overlay || overlay === '#ffffff00') continue;
    result = peBlend(result, overlay, layer.blendMode, layer.opacity);
  }
  return result;
}

function peRender() {
  if (!peCtx) return;
  const composite = peGetComposite();
  peCtx.clearRect(0, 0, peCanvas.width, peCanvas.height);
  const cs = pePixelSize / 2;
  for (let y = 0; y < peGridSize; y++)
    for (let x = 0; x < peGridSize; x++) {
      const px = x * pePixelSize, py = y * pePixelSize, p = composite[y][x];
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
  peRenderOnion(peCtx);
}

function peSaveState() {
  const s = { frameIdx: peCurrentFrame, layers: peLayers.map(l => ({...l, data: l.data.map(r=>[...r])})) };
  peHistory = peHistory.slice(0, peHistoryIdx + 1);
  peHistory.push(s);
  if (peHistory.length > PE_MAX_HISTORY) peHistory.shift();
  peHistoryIdx = peHistory.length - 1; peUpdateBtn();
}
function peSaveCurrent() {
  pePrevData = peLayers.map(l => ({...l, data: l.data.map(r=>[...r])}));
}
function peRestorePreview() {
  if (pePrevData) peLayers = pePrevData.map(l => ({...l, data: l.data.map(r=>[...r])}));
}
function peSet(x, y, c) {
  if (!peLayers[peActiveLayer] || peLayers[peActiveLayer].locked) return;
  if (x>=0&&x<peGridSize&&y>=0&&y<peGridSize) peLayers[peActiveLayer].data[y][x]=c;
  if (peSymmetry) peMirror(x, y, c);
}
function peSetRaw(x, y, c) {
  if (x>=0&&x<peGridSize&&y>=0&&y<peGridSize) peLayers[peActiveLayer].data[y][x]=c;
}
function peMirror(x, y, c) {
  var mx = peGridSize - 1, my = peGridSize - 1;
  var mode = peSymmetryMode;
  if (mode === 'vertical' || mode === 'both') peSetRaw(mx - x, y, c);
  if (mode === 'horizontal' || mode === 'both') peSetRaw(x, my - y, c);
  if (mode === 'radial') { peSetRaw(my - y, x, c); peSetRaw(mx - x, my - y, c); peSetRaw(y, mx - x, c); }
}
function peSetBrush(x, y, c) {
  const bs = peBrushSize, half = Math.floor(bs / 2);
  for (let dy = 0; dy < bs; dy++)
    for (let dx = 0; dx < bs; dx++)
      peSet(x + dx - half, y + dy - half, c);
}
function peGetPixel(ex, ey) {
  const r = peCanvas.getBoundingClientRect();
  const x = Math.floor((ex - r.left) / r.width * peGridSize);
  const y = Math.floor((ey - r.top) / r.height * peGridSize);
  if (x < 0 || x >= peGridSize || y < 0 || y >= peGridSize) return null;
  return {x, y, color: peGetCompositePixel(x, y)};
}

function peDrawLine(x0, y0, x1, y1, c) {
  let dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
  let sx = x0<x1?1:-1, sy = y0<y1?1:-1, err = dx - dy;
  while (true) {
    peSetBrush(x0, y0, c);
    if (x0===x1 && y0===y1) break;
    const e2 = 2*err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
function peDrawCircle(cx, cy, r, c, fill) {
  if (fill) { for (let y=-r;y<=r;y++) for (let x=-r;x<=r;x++) if (x*x+y*y<=r*r) peSetBrush(cx+x,cy+y,c); return; }
  let x=r, y=0, err=1-r;
  while (x>=y) {
    peSetBrush(cx+x,cy+y,c);peSetBrush(cx-x,cy+y,c);peSetBrush(cx+x,cy-y,c);peSetBrush(cx-x,cy-y,c);
    peSetBrush(cx+y,cy+x,c);peSetBrush(cx-y,cy+x,c);peSetBrush(cx+y,cy-x,c);peSetBrush(cx-y,cy-x,c);
    y++; if (err<0) err+=2*y+1; else { x--; err+=2*(y-x)+1; }
  }
}
function peDrawRect(x0, y0, x1, y1, c) {
  const minX=Math.min(x0,x1),maxX=Math.max(x0,x1),minY=Math.min(y0,y1),maxY=Math.max(y0,y1);
  for (let y=minY;y<=maxY;y++) for (let x=minX;x<=maxX;x++) peSet(x,y,c);
}
function peFloodFill(sx, sy, fc) {
  const layer = peLayers[peActiveLayer];
  if (!layer || layer.locked) return;
  const data = layer.data;
  const tc = data[sy][sx]; if (tc === fc) return;
  const vis = new Set(), stack = [[sx, sy]];
  while (stack.length) {
    const [cx, cy] = stack.pop(), k = cx+','+cy;
    if (vis.has(k)) continue; vis.add(k);
    if (cx<0||cx>=peGridSize||cy<0||cy>=peGridSize||data[cy][cx]!==tc) continue;
    data[cy][cx] = fc;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
}
function peReplaceColor(targetColor, newColor) {
  const layer = peLayers[peActiveLayer];
  if (!layer || layer.locked || targetColor === newColor) return false;
  let count = 0;
  for (let y=0; y<peGridSize; y++) for (let x=0; x<peGridSize; x++)
    if (layer.data[y][x] === targetColor) { layer.data[y][x] = newColor; count++; }
  return count > 0;
}
// === Selection ===
function peShowSelection(x,y,w,h) {
  peSelOverlay.style.display='block';peSelOverlay.style.left=(x*pePixelSize)+'px';peSelOverlay.style.top=(y*pePixelSize)+'px';
  peSelOverlay.style.width=(w*pePixelSize)+'px';peSelOverlay.style.height=(h*pePixelSize)+'px';peSelection={x,y,w,h};
}
function peHideSelection(){peSelOverlay.style.display='none';peSelection=null;}
function peNormalizeSel(x0,y0,x1,y1){return{x:Math.min(x0,x1),y:Math.min(y0,y1),w:Math.abs(x1-x0)+1,h:Math.abs(y1-y0)+1};}
function peUpdateSelectionOverlay(){if(peSelection)peShowSelection(peSelection.x,peSelection.y,peSelection.w,peSelection.h);}
function peCopySelection(){
  if(!peSelection)return;const{x,y,w,h}=peSelection;peClipboard=[];
  for(let sy=y;sy<y+h&&sy<peGridSize;sy++){const row=[];for(let sx=x;sx<x+w&&sx<peGridSize;sx++)row.push(peLayers[peActiveLayer]?.data[sy][sx]);peClipboard.push(row);}
}
function peCutSelection(){
  if(!peSelection)return;peCopySelection();const{x,y,w,h}=peSelection;const data=peLayers[peActiveLayer]?.data;
  if(!data)return;for(let sy=y;sy<y+h&&sy<peGridSize;sy++)for(let sx=x;sx<x+w&&sx<peGridSize;sx++)data[sy][sx]='#ffffff00';
  peRender();peSaveState();
}
function pePasteSelection(){
  if(!peClipboard)return;let px=0,py=0;if(peSelection){px=peSelection.x;py=peSelection.y;}const data=peLayers[peActiveLayer]?.data;if(!data)return;
  for(let sy=0;sy<peClipboard.length&&py+sy<peGridSize;sy++)for(let sx=0;sx<peClipboard[sy].length&&px+sx<peGridSize;sx++)if(peClipboard[sy][sx])data[py+sy][px+sx]=peClipboard[sy][sx];
  peRender();peSaveState();
}
function peDeleteSelection(){
  if(!peSelection)return;const{x,y,w,h}=peSelection;const data=peLayers[peActiveLayer]?.data;if(!data)return;
  for(let sy=y;sy<y+h&&sy<peGridSize;sy++)for(let sx=x;sx<x+w&&sx<peGridSize;sx++)data[sy][sx]='#ffffff00';
  peRender();peSaveState();
}
function peSelectAll(){peShowSelection(0,0,peGridSize,peGridSize);}

function peSpray(cx,cy,color,density,radius){
  for(let i=0;i<density;i++){const angle=Math.random()*2*Math.PI,dist=Math.random()*radius;peSet(Math.round(cx+Math.cos(angle)*dist),Math.round(cy+Math.sin(angle)*dist),color);}
}

function peUndo(){if(peHistoryIdx<=0)return;peHistoryIdx--;peCurrentFrame=peHistory[peHistoryIdx].frameIdx;peLayers=peHistory[peHistoryIdx].layers.map(l=>({...l,data:l.data.map(r=>[...r])}));peRender();peUpdateBtn();peRenderLayerPanel();peRenderTimeline();}
function peRedo(){if(peHistoryIdx>=peHistory.length-1)return;peHistoryIdx++;peCurrentFrame=peHistory[peHistoryIdx].frameIdx;peLayers=peHistory[peHistoryIdx].layers.map(l=>({...l,data:l.data.map(r=>[...r])}));peRender();peUpdateBtn();peRenderLayerPanel();peRenderTimeline();}
function peUpdateBtn(){const u=document.getElementById('peUndo'),r=document.getElementById('peRedo');if(u)u.style.opacity=peHistoryIdx<=0?'0.3':'1';if(r)r.style.opacity=peHistoryIdx>=peHistory.length-1?'0.3':'1';}

function peBuildPalette(){
  const container=document.getElementById('pePalette');if(!container)return;container.innerHTML='';
  (AppState.sharedPalette||PE_COLORS).forEach(c=>{const d=document.createElement('div');d.className='pe-swatch'+(c===peColor?' active':'');d.style.background=c;d.dataset.color=c;d.addEventListener('click',()=>peSelectColor(c));container.appendChild(d);});
}
function peBuildHistory(){
  const container=document.getElementById('peColorHistory');if(!container)return;container.innerHTML='';
  peColorHistory.forEach(c=>{const d=document.createElement('div');d.className='pe-swatch';d.style.background=c;d.dataset.color=c;d.addEventListener('click',()=>peSelectColor(c));container.appendChild(d);});
}
function peAddHistory(c){peColorHistory=peColorHistory.filter(x=>x!==c);peColorHistory.unshift(c);if(peColorHistory.length>PE_MAX_HIST_COLORS)peColorHistory.pop();}
function peSelectColor(c){peColor=c;AppState.currentColor=c;const cur=document.getElementById('peCurColor');if(cur)cur.style.background=c;const picker=document.getElementById('peColorPicker');if(picker)picker.value=c;document.querySelectorAll('#pePalette .pe-swatch').forEach(el=>el.classList.toggle('active',el.dataset.color===c));peAddHistory(c);peBuildHistory();}

function peUpdateStatusBar(){
  const sbTool=document.getElementById('sbTool'),sbPos=document.getElementById('sbPos'),sbZoom=document.getElementById('sbZoom'),sbSize=document.getElementById('sbSize');
  const names={pencil:'Pencil',eraser:'Eraser',eyedropper:'Eye',fill:'Fill',line:'Line',rect:'Rect',circle:'Circle',select:'Select',spray:'Spray',replace:'Replace'};
  if(sbTool)sbTool.textContent=names[peTool]||peTool;if(sbSize)sbSize.textContent=peGridSize+'x'+peGridSize;if(sbZoom)sbZoom.textContent=Math.round(pePixelSize/peGridSize*100*peGridSize)+'%';
}
function peSetZoom(nz){
  pePixelSize=Math.max(4,Math.min(64,nz));const zs=document.getElementById('peZoom');if(zs)zs.value=pePixelSize;const zv=document.getElementById('peZoomVal');if(zv)zv.textContent=pePixelSize+'x';
  peCanvas.width=peGridSize*pePixelSize;peCanvas.height=peGridSize*pePixelSize;peRender();peUpdateStatusBar();
}
peCanvas.addEventListener('mousedown', e => {
  if (peTool === 'select') {
    const pos = peGetPixel(e.clientX, e.clientY); if (!pos) return;
    if (peSelection && pos.x>=peSelection.x && pos.x<peSelection.x+peSelection.w && pos.y>=peSelection.y && pos.y<peSelection.y+peSelection.h) {
      peDrawing = true; peSaveCurrent(); peSelStartX = pos.x - peSelection.x; peSelStartY = pos.y - peSelection.y; return;
    }
    peSelecting = true; peSelStartX = pos.x; peSelStartY = pos.y; return;
  }
  const pos = peGetPixel(e.clientX, e.clientY); if (!pos) return;
  peDrawing = true;
  if (peTool === 'fill') { peFloodFill(pos.x,pos.y,peColor); peSaveState(); peRender(); peRenderLayerPanel(); return; }
  if (peTool === 'eyedropper') { const c = peGetCompositePixel(pos.x,pos.y); if(c&&c!=='#ffffff00') peSelectColor(c); peDrawing = false; return; }
  if (peTool === 'replace') {
    const c = peLayers[peActiveLayer]?.data[pos.y]?.[pos.x];
    if(c&&c!=='#ffffff00'&&c!==peColor){peReplaceColor(c,peColor);peSaveState();peRender();peRenderLayerPanel();showToast('Replaced '+c);}
    peDrawing = false; return;
  }
  if (peTool === 'spray') { peSpray(pos.x,pos.y,peColor,peSprayDensity,peSprayRadius); peRender(); return; }
  if (peTool === 'line'||peTool==='rect'||peTool==='circle'){peStartX=pos.x;peStartY=pos.y;peSaveCurrent();return;}
  peSetBrush(pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor); peRender();
});

peCanvas.addEventListener('mousemove', e => {
  const pos = peGetPixel(e.clientX, e.clientY);
  const cursorEl = document.getElementById('peCursor');
  const sbPos = document.getElementById('sbPos');
  if (pos) { if (cursorEl) cursorEl.textContent = '('+pos.x+', '+pos.y+')'; if (sbPos) sbPos.textContent = pos.x+', '+pos.y; }
  if (pePanning) { const dx=e.clientX-pePanStartX,dy=e.clientY-pePanStartY; peCanvasArea.scrollLeft=pePanCX-dx; peCanvasArea.scrollTop=pePanCY-dy; return; }
  if (!peDrawing||!pos) return;
  if (peTool==='fill'||peTool==='eyedropper'||peTool==='replace') return;
  if (peTool==='spray'){peSpray(pos.x,pos.y,peColor,peSprayDensity,peSprayRadius);peRender();return;}
  if (peTool==='select'&&peSelecting&&pos){const sel=peNormalizeSel(peSelStartX,peSelStartY,pos.x,pos.y);peShowSelection(sel.x,sel.y,sel.w,sel.h);return;}
  if (peTool==='line'){peRestorePreview();peDrawLine(peStartX,peStartY,pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor);peRender();return;}
  if (peTool==='rect'){peRestorePreview();peDrawRect(peStartX,peStartY,pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor);peRender();return;}
  if (peTool==='circle'){peRestorePreview();const dx=pos.x-peStartX,dy=pos.y-peStartY;const radius=e.shiftKey?Math.max(Math.abs(dx),Math.abs(dy)):Math.round(Math.sqrt(dx*dx+dy*dy));peDrawCircle(peStartX,peStartY,radius,peColor,false);peRender();return;}
  peSetBrush(pos.x,pos.y,peTool==='eraser'?'#ffffff00':peColor);peRender();
});

document.addEventListener('mouseup', () => {
  if (pePanning) { pePanning=false; document.body.style.cursor=''; return; }
  if (peDrawing && peTool==='select'){peDrawing=false;if(pePrevData){peSaveState();pePrevData=null;peRenderLayerPanel();} return;}
  if (peSelecting && peTool==='select'){peSelecting=false;if(peSelection&&(peSelection.w<1||peSelection.h<1))peHideSelection();return;}
  if (peDrawing && (peTool==='line'||peTool==='rect'||peTool==='circle')){peDrawing=false;peSaveState();pePrevData=null;peRenderLayerPanel();return;}
  if (peDrawing && peTool==='spray'){peDrawing=false;peSaveState();peRenderLayerPanel();return;}
  if(peDrawing){peDrawing=false;if(peTool!=='fill'&&peTool!=='eyedropper'&&peTool!=='replace'){peSaveState();peRenderLayerPanel();}}
});
peCanvas.addEventListener('mouseleave',()=>{const c=document.getElementById('peCursor');if(c)c.textContent='Click to paint - Drag to draw';if(peDrawing&&(peTool==='line'||peTool==='rect'||peTool==='circle')){peDrawing=false;peRestorePreview();peRender();pePrevData=null;}if(peSelecting)peSelecting=false;});
// === Tool selection ===
document.querySelectorAll('[data-pe-tool]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-pe-tool]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');peTool=btn.dataset.peTool;
    peCanvas.style.cursor={fill:'cell',line:'crosshair',rect:'crosshair',circle:'crosshair',select:'crosshair',spray:'crosshair',replace:'crosshair',eraser:'crosshair',eyedropper:'crosshair'}[peTool]||'crosshair';
    const sr1=document.getElementById('sprayDensityRow'),sr2=document.getElementById('sprayRadiusRow');
    if(peTool==='spray'){if(sr1)sr1.classList.add('show');if(sr2)sr2.classList.add('show');}else{if(sr1)sr1.classList.remove('show');if(sr2)sr2.classList.remove('show');}
    peUpdateStatusBar();
  });
});
document.querySelectorAll('[data-bs]').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('[data-bs]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');peBrushSize=parseInt(btn.dataset.bs);});});
document.getElementById('peUndo')?.addEventListener('click',peUndo);
document.getElementById('peRedo')?.addEventListener('click',peRedo);
document.getElementById('peClear')?.addEventListener('click',()=>{if(!confirm('Clear the canvas?'))return;peLayers.forEach(l=>{l.data=Array(peGridSize).fill().map(()=>Array(peGridSize).fill('#ffffff00'));});peSaveState();peRender();peRenderLayerPanel();});

// Resize
document.getElementById('peResizeBtn')?.addEventListener('click',()=>{document.getElementById('resizeWidth').value=peGridSize;document.getElementById('resizeHeight').value=peGridSize;document.getElementById('resizeCurrent').textContent=peGridSize+'x'+peGridSize;document.getElementById('resizeDialog').classList.add('show');});
document.getElementById('resizeApply')?.addEventListener('click',()=>{
  const nw=parseInt(document.getElementById('resizeWidth').value),nh=parseInt(document.getElementById('resizeHeight').value),mode=document.getElementById('resizeMode').value;
  if(isNaN(nw)||isNaN(nh)||nw<1||nh<1||nw>256||nh>256)return;
  const oldSize=peGridSize;
  peGridSize=nw;
  peLayers.forEach(l=>{
    const oldData=l.data; l.data=Array(peGridSize).fill().map(()=>Array(peGridSize).fill('#ffffff00'));
    if(mode==='stretch'){for(let y=0;y<peGridSize;y++)for(let x=0;x<peGridSize;x++){const sx=Math.floor(x/peGridSize*oldSize),sy=Math.floor(y/peGridSize*oldSize);if(sx<oldSize&&sy<oldSize)l.data[y][x]=oldData[sy][sx];}}
    else if(mode==='crop'){const ox=Math.max(0,Math.floor((oldSize-peGridSize)/2)),oy=Math.max(0,Math.floor((oldSize-peGridSize)/2));for(let y=0;y<Math.min(peGridSize,oldSize-oy);y++)for(let x=0;x<Math.min(peGridSize,oldSize-ox);x++)if(oy+y<oldSize&&ox+x<oldSize)l.data[y][x]=oldData[oy+y][ox+x];}
    else{const ox=Math.max(0,Math.floor((peGridSize-oldSize)/2)),oy=Math.max(0,Math.floor((peGridSize-oldSize)/2));for(let y=0;y<oldSize&&oy+y<peGridSize;y++)for(let x=0;x<oldSize&&ox+x<peGridSize;x++)l.data[oy+y][ox+x]=oldData[y][x];}
  });
  peHideSelection();document.getElementById('resizeDialog').classList.remove('show');
  const gs=document.getElementById('peGridSize');if(gs)gs.value=peGridSize;document.getElementById('peGridSizeVal').textContent=peGridSize;
  peCanvas.width=peGridSize*pePixelSize;peCanvas.height=peGridSize*pePixelSize;
  peSaveState();peRender();peUpdateStatusBar();peRenderLayerPanel();showToast('Canvas resized to '+peGridSize+'x'+peGridSize);
});
// Export
document.getElementById('peExport')?.addEventListener('click',()=>{document.getElementById('exportScale').value='4';document.getElementById('exportPreview').textContent='Output: '+(peGridSize*4)+'x'+(peGridSize*4)+' px';document.getElementById('exportDialog').classList.add('show');});
document.getElementById('exportScale')?.addEventListener('change',function(){const s=parseInt(this.value);document.getElementById('exportPreview').textContent='Output: '+(peGridSize*s)+'x'+(peGridSize*s)+' px';});
document.getElementById('exportApply')?.addEventListener('click',()=>{
  const scale=parseInt(document.getElementById('exportScale').value),transparent=document.getElementById('exportTransparent').checked,showGrid=document.getElementById('exportShowGrid').checked;
  const comp=peGetComposite();
  const ec=document.createElement('canvas');ec.width=peGridSize*scale;ec.height=peGridSize*scale;
  const ex=ec.getContext('2d');
  if(!transparent){ex.fillStyle='#fff';ex.fillRect(0,0,ec.width,ec.height);}
  for(let y=0;y<peGridSize;y++)for(let x=0;x<peGridSize;x++){const c=comp[y][x];if(c&&c!=='#ffffff00'){ex.fillStyle=c;ex.fillRect(x*scale,y*scale,scale,scale);}}
  if(showGrid&&scale>=4){ex.strokeStyle='rgba(0,0,0,0.15)';ex.lineWidth=1;for(let i=0;i<=peGridSize;i++){ex.beginPath();ex.moveTo(i*scale,0);ex.lineTo(i*scale,ec.height);ex.stroke();ex.beginPath();ex.moveTo(0,i*scale);ex.lineTo(ec.width,i*scale);ex.stroke();}}
  document.getElementById('exportDialog').classList.remove('show');
  const lnk=document.createElement('a');lnk.download='pixel-art.png';lnk.href=ec.toDataURL();lnk.click();showToast('Exported '+ec.width+'x'+ec.height+' PNG');
});

let peGridVisible=true;
document.getElementById('peGrid')?.addEventListener('click',()=>{peGridVisible=!peGridVisible;peShowGrid=peGridVisible;document.getElementById('peGrid').classList.toggle('active');peRender();});
document.getElementById('peColorPicker')?.addEventListener('input',e=>peSelectColor(e.target.value));
document.getElementById('peGridSize')?.addEventListener('input',e=>{peGridSize=parseInt(e.target.value);document.getElementById('peGridSizeVal').textContent=peGridSize;peInit();});
document.getElementById('peZoom')?.addEventListener('input',e=>{peSetZoom(parseInt(e.target.value));});
document.getElementById('sprayDensity')?.addEventListener('input',e=>{peSprayDensity=parseInt(e.target.value);document.getElementById('sprayDensityVal').textContent=peSprayDensity;});
document.getElementById('sprayRadius')?.addEventListener('input',e=>{peSprayRadius=parseInt(e.target.value);document.getElementById('sprayRadiusVal').textContent=peSprayRadius;});
peCanvasArea.addEventListener('wheel',e=>{e.preventDefault();peSetZoom(pePixelSize+(e.deltaY>0?-1:1)*2);},{passive:false});

document.addEventListener('keydown',e=>{if(e.key===' '&&!e.repeat){if(peAnimPlaying){peStopAnim();e.preventDefault();return;}pePanning=true;pePanStartX=0;pePanStartY=0;pePanCX=peCanvasArea.scrollLeft;pePanCY=peCanvasArea.scrollTop;document.body.style.cursor='grab';e.preventDefault();}});
document.addEventListener('keyup',e=>{if(e.key===' '){pePanning=false;document.body.style.cursor='';}});
peCanvasArea.addEventListener('mousedown',e=>{if(e.button===0&&pePanning){pePanStartX=e.clientX;pePanStartY=e.clientY;pePanCX=peCanvasArea.scrollLeft;pePanCY=peCanvasArea.scrollTop;document.body.style.cursor='grabbing';e.preventDefault();}});

peCanvas.addEventListener('contextmenu',e=>{e.preventDefault();const m=document.getElementById('contextMenu');m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';m.classList.add('show');});
document.addEventListener('click',e=>{if(!e.target.closest('.context-menu'))document.getElementById('contextMenu').classList.remove('show');});
document.querySelectorAll('[data-cm]').forEach(item=>{
  item.addEventListener('click',()=>{
    const action=item.dataset.cm;document.getElementById('contextMenu').classList.remove('show');
    if(action==='cut')peCutSelection();else if(action==='copy')peCopySelection();else if(action==='paste')pePasteSelection();else if(action==='clear')peDeleteSelection();else if(action==='deselect')peHideSelection();
    else if(action==='fill-selection'){if(peSelection){const{x,y,w,h}=peSelection;const data=peLayers[peActiveLayer]?.data;if(data)for(let sy=y;sy<y+h&&sy<peGridSize;sy++)for(let sx=x;sx<x+w&&sx<peGridSize;sx++)data[sy][sx]=peColor;peRender();peSaveState();}}
  });
});
document.getElementById('peHelpBtn')?.addEventListener('click',()=>{document.getElementById('helpOverlay').classList.add('show');});

document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();peUndo();}
  if(e.ctrlKey&&(e.key==='Z'||(e.key==='z'&&e.shiftKey))){e.preventDefault();peRedo();}
  if(e.ctrlKey&&e.key==='e'){e.preventDefault();document.getElementById('peExport')?.click();}
  if(e.ctrlKey&&e.key==='n'){e.preventDefault();peNewProject();}
  if(e.ctrlKey&&e.key==='o'){e.preventDefault();document.getElementById('peOpen')?.click();}
  if(e.ctrlKey&&e.key==='s'){e.preventDefault();peSaveProject();}
  if(e.ctrlKey&&e.key==='a'){e.preventDefault();peSelectAll();}
  if(e.key==='Delete'||e.key==='Del'){peDeleteSelection();}
  if(e.key==='Escape'){peHideSelection();document.getElementById('helpOverlay').classList.remove('show');document.getElementById('resizeDialog').classList.remove('show');document.getElementById('exportDialog').classList.remove('show');document.getElementById('contextMenu').classList.remove('show');}
  if(e.key==='?'){document.getElementById('helpOverlay').classList.toggle('show');}
  const tm={'p':'pencil','P':'pencil','e':'eraser','E':'eraser','i':'eyedropper','I':'eyedropper','f':'fill','F':'fill','l':'line','L':'line','r':'rect','R':'rect','c':'circle','C':'circle','m':'select','M':'select','s':'spray','S':'spray','k':'replace','K':'replace','g':'grid','G':'grid'};
  if(tm[e.key]){if(tm[e.key]==='grid'){document.getElementById('peGrid')?.click();}else{const btn=document.querySelector('[data-pe-tool="'+tm[e.key]+'"]');if(btn)btn.click();}e.preventDefault();}
});

peCanvasArea.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
peCanvasArea.addEventListener('drop',e=>{
  e.preventDefault();const file=e.dataTransfer.files[0];if(!file||!file.type.startsWith('image/'))return;
  const img=new Image();
  img.onload=()=>{
    const tempC=document.createElement('canvas');tempC.width=peCanvas.width;tempC.height=peCanvas.height;
    const tCtx=tempC.getContext('2d');tCtx.drawImage(img,0,0,peCanvas.width,peCanvas.height);
    const imgData=tCtx.getImageData(0,0,peCanvas.width,peCanvas.height);
    const newLayer=peCreateLayer('Imported');peLayers.push(newLayer);peActiveLayer=peLayers.length-1;
    for(let y=0;y<peGridSize;y++)for(let x=0;x<peGridSize;x++){
      const idx=(y*pePixelSize+Math.floor(pePixelSize/2))*peCanvas.width*4+(x*pePixelSize+Math.floor(pePixelSize/2))*4;
      const r=imgData.data[idx],g=imgData.data[idx+1],b=imgData.data[idx+2],a=imgData.data[idx+3];
      if(a>128){newLayer.data[y][x]='#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
    }
    peRender();peSaveState();peRenderLayerPanel();showToast('Imported as new layer');
  };
  img.onerror=()=>showToast('Failed to load image');
  img.src=URL.createObjectURL(file);
});
// === Layer Panel ===
function peRenderLayerPanel() {
  const list = document.getElementById('layerList');
  if (!list) return;
  list.innerHTML = '';
  for (let i = peLayers.length - 1; i >= 0; i--) {
    const l = peLayers[i];
    const item = document.createElement('div');
    item.className = 'pe-layer-item' + (i === peActiveLayer ? ' active' : '');
    item.draggable = true; item.dataset.layer = i;
    // Thumbnail
    const thumb = document.createElement('canvas');
    thumb.className = 'pe-layer-thumb'; thumb.width = 36; thumb.height = 36;
    const tCtx = thumb.getContext('2d');
    for (let y = 0; y < peGridSize; y++) for (let x = 0; x < peGridSize; x++) {
      const px = Math.floor(x * 36 / peGridSize), py = Math.floor(y * 36 / peGridSize);
      const pw = Math.ceil((x+1)*36/peGridSize) - px, ph = Math.ceil((y+1)*36/peGridSize) - py;
      const c = l.data[y][x];
      if (!c || c === '#ffffff00') { tCtx.fillStyle = ((x+y)%2===0?'#ddd':'#999'); tCtx.fillRect(px,py,pw,ph); }
      else { tCtx.fillStyle = c; tCtx.fillRect(px,py,pw,ph); }
    }
    // Info
    const info = document.createElement('div'); info.className = 'pe-layer-info';
    const name = document.createElement('div'); name.className = 'pe-layer-name'; name.textContent = l.name;
    const opRow = document.createElement('div'); opRow.className = 'pe-layer-op-row';
    const opInput = document.createElement('input'); opInput.type = 'range'; opInput.min = 0; opInput.max = 100;
    opInput.value = Math.round(l.opacity * 100); opInput.className = 'pe-layer-op';
    const opLabel = document.createElement('span'); opLabel.className = 'ol'; opLabel.textContent = Math.round(l.opacity * 100) + '%';
    opInput.addEventListener('input', e => { peLayers[i].opacity = parseInt(e.target.value) / 100; opLabel.textContent = parseInt(e.target.value) + '%'; peRender(); peRenderLayerPanel(); });
    opInput.addEventListener('mouseup', () => { if (i === peActiveLayer) peSaveState(); });
    opRow.append(opInput, opLabel);
    info.append(name, opRow);
    // Buttons
    const btns = document.createElement('div'); btns.className = 'pe-layer-btns';
    const visBtn = document.createElement('button'); visBtn.textContent = l.visible ? '馃憗' : '鈼?;
    visBtn.className = l.visible ? 'on' : ''; visBtn.title = 'Toggle visibility';
    visBtn.addEventListener('click', e => { e.stopPropagation(); peLayers[i].visible = !peLayers[i].visible; peRender(); peRenderLayerPanel(); });
    const lockBtn = document.createElement('button'); lockBtn.textContent = l.locked ? '馃敀' : '鈼?;
    lockBtn.className = l.locked ? 'on' : ''; lockBtn.title = 'Toggle lock';
    lockBtn.addEventListener('click', e => { e.stopPropagation(); peLayers[i].locked = !peLayers[i].locked; peRenderLayerPanel(); });
    btns.append(visBtn, lockBtn);
    item.append(thumb, info, btns);
    // Click to activate
    item.addEventListener('click', () => { peActiveLayer = i; peRenderLayerPanel(); });
    // Drag events
    item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i); item.classList.add('dragging'); });
    item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-over');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (fromIdx === i) return;
      const [layer] = peLayers.splice(fromIdx, 1);
      const toIdx = fromIdx < i ? i - 1 : i;
      peLayers.splice(toIdx, 0, layer);
      peActiveLayer = toIdx;
      peRender(); peRenderLayerPanel();
    });
    item.addEventListener('dragend', () => { document.querySelectorAll('.pe-layer-item').forEach(el => el.classList.remove('dragging','drag-over')); });
    list.appendChild(item);
  }
  // Update blend mode selector
  const bm = document.getElementById('layerBlendMode');
  if (bm && peLayers[peActiveLayer]) bm.value = peLayers[peActiveLayer].blendMode;
}

// Layer operations
document.getElementById('layerAdd')?.addEventListener('click', () => {
  peLayers.push(peCreateLayer()); peActiveLayer = peLayers.length - 1; peRender(); peSaveState(); peRenderLayerPanel();
});
document.getElementById('layerDel')?.addEventListener('click', () => {
  if (peLayers.length <= 1) { showToast('Cannot delete the only layer'); return; }
  if (!confirm('Delete layer "' + peLayers[peActiveLayer].name + '"?')) return;
  peLayers.splice(peActiveLayer, 1);
  if (peActiveLayer >= peLayers.length) peActiveLayer = peLayers.length - 1;
  peRender(); peSaveState(); peRenderLayerPanel();
});
document.getElementById('layerDup')?.addEventListener('click', () => {
  const src = peLayers[peActiveLayer]; if (!src) return;
  const newLayer = peCreateLayer(src.name + ' copy');
  newLayer.data = src.data.map(r=>[...r]);
  peLayers.push(newLayer); peActiveLayer = peLayers.length - 1; peRender(); peSaveState(); peRenderLayerPanel();
});
document.getElementById('layerMerge')?.addEventListener('click', () => {
  if (peActiveLayer <= 0) { showToast('Cannot merge the bottom layer'); return; }
  const bottom = peLayers[peActiveLayer - 1], top = peLayers[peActiveLayer];
  for (let y = 0; y < peGridSize; y++) for (let x = 0; x < peGridSize; x++) {
    const tc = top.data[y][x];
    if (tc && tc !== '#ffffff00') bottom.data[y][x] = peBlend(bottom.data[y][x], tc, top.blendMode, top.opacity);
  }
  peLayers.splice(peActiveLayer, 1); peActiveLayer--;
  peRender(); peSaveState(); peRenderLayerPanel(); showToast('Merged down');
});
// === Project File Events ===
document.getElementById('peNew')?.addEventListener('click',peNewProject);
document.getElementById('peOpen')?.addEventListener('click',function(){document.getElementById('peFileInput')?.click();});
document.getElementById('peFileInput')?.addEventListener('change',function(){if(this.files[0])peOpenProject(this.files[0]);this.value='';});
document.getElementById('peSave')?.addEventListener('click',peSaveProject);

// === Animation Timeline Events ===
document.getElementById('tlPlay')?.addEventListener('click',peTogglePlay);
document.getElementById('tlStop')?.addEventListener('click',peStopAnim);
document.getElementById('tlAdd')?.addEventListener('click',peAddFrame);
document.getElementById('tlDel')?.addEventListener('click',function(){peDeleteFrame(peCurrentFrame);});
document.getElementById('tlDup')?.addEventListener('click',function(){peDuplicateFrame(peCurrentFrame);});
document.getElementById('tlGif')?.addEventListener('click',peExportGIF);
document.getElementById('tlSheet')?.addEventListener('click',peExportSpriteSheet);
document.getElementById('onionToggle')?.addEventListener('change',function(){peOnionEnabled=this.checked;peRender();});
document.getElementById('onionPrev')?.addEventListener('input',function(){peOnionPrevAlpha=parseInt(this.value)/100;if(peOnionEnabled)peRender();});
document.getElementById('onionNext')?.addEventListener('input',function(){peOnionNextAlpha=parseInt(this.value)/100;if(peOnionEnabled)peRender();});
// === Symmetry Events ===
document.getElementById('peSymmetryToggle')?.addEventListener('change', function() {
  peSymmetry = this.checked;
  document.getElementById('peSymmetryMode').disabled = !this.checked;
});
document.getElementById('peSymmetryMode')?.addEventListener('change', function() {
  peSymmetryMode = this.value;
});
document.getElementById('layerBlendMode')?.addEventListener('change', function() {
  if (peLayers[peActiveLayer]) { peLayers[peActiveLayer].blendMode = this.value; peRender(); }
});
// === FRAME / ANIMATION SYSTEM ===
function peInitFrames(){peFrames=[];peFrames.push({name:'Frame 1',delay:100,layers:deepCloneLayers(peLayers)});peCurrentFrame=0;peAnimPlaying=false;peAnimTimer=null;peAnimDirection=1;}
function deepCloneLayers(l){return l.map(function(layer){return{name:layer.name,visible:layer.visible,locked:layer.locked,opacity:layer.opacity,blendMode:layer.blendMode,data:layer.data.map(function(r){return[...r]})};});}
function peAddFrame(){peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);var n={name:'Frame '+(peFrames.length+1),delay:100,layers:deepCloneLayers(peLayers)};peFrames.push(n);peCurrentFrame=peFrames.length-1;peRenderTimeline();showToast('Frame '+(peCurrentFrame+1)+' added');}
function peDeleteFrame(i){if(peFrames.length<=1){showToast('Need at least 1 frame');return;}if(!confirm('Delete '+peFrames[i].name+'?'))return;peFrames.splice(i,1);if(peCurrentFrame>=peFrames.length)peCurrentFrame=peFrames.length-1;peLayers=deepCloneLayers(peFrames[peCurrentFrame].layers);peRender();peRenderTimeline();peRenderLayerPanel();peSaveState();}
function peDuplicateFrame(i){var src=peFrames[i];var dup={name:src.name+' copy',delay:src.delay,layers:deepCloneLayers(src.layers)};peFrames.splice(i+1,0,dup);peCurrentFrame=i+1;peLayers=deepCloneLayers(dup.layers);peRender();peRenderTimeline();peRenderLayerPanel();peSaveState();showToast('Frame duplicated');}
function peSelectFrame(i){if(i===peCurrentFrame||i<0||i>=peFrames.length)return;peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);peCurrentFrame=i;peLayers=deepCloneLayers(peFrames[i].layers);peRender();peRenderTimeline();peRenderLayerPanel();}
function peMoveFrame(fromIdx,toIdx){var frame=peFrames.splice(fromIdx,1)[0];var insertAt=fromIdx<toIdx?toIdx-1:toIdx;peFrames.splice(insertAt,0,frame);peCurrentFrame=insertAt;peRenderTimeline();}
function getFrameComposite(frame){var comp=Array(peGridSize).fill().map(function(){return Array(peGridSize).fill('#ffffff00')});for(var li=0;li<frame.layers.length;li++){var layer=frame.layers[li];if(!layer.visible)continue;for(var y=0;y<peGridSize;y++)for(var x=0;x<peGridSize;x++){var o=layer.data[y][x];if(!o||o==='#ffffff00')continue;comp[y][x]=peBlend(comp[y][x],o,layer.blendMode,layer.opacity);}}return comp;}
function peRenderTimeline(){
  var container=document.getElementById('tlFrames');if(!container)return;container.innerHTML='';
  var countEl=document.getElementById('tlFrameCount');if(countEl)countEl.textContent=peFrames.length+' frame'+(peFrames.length>1?'s':'');
  for(var i=0;i<peFrames.length;i++){var frame=peFrames[i];var el=document.createElement('div');el.className='pe-tl-frame'+(i===peCurrentFrame?' active':'');el.dataset.index=i;
    var canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;var ctx=canvas.getContext('2d');var comp=getFrameComposite(frame);var pw=48/peGridSize;
    for(var y=0;y<peGridSize;y++)for(var x=0;x<peGridSize;x++){var c=comp[y][x];if(!c||c==='#ffffff00'){ctx.fillStyle=(x+y)%2===0?'#ddd':'#999';ctx.fillRect(Math.floor(x*pw),Math.floor(y*pw),Math.ceil(pw)+0.5,Math.ceil(pw)+0.5);}else{ctx.fillStyle=c;ctx.fillRect(Math.floor(x*pw),Math.floor(y*pw),Math.ceil(pw)+0.5,Math.ceil(pw)+0.5);}}
    var label=document.createElement('span');label.className='fl';label.textContent=frame.delay+'ms';el.append(canvas,label);
    el.addEventListener('click',function(idx){return function(){peSelectFrame(idx);}}(i));
    label.addEventListener('dblclick',function(idx,fr){return function(e){e.stopPropagation();var inp=document.createElement('input');inp.type='number';inp.value=fr.delay;inp.min=10;inp.max=5000;inp.step=10;inp.style.width='50px';inp.style.fontSize='9px';inp.addEventListener('blur',function(){fr.delay=Math.max(10,Math.min(5000,parseInt(inp.value)||100));peRenderTimeline();});inp.addEventListener('keydown',function(ev){if(ev.key==='Enter')inp.blur();if(ev.key==='Escape')peRenderTimeline();});label.replaceWith(inp);inp.focus();inp.select();}}(i,frame));
    el.draggable=true;el.addEventListener('dragstart',function(idx){return function(e){e.dataTransfer.setData('text/plain',idx);el.classList.add('dragging');}}(i));
    el.addEventListener('dragover',function(e){e.preventDefault();el.classList.add('drag-over');});
    el.addEventListener('dragleave',function(){el.classList.remove('drag-over');});
    el.addEventListener('drop',function(idx){return function(e){e.preventDefault();el.classList.remove('drag-over');var from=parseInt(e.dataTransfer.getData('text/plain'));if(from===idx)return;peMoveFrame(from,idx);peRenderTimeline();}}(i));
    el.addEventListener('dragend',function(){var el2=document.querySelectorAll('.pe-tl-frame');for(var ei=0;ei<el2.length;ei++){el2[ei].classList.remove('dragging','drag-over');}});
    container.appendChild(el);
  }
}
function peTogglePlay(){if(peAnimPlaying)peStopAnim();else pePlayAnim();}
function pePlayAnim(){if(peAnimPlaying||peFrames.length<=1)return;peAnimPlaying=true;peAnimDirection=1;peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);var playBtn=document.getElementById('tlPlay');if(playBtn)playBtn.innerHTML='&#9208;';function tick(){if(!peAnimPlaying)return;var next=peCurrentFrame+peAnimDirection;var loopMode=document.getElementById('tlLoop')?document.getElementById('tlLoop').value:'forward';if(next>=peFrames.length){if(loopMode==='pingpong'){peAnimDirection=-1;next=peFrames.length-2;}else next=0;}else if(next<0){if(loopMode==='pingpong'){peAnimDirection=1;next=1;}else next=peFrames.length-1;}if(next>=0&&next<peFrames.length){peCurrentFrame=next;peLayers=deepCloneLayers(peFrames[next].layers);peRender();peRenderTimeline();}var dly=peFrames[peCurrentFrame]?peFrames[peCurrentFrame].delay:100;peAnimTimer=setTimeout(tick,dly);}tick();}
function peStopAnim(){peAnimPlaying=false;if(peAnimTimer){clearTimeout(peAnimTimer);peAnimTimer=null;}var playBtn=document.getElementById('tlPlay');if(playBtn){playBtn.innerHTML='&#9654;';playBtn.classList.remove('active');}}
function peExportGIF(){if(typeof GIF==='undefined'){showToast('GIF library not loaded');return;}if(peFrames.length<2){showToast('Need 2+ frames for GIF');return;}peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);var gif=new GIF({workers:2,quality:10,width:peGridSize,height:peGridSize,workerScript:'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js'});for(var fi=0;fi<peFrames.length;fi++){var f=peFrames[fi];var comp=getFrameComposite(f);var cvs=document.createElement('canvas');cvs.width=peGridSize;cvs.height=peGridSize;var ctx=cvs.getContext('2d');for(var y=0;y<peGridSize;y++)for(var x=0;x<peGridSize;x++){var col=comp[y][x];if(col&&col!=='#ffffff00'){ctx.fillStyle=col;ctx.fillRect(x,y,1,1);}}gif.addFrame(cvs,{delay:f.delay,copy:true});}gif.on('finished',function(blob){var a=document.createElement('a');a.download='animation.gif';a.href=URL.createObjectURL(blob);a.click();showToast('GIF: '+(blob.size/1024).toFixed(1)+'KB');});gif.render();showToast('Encoding GIF...');}
function peExportSpriteSheet(){if(peFrames.length<2){showToast('Need 2+ frames');return;}peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);var cols=Math.ceil(Math.sqrt(peFrames.length));var rows=Math.ceil(peFrames.length/cols);var scale=4;var cvs=document.createElement('canvas');cvs.width=cols*peGridSize*scale;cvs.height=rows*peGridSize*scale;var ctx=cvs.getContext('2d');for(var fi=0;fi<peFrames.length;fi++){var comp=getFrameComposite(peFrames[fi]);var cx=(fi%cols)*peGridSize*scale;var cy=Math.floor(fi/cols)*peGridSize*scale;for(var y=0;y<peGridSize;y++)for(var x=0;x<peGridSize;x++){var col=comp[y][x];if(col&&col!=='#ffffff00'){ctx.fillStyle=col;ctx.fillRect(cx+x*scale,cy+y*scale,scale,scale);}}}var link=document.createElement('a');link.download='spritesheet.png';link.href=cvs.toDataURL();link.click();var jsonData={frames:{},meta:{image:'spritesheet.png',size:{w:peGridSize,h:peGridSize},scale:scale,frameCount:peFrames.length}};for(var fi2=0;fi2<peFrames.length;fi2++){jsonData.frames['frame_'+fi2]={frame:{x:(fi2%cols)*peGridSize*scale,y:Math.floor(fi2/cols)*peGridSize*scale,w:peGridSize*scale,h:peGridSize*scale},delay:peFrames[fi2].delay};}var jsonBlob=new Blob([JSON.stringify(jsonData,null,2)],{type:'application/json'});var jlink=document.createElement('a');jlink.download='spritesheet.json';jlink.href=URL.createObjectURL(jsonBlob);jlink.click();showToast('Sheet: '+peFrames.length+' frames');}
function peRenderOnion(ctx){
  if(!peOnionEnabled)return;
  if(peCurrentFrame>0&&peOnionPrevAlpha>0){var prevComp=getFrameComposite(peFrames[peCurrentFrame-1]);for(var y=0;y<peGridSize;y++)for(var x=0;x<peGridSize;x++){var c=prevComp[y][x];if(c&&c!=='#ffffff00'){var rgb=hexToRgb(c);ctx.globalAlpha=peOnionPrevAlpha;ctx.fillStyle=rgbToHex(Math.min(255,rgb[0]+60),Math.round(rgb[1]*0.6),Math.round(rgb[2]*0.6));ctx.fillRect(x*pePixelSize,y*pePixelSize,pePixelSize,pePixelSize);}}}
  if(peCurrentFrame<peFrames.length-1&&peOnionNextAlpha>0){var nextComp=getFrameComposite(peFrames[peCurrentFrame+1]);for(var y=0;y<peGridSize;y++)for(var x=0;x<peGridSize;x++){var c=nextComp[y][x];if(c&&c!=='#ffffff00'){var rgb=hexToRgb(c);ctx.globalAlpha=peOnionNextAlpha;ctx.fillStyle=rgbToHex(Math.round(rgb[0]*0.6),Math.min(255,rgb[1]+60),Math.round(rgb[2]*0.6));ctx.fillRect(x*pePixelSize,y*pePixelSize,pePixelSize,pePixelSize);}}}
  ctx.globalAlpha=1;
}
// === PROJECT FILE SYSTEM (.pxs) ===
function peSerializeProject(n){
  return JSON.stringify({
    version:'1.0',name:n||'Untitled',canvas:{width:peGridSize,height:peGridSize},
    frames:peFrames.map(function(f){
      return{name:f.name,delay:f.delay,layers:f.layers.map(function(l){
        return{name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,blendMode:l.blendMode,data:l.data};
      })};
    }),
    created:localStorage.getItem('pxs_created')||new Date().toISOString(),
    modified:new Date().toISOString()
  },null,0);
}
function peDeserializeProject(j){
  try{
    var d=JSON.parse(j);if(!d.frames||!d.frames.length)return showToast('Invalid .pxs'),false;
    peGridSize=d.canvas.width||d.canvas.height||16;
    peFrames=d.frames.map(function(f){return{
      name:f.name||'Frame',delay:f.delay||100,
      layers:f.layers.map(function(l){return{
        name:l.name||'Layer',visible:l.visible!==false,locked:l.locked===true,
        opacity:l.opacity||1,blendMode:l.blendMode||'normal',
        data:l.data||Array(peGridSize).fill().map(function(){return Array(peGridSize).fill('#ffffff00');})
      };})};});
    peCurrentFrame=0;peLayers=peFrames[0].layers.map(function(l){return JSON.parse(JSON.stringify(l));});
    var gs=document.getElementById('peGridSize');if(gs){gs.value=peGridSize;gs.max=256;}
    document.getElementById('peGridSizeVal').textContent=peGridSize;
    peCanvas.width=peGridSize*pePixelSize;peCanvas.height=peGridSize*pePixelSize;
    localStorage.setItem('pxs_created',d.created||new Date().toISOString());
    peHideSelection();peRender();peRenderLayerPanel();peRenderTimeline();peUpdateStatusBar();peSaveState();
    showToast('Loaded: '+(d.name||'project')+' ('+peFrames.length+' frames, '+peLayers.length+' layers)');
    return true;
  }catch(e){return showToast('Failed to load .pxs'),false;}
}
function peSaveProject(){
  peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);
  var json=peSerializeProject(),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.download='project.pxs';a.href=url;a.click();URL.revokeObjectURL(url);
  localStorage.setItem('pxs_autosave',json);localStorage.setItem('pxs_autosave_time',Date.now().toString());
  showToast('Saved '+(blob.size/1024).toFixed(1)+'KB');
}
function peOpenProject(f){
  var r=new FileReader();r.onload=function(e){
    if(peDeserializeProject(e.target.result)){localStorage.setItem('pxs_autosave',e.target.result);localStorage.setItem('pxs_autosave_time',Date.now().toString());}
  };r.readAsText(f);
}
function peNewProject(){if(!confirm('New project? Unsaved changes lost.'))return;localStorage.removeItem('pxs_autosave');localStorage.removeItem('pxs_autosave_time');location.reload();}
function peInitAutoSave(){setInterval(function(){
  peFrames[peCurrentFrame].layers=deepCloneLayers(peLayers);
  var json=peSerializeProject();localStorage.setItem('pxs_autosave',json);localStorage.setItem('pxs_autosave_time',Date.now().toString());
},30000);}
function peCheckRecovery(){
  try{
    var saved=localStorage.getItem('pxs_autosave'),savedTime=parseInt(localStorage.getItem('pxs_autosave_time'))||0;
    if(saved&&(Date.now()-savedTime)<86400000){
      if(confirm('Restore unsaved project from '+new Date(savedTime).toLocaleString()+'?'))return peDeserializeProject(saved),true;
      else localStorage.removeItem('pxs_autosave'),localStorage.removeItem('pxs_autosave_time');
    }
  }catch(e){}
  return false;
}

// === PALETTE GENERATOR ===
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
    const hdr=document.createElement('div');hdr.className='pv-card-header';hdr.innerHTML='<h2>'+meta.label+'</h2><span class="desc">'+meta.desc+'</span>';card.appendChild(hdr);
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
  const tc={dark:{bg:'#1a1a2e',fg:'#e0e0e0',card:'#16213e',border:'#0f3460'},light:{bg:'#f5f5f5',fg:'#222',card:'#fff',border:'#ddd'},highcontrast:{bg:'#000',fg:'#fff',card:'#111',border:'#ff0'}};
  const t=tc[pvTheme]||tc.dark;document.querySelectorAll('.pv-preview-card').forEach(c=>{c.style.background=t.card;c.style.borderColor=t.border;c.style.color=t.fg;});document.querySelectorAll('.pv-ptext').forEach(el=>el.style.color=t.fg);
}
function pvUpdateCSS(hex,palettes){
  const lines=[':root {','  --primary: '+hex+';'];pvMeta.forEach(meta=>{const cols=palettes[meta.key];if(cols)cols.forEach((c,i)=>{lines.push('  --'+meta.key.replace('Complementary','comp').replace('SplitComp','split')+'-'+(i+1)+': '+c+';');});});lines.push('}');
  const cssBox=document.getElementById('pvCss');if(cssBox)cssBox.textContent=lines.join('\n');
}

// Palette events
document.getElementById('pvColorPicker')?.addEventListener('input',e=>{const hex=e.target.value;document.getElementById('pvHexInput').value=hex;document.getElementById('pvColorPreview').style.background=hex;pvRender(hex);AppState.currentColor=hex;});
document.getElementById('pvHexInput')?.addEventListener('input',e=>{let val=e.target.value.trim();if(!val.startsWith('#'))val='#'+val;if(/^#[0-9a-fA-F]{6}$/.test(val)){document.getElementById('pvColorPicker').value=val;document.getElementById('pvColorPreview').style.background=val;pvRender(val);AppState.currentColor=val;}});
document.getElementById('pvHexInput')?.addEventListener('blur',()=>{let val=document.getElementById('pvHexInput').value.trim();if(!val.startsWith('#'))val='#'+val;if(!/^#[0-9a-fA-F]{6}$/.test(val))document.getElementById('pvHexInput').value=document.getElementById('pvColorPicker').value;});
document.getElementById('pvCss')?.addEventListener('click',()=>{navigator.clipboard.writeText(document.getElementById('pvCss').textContent).then(()=>showToast('Copied CSS'));});
document.getElementById('pvSendToEditor')?.addEventListener('click',()=>{if(pvColors.length>0){AppState.sharedPalette=pvColors;showToast('Sent '+pvColors.length+' colors to Editor');document.getElementById('navPixel')?.click();peBuildPalette();}});
document.querySelectorAll('[data-pvtheme]').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('[data-pvtheme]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');pvTheme=btn.dataset.pvtheme;pvRender(document.getElementById('pvColorPicker').value);});});

// IndexedDB
const DB_NAME='PixelStudioDB',DB_VER=1,STORE='palettes';
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VER);req.onupgradeneeded=(e)=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});};req.onsuccess=e=>resolve(e.target.result);req.onerror=e=>reject(e.target.error);});}
function dbSavePalette(colors,name){return dbOpen().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add({name:name||'Palette '+new Date().toLocaleString(),colors:colors,created:Date.now()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=e=>reject(e.target.error);}));}
function dbLoadPalettes(){return dbOpen().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>{db.close();resolve(req.result);};req.onerror=e=>reject(e.target.error);}));}
function dbDeletePalette(id){return dbOpen().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=e=>reject(e.target.error);}));}

document.getElementById('pvSavePalette')?.addEventListener('click',()=>{if(!pvColors.length)return;const name=prompt('Palette name:','My Palette');if(!name)return;dbSavePalette(pvColors,name).then(()=>showToast('Palette saved!')).catch(()=>showToast('Failed to save'));});
document.getElementById('pvLoadPalettes')?.addEventListener('click',()=>{
  const area=document.getElementById('pvSavedArea');
  if(area.style.display==='block'){area.style.display='none';return;}
  dbLoadPalettes().then(palettes=>{
    const list=document.getElementById('pvSavedList');list.innerHTML='';
    if(!palettes||palettes.length===0){list.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:8px">No saved palettes</div>';}
    else{palettes.forEach(p=>{
      const item=document.createElement('div');item.className='pv-saved-item';
      const minis=document.createElement('div');minis.className='s-minis';(p.colors||[]).slice(0,8).forEach(c=>{const m=document.createElement('div');m.className='s-mini';m.style.background=c;minis.appendChild(m);});
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
    for(let i=0;i<data.length;i+=16){const r=Math.round(data[i]/32)*32,g=Math.round(data[i+1]/32)*32,b=Math.round(data[i+2]/32)*32,a=data[i+3];if(a<128)continue;colorMap[r+','+g+','+b]=(colorMap[r+','+g+','+b]||0)+1;}
    const sorted=Object.entries(colorMap).sort((a,b)=>b[1]-a[1]);
    const top8=sorted.slice(0,8).map(([key])=>{const[r,g,b]=key.split(',').map(Number);return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');});
    if(top8.length>0){AppState.sharedPalette=top8;showToast('Extracted '+top8.length+' colors');document.getElementById('navPixel')?.click();peBuildPalette();}
  };
  img.onerror=()=>showToast('Failed to read image');
  img.src=URL.createObjectURL(file);this.value='';
});

// PWA
if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
var deferredPrompt;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.add('show');});
document.getElementById('installBtn')?.addEventListener('click',function(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;document.getElementById('installBtn').classList.remove('show');}});

// INIT
peInit();peBuildPalette();peSelectColor('#4fc3f7');
document.getElementById('peGrid')?.classList.add('active');peUpdateBtn();
document.getElementById('pvColorPreview').style.background='#4fc3f7';
pvRender('#4fc3f7');
peInitAutoSave();

window.__debug={
  getData:()=>peLayers[peActiveLayer]?.data,
  getLayers:()=>peLayers.map(l=>({name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,blendMode:l.blendMode})),
  getLayerData:(i)=>peLayers[i]?.data,
  getActiveLayer:()=>peActiveLayer,
  getComposite:()=>peGetComposite(),
  getCompositePixel:(x,y)=>peGetCompositePixel(x,y),
  getHistory:()=>({history:peHistory.length,idx:peHistoryIdx}),
  getSelection:()=>peSelection,
  getCanvasSize:()=>({w:peGridSize,h:peGridSize,zoom:pePixelSize}),
  getTool:()=>peTool,
  getBrushSize:()=>peBrushSize,
  getFrames:()=>peFrames.map(function(f){return{name:f.name,delay:f.delay,layers:f.layers.length};}),getCurrentFrame:()=>peCurrentFrame,getFrameCount:()=>peFrames.length,isAnimPlaying:()=>peAnimPlaying,getOnion:()=>({enabled:peOnionEnabled,prevAlpha:peOnionPrevAlpha,nextAlpha:peOnionNextAlpha}),selectFrame:(i)=>peSelectFrame(i),addFrame:peAddFrame,deleteFrame:(i)=>peDeleteFrame(i),playAnim:pePlayAnim,stopAnim:peStopAnim,exportGIF:peExportGIF,exportSheet:peExportSpriteSheet,saveProject:peSaveProject,openProject:peOpenProject,newProject:peNewProject,
  getSpray:()=>({density:peSprayDensity,radius:peSprayRadius}),
  getSymmetry:()=>({enabled:peSymmetry,mode:peSymmetryMode}),
  getBlendModes:()=>BLEND_MODES,
  setActiveLayer:(i)=>{if(i>=0&&i<peLayers.length){peActiveLayer=i;peRenderLayerPanel();}}
};
console.log('Pixel Studio v0.7.0 loaded. Layers enabled. Use window.__debug for verification.');






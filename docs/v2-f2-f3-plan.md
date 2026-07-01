# Pixel Studio — F-2 & F-3 全量实施计划

**基线**: v2.0.0-pre (app.js 64.9KB, 787 行, Tauri 项目就绪)
**目标**: Web 可访问 + 可扩展

---

## F-2: Web 分发 (GitHub Pages + PWA)

### 交付物清单

```
.github/workflows/pages.yml    ← GitHub Pages 自动部署
.github/workflows/lighthouse.yml ← 性能审计自动化
styles.css                     ← 从 index.html 提取的独立样式表
screenshots/*.png              ← PWA 截图 (editor/palette/mobile)
manifest.json                  ← 更新截图和描述
index.html                     ← 关键 CSS 内联、外链样式
sw.js                          ← 优化缓存策略
```

### F2-1: GitHub Pages 部署

#### 流程
```
[推送到 main] → [GitHub Actions 触发] → [上传 artifact] → [部署到 Pages]
     ↓                                                       ↓
  git push origin main                     https://redrighthand05.github.io/pixel-studio/
```

#### 配置文件 (.github/workflows/pages.yml)

```yaml
name: Deploy to Pages
on:
  push:
    branches: ["main"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: "pages"
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: "."
      - id: deployment
        uses: actions/deploy-pages@v4
```

#### 所需 GitHub 设置
- 仓库 → Settings → Pages → Source: "GitHub Actions"
- 仓库 → Settings → Environments → "github-pages" 需要批准

### F2-2: CSS 提取与压缩

当前 index.html 内联 ~19KB CSS。改为外链：

#### 操作步骤
1. 从 `<style>...</style>` 提取所有 CSS → `styles.css`
2. 使用 csso 或 clean-css 压缩
3. 在 `<head>` 中链接 `<link rel="stylesheet" href="styles.css">`
4. 关键渲染路径 CSS (首屏必需样式) 仍内联

#### 关键 CSS 内容
```
:root 变量定义               ← 保留内联
布局 (flex, grid 规则)       ← 保留内联
组件样式                     ← 外链
@media 查询                  ← 外链
```

#### 压缩预期
```
当前: ~19KB 内联 CSS
优化后: ~12KB 外链 (可缓存) + ~2KB 关键 CSS 内联
总计: ~14KB (-26%)
```

### F2-3: 性能优化

#### 优化清单

| 指标 | 当前 | 目标 | 措施 |
|------|------|------|------|
| First Contentful Paint | - | < 1.5s | 关键 CSS 内联 |
| Largest Contentful Paint | - | < 2.5s | JS 延迟加载 |
| Cumulative Layout Shift | - | < 0.1 | 显式尺寸 |
| Time to Interactive | - | < 3.0s | 非阻塞 JS |
| Total Blocking Time | - | < 200ms | 拆分长任务 |
| Lighthouse Performance | - | >= 90 | 综合 |

#### JavaScript 优化

当前 app.js 65KB 单文件。不拆分模块，改为：

1. **移除 gif.js CDN 依赖** — GIF 编码器改为动态加载
```js
// 当前: <script src="gif.js CDN">
// 改为: 
async function loadGifEncoder() {
    const module = await import("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js");
    return module.default;
}
```

2. **关键路径分离**
```html
<!-- 关键: 立即执行 -->
<script src="app.js"></script>

<!-- 非关键: 延迟加载 -->
<script defer>
async function loadNonCritical() {
    await import("./palette-gen.js");
    await import("./editor-anim.js");
}
</script>
```

3. **压缩**
- 使用 UglifyJS 或 terser 压缩 app.js
- 预期: 65KB → ~25KB (gzip 后 ~8KB)

### F2-4: PWA 增强

#### 截图 (manifest.json)

```json
"screenshots": [
    {
        "src": "screenshots/editor.png",
        "sizes": "1280x800",
        "type": "image/png",
        "form_factor": "wide",
        "label": "Pixel Editor with layers and animation timeline"
    },
    {
        "src": "screenshots/mobile.png",
        "sizes": "390x844",
        "type": "image/png",
        "form_factor": "narrow",
        "label": "Mobile pixel art editor"
    }
]
```

截图需要手动截图后存入 screenshots/ 目录。

#### Service Worker 升级

当前策略：
```
install: 缓存所有静态资源
fetch: 缓存优先 → 网络回退
```

优化策略：
```
install: 缓存关键资源 (app.js, index.html, styles.css)
fetch: Stale-while-revalidate + 网络优先 (gif.js CDN)
activate: 清理旧缓存 + 立即接管页面
```

#### 添加处理程序声明

```json
"display_override": ["window-controls-overlay", "standalone"],
"handle_links": "auto",
"launch_handler": {
    "client_mode": ["navigate-existing", "auto"]
}
```

### F2-5: Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse
on: [push]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Audit URL
        uses: treosh/lighthouse-ci-action@v11
        with:
          url: "https://redrighthand05.github.io/pixel-studio/"
          uploadArtifacts: true
          temporaryPublicStorage: true
```

### F2-6: SEO & Sharing

```html
<!-- Open Graph (社交分享预览) -->
<meta property="og:title" content="Pixel Studio">
<meta property="og:description" content="Free pixel art editor with layers, animation, and palette generator">
<meta property="og:image" content="https://redrighthand05.github.io/pixel-studio/icon.svg">
<meta property="og:url" content="https://redrighthand05.github.io/pixel-studio/">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Pixel Studio">
<meta name="twitter:description" content="Free pixel art editor">

<!-- Structured Data (搜索引擎) -->
<script type="application/ld+json">
{
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Pixel Studio",
    "operatingSystem": "Any",
    "browserRequirements": "Chrome, Edge, Firefox, Safari",
    "applicationCategory": "Multimedia",
    "offers": { "@type": "Offer", "price": "0" }
}
</script>
```

---

## F-3: 插件系统

### 设计目标

1. 第三方开发者可以注册自定义工具、滤镜、导出格式
2. 插件是标准的 ES Module，通过 script 标签或动态 import 加载
3. 内置至少 2 个示例插件
4. 插件市场概念：JSON 索引文件，可发现可安装

### F3-1: 插件 API

#### 插件对象格式

```js
// 标准插件结构
{
    name: "My Plugin",
    version: "1.0.0",
    description: "Description of what this plugin does",
    author: "Developer Name",

    // 可选: 工具注册
    tools: [
        {
            id: "custom-brush",
            name: "Custom Brush",
            icon: "\u2728",  // 单个 emoji 或 SVG
            shortcut: "Ctrl+Shift+B",
            onPointerDown(x, y) { },
            onPointerMove(x, y) { },
            onPointerUp(x, y) { }
        }
    ],

    // 可选: 滤镜注册
    filters: [
        {
            id: "blur",
            name: "Pixel Blur",
            params: [
                { key: "radius", label: "Radius", type: "number", default: 3 }
            ],
            apply(layerData, params) {
                // layerData: string[][]
                // 返回新的 layerData
            }
        }
    ],

    // 可选: 导出格式注册
    exportFormats: [
        {
            name: "BMP",
            extension: ".bmp",
            mimeType: "image/bmp",
            export(canvas, frames) { }
        }
    ],

    // 可选: 调色板格式注册
    paletteFormats: [
        {
            name: "GIMP Palette",
            extension: ".gpl",
            parse(text) { return colors[]; },
            stringify(colors) { return text; }
        }
    ]
}
```

#### 核心注册表

```js
// plugin-loader.js
const PixelStudioPlugin = {
    _plugins: [],

    register(plugin) {
        if (this._plugins.find(p => p.name === plugin.name)) {
            console.warn("Plugin already registered:", plugin.name);
            return false;
        }
        plugin._id = "plugin_" + Date.now();
        this._plugins.push(plugin);
        this._activate(plugin);
        return true;
    },

    unregister(name) {
        const idx = this._plugins.findIndex(p => p.name === name);
        if (idx >= 0) {
            this._deactivate(this._plugins[idx]);
            this._plugins.splice(idx, 1);
            return true;
        }
        return false;
    },

    _activate(plugin) {
        // 注册工具
        if (plugin.tools) {
            plugin.tools.forEach(tool => {
                window.__pluginTools = window.__pluginTools || {};
                window.__pluginTools[tool.id] = tool;
                this._createToolButton(tool);
            });
        }
        // 注册滤镜
        if (plugin.filters) {
            plugin.filters.forEach(filter => {
                window.__pluginFilters = window.__pluginFilters || {};
                window.__pluginFilters[filter.id] = filter;
            });
        }
        // 注册导出格式
        if (plugin.exportFormats) {
            plugin.exportFormats.forEach(fmt => {
                window.__pluginExportFormats = window.__pluginExportFormats || {};
                window.__pluginExportFormats[fmt.extension] = fmt;
            });
        }
        showToast("Plugin loaded: " + plugin.name);
    },

    _createToolButton(tool) {
        // 在工具栏添加新按钮
        const toolbar = document.querySelector(".pe-toolbar");
        const sep = document.createElement("div");
        sep.className = "pe-toolbar-sep";
        const btn = document.createElement("button");
        btn.className = "pe-btn";
        btn.dataset.peTool = tool.id;
        btn.innerHTML = tool.icon || "?";
        btn.title = tool.name + (tool.shortcut ? " (" + tool.shortcut + ")" : "");
        btn.addEventListener("click", () => {
            // 切换到此工具
            document.querySelectorAll("[data-pe-tool]").forEach(b => b.classList.remove("active"));
            document.querySelectorAll("[data-pe-tool]").forEach(b => b.dataset.peTool === tool.id);
            btn.classList.add("active");
            // 工具逻辑
        });
        toolbar.appendChild(sep);
        toolbar.appendChild(btn);
    },

    getTools() { return this._plugins.flatMap(p => p.tools || []); },
    getFilters() { return this._plugins.flatMap(p => p.filters || []); },
    getExportFormats() { return this._plugins.flatMap(p => p.exportFormats || []); },
    list() { return this._plugins.map(p => ({ name: p.name, version: p.version, tools: (p.tools||[]).length, filters: (p.filters||[]).length })); }
};

// 挂载到全局
window.PixelStudioPlugin = PixelStudioPlugin;
```

### F3-2: 插件加载方式

#### 方式 1: HTML 脚本标签 (静态)

```html
<script src="plugins/dither-master.js"></script>
```

插件文件末尾调用:
```js
PixelStudioPlugin.register({
    name: "Dither Master",
    version: "1.0.0",
    // ...
});
```

#### 方式 2: 动态加载 (从 URL)

```js
async function loadPluginFromURL(url) {
    try {
        const module = await import(url);
        if (module.default) {
            PixelStudioPlugin.register(module.default);
        } else {
            showToast("Invalid plugin: no default export");
        }
    } catch (e) {
        showToast("Failed to load plugin: " + e.message);
    }
}
```

#### 方式 3: 从 IndexedDB 加载已安装插件

```js
async function loadInstalledPlugins() {
    const db = await dbOpen();
    const tx = db.transaction("plugins", "readonly");
    const installed = await new Promise(resolve => {
        const req = tx.objectStore("plugins").getAll();
        req.onsuccess = () => resolve(req.result);
    });
    installed.forEach(p => {
        try {
            const fn = new Function(p.code + "; return " + p.exportName + ";");
            PixelStudioPlugin.register(fn());
        } catch (e) {
            console.error("Failed to load installed plugin:", p.name, e);
        }
    });
}
```

### F3-3: 内置示例插件

#### 示例 1: 抖动滤镜插件

```js
// plugins/dither-filters.js
PixelStudioPlugin.register({
    name: "Dither Filters",
    version: "1.0.0",
    description: "Floyd-Steinberg and Bayer matrix dithering",
    author: "Pixel Studio Team",

    filters: [
        {
            id: "floyd-steinberg",
            name: "Floyd-Steinberg Dither",
            params: [
                { key: "levels", label: "Levels per channel", type: "number", default: 4, min: 2, max: 16 }
            ],
            apply(data, params) {
                const levels = params.levels || 4;
                const factor = 256 / levels;
                const error = {};

                for (let y = 0; y < data.length; y++) {
                    for (let x = 0; x < data[y].length; x++) {
                        const oldPixel = data[y][x];
                        if (!oldPixel || oldPixel === "#ffffff00") continue;

                        const [r, g, b] = hexToRgb(oldPixel);
                        const newR = Math.round(Math.round(r / factor) * factor);
                        const newG = Math.round(Math.round(g / factor) * factor);
                        const newB = Math.round(Math.round(b / factor) * factor);
                        data[y][x] = rgbToHex(newR, newG, newB);

                        const errR = r - newR;
                        const errG = g - newG;
                        const errB = b - newB;

                        // Floyd-Steinberg 误差扩散矩阵
                        const distribute = (dx, dy, w) => {
                            const nx = x + dx, ny = y + dy;
                            if (ny < data.length && nx >= 0 && nx < data[ny].length) {
                                const p = data[ny][nx];
                                if (p && p !== "#ffffff00") {
                                    const [pr, pg, pb] = hexToRgb(p);
                                    data[ny][nx] = rgbToHex(
                                        Math.max(0, Math.min(255, pr + errR * w)),
                                        Math.max(0, Math.min(255, pg + errG * w)),
                                        Math.max(0, Math.min(255, pb + errB * w))
                                    );
                                }
                            }
                        };
                        distribute(1, 0, 7/16);
                        distribute(-1, 1, 3/16);
                        distribute(0, 1, 5/16);
                        distribute(1, 1, 1/16);
                    }
                }
                return data;
            }
        }
    ]
});
```

#### 示例 2: 调色板互通插件

```js
// plugins/palette-exchange.js
PixelStudioPlugin.register({
    name: "Palette Exchange",
    version: "1.0.0",
    description: "Import and export GIMP/Adobe palette formats",
    author: "Pixel Studio Team",

    paletteFormats: [
        {
            name: "GIMP Palette",
            extension: ".gpl",
            parse(text) {
                const colors = [];
                const lines = text.split("\n");
                let inColors = false;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("#")) continue;
                    if (trimmed === "") continue;
                    if (trimmed.toLowerCase().startsWith("gimp palette")) { inColors = true; continue; }
                    if (trimmed.toLowerCase().startsWith("name:")) continue;
                    if (trimmed.toLowerCase().startsWith("columns:")) continue;
                    if (inColors) {
                        const parts = trimmed.split(/\s+/);
                        if (parts.length >= 3) {
                            const r = parseInt(parts[0]), g = parseInt(parts[1]), b = parseInt(parts[2]);
                            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                                colors.push(rgbToHex(r, g, b));
                            }
                        }
                    }
                }
                return colors;
            },
            stringify(colors) {
                let text = "GIMP Palette\nName: Pixel Studio Export\nColumns: 8\n#\n";
                colors.forEach(c => {
                    const [r, g, b] = hexToRgb(c);
                    text += r + " " + g + " " + b + " Untitled\n";
                });
                return text;
            }
        }
    ]
});
```

### F3-4: 插件管理器 UI

在设置/帮助区域新增插件管理页面：

```
┌──────────────────────────────────────┐
│  Plugins (3 loaded)                  │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Dither Filters  v1.0.0    [x]   │ │
│ │ Floyd-Steinberg, Bayer dither   │ │
│ │ Tools: 0 | Filters: 1           │ │
│ ├──────────────────────────────────┤ │
│ │ Palette Exchange v1.0.0   [x]   │ │
│ │ GIMP/Adobe palette import/export │ │
│ │ Formats: 1                      │ │
│ ├──────────────────────────────────┤ │
│ │ Color Extractor  v1.0.0  [x]    │ │
│ │ Extract palette from image       │ │
│ │ Filters: 1                      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Load from URL...]  [Browse...]      │
└──────────────────────────────────────┘
```

#### 插件面板 HTML

```html
<div class="modal-overlay" id="pluginManager">
  <div class="modal-box" style="max-width:520px;max-height:80vh;overflow-y:auto">
    <h2>Plugins</h2>
    <div id="pluginList"></div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <input type="text" id="pluginUrl" placeholder="https://..." style="flex:1">
      <button class="m-primary" id="pluginLoadUrl">Load</button>
      <button class="m-cancel" id="pluginBrowse">Browse...</button>
    </div>
    <div class="modal-actions">
      <button class="m-primary" onclick="document.getElementById('pluginManager').classList.remove('show')">Close</button>
    </div>
  </div>
</div>
```

### F3-5: 插件市场概念

#### 市场索引 JSON

```
https://redrighthand05.github.io/pixel-studio/plugins/index.json
```

格式:
```json
[
    {
        "name": "Dither Filters",
        "version": "1.0.0",
        "description": "Advanced dithering algorithms",
        "author": "Community",
        "url": "https://example.com/plugins/dither-filters.js",
        "icon": "https://example.com/plugins/icon.png",
        "features": { "tools": 0, "filters": 1, "formats": 0 },
        "downloads": 42,
        "updated": "2026-07-01"
    }
]
```

#### 市场 UI (在插件管理器中)

```
┌──────────────────────────────────────┐
│  Discover Plugins                    │
├──────────────────────────────────────┤
│  Search: [.......................]   │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ [icon] Dither Filters           │ │
│ │        Floyd-Steinberg + Bayer  │ │
│ │        v1.0.0  |  42 downloads  │ │
│ │                          [Install]│ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### F3-6: 插件安全

| 风险 | 缓解措施 |
|------|----------|
| 恶意插件读取像素数据 | 插件在与主程序相同的上下文中运行，无法隔离 |
| 恶意插件修改 DOM | API 只暴露有限的接口，不直接给 DOM 引用 |
| 无限循环/崩溃 | 滤镜操作超时保护 (setTimeout 中断) |
| 插件冲突 | 注册时检查 name 唯一性 |

#### 超时保护

```js
function runFilterWithTimeout(filter, data, params, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Filter timed out"));
        }, timeoutMs || 5000);
        try {
            const result = filter.apply(data, params);
            clearTimeout(timer);
            resolve(result);
        } catch (e) {
            clearTimeout(timer);
            reject(e);
        }
    });
}
```

---

## 实施路线图

### Day 1: GitHub Pages

```
1. 创建 .github/workflows/pages.yml
2. 提交并推送到 main
3. 在 GitHub 仓库设置中启用 Pages (Actions)
4. 验证 https://redrighthand05.github.io/pixel-studio/ 可访问
```

### Day 2: CSS 提取 + PWA

```
5. 从 index.html 提取 CSS 到 styles.css
6. 压缩 styles.css (csso)
7. 关键 CSS 内联 + 外链
8. 更新 manifest.json (截图、处理程序)
9. 优化 service worker
10. 验证 Lighthouse 分数
```

### Day 3: Plugin System 核心

```
11. 创建 plugin-loader.js
12. 实现 PixelStudioPlugin 注册表
13. 实现 _activate 逻辑 (工具/滤镜/导出)
14. 实现 _createToolButton
15. 添加插件管理器 UI (模态框)
16. 实现 3 种加载方式
```

### Day 4: 示例插件 + 市场

```
17. 编写 dither-filters.js 插件
18. 编写 palette-exchange.js 插件
19. 创建 plugins/index.json 市场索引
20. 市场发现 UI
21. 超时保护
22. 端到端测试
```

---

## 文件新增/变更清单

```
.github/
├── workflows/
│   ├── pages.yml          ← NEW (30行)
│   └── lighthouse.yml     ← NEW (25行)

根目录:
├── styles.css             ← NEW (从 index.html 提取)
├── plugins/
│   ├── index.json         ← NEW (市场索引)
│   ├── dither-filters.js  ← NEW (示例插件)
│   └── palette-exchange.js ← NEW (示例插件)

index.html:
├── <style> 缩减 (关键 CSS 内联)
├── <link rel="stylesheet" href="styles.css">
├── <meta property="og:..."> (社交分享)
├── <script type="application/ld+json"> (结构化数据)
└── 插件管理器 HTML

app.js:
├── plugin-loader.js 逻辑 (或单独文件)
├── 动态导入 gif.js (移除 CDN script 标签)
└── 插件相关事件绑定

screenshots/
├── editor.png            ← NEW (手动截取)
├── palette.png           ← NEW (手动截取)
└── mobile.png            ← NEW (手动截取)
```

---

## 预估工作量

| 模块 | 新增代码 | 预计耗时 |
|------|----------|----------|
| GitHub Pages 部署 | 30 行 yml | 15 分钟 |
| CSS 提取与压缩 | 100 行 (CSS + HTML 调整) | 30 分钟 |
| PWA 优化 (manifest + SW) | 20 行 | 15 分钟 |
| SEO 标签 | 20 行 | 10 分钟 |
| Lighthouse CI | 25 行 yml | 10 分钟 |
| 插件加载器 | 150 行 JS | 45 分钟 |
| 插件管理器 UI | 60 行 HTML + JS | 30 分钟 |
| 示例插件 (抖动) | 80 行 JS | 30 分钟 |
| 示例插件 (调色板) | 60 行 JS | 20 分钟 |
| 插件市场 | 40 行 JS + JSON | 20 分钟 |
| 安全/超时保护 | 20 行 JS | 10 分钟 |
| **合计** | **~605 行** | **~4 小时** |

---

## 关键决策

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| CSS 方案 | 内联全部 / 外链 / 关键内联+外链 | 关键内联+外链 | 平衡 FCP 与缓存 |
| JS 加载 | 单文件 / ESM 拆分 / 动态加载 | 单文件+动态 import | 保持简单，非关键功能延迟加载 |
| 插件格式 | UMD / ESM / 全局对象 | ESM + 全局对象 | 兼容静态和动态加载 |
| 插件隔离 | iframe / Worker / 无隔离 | 无隔离 (同上下文) | 简单，插件需信任 |
| 插件存储 | IndexedDB / localStorage / 文件系统 | IndexedDB | 容量大，支持结构化查询 |
| CDN gif.js | script 标签 / 动态 import | 动态 import | 移除阻塞加载 |

---

## F-2 + F-3 完成后项目全景

```
github.com/REDrighthand05/pixel-studio
├── app.js                 ← 65KB, 787 行
├── index.html             ← 精简优化
├── styles.css             ← 独立可缓存
├── manifest.json          ← PWA 含截图
├── sw.js                  ← 优化缓存策略
├── plugin-loader.js       ← 插件系统核心
├── plugins/               ← 插件目录
│   ├── index.json         ← 市场索引
│   ├── dither-filters.js  ← 示例
│   └── palette-exchange.js ← 示例
├── screenshots/           ← PWA 截图
├── .github/workflows/     ← CI/CD
│   ├── pages.yml          ← Pages 自动部署
│   └── lighthouse.yml     ← 性能审计
├── src-tauri/             ← Tauri 桌面版
└── README.md              ← 更新
```

访问: https://redrighthand05.github.io/pixel-studio/

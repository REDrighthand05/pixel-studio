## Phase C — 动画引擎 (目标 v0.7)

**构建在图层系统之上。每帧 = 一组图层状态。动画 = 帧序列。**

### C1. 帧数据结构

`js
let peFrames = [
  {
    name: 'Frame 1',
    delay: 100,          // 毫秒
    layers: [...]        // 完整的图层快照 (同 Phase B 结构)
  }
]
let peCurrentFrame = 0
let peAnimPlaying = false
let peAnimLoop = true
let peAnimTimer = null
`

### C2. 帧时间线 UI

`
┌─────────────────────────────────────────┐
│ ◀ ▶ ⏹  FPS: 10   [Loop: 🔁]  [+][×]  │  ← 播放控制 + 帧操作
├─────────────────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │
│ │F1│→│F2│→│F3│→│F4│→│F5│  ...         │  ← 帧缩略图 + 延迟标签
│ └──┘ └──┘ └──┘ └──┘ └──┘              │
│  100ms 150ms 100ms  80ms 100ms          │
├─────────────────────────────────────────┤
│ Onion Skin: [━━━━●━━━]  前帧: 50% 后帧: 30% │
└─────────────────────────────────────────┘
`

帧时间线放在底部，替换或扩展状态栏区域。

### C3. 洋葱皮 (Onion Skinning)

在绘制当前帧时，半透明显示前后帧的内容：
- 前一帧：以 50% 不透明度叠加（默认红色调）
- 后一帧：以 30% 不透明度叠加（默认绿色调）
- 滑条控制前后帧透明度
- 仅参考显示，不写入像素数据

### C4. 动画播放引擎

`js
function pePlayAnim() {
  peAnimPlaying = true
  let frameIdx = peCurrentFrame
  function nextFrame() {
    if (!peAnimPlaying) return
    peCurrentFrame = (frameIdx + 1) % peFrames.length
    if (peCurrentFrame === 0 && !peAnimLoop) { peStopAnim(); return }
    peLoadFrame(peCurrentFrame)
    peAnimTimer = setTimeout(nextFrame, peFrames[peCurrentFrame].delay)
  }
  nextFrame()
}
`

### C5. GIF 导出

依赖：一个纯 JS GIF 编码器。方案：

1. **gif.js 库**（推荐）— https://github.com/jnordberg/gif.js，纯 JS，约 12KB 压缩
   或
2. **自实现最小 GIF 编码器** — LZW 压缩 + GIF 头格式，大约 5KB，但需要自行维护

采用方案 1（gif.js），原因：
- 成熟稳定，被 Aseprite Web 版等使用
- 量化器（颜色表优化）内置
- 支持每帧延迟、无限循环
- MIT 许可证

`js
// 伪代码
async function peExportGIF() {
  const gif = new GIF({ workers: 2, quality: 10, width: peGridSize, height: peGridSize })
  for (const frame of peFrames) {
    // 每帧渲染到 offscreen canvas
    const canvas = peRenderFrameToCanvas(frame)
    gif.addFrame(canvas, { delay: frame.delay, copy: true })
  }
  gif.on('finished', (blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = 'animation.gif'
    a.href = url
    a.click()
  })
  gif.render()
}
`

### C6. 精灵表 (Sprite Sheet) 导出

将所有帧按行排列为一张 PNG：

`
┌─────┬─────┬─────┬─────┐
│ F1  │ F2  │ F3  │ F4  │
├─────┼─────┼─────┼─────┤
│ F5  │ F6  │ F7  │ F8  │
└─────┴─────┴─────┴─────┘
`

JSON 数据文件伴随导出：

`json
{
  "frames": {
    "frame_0": { "frame": { "x": 0, "y": 0, "w": 16, "h": 16 } },
    "frame_1": { "frame": { "x": 16, "y": 0, "w": 16, "h": 16 } }
  },
  "meta": { "size": { "w": 16, "h": 16 }, "scale": 1 }
}
`

### C7. 帧操作

- 添加帧：复制当前帧所有图层数据
- 删除帧：移除帧，调整后续索引
- 复制帧：深拷贝
- 移动帧：修改帧顺序
- 清空帧：所有图层数据清为透明
- 帧延迟：双击编辑毫秒数

---

## Phase D — 工程化与 v1.0

这是"成熟软件"的最后一步。

### D1. 项目文件格式 (.pxs)

`json
{
  "version": "1.0",
  "name": "My Artwork",
  "canvas": { "width": 16, "height": 16 },
  "frames": [
    {
      "delay": 100,
      "layers": [
        {
          "name": "Layer 1",
          "visible": true,
          "locked": false,
          "opacity": 1.0,
          "blendMode": "normal",
          "data": [ [...], [...] ]
        }
      ]
    }
  ],
  "created": "2026-07-02T12:00:00Z",
  "modified": "2026-07-02T14:30:00Z"
}
`

.pxs = 压缩 JSON (用 pako 或内置 CompressionStream) + 可选的 PNG 预览图

### D2. 自动恢复

- IndexedDB 自动保存每 30s (或每次操作后 5s 防抖)
- 崩溃后打开时检测 utorecover.pxs 是否存在
- 弹出提示："检测到未保存的恢复数据，是否恢复？"

`js
const AUTOSAVE_KEY = 'pixelstudio_autosave'
function peAutoSave() {
  const data = peSerializeProject()
  // 压缩存储到 IndexedDB
  localStorage.setItem(AUTOSAVE_KEY, data)
}
`

### D3. 代码重构

**拆分为 ES Module：**

`
app.js (38KB) → 拆分为:
├── editor-core.js    (渲染引擎 + 像素操作)
├── editor-tools.js   (全部 10+ 种工具)
├── editor-layers.js  (图层管理)
├── editor-anim.js    (动画引擎)
├── palette-gen.js    (调色板生成器)
├── storage.js        (IndexedDB + .pxs 序列化)
├── ui.js             (UI 交互: 模态框/菜单/Toast)
└── app.js            (入口 + 初始化)
`

使用 <script type="module"> 加载。每个模块导出特定功能集。

### D4. PWA 加固

- 完整图标集：96/128/192/256/512 SVG 或 PNG
- screenshots 数组在 manifest 中（展示截图）
- Service Worker 策略从 cache-first 改为 stale-while-revalidate（更快更新）
- 桌面 PWA 窗口控制（标题栏适配宽屏）

### D5. CSS 主题系统完善

- CSS 变量覆盖范围扩展至所有组件
- 全局主题切换（暗色/亮色/高对比）
- 自定义强调色

---

## Phase E — 高级工具 (v1.1 → v1.5)

### E1. 对称工具

| 模式 | 描述 |
|------|------|
| Vertical | 垂直镜像，左右对称绘制 |
| Horizontal | 水平镜像，上下对称绘制 |
| Both | 水平和垂直同时 |
| Radial | 四向/八向径向对称 |

实现：在 peSet / peSetBrush 中根据对称模式在对称位置调用 peSet(x_sym, y_sym, color)

### E2. 抖动 (Dithering)

- **图案抖动**：预定义 4×4 Bayer 矩阵
- **Floyd-Steinberg 误差扩散**：将颜色误差扩散到相邻像素
- 应用于：将全色图像降为调色板颜色时

### E3. HSL 调整

- 色相偏移（-180° ~ +180°）
- 饱和度缩放（0% ~ 200%）
- 明度偏移（-100% ~ +100%）
- 应用到：选区 / 激活层 / 所有层

### E4. 描边/轮廓工具

自动检测像素块边缘并添加描边线条（类似 Aseprite 的 Outline）。

算法：对于每个非透明像素，检查 4 邻域，如果邻居是透明则在该方向绘制描边色。

### E5. 调色板互通

导入/导出格式：

| 格式 | 用途 | 支持 |
|------|------|------|
| ASE | Adobe Swatch Exchange | Photoshop/Illustrator/InDesign |
| ACO | Adobe Color | Photoshop |
| GPL | GIMP Palette | GIMP/Inkscape |
| TXT | 纯文本 hex 列表 | 通用 |

最简实现：GPL 格式（人类可读，无二进制编码）和 TXT。

### E6. 瓷砖模式 (Tileset)

- 将画布划分为固定尺寸网格（8×8 / 16×16 / 32×32）
- 每个网格单元是一个瓷砖，可单独选中/绘制
- 瓷砖浏览器：以图块集方式查看所有瓷砖
- 导出瓷砖表 PNG + JSON 数据

---

## Phase F — 生态分发 (v2.0)

### F1. Web Component 核心

`html
<!-- 使用方式 -->
<pixel-canvas width="32" height="32" zoom="16" palette="#ff0000,#00ff00,#0000ff">
</pixel-canvas>
`

- <pixel-canvas> 自定义元素，Shadow DOM 封装
- 通过属性/事件与外部通信
- 无外部依赖，可嵌入任何 HTML 页面
- NPM 包发布

### F2. Tauri v2 桌面版

- Rust 后端 + 系统 WebView
- 系统文件对话框（打开/保存 .pxs）
- 拖拽加载图片（系统级）
- 系统菜单 + 快捷键
- 原生安装包：.msi (Windows) / .dmg (macOS) / .AppImage (Linux)
- 自动更新

### F3. 插件系统

`js
// 插件格式
registerTool({
  name: 'My Custom Tool',
  icon: '...',
  shortcut: 'U',
  onPointerDown(x, y) { ... },
  onPointerMove(x, y) { ... },
  onPointerUp(x, y) { ... }
})

registerFilter({
  name: 'Pixelate',
  apply(layerData) { ... return newData }
})

registerExportFormat({
  name: 'BMP',
  extension: '.bmp',
  export(canvas, layers) { ... }
})
`

---

## 版本发布路线图

| 版本 | 内容 | JS 线 | 估价 |
|------|------|-------|------|
| v0.3.x | Phase A (已完成) | 558 行 | ✅ |
| v0.5.0 | Phase B: 图层核心 (数据结构 + 面板 + 渲染) | ~900 行 | +350 行 |
| v0.6.0 | Phase B: 图层完善 (混合模式 + 全部工具适配 + 验证) | ~1100 行 | +200 行 |
| v0.7.0 | Phase C: 动画引擎 (帧时间线 + 播放) | ~1400 行 | +300 行 |
| v0.8.0 | Phase C: 动画导出 (GIF + Sprite Sheet + 洋葱皮) | ~1600 行 | +200 行 |
| v1.0.0 | Phase D: 工程重构 (模块化 + .pxs + PWA 加固 + 自动恢复) | ~2000 行 | +400 行 |
| v1.1.0 | Phase E: 对称/HSL | ~2200 行 | +200 行 |
| v1.3.0 | Phase E: 抖动/描边/瓷砖 | ~2500 行 | +300 行 |
| v1.5.0 | Phase E: 调色板互通 | ~2600 行 | +100 行 |
| v2.0.0 | Phase F: Web Component + Tauri + 插件 | ~3500 行 | +900 行 |

---

## 关键技术决策清单

| 决策 | 选项 | 选择 |
|------|------|------|
| 模块拆分方式 | ES Module / Rollup / 单文件 | ES Module (零工具链) |
| GIF 编码 | gif.js / 自实现 | gif.js (成熟的纯 JS) |
| .pxs 压缩 | CompressionStream / pako / 无压缩 | CompressionStream API (Chrome 内置) |
| Tauri 版本 | v1 / v2 | v2 (2026 最新) |
| Web Component | 原生 Custom Elements / Lit | 原生 (零依赖) |
| 图标 | SVG / PNG / 字体 | SVG inline (已用模式) |
| 图层数据存储 | Array / TypedArray / ImageData | Array (与前端一致的字符串格式) |

---

## 每一阶段的验证策略

每个版本发布前，在 Console 执行:

`js
// 通用健康检查
const check = __debug.getHealthCheck()  // 新增方法
// → { passed: N, failed: 0, details: [...] }

// 图层特定检查 (Phase B+)
__debug.assertLayers()     // → true 如果所有层数据完整
__debug.assertBlend()      // → true 如果混合模式计算正确
__debug.assertAnimation()  // → true 如果帧结构有效

// 持久化检查 (Phase D+)
__debug.assertSaveLoad()   // → true 如果 .pxs 可逆序列化
`

---

_计划生成: 2026-07-02 | 当前基线: v0.3.1 | 基于 Phase A 实际产出_



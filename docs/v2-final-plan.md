# Pixel Studio — v2.0 Final Push Plan

当前: 17 commits, 8 tags, 27 files, app.js 808 行
目标: v2.0.0 稳定发布

---

## Block 1: v1.6.0 — Polish & Fix (5 项必修)

### B1.1 CSS 去重

当前问题:
```
index.html 内:
  <link rel="stylesheet" href="styles.css">    ← 外链 ~19KB
  <style>... ~19KB CSS ...</style>             ← 内联 ~19KB (重复!)
```
解决: 将 `<style>` 内的 CSS 删除，只保留关键 CSS（`:root` 变量 + 布局规则 ~2KB），其余靠外链。

操作:
1. 从 `<style>` 中提取关键 CSS:
   - `:root` 变量定义 (~500B)
   - `body`, `.app-nav`, `.view`, `.pixel-view`, `.pe-main`, `.pe-toolbar`, `.pe-sidebar` 布局规则 (~1.5KB)
2. 其余 CSS 移到 styles.css
3. `<style>` 只保留关键 CSS

结果: 首屏渲染 ~2KB 内联 + ~17KB 可缓存外链 (-50% 首屏体积)

### B1.2 添加 LICENSE 文件

```txt
MIT License
Copyright (c) 2026 REDrighthand05
Permission is hereby granted...
```

标准 MIT License 文本，GitHub 会自动识别。

### B1.3 添加 404.html

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Pixel Studio</title>
<meta http-equiv="refresh" content="0;url=https://redrighthand05.github.io/pixel-studio/">
<link rel="canonical" href="https://redrighthand05.github.io/pixel-studio/">
</head>
<body><h1>404</h1><p>Page not found. <a href="/pixel-studio/">Go home</a>.</p></body>
</html>
```

### B1.4 添加 .nojekyll

空文件，告诉 GitHub Pages 不要用 Jekyll 处理站点。

### B1.5 添加 Favicon

```html
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="icon" type="image/png" href="icon.png">
```

### B1.6 修复结构化数据

当前 `application/ld+json` 没有正确注入，检查并修复。

### B1.7 触发 GitHub Pages 部署

确保 `.github/workflows/pages.yml` 正确，推送到 main 后自动触发。

---

## Block 2: v1.7.0 — Advanced Tools

### B2.1 HSL 全局调整

功能: 对选区/图层/全部应用色相偏移、饱和度缩放、明度偏移。

```js
// 界面: 模态对话框
// 参数: Hue (-180~+180), Saturation (0~200%), Lightness (-100~+100)
// 作用域: 选区 / 当前层 / 所有层
function peAdjustHSL(mode, hue, sat, light, scope) {
    forEachPixel(scope, function(r, g, b) {
        var hsl = rgbToHsl(r, g, b);
        hsl.h = (hsl.h + hue / 360) % 1;
        hsl.s = clamp(hsl.s * sat / 100, 0, 1);
        hsl.l = clamp(hsl.l + light / 100, 0, 1);
        return hslToRgb(hsl);
    });
}
```

UI: 三个滑块 + 作用域选择 + 预览/应用按钮。

估算: ~80 行 JS + ~20 行 HTML/CSS

### B2.2 描边/轮廓工具

功能: 自动检测非透明像素的边缘，在边缘绘制轮廓线。

算法: 对于每个非透明像素，检查 4 邻域。如果某方向邻居透明，就在该方向绘制描边色。

```js
function peOutline(scope, color, thickness, mode) {
    // mode: 'inside' | 'outside' | 'both'
    forEachPixel(scope, function(x, y, c) {
        if (c && c !== '#ffffff00') {
            for (var dx = -thickness; dx <= thickness; dx++)
                for (var dy = -thickness; dy <= thickness; dy++) {
                    var nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= peGridSize || ny < 0 || ny >= peGridSize) {
                        setOutline(x, y, dx, dy, color, mode);
                    } else if (!peData[ny][nx] || peData[ny][nx] === '#ffffff00') {
                        setOutline(x, y, dx, dy, color, mode);
                    }
                }
        }
    });
}
```

实现方式: 作为插件 (利用现有插件系统) 或内建工具。

### B2.3 瓷砖模式

功能: 将画布划分为固定大小的网格 (8x8 / 16x16 / 32x32)，每个网格单元为独立瓷砖。
- 瓷砖鼠标悬浮高亮
- 点击选中瓷砖 (可复制/粘贴/移动)
- 导出瓷砖表 PNG + JSON 数据

---

## Block 3: v1.8.0 — Engineering

### B3.1 CHANGELOG.md

从 git log 和 Release 中提取变更内容，按版本排列。

```markdown
# Changelog

## v1.5.0 (2026-07-02)
### Added
- Symmetry drawing tool (Vertical/Horizontal/Both/Radial)
- Plugin system with PixelStudioPlugin API
- GitHub Pages deployment workflow
```

### B3.2 CONTRIBUTING.md

为潜在贡献者提供指引:
- 如何搭建开发环境
- 代码风格
- 提 PR 流程
- 插件开发指南 (引用 plugin-loader.js)

### B3.3 代码模块化 (可选)

不强制拆分，但如果拆分:
```
app.js → editor-core.js (渲染引擎)
       → editor-tools.js (10 种工具)
       → editor-layers.js (图层)
       → editor-anim.js (动画)
       → palette-gen.js (调色板)
       → storage.js (IndexedDB + .pxs)
       → ui.js (模态框/菜单)
       → app.js (入口)
```

使用 ES Module (`<script type="module">`)，Rollup 或不打包直接加载。

---

## Block 4: v2.0.0 — Release

### B4.1 Tauri 实际编译

前提条件 (需你本地执行):
```bash
rustup install stable
cargo install tauri-cli --version "^2"
cd src-tauri
cargo tauri icon ../icon.svg
cargo tauri build
```

### B4.2 插件市场发现 UI

在插件管理器模态框增加 "Discover" 标签页:
- 从 `plugins/index.json` 加载市场列表
- 显示插件名称、描述、版本
- Install 按钮 (import 插件脚本并注册)

### B4.3 Web Component (可选)

```html
<pixel-canvas width="32" height="32" zoom="16" palette="#ff0000">
</pixel-canvas>
```

Shadow DOM 封装，可嵌入任意页面。

### B4.4 GitHub Pages 验证

1. 在仓库 Settings → Pages 确认部署状态
2. 访问 https://redrighthand05.github.io/pixel-studio/ 确认可访问
3. 运行 Lighthouse CI 获取初始分数

---

## 实施路线图

### Day 1: Block 1 (v1.6.0)

| 时间 | 任务 | 代码量 |
|------|------|--------|
| 15min | CSS 去重 + 关键内联 | ~20 行 HTML 调整 |
| 2min | LICENSE 文件 | 21 行 |
| 2min | 404.html | 15 行 |
| 1min | .nojekyll | 0 行 |
| 2min | Favicon | 2 行 |
| 5min | 结构化数据修复 | ~5 行 |
| 10min | 验证 + 推送 + Pages 触发 | - |
| **总计** | **~37min** | |

### Day 2: Block 2 (v1.7.0)

| 时间 | 任务 | 代码量 |
|------|------|--------|
| 45min | HSL 调整 (JS + UI) | ~100 行 |
| 30min | 描边/轮廓工具 | ~60 行 |
| 30min | 瓷砖模式 (可选) | ~80 行 |
| **总计** | **~1h45min** | |

### Day 3: Block 3 (v1.8.0)

| 时间 | 任务 | 代码量 |
|------|------|--------|
| 10min | CHANGELOG.md | ~60 行 |
| 15min | CONTRIBUTING.md | ~50 行 |
| **总计** | **~25min** | |

### Day 4: Block 4 (v2.0.0)

| 时间 | 任务 | 代码量 |
|------|------|--------|
| 20min | 插件市场 UI | ~60 行 |
| 30min | Web Component 核心 (可选) | ~80 行 |
| 10min | GitHub Pages 验证 | - |
| 5min | v2.0.0 Release 发布 | - |
| **总计** | **~1h05min** | |

---

## 文件变更清单

```
v1.6.0:
  index.html       ← CSS 去重 + favicon + 结构化数据修复
  LICENSE          ← NEW (MIT)
  404.html         ← NEW
  .nojekyll        ← NEW
  styles.css       ← 可能调整

v1.7.0:
  app.js           ← +HSL + 描边工具
  index.html       ← +HSL/描边 UI 元素

v1.8.0:
  CHANGELOG.md     ← NEW
  CONTRIBUTING.md  ← NEW

v2.0.0:
  app.js           ← +插件市场 UI
  index.html       ← +市场模态框
  plugins/index.json ← 更新
```

---

## 依赖

| Block | 需要外部工具 | 备注 |
|-------|-------------|------|
| B1 | 无 | 全部纯文件操作 |
| B2 | 无 | 纯 JS 实现 |
| B3 | 无 | 纯 Markdown |
| B4.1 | Rust + VS Build Tools | 需要你本地执行 |
| B4.2-B4.4 | 无 | 纯文件操作 |

---

## 风险

| 风险 | 可能性 | 影响 | 缓解 |
|------|--------|------|------|
| CSS 去重破坏样式 | 中 | 高 | 保留全部关键 CSS |
| GitHub Pages 部署失败 | 低 | 中 | 本地测试后推送 |
| Tauri 编译依赖缺失 | 高 | 高 | 提供本地构建指南 |
| 模块化拆分引入回归 | 中 | 中 | 拆分后全量验证 |

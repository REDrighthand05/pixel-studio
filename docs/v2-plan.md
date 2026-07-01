# Pixel Studio — Beta & Ecosystem Plan (v2.0)

**基线**: v1.5.0 (app.js 64.9KB, 787 行)  
**目标**: 从浏览器中的 PWA 进化为可分发、可扩展、可嵌入的成熟产品

---

## 总览

三条线并行推进：

```
Phase F-1: Tauri 桌面封装  -> 原生安装包 (.msi / .dmg / .AppImage)
Phase F-2: Web 分发        -> GitHub Pages + PWA 极限优化
Phase F-3: 插件系统         -> 开放 API + 插件市场概念
```

每条线可独立发布，不阻塞其他线。

---

## F-1: Tauri v2 桌面封装

### F1.1 技术选型

| 方案 | 体积 | 语言 | 生态 | 选择 |
|------|------|------|------|------|
| Tauri v2 | ~5MB | Rust + 系统 WebView | 活跃 | **推荐** |
| Electron | ~150MB | Node.js + Chromium | 最大但超重 | 不采用 |
| Neutralino | ~3MB | 系统 WebView | 小生态 | 备选 |

**选 Tauri v2 的理由：**
- 最终二进制约 5MB（vs Electron 的 150MB）
- 使用系统 WebView（Edge WebView2 / WebKit），不打包浏览器
- Rust 后端提供原生文件系统、系统菜单、托盘图标
- 2026 年已发布 v2，生态成熟
- 自动更新机制内置

### F1.2 启动步骤

```
# 安装 Rust 工具链
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli --version "^2"

# 在 pixel-studio 目录初始化
cd pixel-studio
cargo tauri init

# 开发模式运行
cargo tauri dev

# 构建发布包
cargo tauri build
```

### F1.3 目录结构变化

```
pixel-studio/
├── src-tauri/
│   ├── Cargo.toml        # Rust 依赖
│   ├── tauri.conf.json   # 窗口、菜单、权限配置
│   ├── src/
│   │   └── main.rs       # Rust 入口 (~30 行)
│   ├── icons/            # 各平台图标 (ico/icns/png)
│   └── capabilities/     # 权限声明
├── index.html            # 不变
├── app.js                # 不变
└── ...                   # 其他文件不变
```

### F1.4 核心配置 (tauri.conf.json)

| 配置项 | 值 | 说明 |
|--------|-----|------|
| identifier | com.pixelstudio.app | 应用 ID |
| window.title | Pixel Studio | 窗口标题 |
| window.width | 1024 | 默认宽度 |
| window.height | 768 | 默认高度 |
| window.minWidth | 800 | 最小尺寸 |
| window.decorations | true | 系统标题栏 |
| bundle.identifier | com.pixelstudio.app | 包标识 |
| bundle.targets | msi/dmg/appimage | 三平台 |

## Rust 入口 (main.rs)

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())    // 文件对话框
        .plugin(tauri_plugin_fs::init())        // 文件系统
        .plugin(tauri_plugin_clipboard::init()) // 剪贴板
        .plugin(tauri_plugin_shell::init())     // 链接打开
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

### F1.5 权限声明

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read",
    "fs:allow-write",
    "clipboard-manager:default",
    "shell:default"
  ]
}
```

### F1.6 构建输出

| 平台 | 格式 | 路径 |
|------|------|------|
| Windows | .msi | src-tauri/target/release/bundle/msi/ |
| macOS | .dmg | src-tauri/target/release/bundle/dmg/ |
| Linux | .AppImage | src-tauri/target/release/bundle/appimage/ |

### F1.7 自动更新

内置 tauri-updater 支持。更新策略：
- Beta 版本：手动检查更新
- 正式版本：启动时静默检查
- 更新服务器：GitHub Releases

---

## F-2: Web 分发优化

### F2.1 GitHub Pages 部署

通过 GitHub Actions 自动部署到 Pages。

```yaml
# .github/workflows/pages.yml
name: Deploy to Pages
on:
  push:
    branches: ["main"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: "."
      - uses: actions/deploy-pages@v4
```

**访问链接**: https://redrighthand05.github.io/pixel-studio/

### F2.2 PWA 优化清单

| 指标 | 目标 | 操作 |
|------|------|------|
| Lighthouse Performance | >= 90 | CSS 提取+压缩、JS 拆分 |
| Lighthouse Accessibility | >= 95 | ARIA 标签、焦点管理 |
| Lighthouse Best Practices | >= 90 | HTTPS、正确 MIME |
| 首次内容渲染 (FCP) | < 1.5s | 关键 CSS 内联 |
| 最大内容渲染 (LCP) | < 2.5s | 懒加载非核心资源 |
| 累积布局偏移 (CLS) | < 0.1 | 显式宽高比 |

### F2.3 具体优化措施

**CSS 优化：**
- 将 `<style>` 块提取为独立 `styles.css` → 浏览器可缓存
- 使用 csso 压缩，预期从 19KB 降到 ~12KB
- 关键渲染路径 CSS 内联到 `<head>`

**JS 优化：**
- 当前 app.js 65KB 单文件
- 拆分为 ES Module：
  - `editor-core.js` (~15KB) - 渲染引擎、像素操作
  - `editor-tools.js` (~10KB) - 全部工具
  - `editor-layers.js` (~8KB) - 图层管理
  - `editor-anim.js` (~10KB) - 动画引擎
  - `palette-gen.js` (~8KB) - 调色板生成器
  - `storage.js` (~5KB) - IndexedDB + .pxs
  - `ui.js` (~5KB) - 模态框、菜单、Toast
  - `app.js` (~4KB) - 入口 + 初始化
- GIF 导出代码延迟加载（仅在点击 GIF 按钮时加载）

### F2.4 PWA 截图

```json
{
  "screenshots": [
    {
      "src": "screenshots/editor.png",
      "sizes": "1280x800",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Pixel Editor with layers and animation timeline"
    }
  ]
}
```

需要手动截取截图存入 screenshots/ 目录。

### F2.5 Lighthouse CI 自动化

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse
on: [push]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lighthouse Audit
        uses: treosh/lighthouse-ci-action@v11
        with:
          url: https://redrighthand05.github.io/pixel-studio/
```

---

## F-3: 插件系统

### F3.1 插件格式

```js
// 一个标准的插件对象
{
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Description',
  author: 'Name',

  // 注册自定义工具
  tools: [{
    id: 'my-tool',
    name: 'My Tool',
    icon: 'svg-or-text',
    onPointerDown(x, y) { ... },
    onPointerMove(x, y) { ... },
    onPointerUp(x, y) { ... }
  }],

  // 注册滤镜
  filters: [{
    id: 'dither',
    name: 'Dither',
    apply(layerData, params) { ... }
  }],

  // 注册导出格式
  exportFormats: [{
    name: 'BMP',
    extension: '.bmp',
    export(canvas) { ... }
  }]
}
```

### F3.2 插件加载器 (plugin-loader.js)

```js
const PixelStudioPlugins = {
  _plugins: [],
  register(plugin) { ... },
  getTools() { ... },
  getFilters() { ... },
  getExportFormats() { ... }
};
```

加载方式：
1. `<script src="plugins/xxx.js"></script>` 脚本标签
2. 动态 `import()` 从 URL 加载
3. 从 IndexedDB 加载已安装插件

### F3.3 内置示例插件

随应用内置至少 1 个示例插件：
- 抖动滤镜 (Floyd-Steinberg + Bayer 矩阵)
- 调色板互通 (GPL 格式导入/导出)
- 像素放大镜工具

### F3.4 插件市场概念

```
https://redrighthand05.github.io/pixel-studio/plugins/index.json

[{
  "name": "Dither Master",
  "version": "1.0.0",
  "description": "高级抖动算法集合",
  "author": "Community",
  "url": "https://.../dither-master.js",
  "filters": "3",
  "downloads": "42"
}]
```

---

## F-4: Beta 发布计划

### F4.1 版本号

```
v2.0.0-beta.1    <- Tauri 可用 + GitHub Pages
v2.0.0-beta.2    <- 插件系统 MVP + 修复反馈
v2.0.0-rc.1      <- 候选发布
v2.0.0           <- 正式发布
```

### F4.2 Beta 1 发布检查清单

- [ ] Tauri 可构建并启动
- [ ] 核心功能正常 (绘制/图层/动画/项目文件)
- [ ] 系统对话框保存/打开 .pxs
- [ ] GitHub Pages 部署完成
- [ ] Lighthouse >= 80
- [ ] README 更新

### F4.3 Beta 2 检查清单

- [ ] 插件系统 MVP 可用
- [ ] 至少 1 个内置示例插件
- [ ] Beta 1 反馈修复
- [ ] Lighthouse >= 90
- [ ] Windows .msi 安装包通过验证

### F4.4 CI/CD 构建流水线

```yaml
# .github/workflows/build.yml
name: Build
on:
  push:
    tags: ["v*"]
jobs:
  build-tauri:
    strategy:
      matrix:
        platform: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Build
        uses: tauri-apps/tauri-action@v0
```

### F4.5 Issue 模板

新建 .github/ISSUE_TEMPLATE/bug.yml：
- Version (input)
- Platform (dropdown: Windows/macOS/Linux/Web)  
- Description (textarea)
- Steps to reproduce (textarea)
- Expected behavior (textarea)

---

## 实施顺序

### Day 1-2: 基建
1. 安装 Rust + Tauri CLI
2. `cargo tauri init` 初始化项目
3. 配置 tauri.conf.json
4. 设置各平台图标
5. 验证 `cargo tauri dev` 可运行

### Day 3-4: 桌面功能
6. 系统文件对话框 (打开/保存 .pxs)
7. 系统拖拽支持
8. 系统菜单栏
9. 自动更新集成

### Day 5: Web 优化
10. GitHub Actions: Pages 部署
11. CSS/JS 拆分和压缩
12. Lighthouse 优化

### Day 6-8: 插件系统
13. 插件加载器核心
14. 插件 API 定义 (工具/滤镜/导出)
15. 内置示例插件
16. 插件市场概念索引

### Day 9: Beta 发布
17. Issue 模板
18. 检查清单
19. v2.0.0-beta.1 发布

---

## 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Rust 编译慢 | 高 | 低 | 首次编译后增量 |
| Tauri API 变更 | 低 | 中 | 锁定版本 |
| WebView 兼容性 | 中 | 中 | 测试 Edge/Safari/Chrome |
| 插件安全 | 中 | 高 | 沙箱隔离、审核机制 |
| 构建体积膨胀 | 低 | 低 | 定期检查 dist 大小 |

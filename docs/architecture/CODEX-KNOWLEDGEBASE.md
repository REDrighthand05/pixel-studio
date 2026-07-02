# Codex 工程知识库
---

## 1. Agent 召唤体系

| Agent | 模型 | 职责 |
|-------|------|------|
| Planner | pro/flash mixed | 制定计划、拆解任务 |
| Worker | pro | 执行具体代码任务 |
| Nash | pro | 独立执行者（无法调worker） |
| Architect | pro | 架构评审方案设计 |
| Designer | pro | UI/UX设计评审 |
| Audit | flash | 快速扫描审计 |

> 问题记录:
> - CodexDesktop UI 不显示模型选择器
> - 通过CCSwitch导入MCP/Skill切换模型
> - Agent上限10个，手动删除失败
> - Nash无法调Worker，仅Codex可分配

## 2. GitHub 仓库与令牌

| 仓库 | URL | 本地路径 |
|------|-----|---------|
| pixel-studio | https://github.com/REDrighthand05/pixel-studio.git | D:\codexs_workspace\pixel-studio |
| daily (Popper) | 待确认 | D:\codexs_workspace\daily |

令牌: [[GITHUB_TOKEN_PLACEHOLDER]] (通过mihomo代理)

## 3. 技术栈与工具链

### 前端
- 语言: Vanilla JS (896行) -> TypeScript 5.x
- 构建: Vite 6 / Turbopack
- 状态: Zustand / Jotai
- Lint: Biome / oxlint
- 测试: Vitest + Playwright
- 版本: changesets

### 桌面端
- Tauri v2 (Rust)
- 插件: dialog, fs, clipboard, shell
- 构建目标: .msi .dmg .AppImage

### Web/PWA
- PWA: sw.js + manifest.json
- 部署: GitHub Pages
- CDN: gif.js

### 插件系统
- 当前: plugin-loader.js + dither + palette-exchange
- 目标: 标准化API + 插件市场 + SDK

### WASM/Rust
- wasm-pack + image-rs
- 像素操作5-50x加速

## 4. 重构成熟度模型 (L1-L5)

L5 - 生态化平台: 插件市场/Web Component/SDK/多平台
L4 - 工程化产品: TypeScript/测试/CI/自动化发布
L3 - 模块化架构: ES Module/单向数据流/渲染管线
L2 - 函数拆分: 工具函数独立/文件分离
L1 - 单文件: 全局变量/过程式/无构建

当前: L1.5 -> 目标: L5

## 5. 参考开源项目

- Pixelorama (Godot, 5.5k stars)
- Piskel (Vanilla JS, 7k stars)
- Aseprite (C++/Lua, 29k stars)
- Excalidraw (TS/React, 协作白板)
- Figma Plugin API (架构参考)
- chroma.js (颜色空间)
- rough.js (手绘渲染)
- wasm-pack (Rust->WASM)
- image-rs (Rust图像处理)
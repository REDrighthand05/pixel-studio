# Tauri Desktop Setup Guide

## Prerequisites

### 1. Rust
  curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh

### 2. VS Build Tools (Windows)
  winget install Microsoft.VisualStudio.2022.BuildTools --silent
  # Then run: "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

### 3. Tauri CLI
  cargo install tauri-cli --version "^2"

### 4. Generate Icons
  cd src-tauri
  cargo tauri icon ../icon.svg

## Development
  cargo tauri dev    # Run in development mode
  cargo tauri build  # Build for distribution

## Configuration
See src-tauri/tauri.conf.json for window, bundle, and security settings.

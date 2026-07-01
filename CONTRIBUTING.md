# Contributing to Pixel Studio

## Development Setup

```bash
# Clone the repository
git clone https://github.com/REDrighthand05/pixel-studio.git
cd pixel-studio

# No build step needed for web version
# Open index.html in your browser

# For Tauri desktop version:
# rustup install stable
# cargo install tauri-cli --version "^2"
# cd src-tauri && cargo tauri dev
```

## Code Style

- app.js uses ES5-compatible syntax (no arrow functions in most places)
- Variable naming: pe* prefix for pixel editor globals
- CSS uses custom properties with --prefix
- Indentation: 2 spaces

## Plugin Development

See [plugin-loader.js](./plugin-loader.js) for the API reference, and [plugins/](./plugins/) for examples.

```js
PixelStudioPlugin.register({
  name: "My Plugin",
  version: "1.0.0",
  tools: [{ ... }],
  filters: [{ ... }]
});
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Test your changes by opening index.html in a browser
4. Verify with the console: \`window.__debug\`
5. Submit a PR with a clear description of the changes

## Verification

Before submitting, run the health check in your browser console:
\`\`\`js
(function runChecks() {
  // ... paste from TESTING.md ...
})();
\`\`\`

See [TESTING.md](./TESTING.md) for the complete verification guide.

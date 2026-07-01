# Platform Icons

Tauri requires platform-specific icon formats (.ico for Windows, .icns for macOS, .png for Linux).

To generate these from icon.svg:
  cargo tauri icon icon.svg

Or manually convert icon.svg to:
  - icons/32x32.png
  - icons/128x128.png
  - icons/128x128@2x.png
  - icons/icon.icns
  - icons/icon.ico

The existing icon.svg serves as the source artwork.

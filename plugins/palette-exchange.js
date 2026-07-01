PixelStudioPlugin.register({
    name: "Palette Exchange",
    version: "1.0.0",
    description: "Import GIMP palette (.gpl) files",
    author: "Pixel Studio Team",
    paletteFormats: [{
        name: "GIMP Palette",
        extension: ".gpl",
        parse: function(text) {
            var colors = [], lines = text.split("\n"), inColors = false;
            for (var i = 0; i < lines.length; i++) {
                var t = lines[i].trim();
                if (t.toLowerCase().startsWith("gimp palette")) { inColors = true; continue; }
                if (t.startsWith("#") || t === "") continue;
                if (t.toLowerCase().startsWith("name:") || t.toLowerCase().startsWith("columns:")) continue;
                if (inColors) {
                    var parts = t.split(/\s+/);
                    if (parts.length >= 3) {
                        var r = parseInt(parts[0]), g = parseInt(parts[1]), b = parseInt(parts[2]);
                        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) colors.push(rgbToHex(r, g, b));
                    }
                }
            }
            return colors;
        },
        stringify: function(colors) {
            var text = "GIMP Palette\nName: Pixel Studio Export\nColumns: 8\n#\n";
            for (var i = 0; i < colors.length; i++) {
                var c = hexToRgb(colors[i]);
                text += c[0] + " " + c[1] + " " + c[2] + " Color " + (i+1) + "\n";
            }
            return text;
        }
    }]
});

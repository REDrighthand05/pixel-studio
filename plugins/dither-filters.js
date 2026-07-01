PixelStudioPlugin.register({
    name: "Dither Filters",
    version: "1.0.0",
    description: "Floyd-Steinberg and Bayer matrix dithering",
    author: "Pixel Studio Team",
    filters: [{
        id: "floyd-steinberg",
        name: "Floyd-Steinberg Dither",
        params: [{ key: "levels", label: "Levels", type: "number", default: 4, min: 2, max: 16 }],
        apply: function(data, params) {
            var levels = params.levels || 4;
            var factor = 256 / levels;
            for (var y = 0; y < data.length; y++) {
                for (var x = 0; x < data[y].length; x++) {
                    var old = data[y][x];
                    if (!old || old === "#ffffff00") continue;
                    var c = hexToRgb(old);
                    var nr = Math.round(Math.round(c[0] / factor) * factor);
                    var ng = Math.round(Math.round(c[1] / factor) * factor);
                    var nb = Math.round(Math.round(c[2] / factor) * factor);
                    data[y][x] = rgbToHex(nr, ng, nb);
                    var er = c[0] - nr, eg = c[1] - ng, eb = c[2] - nb;
                    var dist = function(dx, dy, w) {
                        var nx = x + dx, ny = y + dy;
                        if (ny < data.length && nx >= 0 && nx < data[ny].length) {
                            var p = data[ny][nx];
                            if (p && p !== "#ffffff00") {
                                var pc = hexToRgb(p);
                                data[ny][nx] = rgbToHex(
                                    Math.max(0, Math.min(255, pc[0] + er * w)),
                                    Math.max(0, Math.min(255, pc[1] + eg * w)),
                                    Math.max(0, Math.min(255, pc[2] + eb * w))
                                );
                            }
                        }
                    };
                    dist(1, 0, 7/16); dist(-1, 1, 3/16); dist(0, 1, 5/16); dist(1, 1, 1/16);
                }
            }
            return data;
        }
    }]
});

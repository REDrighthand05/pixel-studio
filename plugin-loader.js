// Pixel Studio Plugin System v1.0
const PixelStudioPlugin = {
    _plugins: [],

    register(plugin) {
        if (this._plugins.find(function(p) { return p.name === plugin.name; })) {
            console.warn("Plugin already registered:", plugin.name);
            return false;
        }
        plugin._id = "plugin_" + Date.now();
        this._plugins.push(plugin);
        this._activate(plugin);
        return true;
    },

    unregister(name) {
        var idx = -1;
        for (var i = 0; i < this._plugins.length; i++) {
            if (this._plugins[i].name === name) { idx = i; break; }
        }
        if (idx >= 0) {
            this._deactivate(this._plugins[idx]);
            this._plugins.splice(idx, 1);
            return true;
        }
        return false;
    },

    list() {
        return this._plugins.map(function(p) {
            return { name: p.name, version: p.version, tools: (p.tools||[]).length, filters: (p.filters||[]).length };
        });
    },

    _activate(plugin) {
        if (plugin.tools) {
            plugin.tools.forEach(function(tool) {
                window.__pluginTools = window.__pluginTools || {};
                window.__pluginTools[tool.id] = tool;
                this._createToolButton(tool);
            }.bind(this));
        }
        if (plugin.filters) {
            plugin.filters.forEach(function(filter) {
                window.__pluginFilters = window.__pluginFilters || {};
                window.__pluginFilters[filter.id] = filter;
            });
        }
        if (plugin.exportFormats) {
            plugin.exportFormats.forEach(function(fmt) {
                window.__pluginExportFormats = window.__pluginExportFormats || {};
                window.__pluginExportFormats[fmt.extension] = fmt;
            });
        }
        if (typeof showToast === "function") showToast("Plugin: " + plugin.name + " loaded");
    },

    _deactivate(plugin) {
        if (plugin.tools) {
            plugin.tools.forEach(function(tool) {
                delete window.__pluginTools[tool.id];
                var btn = document.querySelector('[data-pe-tool="plugin_' + tool.id + '"]');
                if (btn) { var sep = btn.previousSibling; if (sep && sep.className === "pe-toolbar-sep") sep.remove(); btn.remove(); }
            });
        }
    },

    _createToolButton(tool) {
        var toolbar = document.querySelector(".pe-toolbar");
        if (!toolbar) return;
        var sep = document.createElement("div");
        sep.className = "pe-toolbar-sep";
        var btn = document.createElement("button");
        btn.className = "pe-btn";
        btn.dataset.peTool = "plugin_" + tool.id;
        btn.title = tool.name + (tool.shortcut ? " (" + tool.shortcut + ")" : "");
        btn.textContent = tool.icon || "?";
        btn.addEventListener("click", function() {
            document.querySelectorAll("[data-pe-tool]").forEach(function(b) { b.classList.remove("active"); });
            btn.classList.add("active");
            peTool = "plugin_" + tool.id;
            window.__activePluginToolId = tool.id;
        });
        toolbar.appendChild(sep);
        toolbar.appendChild(btn);
    }
};

window.PixelStudioPlugin = PixelStudioPlugin;

// Plugin marketplace
PixelStudioPlugin._discover = function() {
    var list = document.getElementById('pluginList');
    if (!list) return;
    list.innerHTML = '<div style="font-size:11px;color:var(--fg3);padding:8px">Loading...</div>';
    fetch('plugins/index.json')
        .then(function(r) { return r.json(); })
        .then(function(plugins) {
            list.innerHTML = '';
            if (!plugins || plugins.length === 0) {
                list.innerHTML = '<div style="font-size:11px;color:var(--fg3);padding:8px">No plugins available</div>';
                return;
            }
            plugins.forEach(function(p) {
                var item = document.createElement('div');
                item.className = 'pv-saved-item';
                var info = document.createElement('div');
                info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px';
                info.innerHTML = '<span style="font-size:11px;font-weight:500">' + p.name + ' <span style="color:var(--fg3);font-weight:400">v' + p.version + '</span></span><span style="font-size:10px;color:var(--fg3)">' + p.description + '</span>';
                var installBtn = document.createElement('button');
                installBtn.textContent = 'Install';
                installBtn.style.cssText = 'padding:3px 10px;border:none;border-radius:3px;background:var(--accent);color:#111;font-size:10px;cursor:pointer';
                installBtn.addEventListener('click', function() {
                    var script = document.createElement('script');
                    script.src = p.url;
                    script.onload = function() {
                        showToast('Installed: ' + p.name);
                        PixelStudioPlugin._showInstalled();
                    };
                    script.onerror = function() {
                        showToast('Failed: ' + p.name);
                    };
                    document.body.appendChild(script);
                    installBtn.textContent = '...';
                    installBtn.disabled = true;
                });
                item.append(info, installBtn);
                list.appendChild(item);
            });
        })
        .catch(function() {
            list.innerHTML = '<div style="font-size:11px;color:var(--fg3);padding:8px">Failed to load marketplace</div>';
        });
};

PixelStudioPlugin._showInstalled = function() {
    var list = document.getElementById('pluginList');
    if (!list) return;
    var plugins = this.list();
    list.innerHTML = '';
    if (plugins.length === 0) {
        list.innerHTML = '<div style="font-size:11px;color:var(--fg3);padding:8px">No plugins loaded. Go to Discover to browse.</div>';
    } else {
        plugins.forEach(function(p) {
            var item = document.createElement('div');
            item.className = 'pv-saved-item';
            item.innerHTML = '<span style="flex:1;font-size:11px">' + p.name + ' <span style="color:var(--fg3)">v' + p.version + '</span></span><span style="font-size:10px;color:var(--fg3)">tools:' + p.tools + ' filters:' + p.filters + '</span>';
            list.appendChild(item);
        });
    }
};
console.log('Plugin system loaded');


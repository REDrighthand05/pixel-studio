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
console.log("Plugin system loaded");

import { app } from "/scripts/app.js";
import { getApp } from "./core/BlendPackApp.js";
import { NodeUI } from "./ui/NodeUI.js";
import { drawStats } from "./ui/PreviewStats.js";

app.registerExtension({
    name: "ComfyUI.BlendPack",

    async setup() {
        const { registerAllEngines } = await import("./engine/bootstrap.js");
        registerAllEngines();

        try {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = new URL("./user.css", import.meta.url).href;
            document.head.appendChild(link);
        } catch (e) {
            console.warn("[BlendPack] Failed to load user.css", e);
        }

        const blendPack = getApp();
        blendPack.init(app);

        // LGraphCanvas Patch: Hide default slot labels for BlendJoiner
        const origDrawNode = LGraphCanvas.prototype.drawNode;
        LGraphCanvas.prototype.drawNode = function (node, ctx) {
            if (node.type === "BlendJoiner") {
                const savedInputs = node.inputs?.map(s => ({ name: s.name, label: s.label }));
                const savedOutputs = node.outputs?.map(s => ({ name: s.name, label: s.label }));

                node.inputs?.forEach(inp => { inp.name = " "; inp.label = " "; });
                node.outputs?.forEach(out => { out.name = " "; out.label = " "; });

                const result = origDrawNode.call(this, node, ctx);

                node.inputs?.forEach((inp, i) => { if (savedInputs?.[i]) inp.name = savedInputs[i].name; });
                node.outputs?.forEach((out, i) => { if (savedOutputs?.[i]) out.name = savedOutputs[i].name; });

                return result;
            }
            return origDrawNode.call(this, node, ctx);
        };
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "BlendVideoCombine") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                this.setSize([400, 350]);
                this.blendStats = null;

                const previewContainer = document.createElement("div");
                previewContainer.style.cssText = "width:100%;text-align:center;";

                const videoEl = document.createElement("img");
                videoEl.style.cssText = "max-width:100%;max-height:280px;border-radius:4px;";
                previewContainer.appendChild(videoEl);

                this.previewWidget = this.addDOMWidget("preview", "preview", previewContainer, {
                    serialize: false,
                    hideOnZoom: false,
                });
                this.previewWidget.videoEl = videoEl;

                const self = this;
                const onExecuted = this.onExecuted;
                this.onExecuted = function (message) {
                    if (onExecuted) onExecuted.apply(this, arguments);

                    if (message.blend_info && message.blend_info[0]) {
                        self.blendStats = message.blend_info[0];
                    }

                    if (message.gifs && message.gifs[0]) {
                        const gif = message.gifs[0];
                        const params = new URLSearchParams({
                            filename: gif.filename,
                            subfolder: gif.subfolder || "",
                            type: gif.type || "temp",
                            t: Date.now()
                        });
                        videoEl.src = `/view?${params.toString()}`;
                    }
                };

                const onDrawForeground = this.onDrawForeground;
                this.onDrawForeground = function (ctx) {
                    if (onDrawForeground) onDrawForeground.apply(this, arguments);
                    if (self.blendStats) {
                        drawStats(ctx, this.size, self.blendStats);
                    }
                };
            };
        }

        if (nodeData.name === "BlendJoiner") {
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                if (originalOnNodeCreated) {
                    originalOnNodeCreated.apply(this, arguments);
                }

                new NodeUI(this);
            };
        }
    }
});

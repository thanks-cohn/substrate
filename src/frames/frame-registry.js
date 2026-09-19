export const DEFAULT_SKIN_ID = "modern";

const effectPolicy = Object.freeze({ effects: Object.freeze([]), respectsReducedMotion: true, userToggleable: true, performanceTier: "low" });
const SKINS = Object.freeze([
  Object.freeze({ id: "modern", name: "Modern", version: "1.1.0", description: "The existing SUBSTRATE frame appearance.", css: "skins/modern/skin.css", supportedFrameTypes: Object.freeze(["*"]), capabilities: Object.freeze({ titleBar: true, windowControls: true, toolbarStyling: true, decorativeEffects: false, decorative: effectPolicy }) }),
  Object.freeze({ id: "mac-classic", name: "Classic Macintosh", version: "1.1.0", description: "A compact monochrome, classic Macintosh-inspired frame.", css: "skins/mac-classic/skin.css", supportedFrameTypes: Object.freeze(["*"]), capabilities: Object.freeze({ titleBar: true, windowControls: true, toolbarStyling: true, decorativeEffects: true, decorative: effectPolicy }) }),
  Object.freeze({ id: "windows-98", name: "Windows 98", version: "1.1.0", description: "A Windows 98-inspired beveled frame.", css: "skins/windows-98/skin.css", supportedFrameTypes: Object.freeze(["*"]), capabilities: Object.freeze({ titleBar: true, windowControls: true, toolbarStyling: true, decorativeEffects: true, decorative: effectPolicy }) })
]);

const byId = new Map(SKINS.map(skin => [skin.id, skin]));
const copy = value => structuredClone(value);
export function listSkins() { return SKINS.map(copy); }
export function inspectSkin(id) { return byId.has(id) ? copy(byId.get(id)) : null; }
export function supportsFrameType(skin, frameType) { return Boolean(skin && (skin.supportedFrameTypes.includes("*") || skin.supportedFrameTypes.includes(frameType))); }
export function resolveSkin(id, frameType) { const skin = typeof id === "string" ? byId.get(id) : null; return supportsFrameType(skin, frameType) ? skin : byId.get(DEFAULT_SKIN_ID); }

import { cloneDefaults, createProjection, frameToWorldGeometry, importWorldScene, localToWorld, normalizeLighting, projectPoint, projectShadow, SKETCH_TOWN_ASSET_PATHS } from "./omni-world-model.mjs";

const STORAGE_KEY = "substrate.omni-world.v1";
const workspace = document.querySelector("#workspace");
const canvas = document.createElement("canvas");
canvas.id = "omni-world-plane";
canvas.className = "omni-world-plane";
canvas.setAttribute("aria-hidden", "true");
workspace.prepend(canvas);
const context = canvas.getContext("2d", { alpha: true });
const projection = createProjection({ tileWidth: 64, tileHeight: 32, elevationScale: 1 });
const camera = { x: 0, y: 0, zoom: 1 };
const listeners = new Set();
const images = new Map();
let state = loadState();
let scheduled = false;

let scene = {
  id: "sketch-town-scene-v1",
  tileLayers: [{ id: "ground", name: "Ground", width: 15, height: 11, tileSize: 1 }],
  objects: [
    { id: "town-hall", kind: "scenery", asset: "building", local: { x: 7, y: 4, z: 0 } },
    { id: "tree-west", kind: "scenery", asset: "tree", local: { x: 3, y: 3, z: 0 } },
    { id: "tree-east", kind: "scenery", asset: "tree", local: { x: 11, y: 7, z: 0 } },
    { id: "tree-south", kind: "scenery", asset: "trees", local: { x: 6, y: 9, z: 0 } }
  ],
  assetReferences: Object.fromEntries(Object.entries(SKETCH_TOWN_ASSET_PATHS).map(([name, path]) => [name, new URL(path, import.meta.url).href]))
};

fetch(new URL("../assets/worlds/sketch-town/scene.json", import.meta.url)).then(response => {
  if (!response.ok) throw new Error(`Sketch Town scene returned ${response.status}`);
  return response.json();
}).then(map => {
  scene = { ...importWorldScene(map, { tileAssets: { 1: "grass", 2: "path" }, objectAssets: { building: "building", tree: "tree", trees: "trees" } }), assetReferences: scene.assetReferences };
  requestRender();
}).catch(error => console.warn("Could not load the Sketch Town scene; using the built-in layout.", error));

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
    const defaults = cloneDefaults(), lighting = normalizeLighting(stored);
    return { ...defaults, ...lighting, blocks: Array.isArray(stored.blocks) && stored.blocks.length ? stored.blocks.map((block, index) => ({ ...(defaults.blocks[index] || defaults.blocks[0]), ...block, transform: { ...defaults.blocks[0].transform, ...block.transform }, footprint: { ...defaults.blocks[0].footprint, ...block.footprint } })) : defaults.blocks };
  } catch { return cloneDefaults(); }
}

function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function emit(type, detail = {}) { const event = Object.freeze({ type, detail, state: inspect() }); listeners.forEach(listener => listener(event)); window.dispatchEvent(new CustomEvent(`substrate:world-${type}`, { detail: event })); }
function originFor(block) { return { x: block.transform.x, y: block.transform.y }; }
function projectLocal(block, point) { return projectPoint(localToWorld({ transform: { x: 0, y: 0, z: block.transform.z, scale: block.transform.scale } }, point), projection, originFor(block)); }

function resizeCanvas() {
  const width = Math.max(workspace.scrollWidth, workspace.clientWidth), height = Math.max(workspace.scrollHeight, workspace.clientHeight), ratio = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.ceil(width * ratio) || canvas.height !== Math.ceil(height * ratio)) { canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function polygon(points, fill, stroke = null) { if (!points.length) return; context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.closePath(); context.fillStyle = fill; context.fill(); if (stroke) { context.strokeStyle = stroke; context.stroke(); } }

function drawBlock(block) {
  const tiles = scene.tiles || Array.from({ length: 165 }, (_, index) => ({ asset: Math.floor(index / 15) === 5 || index % 15 === 7 ? "path" : "grass", local: { x: index % 15, y: Math.floor(index / 15), z: 0 } }));
  for (const tile of tiles) {
    const points = [tile.local, { ...tile.local, x: tile.local.x + 1 }, { ...tile.local, x: tile.local.x + 1, y: tile.local.y + 1 }, { ...tile.local, y: tile.local.y + 1 }].map(point => projectLocal(block, point));
    polygon(points, tile.asset === "path" ? "#d7bd83" : ((tile.local.x + tile.local.y) % 2 ? "#84bd68" : "#8fc873"), "rgba(45,83,49,.16)");
  }
  for (const object of scene.objects.slice().sort((a, b) => (a.local.x + a.local.y) - (b.local.x + b.local.y))) {
    const image = images.get(object.asset), point = projectLocal(block, object.local);
    if (image?.complete && image.naturalWidth) { const scale = object.asset === "building" ? .58 : .48; context.drawImage(image, point.x - image.naturalWidth * scale / 2, point.y - image.naturalHeight * scale + 16, image.naturalWidth * scale, image.naturalHeight * scale); }
  }
  const label = projectLocal(block, { x: 0, y: 0, z: 0 }); context.fillStyle = "rgba(16,35,28,.82)"; context.font = "600 12px system-ui"; context.fillText(`${block.name}${block.anchored ? "  🔒" : ""}`, label.x - 6, label.y - 12);
}

function frameObjects() {
  const workspaceRect = workspace.getBoundingClientRect(), origin = { x: 0, y: 0 };
  return [...workspace.querySelectorAll(".block")].map(block => {
    const rect = block.getBoundingClientRect();
    return frameToWorldGeometry({ x: rect.left - workspaceRect.left, y: rect.top - workspaceRect.top, width: rect.width, height: rect.height }, projection, origin, { id: block.dataset.blockId, elevation: Number(block.dataset.worldElevation) || 28, castsWorldShadow: block.dataset.castsWorldShadow !== "false", receivesWorldLighting: block.dataset.receivesWorldLighting === "true" });
  }).filter(Boolean);
}

function render() {
  scheduled = false; if (!canvas.isConnected) workspace.prepend(canvas); const size = resizeCanvas(); context.clearRect(0, 0, size.width, size.height); canvas.hidden = !state.enabled;
  workspace.classList.toggle("omni-world-enabled", state.enabled); if (!state.enabled) return;
  state.blocks.forEach(drawBlock);
  if (state.shadowsEnabled && state.sun.enabled) for (const object of frameObjects()) polygon(projectShadow(object, state.sun).map(point => projectPoint(point, projection)), `rgba(18,24,34,${(.12 + state.sun.intensity * .22).toFixed(3)})`);
  const darkness = Math.max(0, 1 - state.ambient - (state.sun.enabled ? state.sun.intensity * .35 : 0)); context.fillStyle = `rgba(16,25,48,${Math.min(.58, darkness).toFixed(3)})`; context.fillRect(0, 0, size.width, size.height);
}
function requestRender() { if (!scheduled) { scheduled = true; requestAnimationFrame(render); } }

function inspect() {
  const objects = frameObjects().map(object => ({ ...object, shadowPolygon: state.enabled && state.shadowsEnabled ? projectShadow(object, state.sun) : [] }));
  return structuredClone({ schemaVersion: 1, activeWorld: state.enabled ? "sketch-town" : null, coordinateConvention: "right-handed: X east, Y south on ground, Z up", projection, camera: { ...camera, viewport: { scrollX, scrollY, width: innerWidth, height: innerHeight } }, plane: { origin: { x: 0, y: 0, z: 0 }, dimensions: { width: workspace.scrollWidth, height: workspace.scrollHeight }, visibleRegion: { x: scrollX, y: scrollY, width: innerWidth, height: innerHeight } }, lighting: { ambient: state.ambient, sun: state.sun, shadowsEnabled: state.shadowsEnabled }, worldBlocks: state.blocks.map(block => ({ ...block, tileLayers: scene.tileLayers, objects: scene.objects })), shadowCasters: objects });
}

function command(name, payload = {}) {
  const previous = JSON.stringify(state);
  if (name === "set-enabled") state.enabled = Boolean(payload.value);
  else if (name === "set-shadows") state.shadowsEnabled = Boolean(payload.value);
  else if (name === "set-sun") state.sun = normalizeLighting({ ...state, sun: { ...state.sun, ...payload } }).sun;
  else if (name === "set-ambient") state.ambient = normalizeLighting({ ...state, ambient: payload.value }).ambient;
  else if (name === "move-block") { const block = state.blocks.find(item => item.id === payload.id); if (!block || block.anchored) return false; block.transform.x += Number(payload.dx) || 0; block.transform.y += Number(payload.dy) || 0; }
  else if (name === "set-block-anchor") { const block = state.blocks.find(item => item.id === payload.id); if (!block) return false; block.anchored = Boolean(payload.value); }
  else if (name === "reset-lighting") { const defaults = cloneDefaults(); Object.assign(state, { shadowsEnabled: defaults.shadowsEnabled, ambient: defaults.ambient, sun: defaults.sun }); }
  else if (name === "request-render") { requestRender(); return true; }
  else throw new TypeError(`Unsupported Omni World command: ${name}`);
  if (previous !== JSON.stringify(state)) { saveState(); syncControls(); requestRender(); emit("changed", { command: name }); }
  return true;
}

const controls = Object.fromEntries(["enabled", "sun", "shadows", "azimuth", "elevation", "ambient", "intensity", "anchor"].map(name => [name, document.querySelector(`#world-${name}`)]));
function syncControls() { if (!controls.enabled) return; controls.enabled.checked = state.enabled; controls.sun.checked = state.sun.enabled; controls.shadows.checked = state.shadowsEnabled; controls.azimuth.value = state.sun.azimuth; controls.elevation.value = state.sun.elevation; controls.ambient.value = state.ambient; controls.intensity.value = state.sun.intensity; controls.anchor.checked = state.blocks[0].anchored; document.querySelector("#world-azimuth-value").textContent = `${Math.round(state.sun.azimuth)}°`; document.querySelector("#world-elevation-value").textContent = `${Math.round(state.sun.elevation)}°`; }
controls.enabled?.addEventListener("change", event => command("set-enabled", { value: event.target.checked })); controls.sun?.addEventListener("change", event => command("set-sun", { enabled: event.target.checked })); controls.shadows?.addEventListener("change", event => command("set-shadows", { value: event.target.checked })); controls.anchor?.addEventListener("change", event => command("set-block-anchor", { id: state.blocks[0].id, value: event.target.checked }));
for (const name of ["azimuth", "elevation", "intensity"]) controls[name]?.addEventListener("input", event => command("set-sun", { [name]: Number(event.target.value) })); controls.ambient?.addEventListener("input", event => command("set-ambient", { value: Number(event.target.value) }));
document.querySelector("#world-reset")?.addEventListener("click", () => command("reset-lighting")); document.querySelectorAll("[data-world-move]").forEach(button => button.addEventListener("click", () => { const [dx, dy] = button.dataset.worldMove.split(",").map(Number); command("move-block", { id: state.blocks[0].id, dx, dy }); }));

for (const [name, url] of Object.entries(scene.assetReferences)) { const image = new Image(); image.addEventListener("load", requestRender); image.src = url; images.set(name, image); }
new ResizeObserver(requestRender).observe(workspace); new MutationObserver(requestRender).observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] }); window.addEventListener("resize", requestRender); window.addEventListener("scroll", requestRender, { passive: true });
window.addEventListener("flashframe:capture-appearance", event => { event.detail.appearance ||= {}; event.detail.appearance.omniWorld = structuredClone(state); }); window.addEventListener("flashframe:restore-appearance", event => { if (event.detail.appearance?.omniWorld) { state = { ...cloneDefaults(), ...event.detail.appearance.omniWorld }; saveState(); syncControls(); requestRender(); } });
window.SubstrateWorld = Object.freeze({ inspect, command, subscribe(listener) { if (typeof listener !== "function") throw new TypeError("Listener required"); listeners.add(listener); return () => listeners.delete(listener); }, registerObject(object, authorization) { if (authorization !== "substrate-internal") throw new DOMException("World mutation is not authorized", "SecurityError"); scene.objects.push(structuredClone(object)); requestRender(); }, updateObject(id, patch, authorization) { if (authorization !== "substrate-internal") throw new DOMException("World mutation is not authorized", "SecurityError"); const object = scene.objects.find(item => item.id === id); if (!object) return false; Object.assign(object, structuredClone(patch)); requestRender(); return true; }, requestRender });
syncControls(); requestRender(); emit("ready");

import { DEFAULT_SKIN_ID, inspectSkin, listSkins } from "./frame-registry.js";
import { FRAME_CATEGORIES, classifyFrame, readFramePreferences, resolveFrameAppearance, writeFramePreferences } from "./frame-preferences.js";
import { layoutContract, measureLayout } from "./frame-layout.js";

const FRAME_CAPABILITIES = Object.freeze(["move", "resize", "maximize", "close", "change-skin"]);
let preferences = readFramePreferences();
let managedRoot = null;
const observedFrames = new WeakSet();
const layoutObserver = globalThis.ResizeObserver ? new ResizeObserver(entries => { for (const entry of entries) updateLayout(entry.target); }) : null;

export function normalizeSkinId(id) { return inspectSkin(id)?.id || DEFAULT_SKIN_ID; }
export function frameOverride(frame) { return typeof frame?.dataset?.frameSkinOverride === "string" && frame.dataset.frameSkinOverride ? frame.dataset.frameSkinOverride : null; }

function updateLayout(frame) {
  const category = classifyFrame(frame), rect = frame.getBoundingClientRect(), layout = measureLayout(rect.width, rect.height, category), contract = layout.constraints;
  frame.dataset.frameCategory = category; frame.dataset.frameLayout = layout.state; frame.dataset.frameWidthState = layout.widthState; frame.dataset.frameHeightState = layout.heightState;
  frame.style.setProperty("--frame-min-width", `${contract.minWidth}px`); frame.style.setProperty("--frame-min-height", `${contract.minHeight}px`); frame.style.setProperty("--frame-header-height", `${contract.titleBarHeight}px`);
  return layout;
}

export function applyFrameSkin(frame, requestedOverride = frameOverride(frame), { emit = false } = {}) {
  if (!(frame instanceof Element)) return DEFAULT_SKIN_ID;
  const previous = frame.dataset.frameSkin || null;
  if (typeof requestedOverride === "string" && inspectSkin(requestedOverride)) frame.dataset.frameSkinOverride = requestedOverride; else delete frame.dataset.frameSkinOverride;
  const category = classifyFrame(frame), resolved = resolveFrameAppearance({ override: frameOverride(frame), category, preferences });
  frame.dataset.frameSkin = resolved.skinId; frame.dataset.frameSkinReason = resolved.reason;
  const selector = frame.querySelector(":scope > .block-header .frame-skin-select"); if (selector) selector.value = frameOverride(frame) || "";
  updateLayout(frame);
  if (emit && previous !== resolved.skinId) window.dispatchEvent(new CustomEvent("substrate:frame-skin-changed", { detail: { type: "FRAME_SKIN_CHANGED", frameId: frame.dataset.blockId, previousSkin: previous, newSkin: resolved.skinId, reason: resolved.reason, documentModelChanged: false, frameIdentityChanged: false } }));
  if (emit) frame.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  return resolved.skinId;
}

export function attachFramePresentation(frame, requestedOverride) {
  if (!(frame instanceof Element)) return frame;
  if (requestedOverride !== undefined) { if (requestedOverride) frame.dataset.frameSkinOverride = requestedOverride; else delete frame.dataset.frameSkinOverride; }
  const actions = frame.querySelector(":scope > .block-header .block-actions");
  if (actions && !actions.querySelector(".frame-skin-select")) {
    const label = document.createElement("label"); label.className = "frame-skin-picker"; label.title = "Frame appearance";
    const accessible = document.createElement("span"); accessible.className = "visually-hidden"; accessible.textContent = "Frame appearance";
    const select = document.createElement("select"); select.className = "frame-skin-select"; select.setAttribute("aria-label", "Frame appearance");
    const inherited = document.createElement("option"); inherited.value = ""; inherited.textContent = "Use default"; select.append(inherited);
    for (const skin of listSkins()) { const option = document.createElement("option"); option.value = skin.id; option.textContent = skin.name; select.append(option); }
    select.addEventListener("change", () => applyFrameSkin(frame, select.value || null, { emit: true })); label.append(accessible, select); actions.prepend(label);
  }
  applyFrameSkin(frame);
  if (!observedFrames.has(frame) && layoutObserver) { observedFrames.add(frame); layoutObserver.observe(frame); }
  return frame;
}

function refreshInheritingFrames() { for (const frame of managedRoot?.querySelectorAll(".block") || []) if (!frameOverride(frame)) applyFrameSkin(frame, null, { emit: true }); }
function updatePreferences(next) { preferences = writeFramePreferences(next); refreshInheritingFrames(); window.dispatchEvent(new CustomEvent("substrate:frame-appearance-defaults-changed", { detail: getPreferences() })); return getPreferences(); }
function getPreferences() { return structuredClone(preferences); }

function installSettings() {
  const body = document.querySelector("#settings-dock .settings-body"); if (!body || body.querySelector(".frame-appearance-settings")) return;
  const section = document.createElement("div"); section.className = "storage-setting frame-appearance-settings";
  const heading = document.createElement("div"); heading.innerHTML = "<strong>Frame appearances</strong><small>Choose the overall default, then optional defaults for each application or file category. Individual frame overrides always win.</small>"; section.append(heading);
  const addSelect = (labelText, category = null) => { const label = document.createElement("label"); label.className = "frame-default-row"; const text = document.createElement("span"); text.textContent = labelText; const select = document.createElement("select"); select.setAttribute("aria-label", `${labelText} appearance`); if (category) { const inherit = document.createElement("option"); inherit.value = ""; inherit.textContent = "Use overall default"; select.append(inherit); } for (const skin of listSkins()) { const option = document.createElement("option"); option.value = skin.id; option.textContent = skin.name; select.append(option); } select.value = category ? preferences.categories[category] || "" : preferences.overall; select.addEventListener("change", () => { const next = getPreferences(); if (category) { if (select.value) next.categories[category] = select.value; else delete next.categories[category]; } else next.overall = select.value; updatePreferences(next); }); label.append(text, select); section.append(label); };
  addSelect("Overall default"); for (const category of FRAME_CATEGORIES) addSelect(category[0].toUpperCase() + category.slice(1), category); body.append(section);
}

export function inspectFrame(frame) {
  if (!(frame instanceof Element)) return null; const header = frame.querySelector(":scope > .block-header"), category = classifyFrame(frame), rect = frame.getBoundingClientRect(), layout = measureLayout(rect.width, rect.height, category), override = frameOverride(frame), resolved = resolveFrameAppearance({ override, category, preferences });
  return Object.freeze({ frameId: frame.dataset.blockId || null, applicationType: frame.dataset.blockType || null, category, hasExplicitOverride: Boolean(override), overrideSkinId: override, resolvedSkinId: resolved.skinId, skinId: resolved.skinId, resolutionReason: resolved.reason, presentation: Object.freeze({ maximized: frame.classList.contains("is-maximized"), fixedToViewport: frame.classList.contains("is-viewport-fixed"), frameless: frame.classList.contains("is-frameless-media"), headerVisible: Boolean(header && getComputedStyle(header).display !== "none"), layoutState: layout.state, widthState: layout.widthState, heightState: layout.heightState, geometryConstraints: structuredClone(layout.constraints) }), capabilities: FRAME_CAPABILITIES });
}

export function framePresentationApi({ root, frameTypes }) {
  managedRoot = root; const find = id => [...root.querySelectorAll(".block[data-block-id]")].find(frame => frame.dataset.blockId === id);
  const observer = new MutationObserver(records => { for (const record of records) { for (const node of record.addedNodes) { if (!(node instanceof Element)) continue; if (node.matches(".block")) attachFramePresentation(node); for (const frame of node.querySelectorAll?.(".block") || []) attachFramePresentation(frame); } for (const node of record.removedNodes) { if (!(node instanceof Element)) continue; if (node.matches(".block")) layoutObserver?.unobserve(node); for (const frame of node.querySelectorAll?.(".block") || []) layoutObserver?.unobserve(frame); } } installSettings(); }); observer.observe(root, { childList: true, subtree: true });
  queueMicrotask(installSettings);
  return Object.freeze({ inspect(frameId) { return inspectFrame(find(frameId)); }, getAppearance(frameId) { const result = inspectFrame(find(frameId)); return result ? Object.freeze({ category: result.category, hasExplicitOverride: result.hasExplicitOverride, overrideSkinId: result.overrideSkinId, resolvedSkinId: result.resolvedSkinId, resolutionReason: result.resolutionReason, ...result.presentation }) : null; }, listSkins, inspectSkin, listFrameTypes() { return [...frameTypes()]; }, listCategories() { return [...FRAME_CATEGORIES]; }, getDefaults: getPreferences });
}

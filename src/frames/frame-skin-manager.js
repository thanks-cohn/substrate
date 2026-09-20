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

/** Position the menu in viewport coordinates; never make the frame wider to open it. */
export function positionFrameSkinMenu(rect, menuWidth, menuHeight, viewportWidth, viewportHeight) {
  const margin = 8;
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - menuWidth - margin));
  const below = rect.bottom + 5;
  const above = rect.top - menuHeight - 5;
  const top = below + menuHeight <= viewportHeight - margin
    ? below
    : above >= margin ? above : Math.max(margin, viewportHeight - menuHeight - margin);
  return { left, top };
}

let activePicker = null;

function closeFramePicker({ restoreFocus = false } = {}) {
  if (!activePicker) return;
  const { trigger, menu, onOutsidePointer, onKeyDown, reposition } = activePicker;
  activePicker = null;
  document.removeEventListener("pointerdown", onOutsidePointer, true);
  document.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("resize", reposition);
  window.removeEventListener("scroll", reposition, true);
  trigger.setAttribute("aria-expanded", "false");
  menu.remove();
  if (restoreFocus && trigger.isConnected) trigger.focus();
}

function openFramePicker(frame, trigger) {
  if (activePicker?.trigger === trigger) { closeFramePicker(); return; }
  closeFramePicker();

  const menu = document.createElement("div");
  menu.className = "frame-skin-popover";
  menu.id = `frame-skin-popover-${frame.dataset.blockId || "frame"}`;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Frame appearance");
  const options = [{ id: "", name: "Use default" }, ...listSkins()];
  const selectedId = frameOverride(frame) || "";

  for (const skin of options) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "frame-skin-option";
    option.setAttribute("role", "menuitemradio");
    option.setAttribute("aria-checked", String(skin.id === selectedId));
    option.dataset.skinId = skin.id;
    option.textContent = skin.name;
    option.addEventListener("click", event => {
      event.stopPropagation();
      applyFrameSkin(frame, skin.id || null, { emit: true });
      closeFramePicker({ restoreFocus: true });
    });
    menu.append(option);
  }

  // The parent .block uses overflow:hidden; a document-body portal keeps
  // the menu visible without changing the frame's geometry or stacking.
  document.body.append(menu);
  trigger.setAttribute("aria-expanded", "true");
  trigger.setAttribute("aria-controls", menu.id);
  const reposition = () => {
    if (!trigger.isConnected || !frame.isConnected) { closeFramePicker(); return; }
    const rect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const { left, top } = positionFrameSkinMenu(rect, menuRect.width, menuRect.height, innerWidth, innerHeight);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };
  const onOutsidePointer = event => {
    if (!menu.contains(event.target) && !trigger.contains(event.target)) closeFramePicker();
  };
  const onKeyDown = event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFramePicker({ restoreFocus: true });
      return;
    }
    if (!menu.contains(document.activeElement)) return;
    const items = [...menu.querySelectorAll(".frame-skin-option")];
    const index = items.indexOf(document.activeElement);
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index + items.length - 1) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Tab") { closeFramePicker(); return; }
    else return;
    event.preventDefault();
    items[next]?.focus();
  };
  activePicker = { frame, trigger, menu, onOutsidePointer, onKeyDown, reposition };
  document.addEventListener("pointerdown", onOutsidePointer, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  reposition();
  menu.querySelector('[aria-checked="true"]')?.focus();
}

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
  const trigger = frame.querySelector(":scope > .block-header .frame-skin-trigger");
  if (trigger) { const name = inspectSkin(resolved.skinId)?.name || "Frame"; trigger.title = `Frame appearance: ${name} — choose style`; trigger.setAttribute("aria-label", trigger.title); }
  updateLayout(frame);
  if (emit && previous !== resolved.skinId) window.dispatchEvent(new CustomEvent("substrate:frame-skin-changed", { detail: { type: "FRAME_SKIN_CHANGED", frameId: frame.dataset.blockId, previousSkin: previous, newSkin: resolved.skinId, reason: resolved.reason, documentModelChanged: false, frameIdentityChanged: false } }));
  if (emit) frame.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  return resolved.skinId;
}

export function attachFramePresentation(frame, requestedOverride) {
  if (!(frame instanceof Element)) return frame;
  if (requestedOverride !== undefined) { if (requestedOverride) frame.dataset.frameSkinOverride = requestedOverride; else delete frame.dataset.frameSkinOverride; }
  const actions = frame.querySelector(":scope > .block-header .block-actions");
  if (actions && !actions.querySelector(".frame-skin-trigger")) {
    const wrapper = document.createElement("span"); wrapper.className = "frame-skin-picker";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "frame-skin-trigger";
    trigger.textContent = "Appearance ▾";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", event => { event.stopPropagation(); openFramePicker(frame, trigger); });
    wrapper.append(trigger);
    actions.prepend(wrapper);
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
  const observer = new MutationObserver(records => { for (const record of records) { for (const node of record.addedNodes) { if (!(node instanceof Element)) continue; if (node.matches(".block")) attachFramePresentation(node); for (const frame of node.querySelectorAll?.(".block") || []) attachFramePresentation(frame); } for (const node of record.removedNodes) { if (!(node instanceof Element)) continue; if (node.matches(".block")) { layoutObserver?.unobserve(node); if (activePicker?.frame === node) closeFramePicker(); } for (const frame of node.querySelectorAll?.(".block") || []) layoutObserver?.unobserve(frame); } } installSettings(); }); observer.observe(root, { childList: true, subtree: true });
  queueMicrotask(installSettings);
  return Object.freeze({ inspect(frameId) { return inspectFrame(find(frameId)); }, getAppearance(frameId) { const result = inspectFrame(find(frameId)); return result ? Object.freeze({ category: result.category, hasExplicitOverride: result.hasExplicitOverride, overrideSkinId: result.overrideSkinId, resolvedSkinId: result.resolvedSkinId, resolutionReason: result.resolutionReason, ...result.presentation }) : null; }, listSkins, inspectSkin, listFrameTypes() { return [...frameTypes()]; }, listCategories() { return [...FRAME_CATEGORIES]; }, getDefaults: getPreferences });
}

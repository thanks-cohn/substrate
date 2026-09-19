import { DEFAULT_SKIN_ID, inspectSkin, listSkins, resolveSkin } from "./frame-registry.js";

const FRAME_CAPABILITIES = Object.freeze(["move", "resize", "maximize", "close", "change-skin"]);

export function normalizeSkinId(id, frameType) { return resolveSkin(id, frameType)?.id || DEFAULT_SKIN_ID; }

export function applyFrameSkin(frame, requestedId, { emit = false } = {}) {
  if (!(frame instanceof Element)) return DEFAULT_SKIN_ID;
  const previous = normalizeSkinId(frame.dataset.frameSkin, frame.dataset.blockType);
  const skinId = normalizeSkinId(requestedId, frame.dataset.blockType);
  frame.dataset.frameSkin = skinId;
  frame.querySelector(":scope > .block-header .frame-skin-select")?.setAttribute("value", skinId);
  const selector = frame.querySelector(":scope > .block-header .frame-skin-select");
  if (selector) selector.value = skinId;
  if (emit && previous !== skinId) {
    window.dispatchEvent(new CustomEvent("substrate:frame-skin-changed", { detail: {
      type: "FRAME_SKIN_CHANGED", frameId: frame.dataset.blockId, previousSkin: previous,
      newSkin: skinId, documentModelChanged: false, frameIdentityChanged: false
    } }));
  }
  return skinId;
}

export function attachFramePresentation(frame, requestedId) {
  applyFrameSkin(frame, requestedId);
  const actions = frame.querySelector(":scope > .block-header .block-actions");
  if (!actions || actions.querySelector(".frame-skin-select")) return frame;
  const label = document.createElement("label");
  label.className = "frame-skin-picker";
  label.title = "Frame appearance";
  const accessible = document.createElement("span"); accessible.className = "visually-hidden"; accessible.textContent = "Frame appearance";
  const select = document.createElement("select"); select.className = "frame-skin-select"; select.setAttribute("aria-label", "Frame appearance");
  for (const skin of listSkins()) { const option = document.createElement("option"); option.value = skin.id; option.textContent = skin.name; select.append(option); }
  select.value = frame.dataset.frameSkin;
  select.addEventListener("change", () => applyFrameSkin(frame, select.value, { emit: true }));
  label.append(accessible, select); actions.prepend(label);
  return frame;
}

export function inspectFrame(frame) {
  if (!(frame instanceof Element)) return null;
  const header = frame.querySelector(":scope > .block-header");
  return Object.freeze({
    frameId: frame.dataset.blockId || null,
    applicationType: frame.dataset.blockType || null,
    skinId: normalizeSkinId(frame.dataset.frameSkin, frame.dataset.blockType),
    presentation: Object.freeze({
      maximized: frame.classList.contains("is-maximized"),
      fixedToViewport: frame.classList.contains("is-viewport-fixed"),
      frameless: frame.classList.contains("is-frameless-media"),
      headerVisible: Boolean(header && getComputedStyle(header).display !== "none")
    }),
    capabilities: FRAME_CAPABILITIES
  });
}

export function framePresentationApi({ root, frameTypes }) {
  const find = id => [...root.querySelectorAll(".block[data-block-id]")].find(frame => frame.dataset.blockId === id);
  return Object.freeze({
    inspect(frameId) { return inspectFrame(find(frameId)); },
    getAppearance(frameId) { const result = inspectFrame(find(frameId)); return result ? Object.freeze({ skinId: result.skinId, ...result.presentation }) : null; },
    listSkins,
    inspectSkin,
    listFrameTypes() { return [...frameTypes()]; }
  });
}

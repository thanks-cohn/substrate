import { DEFAULT_SKIN_ID, resolveSkin } from "./frame-registry.js";

export const FRAME_APPEARANCE_KEY = "substrate.frame-appearance.v1";
export const FRAME_CATEGORIES = Object.freeze(["pdf", "docx", "image", "gallery", "video", "audio", "canvas", "text", "data", "archive", "web", "generic"]);
const CUSTOM_CATEGORIES = Object.freeze({ image: "image", gallery: "gallery", video: "video", audio: "audio", canvas: "canvas", web: "web", "remote-video": "video", pdf: "pdf", file: "generic" });
const TYPE_CATEGORIES = Object.freeze({ pdf: "pdf", docx: "docx", gallery: "gallery", video: "video", text: "text", csv: "data", zip: "archive", cbz: "archive" });

export function classifyFrame(frame) {
  const explicit = frame?.dataset?.frameCategory;
  if (FRAME_CATEGORIES.includes(explicit)) return explicit;
  return CUSTOM_CATEGORIES[frame?.dataset?.customKind] || TYPE_CATEGORIES[frame?.dataset?.blockType] || "generic";
}

export function sanitizePreferences(value = {}) {
  const overall = resolveSkin(value.overall, "*").id;
  const categories = {};
  for (const category of FRAME_CATEGORIES) if (typeof value.categories?.[category] === "string" && resolveSkin(value.categories[category], category).id === value.categories[category]) categories[category] = value.categories[category];
  return { version: 1, overall, categories };
}

export function resolveFrameAppearance({ override = null, category = "generic", preferences = {} } = {}) {
  const prefs = sanitizePreferences(preferences);
  if (typeof override === "string" && resolveSkin(override, category).id === override) return { skinId: override, reason: "frame-override" };
  const categorySkin = prefs.categories[category];
  if (categorySkin) return { skinId: categorySkin, reason: "category-default" };
  if (prefs.overall) return { skinId: prefs.overall, reason: "overall-default" };
  return { skinId: DEFAULT_SKIN_ID, reason: "modern-fallback" };
}

export function readFramePreferences(storage = globalThis.localStorage) {
  try { return sanitizePreferences(JSON.parse(storage?.getItem(FRAME_APPEARANCE_KEY) || "{}")); } catch { return sanitizePreferences(); }
}
export function writeFramePreferences(value, storage = globalThis.localStorage) {
  const preferences = sanitizePreferences(value); storage?.setItem(FRAME_APPEARANCE_KEY, JSON.stringify(preferences)); return preferences;
}

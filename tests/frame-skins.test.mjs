import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_SKIN_ID, inspectSkin, listSkins, resolveSkin } from "../src/frames/frame-registry.js";
import { duplicateBlockRecord } from "../src/actions/block-records.js";
import { FRAME_APPEARANCE_KEY, classifyFrame, readFramePreferences, resolveFrameAppearance, writeFramePreferences } from "../src/frames/frame-preferences.js";
import { layoutContract, measureLayout } from "../src/frames/frame-layout.js";

test("bundled manifests and synchronous registry agree", async () => {
  const skins = listSkins();
  assert.deepEqual(skins.map(s => s.id), ["modern", "mac-classic", "windows-98"]);
  for (const skin of skins) {
    const manifest = JSON.parse(await readFile(new URL(`../src/skins/${skin.id}/manifest.json`, import.meta.url)));
    for (const key of ["id", "name", "version", "description", "css", "supportedFrameTypes", "capabilities"]) assert.deepEqual(manifest[key], key === "css" ? "skin.css" : skin[key]);
  }
});

test("unknown and incompatible skin identifiers fall back without throwing", () => {
  assert.equal(resolveSkin("missing", "docx").id, DEFAULT_SKIN_ID);
  assert.equal(resolveSkin(null, "pdf").id, DEFAULT_SKIN_ID);
  assert.equal(inspectSkin("missing"), null);
});

test("registry results are defensive copies", () => {
  const skins = listSkins(); skins[0].name = "changed";
  assert.equal(inspectSkin("modern").name, "Modern");
});

test("workspace records preserve independent skin state through duplication", () => {
  const original = { id: "doc-a", type: "docx", skinId: "mac-classic", geometry: { x: 1, y: 2 }, state: { text: "unchanged" } };
  const copy = duplicateBlockRecord(original, { id: "doc-b" });
  assert.equal(copy.skinId, "mac-classic");
  assert.equal(copy.id, "doc-b");
  assert.deepEqual(copy.state, original.state);
  copy.state.text = "copy";
  assert.equal(original.state.text, "unchanged");
});

test("switching one frame preserves identities, geometry, and neighboring state", async () => {
  const OriginalElement = globalThis.Element;
  class FakeFrame {
    constructor(id, type) { this.dataset = { blockId: id, blockType: type, frameSkin: "modern" }; this.geometry = { x: 20, y: 30, width: 640, height: 480 }; this.applicationState = { cursor: 17 }; this.style = { setProperty() {} }; }
    querySelector() { return null; }
    getBoundingClientRect() { return this.geometry; }
  }
  globalThis.Element = FakeFrame;
  try {
    const { applyFrameSkin } = await import("../src/frames/frame-skin-manager.js");
    const first = new FakeFrame("doc-a", "docx"), second = new FakeFrame("doc-b", "docx");
    const geometry = structuredClone(first.geometry), state = structuredClone(first.applicationState);
    applyFrameSkin(first, "mac-classic");
    assert.equal(first.dataset.blockId, "doc-a");
    assert.equal(first.dataset.frameSkin, "mac-classic");
    assert.equal(second.dataset.frameSkin, "modern");
    assert.deepEqual(first.geometry, geometry);
    assert.deepEqual(first.applicationState, state);
  } finally { globalThis.Element = OriginalElement; }
});

test("appearance inheritance follows override, category, overall, fallback order", () => {
  const preferences = { overall: "windows-98", categories: { docx: "mac-classic" } };
  assert.deepEqual(resolveFrameAppearance({ override: "modern", category: "docx", preferences }), { skinId: "modern", reason: "frame-override" });
  assert.deepEqual(resolveFrameAppearance({ category: "docx", preferences }), { skinId: "mac-classic", reason: "category-default" });
  assert.deepEqual(resolveFrameAppearance({ category: "pdf", preferences }), { skinId: "windows-98", reason: "overall-default" });
  assert.deepEqual(resolveFrameAppearance({ override: "unknown", category: "docx", preferences }), { skinId: "mac-classic", reason: "category-default" });
});

test("appearance defaults persist in their own backwards-compatible settings record", () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  writeFramePreferences({ overall: "mac-classic", categories: { pdf: "modern", bogus: "windows-98" } }, storage);
  assert.equal(values.has(FRAME_APPEARANCE_KEY), true);
  assert.deepEqual(readFramePreferences(storage), { version: 1, overall: "mac-classic", categories: { pdf: "modern" } });
});

test("canonical metadata classifies application and file categories without titles or CSS", () => {
  assert.equal(classifyFrame({ dataset: { blockType: "pdf" } }), "pdf");
  assert.equal(classifyFrame({ dataset: { blockType: "text", customKind: "image" } }), "image");
  assert.equal(classifyFrame({ dataset: { blockType: "text", frameCategory: "audio" } }), "audio");
  assert.equal(classifyFrame({ dataset: { blockType: "unknown" } }), "generic");
});

test("layout state measures width and height independently with deterministic constraints", () => {
  assert.deepEqual(measureLayout(400, 500, "pdf").state, "narrow-tall");
  assert.deepEqual(measureLayout(800, 200, "pdf").state, "wide-short");
  assert.equal(layoutContract("pdf").minWidth, 360);
  assert.equal(layoutContract("audio").minHeight, 160);
});

test("skin CSS is frame-scoped and avoids document rendering selectors", async () => {
  for (const { id } of listSkins()) {
    const css = await readFile(new URL(`../src/skins/${id}/skin.css`, import.meta.url), "utf8");
    if (id !== "modern") assert.match(css, new RegExp(`\\.block\\[data-frame-skin=["']${id}["']\\]`));
    assert.doesNotMatch(css, /(?:pdf-text-layer|pdf-surface|docx-editor|contenteditable|canvas)/);
    assert.doesNotMatch(css, /!important/);
  }
});

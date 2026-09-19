import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_SKIN_ID, inspectSkin, listSkins, resolveSkin } from "../src/frames/frame-registry.js";
import { duplicateBlockRecord } from "../src/actions/block-records.js";

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
    constructor(id, type) { this.dataset = { blockId: id, blockType: type, frameSkin: "modern" }; this.geometry = { x: 20, y: 30, width: 640, height: 480 }; this.applicationState = { cursor: 17 }; }
    querySelector() { return null; }
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

test("skin CSS is frame-scoped and avoids document rendering selectors", async () => {
  for (const { id } of listSkins()) {
    const css = await readFile(new URL(`../src/skins/${id}/skin.css`, import.meta.url), "utf8");
    if (id !== "modern") assert.match(css, new RegExp(`\\.block\\[data-frame-skin=["']${id}["']\\]`));
    assert.doesNotMatch(css, /(?:pdf-text-layer|pdf-surface|docx-editor|contenteditable|canvas)/);
    assert.doesNotMatch(css, /!important/);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functionBody = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf("\nfunction ", start + 10);
  return source.slice(start, next < 0 ? source.length : next);
};

test("web marker updates do not reference construction-only options", async () => {
  const source = await readFile(new URL("../src/web-drop.js", import.meta.url), "utf8");
  const marker = functionBody(source, "writeMarker");
  const construction = functionBody(source, "buildShell");
  assert.doesNotMatch(marker, /\boptions\b/);
  assert.match(construction, /options\.skinOverride/);
  assert.match(construction, /dataset\.frameCategory/);
});

test("custom reconstruction forwards explicit overrides and permits inheritance", async () => {
  const source = await readFile(new URL("../src/web-drop.js", import.meta.url), "utf8");
  const restore = functionBody(source, "convertRestoredMarker");
  assert.match(restore, /skinOverride:\s*block\.dataset\.frameSkinOverride\s*\|\|\s*null/);
});

test("remote-video construction and reconstruction preserve appearance metadata", async () => {
  const source = await readFile(new URL("../src/remote-video.js", import.meta.url), "utf8");
  const construction = functionBody(source, "createRemoteVideoBlock");
  const restore = functionBody(source, "convertRestoredRemoteVideo");
  assert.match(construction, /dataset\.frameCategory\s*=\s*"video"/);
  assert.match(construction, /options\.skinOverride/);
  assert.match(restore, /skinOverride:\s*block\.dataset\.frameSkinOverride\s*\|\|\s*null/);
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { SKETCH_TOWN_ASSET_PATHS } from "../src/worlds/omni-world-model.mjs";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, "scripts/prepare-sketch-town-assets.py");
const archive = join(root, "assets/worlds/sketch-town/kenney_sketchTown.zip");
const names = ["grass.png", "path.png", "building.png", "tree.png", "trees.png"];

function run(...arguments_) { return spawnSync("python3", [script, ...arguments_], { encoding: "utf8" }); }

test("runtime asset paths resolve from the world module into src/assets", () => {
  const moduleUrl = new URL("../src/worlds/omni-world.js", import.meta.url);
  assert.deepEqual(Object.values(SKETCH_TOWN_ASSET_PATHS).map(path => new URL(path, moduleUrl).pathname), names.map(name => join(root, "src/assets/worlds/sketch-town", name)));
});

test("preparation extracts every browser-loadable PNG to the renderer paths", async () => {
  const output = await mkdtemp(join(tmpdir(), "sketch-town-assets-"));
  const result = run("--archive", archive, "--output", output);
  assert.equal(result.status, 0, result.stderr);
  for (const name of names) {
    const bytes = await readFile(join(output, name));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, `${name} has valid PNG dimensions`);
  }
});

test("preparation clearly rejects missing and corrupt archives", async () => {
  const output = await mkdtemp(join(tmpdir(), "sketch-town-errors-"));
  const missing = run("--archive", join(output, "missing.zip"), "--output", output);
  assert.notEqual(missing.status, 0); assert.match(missing.stderr, /archive is missing/i);
  const corruptPath = join(output, "corrupt.zip"); await writeFile(corruptPath, "not a zip");
  const corrupt = run("--archive", corruptPath, "--output", output);
  assert.notEqual(corrupt.status, 0); assert.match(corrupt.stderr, /archive is corrupt/i);
});

test("preparation refuses a valid ZIP that lacks a required mapped entry", async () => {
  const output = await mkdtemp(join(tmpdir(), "sketch-town-incomplete-"));
  const incomplete = join(output, "incomplete.zip");
  const creation = spawnSync("python3", ["-c", "import sys,zipfile; zipfile.ZipFile(sys.argv[1],'w').writestr('Tiles/grass_center_N.png',b'no')", incomplete], { encoding: "utf8" });
  assert.equal(creation.status, 0, creation.stderr);
  const result = run("--archive", incomplete, "--output", output);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /lacks required assets/i);
});

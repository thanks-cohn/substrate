import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cloneDefaults, createProjection, frameToWorldGeometry, importTiledMap, importWorldScene, localToWorld, normalizeLighting, projectPoint, projectShadow, unprojectGround, worldToLocal } from "../src/worlds/omni-world-model.mjs";

test("loads the editable Tiled scene and preserves layers, IDs, and tileset source", async () => {
  const map = JSON.parse(await readFile(new URL("../src/assets/worlds/sketch-town/scene.json", import.meta.url)));
  const block = importTiledMap(map, { id: "kenney" });
  assert.equal(block.source.orientation, "isometric"); assert.equal(block.source.tilesets[0].source, "source/Map/map_tiles.tsx"); assert.deepEqual(block.layers.map(layer => layer.type), ["tilelayer", "objectgroup"]); assert.equal(block.layers[1].objects[0].id, 1);
});

test("supported Tiled data becomes engine-neutral town tiles and scenery", async () => {
  const map = JSON.parse(await readFile(new URL("../src/assets/worlds/sketch-town/scene.json", import.meta.url)));
  const scene = importWorldScene(map, { tileAssets: { 1: "grass", 2: "path" } });
  assert.equal(scene.tiles.length, 165);
  assert.equal(scene.tiles.filter(tile => tile.asset === "path").length, 25);
  assert.deepEqual(scene.objects.map(object => object.asset), ["building", "tree", "tree", "trees"]);
  assert.deepEqual(scene.objects[0].source, { layerId: "2", objectId: 1 });
});

test("isometric projection round trips ground coordinates and respects elevation", () => {
  const projection = createProjection(), origin = { x: 420, y: 120 }, point = { x: 5, y: 2, z: 0 };
  assert.deepEqual(unprojectGround(projectPoint(point, projection, origin), projection, origin), point);
  assert.ok(projectPoint({ ...point, z: 20 }, projection, origin).y < projectPoint(point, projection, origin).y);
});

test("World Block translation does not rewrite child-local geometry", () => {
  const local = { x: 3, y: 4, z: 2 }, block = { transform: { x: 100, y: 200, z: 5, scale: 2 } }, before = { ...local };
  const world = localToWorld(block, local); assert.deepEqual(world, { x: 106, y: 208, z: 9 }); assert.deepEqual(worldToLocal(block, world), local); assert.deepEqual(local, before);
});

test("frame mapping preserves readability and shadow follows movement, resize, direction, and elevation", () => {
  const projection = createProjection(), frame = frameToWorldGeometry({ x: 40, y: 60, width: 200, height: 100 }, projection, { x: 0, y: 0 }, { id: "pdf", elevation: 30 });
  assert.equal(frame.receivesWorldLighting, false); assert.equal(frame.castsWorldShadow, true); assert.equal(frame.corners.length, 4);
  const low = projectShadow(frame, { enabled: true, azimuth: 0, elevation: 20 }), high = projectShadow(frame, { enabled: true, azimuth: 0, elevation: 70 }), other = projectShadow(frame, { enabled: true, azimuth: 180, elevation: 20 });
  assert.ok(Math.abs(low[0].x - frame.corners[0].x) > Math.abs(high[0].x - frame.corners[0].x)); assert.ok(Math.sign(low[0].x - frame.corners[0].x) !== Math.sign(other[0].x - frame.corners[0].x));
  const resized = frameToWorldGeometry({ x: 80, y: 60, width: 300, height: 140 }, projection, { x: 0, y: 0 }); assert.notDeepEqual(projectShadow(resized, { enabled: true, azimuth: 0, elevation: 20 }), low);
});

test("lighting preferences validate toggles and numeric ranges without mutating defaults", () => {
  const defaults = cloneDefaults(), lighting = normalizeLighting({ enabled: true, shadowsEnabled: false, ambient: 9, sun: { enabled: false, azimuth: -45, elevation: 0, intensity: -2 } });
  assert.equal(lighting.enabled, true); assert.equal(lighting.shadowsEnabled, false); assert.equal(lighting.ambient, 1); assert.deepEqual([lighting.sun.enabled, lighting.sun.azimuth, lighting.sun.elevation, lighting.sun.intensity], [false, 315, 1, 0]); assert.equal(defaults.blocks[0].anchored, false);
});

test("invalid frame geometry and disabled shadows fail safely", () => {
  assert.equal(frameToWorldGeometry({ x: 0, y: 0, width: -1, height: 2 }, createProjection(), { x: 0, y: 0 }), null); assert.deepEqual(projectShadow({ castsWorldShadow: true, corners: [] }, { enabled: true }), []); assert.deepEqual(projectShadow({ castsWorldShadow: true, corners: [{ x: 0, y: 0 }] }, { enabled: false }), []);
});

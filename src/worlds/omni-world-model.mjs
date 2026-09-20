export const DEFAULT_WORLD_STATE = Object.freeze({
  enabled: false,
  shadowsEnabled: true,
  ambient: 0.62,
  sun: Object.freeze({ enabled: true, azimuth: 315, elevation: 42, intensity: 0.82, color: "#fff4d6" }),
  blocks: Object.freeze([{ id: "kenney-sketch-town", name: "Sketch Town", anchored: false, transform: { x: 760, y: 520, z: 0, scale: 1 }, footprint: { width: 960, height: 720 } }])
});

export const SKETCH_TOWN_ASSET_PATHS = Object.freeze({
  grass: "../assets/worlds/sketch-town/grass.png",
  path: "../assets/worlds/sketch-town/path.png",
  building: "../assets/worlds/sketch-town/building.png",
  tree: "../assets/worlds/sketch-town/tree.png",
  trees: "../assets/worlds/sketch-town/trees.png"
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, low, high) => Math.min(high, Math.max(low, finite(value, low)));
export const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_WORLD_STATE));

/** X points east, Y south on the ground, and Z upward. Projection is presentation-only. */
export function createProjection(options = {}) {
  const tileWidth = clamp(options.tileWidth ?? 64, 1, 1000);
  const tileHeight = clamp(options.tileHeight ?? 32, 1, 1000);
  const elevationScale = clamp(options.elevationScale ?? 1, .01, 100);
  return { id: "isometric", tileWidth, tileHeight, elevationScale };
}

export function projectPoint(point, projection = createProjection(), origin = { x: 0, y: 0 }) {
  const x = finite(point?.x), y = finite(point?.y), z = finite(point?.z);
  return { x: finite(origin.x) + (x - y) * projection.tileWidth / 2, y: finite(origin.y) + (x + y) * projection.tileHeight / 2 - z * projection.elevationScale };
}

export function unprojectGround(point, projection = createProjection(), origin = { x: 0, y: 0 }) {
  const sx = (finite(point?.x) - finite(origin.x)) / (projection.tileWidth / 2);
  const sy = (finite(point?.y) - finite(origin.y)) / (projection.tileHeight / 2);
  return { x: (sx + sy) / 2, y: (sy - sx) / 2, z: 0 };
}

export function localToWorld(block, point) {
  const scale = clamp(block?.transform?.scale ?? 1, .01, 100);
  return { x: finite(block?.transform?.x) + finite(point?.x) * scale, y: finite(block?.transform?.y) + finite(point?.y) * scale, z: finite(block?.transform?.z) + finite(point?.z) * scale };
}

export function worldToLocal(block, point) {
  const scale = clamp(block?.transform?.scale ?? 1, .01, 100);
  return { x: (finite(point?.x) - finite(block?.transform?.x)) / scale, y: (finite(point?.y) - finite(block?.transform?.y)) / scale, z: (finite(point?.z) - finite(block?.transform?.z)) / scale };
}

export function normalizeLighting(input = {}) {
  const base = cloneDefaults();
  const sun = input.sun || {};
  return {
    enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
    shadowsEnabled: input.shadowsEnabled === undefined ? base.shadowsEnabled : Boolean(input.shadowsEnabled),
    ambient: clamp(input.ambient ?? base.ambient, 0, 1),
    sun: { enabled: sun.enabled === undefined ? base.sun.enabled : Boolean(sun.enabled), azimuth: ((finite(sun.azimuth, base.sun.azimuth) % 360) + 360) % 360, elevation: clamp(sun.elevation ?? base.sun.elevation, 1, 89), intensity: clamp(sun.intensity ?? base.sun.intensity, 0, 1), color: /^#[0-9a-f]{6}$/i.test(sun.color || "") ? sun.color : base.sun.color }
  };
}

export function frameToWorldGeometry(rect, projection, origin, options = {}) {
  if (![rect?.x, rect?.y, rect?.width, rect?.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const corners = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]].map(([x, y]) => unprojectGround({ x, y }, projection, origin));
  return { id: options.id || null, kind: "application-frame", corners, elevation: clamp(options.elevation ?? 28, 0, 10000), castsWorldShadow: options.castsWorldShadow !== false, receivesWorldLighting: options.receivesWorldLighting === true };
}

export function projectShadow(object, sun) {
  if (!object?.castsWorldShadow || !Array.isArray(object.corners) || object.corners.length < 3 || !sun?.enabled) return [];
  const elevation = clamp(sun.elevation, 1, 89) * Math.PI / 180;
  const azimuth = finite(sun.azimuth) * Math.PI / 180;
  const length = Math.max(0, finite(object.elevation)) / Math.tan(elevation);
  const dx = -Math.cos(azimuth) * length, dy = -Math.sin(azimuth) * length;
  return object.corners.map(point => ({ x: finite(point.x) + dx, y: finite(point.y) + dy, z: 0 }));
}

export function importTiledMap(map, { id = "imported-world", transform = { x: 0, y: 0, z: 0, scale: 1 } } = {}) {
  if (!map || ![map.width, map.height, map.tilewidth, map.tileheight].every(value => Number.isFinite(Number(value)) && Number(value) > 0)) throw new TypeError("Invalid Tiled map dimensions");
  const layers = (map.layers || []).filter(layer => layer && (layer.type === "tilelayer" || layer.type === "objectgroup")).map(layer => ({ id: String(layer.id), name: String(layer.name || ""), type: layer.type, data: Array.isArray(layer.data) ? [...layer.data] : undefined, objects: Array.isArray(layer.objects) ? layer.objects.map(object => ({ ...object })) : undefined }));
  return { id, source: { format: "tiled-json", orientation: map.orientation || "orthogonal", tileWidth: Number(map.tilewidth), tileHeight: Number(map.tileheight), tilesets: (map.tilesets || []).map(set => ({ firstgid: set.firstgid, source: set.source })) }, transform: { ...transform }, footprint: { width: Number(map.width), height: Number(map.height) }, layers, objects: [] };
}

/** Convert the supported Tiled subset at the boundary into engine-neutral scene data. */
export function importWorldScene(map, { tileAssets = {}, objectAssets = {} } = {}) {
  const imported = importTiledMap(map);
  const width = imported.footprint.width;
  const tiles = imported.layers.filter(layer => layer.type === "tilelayer").flatMap(layer => (layer.data || []).flatMap((gid, index) => {
    const asset = tileAssets[gid];
    return asset ? [{ id: `${layer.id}:${index}`, asset, local: { x: index % width, y: Math.floor(index / width), z: 0 }, source: { layerId: layer.id, gid } }] : [];
  }));
  const objects = imported.layers.filter(layer => layer.type === "objectgroup").flatMap(layer => (layer.objects || []).flatMap(object => {
    const properties = Object.fromEntries((object.properties || []).map(property => [property.name, property.value]));
    const asset = properties.asset || objectAssets[object.type];
    if (!asset) return [];
    return [{ id: `tiled:${layer.id}:${object.id}`, name: object.name || "", kind: "scenery", asset, local: { x: finite(object.x), y: finite(object.y), z: finite(properties.elevation) }, source: { layerId: layer.id, objectId: object.id } }];
  }));
  return { id: "world-scene", footprint: imported.footprint, tiles, objects, source: imported.source };
}

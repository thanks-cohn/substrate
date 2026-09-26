# Omni World foundation

The first Omni World is a deliberately small, engine-neutral world beneath the existing HTML workspace. It uses no Phaser or Tiled runtime. The canonical runtime state belongs to SUBSTRATE; Tiled JSON is an import/interchange source.

## Coordinates and portable World Blocks

World space is right-handed: **X east**, **Y south** along the ground, and **Z up**. A World Block has a stable `id`, a global `transform {x,y,z,scale}`, an artwork-independent `footprint`, and children whose `local` coordinates never change when the block moves. Conversion is:

1. block-local → world: `world = block.transform + local * scale`;
2. world → isometric projection: `screenX = originX + (X-Y)*tileWidth/2`, `screenY = originY + (X+Y)*tileHeight/2-Z*elevationScale`;
3. projected workspace → viewport: subtract scroll/camera position;
4. the inverse ground transform recovers X/Y at Z=0.

Moving Sketch Town changes only its transform. Anchoring prevents user move commands. Tile layers, semantic object identities, asset references, and relationships remain local to the block, allowing independent future blocks to coexist.

## Lighting and shadows

Frames remain normal DOM applications and default to `castsWorldShadow=true` and `receivesWorldLighting=false`. Their workspace rectangles are inverse-projected to ground geometry. A directional sun offsets each corner by `height / tan(elevation)` opposite the sun azimuth; that world polygon is then projected through the same renderer as the terrain. Rendering is invalidation-driven (state, geometry, resize, or scroll changes), not a continuous game loop.

## Authorized interface

`window.SubstrateWorld` exposes:

- `inspect()` — a structured clone of plane, camera/viewport, projection, lighting, World Blocks, frame geometry, readability flags, and computed shadow polygons;
- `command(name, payload)` — validated commands: `set-enabled`, `set-sun`, `set-shadows`, `set-ambient`, `move-block`, `set-block-anchor`, `reset-lighting`, and `request-render`;
- `subscribe(listener)` — returns an unsubscribe function for meaningful world events;
- `registerObject` and `updateObject` — authoring hooks requiring the internal authorization capability string. They expose neither files nor document contents;
- `requestRender()` — invalidates the renderer.

The Settings controls call this same command interface. State is kept in local preferences and included in normal workspace appearance snapshots.

## Tiled import and assets

`importTiledMap` supports finite Tiled JSON dimensions, external tileset references, tile layers, and object layers while retaining IDs. Unsupported editor metadata is ignored without taking ownership of unrelated workspace state. `scene.json` is the editable test scene; the original empty 60×60 isometric TMX and TSX are retained under `source/Map/`.

From a fresh checkout, run `python3 scripts/prepare-sketch-town-assets.py`. It extracts exact Kenney entries into the ignored runtime paths `src/assets/worlds/sketch-town/{grass,path,building,tree,trees}.png`. The mapping is explicit in the script and failures are fatal; no substitute artwork is generated. `scripts/package-web-store.sh` invokes this step automatically, packages that five-image subset, and omits the complete source ZIP. Thus extension users receive ready-to-load artwork without needing Python or Tiled, while the pull request remains text-only.

Sketch Town 1.0 was created by Kenney and released under CC0. The supplied `License.txt` is retained with the editable source.

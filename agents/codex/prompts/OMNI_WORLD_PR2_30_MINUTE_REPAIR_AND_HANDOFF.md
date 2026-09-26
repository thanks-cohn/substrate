# Codex run — Omni World PR #2: repair the first town, preserve progress, and hand off
**Repository:** `thanks-cohn/substrate`  
**Existing, UNMERGED PR:** https://github.com/thanks-cohn/substrate/pull/2  
**Work on the existing PR head branch:** `codex/implement-2.5d-world-with-kenney-assets`  
**Base:** `main`  
**Run objective:** Make the existing Kenney Sketch Town reliably appear beneath ordinary HTML application frames, improve canonical World Block geometry and viewport alignment, complete the first controllable sun and ground-shadow demonstration as time allows, and leave a usable, COMMITTED continuation handoff. **Never merge automatically.**

## Mandatory time and recovery contract — read this FIRST

**The run has an approximately 30-minute total time budget. Do not spend 30 minutes coding and then start a handoff.** Target 0–3 minutes for the baseline/checkpoint, ~3–23 minutes for small prioritized, verified fixes, ~23–25 minutes for the last safe code checkpoint, and **reserve at least the final 5 minutes** for verification, a factual handoff, and final push. If the runner exposes a shorter remaining time or an impending cutoff, stop coding immediately and hand off. No continuous background task or promise of a later handoff.

- First, check the actual branch, worktree status, PR head, and latest tests. **Do not reset, discard, force-push, overwrite others' changes, or start a different PR.** If the PR head has advanced beyond the reference above, inspect/rebase/reconcile before edits; the live branch state wins over descriptions in this prompt.
- Create `docs/handoffs/OMNI_WORLD_PR2_CURRENT_HANDOFF.md` at the **start** of the run with the actual branch/HEAD, PR link, timestamp if available, current verified condition, initial priorities, risks, and the next safe recovery step. Commit/push this *early* as a checkpoint, even if little code has yet changed.
- Implement in small coherent batches and commit/push verified increments **during** the run. Maintain or update the handoff as understanding changes. If a feature is unfinished/broken, do not represent it as done: revert its unsafe partial changes or isolate them without breaking the current PR; record the work, blockers, and recovery steps.
- Around minute 23–25, **stop starting features**. Reserve the remaining time to commit/push all coherent code, update the handoff with evidence and an exact next-run prompt, and confirm the remote commit SHA and PR status. The handoff is more important than an extra feature.
- If remote push/commit fails, provide an explicit failure report and copyable continuation details. Do not claim the handoff is saved to GitHub unless it is. Never merge PR #2 automatically.

## Context and boundaries

Read the actual PR branch files, tests, and existing proposals; do not implement exclusively from this prompt or repeat already fixed work:
- `src/worlds/omni-world.js`, `src/worlds/omni-world-model.mjs`
- `src/assets/worlds/sketch-town/scene.json`, `src/assets/worlds/sketch-town/source/Map/`
- `assets/worlds/sketch-town/kenney_sketchTown.zip`
- `scripts/prepare-sketch-town-assets.py`, `scripts/package-web-store.sh`
- `src/workspace.html`, `src/workspace.css`, relevant existing workspace/scroll/snapshot/frame code and tests
- `Proposals/omni-world-engine-neutral-2-5d-worlds-rend.md`
- `Proposals/omni-behavior-language-semantic-action-compiler.md`

**Preserve, do not replace,** existing PDF/DOCX/media functionality, expandable workspace, frame skins, snapshot/persistence, editable HTML frames, and engine-neutral Omni World. Tiled is an **authoring/input format**; SUBSTRATE owns the canonical world geometry, object identities, transforms, semantic references, permissions, projection, and logical lights. Phaser and other builders are future optional adapters, not mandatory here. The first village is a **portable World Block**, not a fullscreen wallpaper and not an independent game application. Ordinary documents remain readable, editable, and above the environment. A user who opts into the world should see it under the frames on reopening; the ordinary workspace should remain available when disabled or when rendering fails.

**Keep delivery text-only:** The Kenney ZIP is already tracked on `main`. Preserve the existing reproducible asset-extraction script and license, ensure referenced PNGs are prepared locally and inside packaged extension, and do not add generated PNGs, ZIP duplicates, embedded base64 images, or GIT binary patches to this PR. A user of the packaged extension should not need Python, Tiled, or Phaser. Verify the existing archive entries rather than assuming any arbitrary tile image exists.

## Milestone A (highest priority): one real, visible, reusable town

1. **Baseline before changing code:** inspect existing runtime and available browser/test setup. Verify current failing behavior rather than assuming the previously described bugs still exist. Record exact command/output or manual visual evidence. Do not call module loading alone a successful visual test.
2. **Canonical plane and World Block:** use one documented coordinate convention (X/Y ground, Z elevation), typed finite world/block transforms and stable IDs. Block-local scenery stays fixed when the parent moves. Compose local → parent/world → chosen projection → workspace/viewport, with a correct inverse/ray-to-ground for supported picking and frames. Do not treat a block's *world* translation as an arbitrary projected pixel origin or silently rewrite saved frame geometry. Document transform/projection origin units. A frame's temporary viewport-fixed/maximized state needs explicit shadow eligibility/proxy mapping; don't invent a drifting caster.
3. **Tiled import only where useful:** the existing `scene.json` must drive the supported tile and scenery arrangement, not a second hardcoded layout in `omni-world.js`. Map only the actually necessary Tiled tile IDs, tileset/source references, image offsets, layers, and object coordinates into SUBSTRATE's canonical objects; preserve source IDs/metadata for future reimport. If the existing example's tile IDs/TSX mapping are insufficient or inconsistent, fix their mapping instead of pretending arbitrary Tiled files already work. Maintain a small reusable importer/adapter. Changing one supported tile or scenery object's location in scene data should affect the rendered world without editing a duplicate JS scene.
4. **Present one Kenney town:** visible tilted 2.5D ground, crossing/path, building and several trees placed in a finite World Block within the expandable workspace, not a green page-wide rectangle. Art resources must load from the prepared files. Move/anchor controls move the block and its terrain/scenery together, without moving unrelated PDFs. Rendering should not steal document pointers; keep `pointer-events: none` on decorative layers and preserve editing/toolbar hit tests. Make the selected world's saved visibility/position restore consistently.
5. **Prepare for unlimited authored blocks, do not implement an infinite renderer now:** renderer/model should accept a collection of independently identified blocks with parent transforms and shared asset cache; prove with a second temporary test instance at a distinct position, without permanently forcing multiple towns into the first demo. World entities may exist when offscreen; their decoded graphics need not. Avoid assumptions that `blocks[0]` or a singleton scene is always the only world.
6. **Bounded rendering and camera correctness:** do not allocate one huge bitmap at `workspace.scrollWidth × workspace.scrollHeight × devicePixelRatio` as the user expands the canvas. Use viewport-relative canvas plus modest margin, visible-world or visible-block culling, and explicit camera/scroll offsets while preserving stable world positions under scroll, pan, left/top expansion, viewport resize, and frame drag. Static scene should not run an unnecessary high-frequency loop or repeat PNG decodes for each block. If a safe bounded rendering fix cannot be completed this cycle, clearly document it as a blocker and do not claim scalability.

**Milestone A acceptance:** after asset preparation or packaging, a browser-level check (if available) demonstrates a recognizable isometric Kenney town under functioning frames; the import actually controls placement, block motion does not separate children, and scrolling/panning does not shift the town incorrectly. If browser testing is unavailable, list exactly what could be tested and provide a reproducible manual test with expected observations; do not assert the visual test passed.

## Milestone B (only after A is stable): first functional sun and projected ground shadow

- Keep one **canonical logical light-source interface** that can later hold several suns, a moon, local lights and world time, but implement only the working light(s) in this run. Existing controls should toggle the world, sun, shadows, and change sun azimuth, elevation, intensity, and ambient light; updates should be visible without reloading.
- Make ambient + directional contributions coherent, and directional shadows dependent on sun enable/intensity. Turning the sun off removes its own directional contribution while ambient may remain. Prefer an inexpensive stylized approximation clearly derived from actual scene/light state over a disconnected screen-space filter.
- A participating ordinary PDF frame has a lightweight registered world geometry/proxy and can cast a **ground-space** shadow onto the town's receiving plane. Shadow polygon/visibility should respond to frame movement/resizing, direction/elevation, virtual height, and World Block motion. Clip/project to actual receiving ground/visible block rather than painting arbitrarily across the whole page. Do not use an unrelated CSS box-shadow instead of world projection. Explicitly handle viewport-fixed/maximized frames.
- Keep `castsWorldShadow` separate from `receivesWorldLighting`; normal HTML/PDF/DOCX text/layout/export must remain unaffected and readable by default. If a shadow case cannot be modeled correctly in this cycle, disable that case and document the limitation rather than drawing wrong geometry.

**Milestone B acceptance:** world on → PDF above town → ground shadow visible; changing azimuth changes direction, elevation changes length, toggling the sun or shadows removes the correct contribution, and moving the block or frame retains alignment. Report real checks and limitations.

## Milestone C: programmatic access without public privilege bypass

- Preserve versioned read-only structured `SubstrateWorld.inspect()` and meaningful subscriptions, including actual camera, block-local/global transform, plane, lights, and projected shadows. Keep Settings on the same validated command path used by the internal runtime.
- Replace the literal `"substrate-internal"` authorization string used by globally reachable `registerObject`/`updateObject`: a readable public string is not a security boundary. Keep privileged mutation in an internal module closure or explicitly controlled capability API; expose safe read-only inspection and only deliberately public bounded commands. Never grant unrelated scripts, imported metadata, future Phaser packages, or LLM output unrestricted file or world mutations. Model permission changes later, do not implement an overlarge plugin framework now.
- World semantic IDs and typed validated operations should be available for a future Tiled/Phaser adapter and Book of Behaviors; do NOT implement NPCs, LLMs, remote networking, multilingual behavior compiler, or multiplayer in this cycle.

## Actual testing and safety gates

Run targeted model/import/asset preparation tests and the project's existing test/build scripts, including Chrome Web Store packaging when available. Test two block instances programmatically, import-data edits, negative coordinates, projection round trips, frame resize/pan/scroll, sun/shadow toggles, saved preferences, and no missing generated art. Check if packaging still excludes the source ZIP while containing all referenced artwork. If browser automation exists, perform real visual + interaction checks; if it does not, state that explicitly. Don't conflate successful Actions with manual verification of appearance. Report exact test commands, statuses and remaining risks. Do not bypass tests by weakening them.

## Mandatory final handoff (same file created at start)

Update and **commit/push** `docs/handoffs/OMNI_WORLD_PR2_CURRENT_HANDOFF.md` with factual details:

1. Run start/current branch, starting SHA, latest pushed SHA, PR URL/state, elapsed-time estimate when known.
2. Finished tasks with exact files/functions and meaningful test/browser evidence; incomplete/failed tasks with actual error messages or a concise reproduction; any changes reverted.
3. Generated asset preparation command, whether PNGs were actually generated, how package creation includes them, and any limitations for fresh checkout/local development.
4. The current coordinate, World Block, projection, camera/viewport, Tiled import, lighting and shadow contracts actually implemented. Clearly distinguish desired architecture from working code.
5. Precise known bugs, missing tests, visual limitations, regressions and highest-priority safe next task.
6. **A short copy/paste-ready CONTINUATION PROMPT** for the next 30-minute Codex run that reads this handoff and resumes on the same unmerged PR, avoiding repeated work.
7. Separately list a future **post-PR showcase handoff**: multiple independently positioned towns with shared assets, visible-region queries, a canonical World Clock, two suns + one moon and reduced distant rendering; this is a *future milestone*, not a requirement for this cycle. Similarly note future semantic character action language and optional external builder/model integrations without implementing them now.

Push the handoff and coherent work to the existing PR head branch; verify GitHub shows the new commit. Final Codex reply should be brief: PR URL, latest pushed SHA, what visibly works versus what was not verified, test results, handoff path, and next safe action. **Do not merge PR #2. Stop after the approximately 30-minute cycle and its committed handoff.**

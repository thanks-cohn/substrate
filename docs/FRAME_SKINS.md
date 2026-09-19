# Frame presentation and skin architecture

## Existing boundaries and load order

At the time this architecture was introduced, `workspace.js` owned the canonical block-type registry, frame creation, geometry, application runtimes, and workspace capture/restore. `workspace.css` combined workspace, generic frame, and application presentation. Theme customization was loaded later by `workspace-extras.js`; frameless media also injected its stylesheet dynamically. PDF and DOCX models and serializers already lived below `src/documents/`, while their DOM presentation remained in the workspace files.

The conservative boundary is therefore:

1. `workspace.js` and document modules continue to own application capability and frame lifecycle.
2. `frames/frame-base.css` defines presentation variables without changing content padding or document coordinates. `frame-controls.css` styles the compact selector.
3. A bundled `skins/*/skin.css` only decorates a `.block[data-frame-skin="…"]` subtree.
4. Application presentation remains in `workspace.css` for now. It deliberately wins where document geometry is involved; a skin must not target `.pdf-surface`, `.pdf-text-layer`, `.docx-editor`, canvases, or document content.
5. The static stylesheet order is `workspace.css`, frame contract, controls, then bundled skins, followed by existing styles. Dynamic theme and frameless-media styles retain their established behavior.

This incremental split avoids moving fragile PDF/DOCX rules merely for organization. Frame identity, geometry, resize, focus, maximize, header visibility, viewport fixing, runtime cleanup, and commands remain in the existing canonical implementation.

## State and precedence

Every created frame receives `data-frame-skin` and every captured block record receives optional `skinId`. Old records and invalid/incompatible identifiers normalize to `modern`. Duplication uses the same record and therefore carries the skin. Snapshots, autosave/portable consumers using the shared capture bridge, and restoration all use this field; native PDF/DOCX/image/media bytes never do.

The workspace/global theme supplies workspace colors and the default modern variables. An explicit per-frame skin supplies frame variables after that. Global theme updates do not rewrite `data-frame-skin`. Application document formatting has the final semantic boundary and is never inherited from a skin selector.

## Manifest contract

`src/skins/manifest.schema.json` is the versioned JSON Schema. Manifests contain a kebab-case `id`, display `name`, semantic `version`, description, local `skin.css`, compatible frame types (`["*"]` or explicit types), and four declared visual capabilities. Only bundled trusted CSS is supported. Remote URLs, scripts, and runtime installation are intentionally absent.

The JS registry mirrors validated manifest metadata so discovery is synchronous under extension Content Security Policy. Unknown or incompatible IDs resolve to `modern`. Keep the manifest and registry entry in sync; tests enforce this.

## CSS contract

Supported variables are:

* Box: `--frame-background`, `--frame-border-color`, `--frame-border-width`, `--frame-border-radius`, `--frame-shadow`.
* Header: `--frame-header-background`, `--frame-header-text`, `--frame-header-height`.
* Controls: `--frame-control-background`, `--frame-control-border`.
* Toolbar: `--frame-toolbar-background`, `--frame-toolbar-text`.
* Interface typography: `--frame-font-family`.

`--frame-font-family` applies only to frame chrome. Never apply it to editable document descendants. Keep selector roots in the form `.block[data-frame-skin="your-id"]`; do not use global selectors or `!important`. Borders are included by the existing `border-box` sizing, so switching a skin preserves stored outer geometry. Do not add frame content padding or reposition application surfaces.

## Inspection and trace contract

The read-only global `SubstrateFrames` exposes:

* `listFrameTypes()`, `listSkins()`, and `inspectSkin(id)` for discovery.
* `inspect(frameId)` for application type, stable identity, selected skin, presentation modes, and frame operations.
* `getAppearance(frameId)` for the presentation-only subset.

It exposes no document content, handles, history, or mutation method. A real skin transition emits `substrate:frame-skin-changed` with type `FRAME_SKIN_CHANGED`, old/new IDs, and explicit false flags for model and identity changes. It does not emit per-property noise.

## Adding a skin (agent-safe recipe)

1. Create `src/skins/my-skin/manifest.json` and `skin.css`. Copy the schema-shaped modern manifest and give it a unique ID.
2. Scope every declaration under `.block[data-frame-skin="my-skin"]` and use contract variables. A complete skin can be only:

   ```css
   .block[data-frame-skin="paper"] {
     --frame-background: #f5f0df;
     --frame-border-color: #514b3c;
     --frame-border-radius: 0;
     --frame-shadow: 4px 4px 0 #514b3c;
   }
   ```

3. Add matching metadata to `frame-registry.js` and a local stylesheet link after the other skins in `workspace.html`. Do **not** edit PDF, DOCX, media, persistence, geometry, or frame-command code.
4. If an application-specific visual variation is necessary, keep it scoped by both skin and block type (for example `.block.docx-block[data-frame-skin="paper"] > .docx-toolbar`). Never select document content.
5. Run the registry tests, all repository tests, and browser verification. Open PDF, DOCX, gallery/image, and video frames under all skins. Confirm move, resize, maximize/restore, fixed and frameless modes, header/footer toggles, save/export, duplicate, snapshot restore, keyboard focus, and accessible selector operation. Compare PDF overlay coordinates and DOCX formatting/export before and after a skin switch.

For the acceptance scenario, create two DOCX frames and one PDF, select the three skins independently, edit/move/resize, save a snapshot, and restore it. Verify IDs, geometry, document state, and skin IDs are unchanged. These browser checks are required because static CSS tests cannot prove hit testing or computed geometry.

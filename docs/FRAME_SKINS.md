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

Appearance has three persisted preference levels, resolved in this exact order: individual override (`skinOverride`) → category default → overall default → Modern safety fallback. The settings record is `substrate.frame-appearance.v1`, shaped as `{version: 1, overall, categories}`. Category entries are optional; removing one makes it inherit the overall value. The frame selector's **Use default** choice removes its override, so later default changes immediately update that frame without recreating its application runtime.

Every frame exposes the resolved value as `data-frame-skin`, its source as `data-frame-skin-reason`, and an optional explicit preference as `data-frame-skin-override`. Capture records store both inheritance-aware `skinOverride` and compatibility `skinId`. Records with neither field inherit. Records produced by the first skin prototype only have `skinId`; restoration treats that value as an override so imported/saved appearance is not lost. Duplication carries the same preference while receiving an independent frame ID. Native PDF/DOCX/image/media bytes never contain appearance state.

The workspace/global theme supplies workspace colors and the default modern variables. An explicit per-frame skin supplies frame variables after that. Global theme updates do not rewrite `data-frame-skin`. Application document formatting has the final semantic boundary and is never inherited from a skin selector.

## Categories and deterministic layout

Classification uses canonical metadata, never titles or CSS selectors. Registered `pdf`, `docx`, `gallery`, `video`, `text`, `csv`, `zip`, and `cbz` types map to stable categories. Rich custom frames stamp `data-frame-category` for image, canvas, web, generic file, audio, video, and gallery categories. Unknown types use `generic`. Audio and video remain separate preferences even where they share playback infrastructure.

`frame-layout.js` defines measured contracts instead of accumulating arbitrary media queries. Width and height are independent: each frame is `narrow|wide` and `short|tall`, producing states such as `narrow-tall`. Contracts publish minimum functional width/height, compact and short thresholds, title-bar height, control size, and control gap. The manager reflects these as data attributes and CSS variables. Header actions never shrink, the title retains a reachable minimum, and generic narrow toolbars scroll horizontally. PDF and DOCX keep their specialized toolbar/layout behavior and document coordinate systems. Borders remain in `border-box`, so decorative corners and outer dimensions remain deterministic during resize.

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

* `getDefaults()`, `listCategories()`, `listFrameTypes()`, `listSkins()`, and `inspectSkin(id)` for preference and registry discovery.
* `inspect(frameId)` for application type/category, stable identity, explicit-override status, override and resolved skins, resolution reason, presentation modes, responsive state, constraints, and frame operations.
* `getAppearance(frameId)` for the same non-document presentation subset.

It exposes no document content, handles, history, or mutation method. A real skin transition emits `substrate:frame-skin-changed` with type `FRAME_SKIN_CHANGED`, old/new IDs, and explicit false flags for model and identity changes. It does not emit per-property noise.

Skin manifests may declare decorative effect names plus reduced-motion compliance, user-toggle support, and a low/medium/high performance tier. The current demonstrations declare no runtime effects. A future effect host must honor those declarations and user controls; skins must never implement effects by reaching into document engines.

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

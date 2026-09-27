# SUBSTRATE Persistent Folding Path Menus: spatial cascading navigation with depth slivers

**Status:** Proposal, not shipped. **Applies to:** SUBSTRATE / FrameChute browser workspace and any later desktop host. **Primary goal:** replace fragile hover-dependent cascading menus with a persistent, spatial navigation path that can be followed deeply without repeatedly starting over.

## The experience

Traditional cascading menus ask the user to keep the pointer inside a narrow hover corridor. A slight movement can close several levels at once and force the user to reconstruct the path.

SUBSTRATE should instead treat a deep menu traversal as a persistent spatial object.

A menu opens from a parent. Choosing a nested folder opens the next level beside it. Rather than expanding forever in one direction, the path folds across the available workspace:

```text
Parent  ->  Child  <-  Grandchild  ->  Deeper  <-  ...
```

The exact direction is chosen from available space, but the preferred rhythm is a readable right/left folding path. This keeps deep navigation near the place where it began instead of allowing a conventional menu chain to run off-screen.

The central rule is:

> **Hover may preview. Click establishes state.**

Once a level has been deliberately entered, moving the pointer elsewhere does not destroy the path.

## Depth slivers

When an older menu level is no longer the active surface, SUBSTRATE may compact it into a thin vertical **depth sliver** instead of closing it.

```text
|P| |E| |R|   +----------------------+
| | | | | |   | TERRAIN              |
| | | | | |   | Materials            |
| | | | | |   | Elevation            |
                | Water                |
                +----------------------+
```

Each sliver is a miniature restore point for a navigation frame. It may show a short label, icon, depth number, accent, or small state indicator. Clicking it restores that level and its remembered branch.

A sliver is therefore not merely a visual tab. It represents a saved navigation frame containing at least:

- parent node identity;
- selected child;
- scroll position;
- open descendants;
- local search/filter text where applicable;
- menu width where user-adjustable;
- branch state needed to restore the exact path;
- optional contextual state such as the object or frame from which the menu was opened.

A deep traversal can therefore be revisited directly without reconstructing every previous choice.

## Parent collapse and path memory

The originating parent may operate as a toggle.

1. First activation opens the root menu.
2. The user navigates to any depth.
3. Activating the originating parent again collapses the visible branch.
4. SUBSTRATE remembers the traversal and its depth slivers.
5. Activating the parent again restores the previous depth instead of returning only to level one.

A compact indicator may communicate that the parent owns a saved path:

```text
Projects   [depth 4]
```

The visible label is a design detail, not a requirement. The important behavior is preservation.

This turns a cascading menu into a lightweight working context.

## Folding layout

The layout engine should treat each menu panel as a rectangle with an anchor, preferred direction and available viewport.

Preferred behavior:

1. Open the first child to the side with the most useful available space.
2. Attempt to alternate direction for subsequent levels when that keeps the branch visually compact.
3. Offset levels vertically so the path reads diagonally rather than perfectly overlapping.
4. Preserve a visible spatial relationship between parent and child.
5. When a panel would collide with a viewport edge, browser chrome, another fixed workspace surface or an excluded area, choose the opposite side or compact older levels into slivers.
6. Never require the user to trace a narrow diagonal pointer corridor in order to keep a branch alive.

The implementation should not hard-code right-left-right-left if the available geometry makes that awkward. The **folding rhythm is preferred; legibility and reachability are authoritative.**

## Slivers as spatial history

Depth slivers can serve as a local form of browser history for the menu itself.

For example:

```text
ROOT
  -> WORLD
      -> TERRAIN
          -> MATERIALS
              -> ROUGHNESS
```

may compact to:

```text
|R| |W| |T| |M|   [ROUGHNESS panel]
```

Selecting `T` returns to the saved TERRAIN frame. Going deeper from there may either replace the descendant path or create a new branch according to the active navigation mode.

For the first implementation, use the simpler rule: **returning to an earlier sliver and choosing a different child replaces descendants after that depth.** Branch-history trees can be considered later.

## Optional branch visualization

Where the workspace benefits from stronger orientation, the menu can expose a small branch diagram above or beside the active panel:

```text
● ROOT
 \
  ● WORLD
   \
    ● TERRAIN
     \
      ● MATERIALS
```

Accessible/current nodes may use the normal active treatment; unavailable, hidden, disabled or non-current branches may use distinct muted treatments. Color must never be the only status signal.

This branch diagram should remain optional. The menu itself must remain understandable without it.

## Interaction rules

The first version should distinguish four states:

**Preview:** pointer hover or keyboard focus can preview a child without committing the branch.

**Committed:** click, Enter, Space, or the equivalent deliberate command establishes the level. Pointer departure does not close committed ancestors.

**Compacted:** a committed ancestor may become a sliver to reclaim space while retaining its frame.

**Collapsed:** the whole branch is hidden by toggling its starting parent, Escape, Close, or another explicit action. Its last committed path may remain recoverable.

Recommended keyboard behavior:

- Arrow Right / Enter: enter selected child.
- Arrow Left / Backspace-equivalent command: return one committed level.
- Up / Down: move within the active panel.
- Home / End: first or last item.
- Escape: close preview first; then collapse the active branch according to workspace policy.
- A discoverable shortcut may cycle depth slivers.
- Focus must return to a predictable element when a panel compacts or closes.

Touch and pen should use explicit taps rather than hover semantics.

## State model

The rendering layer should not infer the path from visible DOM alone. Keep a small explicit model, for example:

```ts
type PathFrame = {
  nodeId: string;
  parentId: string | null;
  selectedChildId: string | null;
  scrollTop: number;
  width?: number;
  query?: string;
};

type FoldingPathState = {
  rootId: string;
  frames: PathFrame[];
  activeDepth: number;
  collapsed: boolean;
};
```

The UI can derive panels, slivers and the current branch from that state. This makes restoration deterministic and makes the same navigation model portable between browser and desktop shells.

Session persistence should be optional and bounded. Ordinary temporary context may live in memory; a workspace may save selected paths to project/session storage when restoring them later is genuinely useful.

## Chrome / browser implementation

**This interaction does not inherently require a desktop application.** The core paradigm is ordinary HTML, CSS and JavaScript: positioned panels, transforms, clipping, hit testing, keyboard focus and a small state machine.

For SUBSTRATE in Chrome there are three useful surfaces:

### 1. In-page SUBSTRATE overlay

A content script or injected extension UI can render the full folding path over the current webpage. This is the closest match to the intended spatial behavior because the menu can use the tab's available viewport and can be drawn as one coordinated surface.

Use a strongly isolated UI root so host-page CSS does not corrupt the menu. A Shadow DOM root is a reasonable implementation choice. Keep event handling scoped and avoid stealing page shortcuts unless the menu is actively focused.

The hard boundary is the browser viewport: DOM content cannot visually extend through Chrome's toolbar, tab strip or outside the browser window.

### 2. SUBSTRATE extension page / workspace tab

If SUBSTRATE itself is open as an extension-owned workspace page, the paradigm is even simpler. The entire surface is controlled by SUBSTRATE, allowing deep menus, slivers, animated folding and saved state without fighting the host page.

This is the preferred browser-native place to prove the interaction.

### 3. Chrome Side Panel

The Side Panel can host persistent extension HTML and can remain open while the user browses. It is useful for the saved-parent / sliver concept, but its width is browser-controlled and narrower than a full workspace. In side-panel mode the layout engine should favor slivers and vertical restoration rather than assuming wide left/right folds.

### Do not build this as a native Chrome context menu

Chrome's `contextMenus` API is useful for adding commands to Chrome's own menu, but it is not the right rendering surface for this proposal. SUBSTRATE needs arbitrary layout, stateful panels, animation, slivers and its own keyboard/pointer behavior.

Likewise, an extension toolbar action popup is appropriate only for a compact launcher. Chrome constrains that popup surface, so the full persistent path should live in an extension page, injected overlay, side panel, or later desktop host.

## When desktop becomes useful

A desktop shell is not required for the menu paradigm itself. It becomes useful only when SUBSTRATE wants behavior beyond the browser's visual/security boundary, such as:

- drawing or positioning UI outside the webpage/browser content region;
- coordinating native application windows;
- embedding Tiled or other desktop tools as real workspace surfaces;
- unrestricted project filesystem workflows beyond browser-granted access;
- native global shortcuts or OS-level window management;
- consistent custom chrome across browser and native tools.

The same `FoldingPathState` and layout rules should be designed so the interaction can move into Electron, Qt, Tauri or another host without being rewritten conceptually.

## Low-end-first constraints

This should remain cheap enough for SUBSTRATE's low-end target.

- Keep only the active panel and a small number of neighboring panels fully rendered.
- Represent old committed levels as lightweight slivers.
- Avoid continuous layout polling; recalculate geometry on open, resize, state transition, or meaningful content change.
- Prefer transform/opacity animation over expensive repeated layout.
- Respect reduced-motion preferences.
- Do not retain large hidden DOM trees merely to preserve path state; save data, not dead UI.
- Virtualize unusually long menus.

## Accessibility

The paradigm must not depend on visual diagonals or hover dexterity.

- Every committed level must be reachable by keyboard.
- Slivers require readable accessible names such as “Return to Terrain, depth 3.”
- Focus order should follow the logical path, not raw screen coordinates.
- Use ARIA semantics appropriate to the actual interaction rather than forcing everything into a conventional `menu` role if the result behaves more like tabs/navigation.
- Provide a reduced-motion presentation that preserves all functionality.
- Ensure sufficient target width for slivers; an aesthetic one-pixel stripe is not a usable hit target.
- Color can reinforce state but cannot be the sole difference between active, hidden and disabled nodes.

## First prototype

Build a standalone HTML/CSS/JS proof before connecting it to the full SUBSTRATE command tree.

The demo should contain at least six levels of nested folders and demonstrate:

1. root activation;
2. click-to-commit behavior;
3. right/left folding based on viewport geometry;
4. diagonal visual progression;
5. compaction of older frames into vertical slivers;
6. click-to-restore from any visible sliver;
7. parent collapse and exact path restoration;
8. keyboard traversal;
9. viewport-edge collision handling;
10. persistence of state while the pointer freely leaves the menu.

Test the prototype at narrow and wide browser widths and on the project's low-end Windows machine.

## Acceptance criteria

The concept is successful when a user can navigate at least six nested levels, move the pointer anywhere in the SUBSTRATE surface without losing committed progress, collapse the entire menu, reopen it at the same depth, jump directly to an earlier saved level through a sliver, and complete the same traversal using keyboard controls.

No level may become inaccessible solely because the menu reached a screen edge. The layout should remain understandable at common laptop resolutions, and the browser implementation must not require a desktop wrapper merely to preserve path state.

## Design principle

SUBSTRATE should treat deep navigation as something the user **builds and can return to**, not as a temporary hover accident.

The conventional cascade says: “keep pointing correctly or lose your place.”

The folding path says: **“you came this far; the interface remembers.”**

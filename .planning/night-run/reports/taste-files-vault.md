# Taste Reference: /files Vault — Click-Cheap Patterns

**Assignment**: research file-manager/vault UI patterns for LAYOUT, DENSITY, HIERARCHY, INTERACTION only.
**Locked constraint**: D-58-01 visual identity (warm paper/ink, serif=evidence, colour earned never decorative,
entity type as shape) — palette and typography are NOT up for revision. Everything below is filtered through
that lock: adopt the *mechanic*, reject any reference's *chrome*.

---

## The 8 patterns to adopt

1. **Preview pane instead of navigate-away (biggest click-cost win)**
   Selecting a file/row updates a persistent detail/preview pane in place — never a full-page navigation to
   "open" something you're just checking. Source: Gmail/Outlook reading-pane pattern — "clicking an email opens
   it in the reading pane instead of fully replacing the inbox view, letting you move through messages faster
   because your list stays visible." Click impact: eliminates the open→back→open→back round trip entirely;
   turns an O(2n) click cost (open+back per item) into O(n) (select only), and with arrow-key advance, O(1) for
   scanning a whole folder.

2. **Arrow-key list traversal with live preview**
   Up/down arrow moves selection and updates the preview with zero clicks. Source: Gmail — "use the up and down
   arrows on your keyboard to quickly select the next message... with no need to click on each message
   individually." Click impact: converts N clicks (one per file to inspect) into 0 clicks + N keypresses, and
   keypresses chain without re-acquiring the mouse.

3. **Space-bar Quick Look — preview without commit**
   A single keystroke opens a full preview overlay for the selected item and closes on the same key; no
   navigation state is created. Source: macOS Finder Quick Look. Click impact: 1 keypress replaces
   open-file→view→close-file (typically 2-3 clicks including any "back").

4. **Miller-columns-style horizontal drill (if the vault has nested structure)**
   Each level of the hierarchy opens as an adjacent column rather than replacing the current view, so the whole
   path stays visible and any ancestor is one click away (not "back" N times). Source: macOS Finder Columns
   view — "navigation is entirely horizontal — no drilling in and out of folders... you always know exactly
   where you are and where you came from." Click impact: returning to a sibling folder is 1 click instead of N
   "back" clicks; only apply this if the vault actually has folder depth — for a flat/tagged vault, skip it
   (see genericness failure #1 below).

5. **Inline rename on a single deliberate trigger — not naive double-click**
   Bind rename to one unambiguous action (a dedicated key/icon or a clearly-separated click target), not to
   double-click on the same hit target used for "open." Source: UX research on file explorers — "selecting and
   renaming an item requires the same mouse action separated only by an indeterminate wait time... users often
   prefer F2 to enable inline rename mode rather than relying on double-click." Click impact: avoids the
   mis-fire tax (accidental renames or accidental opens) that costs users a correction cycle (2-4 extra clicks).

6. **Drag-anywhere upload with a full-surface, not a fixed widget**
   The entire content pane is a valid drop target (with a clear hover-state border/tint), not a small "browse"
   button in a corner; a click-to-browse fallback is still present for mouse-imprecise/mobile/keyboard users.
   Source: drag-and-drop UX best practices — "a more user-friendly approach is to stretch the drop area to the
   viewport," with "a clearly highlighted drop zone" and hover-state feedback; "a click-to-browse fallback is
   essential because drag-and-drop fails on mobile and for keyboard users." Click impact: removes the
   click-to-open-picker step entirely for the drag path; the fallback keeps the picker path at parity, so this
   is a strict improvement with no downside.

7. **Right-click context menu + multi-select toolbar for bulk actions**
   Right-click on a selection surfaces the same actions as a persistent toolbar that appears once ≥2 items are
   selected — both routes exist so mouse-only and discovery-first users converge on the same action set.
   Source: bulk-actions UX guidance — "for routine bulk changes... inline quick actions work well, allowing
   users to select items and immediately adjust properties... right-click context menus are used to access bulk
   actions on selected items." Click impact: turns N single-item action sequences (select→act, repeated N
   times) into 1 select-many gesture + 1 action click.

8. **Keyboard-first selection primitives (shift-range, cmd/ctrl-toggle, select-all)**
   Standard multi-select keyboard modifiers work identically to native OS file managers — shift-click for
   range, ctrl/cmd-click for toggle, ctrl/cmd-A for select-all in the current scope. Click impact: selecting a
   contiguous range of 20 files is 2 clicks (first, shift+last) instead of 20.

---

## The 3 most common genericness failures to avoid

1. **Imposing folder-tree/Miller-columns chrome on a vault that's actually flat or tag-based.**
   If the underlying data model is flat-with-metadata (which most "vault" concepts are — captures, evidence,
   entities — not deep nested folders), forcing a folder-tree sidebar is the single most common tell of a
   templated file-manager UI. It adds a permanent-fixture click cost (expand/collapse) for a hierarchy that
   isn't real. Verify the vault's actual structure before choosing pattern #4; if flat, use faceted filters
   (type/date/entity/source) instead of a tree.

2. **The "everything at once" dashboard density trap.**
   Cramming a sidebar tree + toolbar + breadcrumb + list + preview + metadata panel + tag rail into one screen
   simultaneously is the default enterprise-file-manager silhouette and reads as generic regardless of palette.
   Source: "high-density layouts often attempt to show everything at once, resulting in cluttered screens and
   dense navigation layers." Pick the two panes that carry the work (list + preview) and let everything else be
   contextual/collapsible, not permanent chrome.

3. **Same-gesture ambiguity (double-click doing double duty for open vs. rename vs. select).**
   Reusing one hit-target/gesture for multiple destructive-adjacent or state-changing actions (open vs. rename)
   is a specific, well-documented failure mode, not just sloppiness — it's what makes generic file UIs feel
   twitchy. Give rename its own unambiguous trigger (pattern #5).

Generic-file-manager tells to actively avoid regardless of the above: grey/blue "cloud SaaS" icon rows,
skeuomorphic folder icons, a search bar that's visually identical to every other SaaS product's search bar, and
row-hover chrome that adds icons/buttons rather than revealing them only on focus/select.

---

## Conflicts with the warm-paper/ink identity — and how to resolve them

- **Drag-hover highlight color.** Most reference implementations use a bright blue/accent tint for the drop-zone
  hover state. Under D-58-01 ("colour earned never decorative"), this must NOT be an arbitrary saturated blue —
  it should reuse whatever accent the system already treats as "true/earned" (the same hue used for confirmed
  entity states), or fall back to an ink-weight/border-weight change (heavier ink border, no new hue) rather
  than introducing a new color purely for hover feedback. No fundamental conflict — just needs the accent
  substitution, not a structural change.

- **Quick Look overlay chrome.** macOS Quick Look uses a dark/frosted-glass modal chrome by default. On warm
  paper/ink, the overlay should read as "held-up paper" (paper-colored surface, ink-weight border/shadow), not
  a dark glass panel — this is a skin substitution, not a pattern conflict.

- **Miller columns' rigid vertical rules.** Traditional Miller-column dividers are hard 1px grey rules — fine
  under ink-on-paper (a hairline rule is already the vocabulary), no change needed. Low risk.

- **Entity-as-shape vs. file-type icons.** Every reference (Finder, Drive, Dropbox) leans on colored file-type
  icons (colored squares/badges per MIME type) for at-a-glance scanning in list/grid views. This is the one
  real tension: D-58-01 assigns shape (not color) to entity type, and file manager convention assigns *color*
  to file type. Resolution: keep file-type differentiation on shape/iconography+ink-weight (already the
  system's language) and reserve any color strictly for the "earned" states the identity already defines
  (e.g., verified/flagged), not for decorative per-type coding. This is the one pattern to deliberately NOT
  port as-is from any reference.

No other researched pattern (preview pane, arrow-key nav, space-bar preview, inline rename, drag-anywhere,
context menu, keyboard multi-select) has any structural conflict with warm-paper/ink — they're all interaction
mechanics, independent of palette/typography.

---

## Sources

- [Miller columns — Wikipedia](https://en.wikipedia.org/wiki/Miller_columns)
- [10 Essential Tips for Using the macOS Finder More Efficiently - MacRumors](https://www.macrumors.com/guide/top-tips-macos-finder/)
- [Use and configure the Reading Pane to preview messages in Outlook | Microsoft Support](https://support.microsoft.com/en-us/office/use-and-configure-the-reading-pane-to-preview-messages-in-outlook-2fd687ed-7fc4-4ae3-8eab-9f9b8c6d53f0)
- [How to Use the Gmail Preview Pane: To Check Emails Quickly | Envato Tuts+](https://business.tutsplus.com/tutorials/how-to-use-the-gmail-preview-pane-to-check-emails-quickly--cms-28597)
- [Split Inbox Preview – Linear Changelog](https://linear.app/changelog/2021-12-02-workspace-templates)
- [Drag-and-Drop UX: Guidelines and Best Practices — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/)
- [Drag & Drop UX Design Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop)
- [UX best practices for designing a file uploader - Uploadcare](https://uploadcare.com/blog/file-uploader-ux-best-practices/)
- [Bulk action UX: 8 design guidelines with examples for SaaS - Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux)
- [Disabling double click to inline-rename filenames - Directory Opus Resource Centre](https://resource.dopus.com/t/disabling-double-click-to-inline-rename-filenames/18617)
- [Bad UI Design: Exploring Common UI Mistakes - Pageflows](https://pageflows.com/resources/bad-ui-design-exploring-common-ui-mistakes/)
- [10 Bad UI Examples: Poor Interface Design and How to Fix It - OFSPACE](https://www.ofspace.co/blog/bad-ui-examples)
- [Is Google Drive or Dropbox the Better File Manager? - IFTTT](https://ifttt.com/explore/google-drive-vs-dropbox-best-file-app)

# 공명선 Art Bible

Pixel art is authored as palette-indexed sources in `art/source/*.ts` and exported by `npm run art` to
`public/assets/**.png` + `manifest.json`. Review previews (4×) go to `art/preview/`. There is no runtime scaling,
rotation or filtering of world art.

## 1. Resolution & density
- Native logical resolution **640×360**. Integer CSS zoom only (1280×720 = 2×, 1920×1080 = 3×, 2560×1440 = 4×), letterboxed.
- Tile **16×16**. One art pixel = one world pixel everywhere (player, bosses, VFX, tiles). No mixed densities.
- Player: 24×32 cell, body ≈14×24 (≈2.5 heads). Small props 8–32 px, large props 32–72 px, bosses 48–128 px native canvases.
- Rotation: needles use 16 exported direction frames; tiles may use exact 90° permutations; nothing else rotates.

## 2. Palette (37 colours, `src/presentation/art/palette.ts`)
| Group | Indices | Use |
|---|---|---|
| Violet-grey neutrals | 0–8 ink…bone | stone, metal, shadows, UI |
| Warm earth | 9–14 umber…wheat | quarry, bronze, hide, wood, the Tuner's cloak |
| Greens | 15–20 forest…lime | garden, roots, Rotational |
| Blues | 21–25 abyss…foam | marsh, water, mirror glass |
| Resonance | 26 reso, 27 resoLite, 36 resoDeep | needles, links, sockets, UI accents (reserved) |
| Signatures | 28/29 Impact, 30/31 Heat, 32/33 Void, 34/35 Wave | attack energy only |

Region accents: hub = neutrals + resonance; garden = greens + stone; belfry = bronze/earth + violet stone;
quarry = sand/umber strata + ash floor; marsh = blues + pale glass. Bosses add 1–3 accent colours from the table.
Visual priority: background (low contrast) < interactables < telegraphs < resonance information.

## 3. Outline, light, shading
- Light from the **upper-left** (-0.62, -0.62, 0.48). `sculpt()` quantises the lit value to the material ramp in hard
  bands, then removes 1-px orphans (`cleanOrphans`). No pillow shading: the light is directional.
- **Sel-out outline**: 1 px, colour = `OUTLINE_OF[neighbour]` (a darker hue relative), softened on lit rims.
  Tiles have no outline; wall tops get an ink rim only where they meet floor (silhouette readability).
- Dithering only where it means something: ordered 25/50% for danger zones and ground shadows, checker for
  afterimages. Never as texture noise.

## 4. Materials
| Material | Language |
|---|---|
| Stone | broad 3–5 band ramps, low roundness (0.45), carved crevices darker |
| Weathered metal / bronze | rounder (0.7), 1-px specular clusters on the lit rim |
| Glass / crystal | edge highlights (foam/bone), flat interior (round 0.3) |
| Water | horizontal ripple bands (tide on deep), no vertical streaks |
| Roots / organic | rounded clumps (0.9), separate regions per clump |
| Cloth | 3-tone vertical folds (sand/ochre/clay), fold line one tone darker |
| Resonance energy | cyan ramp with moving 1-px shimmer; never used for non-interactive decoration except inlays |
| Void | purple/black broken dashes, gaps are part of the shape |

## 5. Characters & bosses
- The Tuner: hooded ochre cloak, pale mask with cyan eyes, cyan scarf; needles strapped on the back show how many are
  held (up-facing frames). Value contrast (light mask, mid cloak) keeps it readable on every region floor.
- Bosses must differ in **mass distribution, limb count/shape, negative space, movement profile, socket placement,
  attack pose**. No recolours or partial edits between bosses.
- Anchorable parts are shaped as sockets/runes and lit with resonance or amber; armour is plate-shaped and
  NonAnchorable. Colliders are authored to match the sprite masses (e.g. Gram: footprint + boulder + head + back socket).

## 6. Animation timing
- Player: idle 4 f (420/180 ms), walk 6 f × 95 ms, throw 4 f (40–60 ms), dash 3 f × 60 ms, pulse 5 f (40–90 ms),
  recall 3 f, hit 2 f, death 7 f (90–400 ms).
- Boss telegraphs use at least two channels: **pose change + ground lane/zone + sound** (e.g. Gram lowers its head,
  paws, the lane locks and flashes 0.28 s before launch). Minimum windup 0.7 s.

## 7. VFX rules
- 1–3 px spark clusters, discrete rings (1 px, optional dash period), stepped trails, hand-timed burst frames.
- Palette exact: no alpha blending, no blur, no bloom, no sub-pixel drift (all positions rounded).
- Signature shapes on charged links (colour-blind safe): **Impact** square wave · **Wave** circles (period/size = pitch) ·
  **Heat** vertical tremble · **Void** broken dashes · **Rotational** double helix.
- Link states: Idle = dim line + travelling shimmer; Charging = fill from the capture point; Charged = signature
  pattern; Overloaded = doubled amplitude + flicker + sparks; Broken = falling red dashes.

## 8. UI
- 24×24 nine-slice frames (8 px corners) in the world's stone + resonance language; 12×12 icons; integer scaled.
- Korean text rendered at native resolution (Malgun Gothic / Apple SD Gothic Neo / Noto Sans KR fallback).
- Focus = frame swap + ▶ marker + underline (never colour alone). Disabled = dim frame + × marker.
- No HP bars, damage numbers or percentages. Seals are glyph icons.

## 9. Forbidden
Downscaled illustrations, vector shapes with pixelated CSS, soft brushes/AA edges, mixed pixel densities, raw
AI/procedural images, placeholder rectangles/glyphs as final art, bilinear filtering, non-integer world scaling,
screen-wide bloom, random 1-px noise as "detail", recoloured boss bodies.

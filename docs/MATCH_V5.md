# Round 7 — make the island screen match docs/ref/main.webp (phone 720x1280) as exactly as possible

Reference images: docs/ref/main.webp (full phone screen), docs/ref/target-v5.webp (crop). Current render for comparison: docs/ref/current-v4.jpg.
Do NOT generate images. Background plates are being painted separately and will exist at
public/bg/day.webp, public/bg/dusk.webp, public/bg/night.webp (portrait 9:16, sky + sun/moon + low-poly clouds + small distant islands + bottom mist; centre column empty). Code must work (fall back to the cream colour) while they are missing.

## 1. Same look on desktop and phone
The user complains desktop and phone look completely different. On viewports wider than ~600px, render the whole app as a centred phone-width column (max-width 430px, full height), identical to the phone layout (same island area height, same bottom sheet single column, same tab bar). Fill the page outside the column with the current period's background plate, blurred and dimmed slightly (or the cream colour), so it looks like a phone on a stage. Remove the desktop-only two-column sheet / wide-scene code paths that this makes dead. Detail page and other tabs follow the same column.

## 2. Painted background behind the 3D scene (main island scene only, not compact/detail)
- .scene gets the plate as CSS background (cover, centre-top), with one layer per period crossfading (~1.5s opacity) when host.dataset.period changes. Morning (0) and day (1) use day.webp; dusk (2) dusk.webp; night (3) night.webp.
- Remove from the main scene the 3D distant islands, 3D clouds, stars, the sun/moon orb and the coloured fog backdrop (canvas stays transparent; alpha renderer already). Keep fog off or so light it does not grey the islands. Keep the compact/detail scene as it is.
- Keep fireflies/lamps/campfire on the islands at night.

## 3. Framing and island separation — match the reference screen fractions
Measured on main.webp (fractions of the 720x1280 screen; the island area is the top ~56%, the bottom sheet starts at y≈0.555):
- Title "我的回訪" centred at y≈0.08; progress ring top-right.
- UPPER island ("本週已聯繫"): grass top spans x≈0.13–0.85, grass centre y≈0.25, rocky underside lowest point y≈0.40 near x≈0.45. Its sign sits at y≈0.30 on the front grass edge.
- LOWER island ("待聯繫"): grass spans x≈0.09–0.88, back edge y≈0.41, centre y≈0.47; its front edge and rocks run under the sheet. Sign at y≈0.50.
- The islands must be clearly SEPARATED: sky visible between them at both sides, the upper island's underside fully visible above the lower island's back edge (currently they overlap and the upper rock hides behind the lower grass). Move platforms apart vertically and/or in depth to achieve this.
- Characters: standing height ≈ 0.085 of the full screen height (≈15% of the island area) — about 1.3× the current size; update island-layout.ts and its test bounds. Name tags just above heads, never over the title.
- Framing must be computed from the fixed composition, so it is identical on every phone width (360–430) — fit the composition width, anchor to the top.

## 4. Colour and contrast like the reference
- Grass a saturated fresh green, rock undersides warm brown with clearly darker shaded facets, white low-poly highlights. Sun from upper-left (matches plate). Strong but soft shadows on grass.
- Adjust lights/tone mapping/exposure and, if needed, a light material tint on the island GLB (glb.ts) to get there; characters stay bright and matte as now.
- Dusk: warmer/orange key light; night: cool blue key, lower intensity, lamps glow.

## 5. Done means
npm run build passes, npm test passes (update tests that encode old numbers), no console errors. Keep all existing behaviour (OrbitControls, tap to zoom, attention animations, jump between islands, period override button). Report every file changed and the numbers you chose.

# Plan C (branch plan-c-2d) — replace the Three.js island scene with a layered 2D illustration

Goal: the island screen must look like docs/ref/main.webp as exactly as possible. The user accepted losing 3D rotation/zoom.
Do NOT generate images; they are being painted now and will appear as WebP files (code must not crash while they are missing — show a soft placeholder):
- public/bg/{day,dusk,night}.webp (already exist; sky plates)
- public/islands/{top,bottom}.webp — transparent island illustrations (props included, no characters), wide landscape
- public/sprites/{honey,rose,lavender,sky,marigold,sage}/{stand,wave,sad,sit}.webp — transparent full-body character poses, feet at the bottom edge. The avatar key comes from demoLook(contact)?.avatar in src/model.ts; contacts without one map from contact.style the same way src/glb.ts characterFiles does (short→sage, long→rose, curly→honey, bob→rose, pony→lavender, swept→sky, bun→marigold).

## Keep the module API
Create src/island2d.ts exporting the same API main.ts uses from src/island.ts: mountIsland(host, choose, compact?) returning null | { reset, period(value), update(rows, settings), ...everything else main.ts calls }, plus localPeriod and periods. Switch main.ts (and anything else) to import it. Remove three, GLB loading, scenery, rig, character.ts etc. from the bundle if nothing else uses them (delete dead files and dependencies, update tests). Keep the period plates crossfade, desktop phone-width column, CSS2D-like name tags (now plain DOM), progress ring, island signs "本週已聯繫"/"待聯繫".

## Layout (fractions of the 720x1280 reference; island area = top ~56%)
- Upper island image: spans x 0.13–0.85, grass centre y≈0.25, underside lowest y≈0.40. Lower island: x 0.06–0.92, back edge y≈0.41, centre y≈0.47, front runs under the sheet. Sky visible between them. Islands bob gently (±0.4% over ~6s, out of phase).
- Each island has a walkable ellipse on its grass top (define in island-image fractions; tune so feet stay on grass). Characters are absolutely positioned <button>s inside the island layer; z-order by feet y. Sprite height ≈ 0.085 of the screen height (≈15% of island area); shrink when an island has more than 4 people so they fit without overlapping, and spread them so name tags don't collide (reuse/adapt the separation idea from island.ts).
- Name tag pill above the head (name, plus mood emoji); keep current .nametag styling.

## Behaviour per mood (spec §5; mood 0 happy, 1 a bit down, 2 depressed, 3 long time no see)
- 0: stand sprite; walk to random points in the ellipse (CSS transform transitions, small bob while walking, flip horizontally by direction); sometimes swap to wave for 1.5s, sometimes a hop.
- 1: slower walks, pauses, occasional "…" bubble.
- 2: sad sprite, slow drag; grey cloud with CSS rain above the head; slightly darker filter.
- 3: sit sprite near the island edge, opacity .7, grey cloud.
- Attention cycle for moods 1–3 (respect settings attention frequency / off): sad 4–6s ↔ attention 3–4s: switch to wave sprite, hop in place, speech bubble from ["我在這裡！","來找我聊聊～","好久不見😢","想你了"], name tag scales up slightly with a soft pulse ring; mood 3 stands up (stand/wave) then sits back. Stagger people. Keep the existing "!!" badge if present.
- Tap a character: happy hop, then smoothly scale/translate the scene toward them (~600ms) and call choose(id), then reset.
- Marking contacted (member moves from 待聯繫 to 本週已聯繫 via update): jump arc animation from current position to a spot on the other island; on recovery show hearts/rainbow sparkle.
- Respect prefers-reduced-motion (no walking, no bobbing).

## Time of day
Period override button keeps working. Islands and sprites get a CSS filter per period (dusk warm, night darker blue-ish, brightness ~.75), night adds a few CSS fireflies and the tags glow slightly. Morning same as day.

## Compact mode (detail page mini scene)
Show the lower island image cropped small with that one character in the centre using the current mood pose.

## Done means
npm run build and npm test pass (rewrite tests that targeted 3D code; add one small test for avatar-key mapping and slot layout). No console errors with missing sprites. Report files changed and bundle size before/after.

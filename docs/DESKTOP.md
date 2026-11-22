# Desktop layout (same URL, responsive) — round 9

Phone (< 900px wide) stays EXACTLY as now (430px column look, do not change it).
At >= 900px wide, replace the "phone column on a blurred stage" with a real desktop layout:
- Left: the island scene (#world with plates, islands, characters, title, progress ring) as a tall portrait panel, height = 100dvh minus nav, width ≈ min(46vw, 0.75 × height), rounded 24px, sticky. It must keep the same composition as the phone (the 2D scene already scales with container width via cqw; make sure #world's container is that panel so everything scales).
- Right: the sheet content without the drag handle — 今天的約, 快快聯繫 (full 該聯繫了 list), 敞開程度分布, 心情分布 — in a scrollable column (max-width ~640px), cards in a 2-column grid where it helps (e.g. today + distributions), list single column.
- Navigation: the bottom tab bar becomes a left vertical rail or a top bar with the same tabs (島嶼 名單 行程 統計) and the ＋ button; other tabs (名單/行程/統計/settings/detail dialog) use the wide right area properly (no 430px cap; dialogs centred max 560px).
- Background outside panels: current period plate blurred (reuse #stage) or cream.
- Night/dusk theming, period button, attention animations, tap-to-focus all keep working.
Done: npm run build && npm test pass; check at 1440x900 and 375x812 (phone unchanged). Do not commit. Report files changed.

# Shepherdiland 建置說明（給 Codex）
網站名稱：Shepherdiland（介面標題可顯示「我的回訪」副標）。完整需求見 docs/SPEC.md，請逐段實作。

技術：Vite + TypeScript（已安裝 three、@supabase/supabase-js、vite-plugin-pwa），不要再加新套件（沒網路）。
- 程式放 src/，Three.js 低面數 Q 版小人用程式產生幾何（不用外部模型）。
- 若沒有設定 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，自動進入「示範模式」：用 localStorage + 第十三段的 6 位虛構範例資料，所有功能可操作（AI 分析與建議回傳假資料）。
- supabase/migrations/0001_init.sql：所有資料表、RLS（user_id = auth.uid()）、私有 bucket chat-screenshots 與 storage RLS。
- supabase/functions/analyze-chat/index.ts、suggest-topics/index.ts、delete-contact/index.ts（Deno，金鑰只讀 Deno.env）。
- README.md（繁中）：本機執行、Supabase 部署步驟、個資注意事項。.env.example，.gitignore 含 .env*（除 example）。
- 全部介面繁體中文，手機優先。
完成後務必執行 `npm run build` 直到沒有錯誤。不要 git commit。

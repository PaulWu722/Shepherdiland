# Shepherdiland｜我的回訪

面向手機的校園回訪工具。島上的小人會依本週聯繫紀錄移動，週一當地時間零時開始新的一週。

## 本機執行

```sh
npm ci
npm run dev
npm run build
npm run preview
```

未填寫 Supabase 設定時會進入示範模式。六位成員與紀錄皆為虛構，資料留在目前瀏覽器，截圖存於 IndexedDB，AI 回傳固定的示範結果。使用 `npm run preview` 或 HTTPS 部署測試 PWA 安裝與離線瀏覽。

## 部署 Supabase

1. 建立 Supabase 專案，在 Auth 設定啟用電子郵件登入，設定 Site URL 與允許的 Redirect URLs，例如 `http://localhost:5173` 與正式網站網址。Magic link 會寄到使用者的電子郵件。
2. 複製 `.env.example` 為 `.env.local`，填入專案 URL 與公開 anon key。正式前端建置也需設定這兩個變數。
3. 在專案根目錄用 Supabase CLI 登入並套用遷移。遷移會建立資料表、RLS、原子寫入函式與私有截圖 bucket。

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

4. 在 Supabase Dashboard 的 Edge Functions Secrets 設定 `OPENAI_API_KEY`。預設模型為 `gpt-4o`，可透過 `OPENAI_MODEL` 指定相容的視覺模型。Edge Function 會使用 Supabase 提供的環境變數，並自行驗證每次請求的使用者登入憑證。

   ```sh
   supabase functions deploy analyze-chat
   supabase functions deploy suggest-topics
   supabase functions deploy delete-contact
   ```

5. 執行 `npm run build`，把 `dist/` 部署到網站根目錄。以兩個帳號確認只能讀取各自的名單和截圖，再以虛構資料測試分析、刪除與匯出。

## 個資與通知

- 截圖可先打碼，按下分析後才送至 OpenAI。儲存前請核對日期、約定、代禱及敞開程度建議。
- 截圖留在私有 Storage，查看連結效期為一小時。刪除成員會一併刪除關聯資料及截圖。匯出 JSON 內含截圖，請妥善保管。
- OpenAI 金鑰及 service role key 只能存放在伺服器。請勿將真實名單、截圖、金鑰或匯出備份提交到版本庫。
- 開站取得的名單與文字紀錄會留在目前瀏覽器供離線查看。共用裝置使用完畢請登出，登出會清除該帳號的本機資料快取。正式模式下上傳、AI 分析與取得截圖需要連線。
- 允許通知後，網站每天早上七點起於開站或運行時檢查提醒。關閉網站後沒有排程推播。震動、安裝及通知支援依裝置和瀏覽器而異。

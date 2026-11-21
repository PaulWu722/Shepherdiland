# 換上 Tripo 3D 模型（方案 B）
public/models/ 會有以下 GLB（Tripo 產生，Mixamo 骨架 `mixamorig:*`，約 2 萬面、1k/2k 貼圖，模型無動畫）：
- island_top.glb、island_bottom.glb：兩座浮空島（含道具），無骨架
- char_curly / char_bob / char_aiwei / char_haoyu / char_yuyan / char_zichian.glb：小人，A-pose，有骨架

對應 src/model.ts 的 demoLooks.avatar：honey→char_curly、rose→char_bob、lavender→char_aiwei、sky→char_haoyu、marigold→char_yuyan、sage→char_zichian。
非範例成員：依 hair/style 選最接近的模型，並用 shirt 顏色微調衣服色調（可選）。

## 要做
1. 用 three/addons GLTFLoader 載入（加 DRACO 不需要）。用 SkeletonUtils.clone 讓同模型可重複使用。模型還沒下載完成或載入失敗時，沿用現有程式繪製的小人/島（保持現在行為），檔案不存在不能報錯中斷。
2. 島：取代 terrain()/dressIsland 產生的幾何，自動依 bounding box 縮放置中，讓頂面高度與站立點對齊現有 platforms；小人走動範圍改成依模型頂面大小。模型如果岩層看起來太薄，可在 Y 軸放大岩層（整體 scale.y 1.2–1.5，視覺接近 docs/ref/main.webp）。
3. 小人：character.ts 的 avatar() 回傳物件被 island.ts 動畫使用（head、arms、legs、body、eyes、brows、tears、smile、mouth…）。改成在 GLB 載入後，把 head→mixamorig:Head、arms→LeftArm/RightArm、legs→LeftUpLeg/RightUpLeg、body→Spine（或 Hips）骨頭接上，讓既有的低頭、塌肩、垂手、揮手、跳、坐下、轉身等動作都改為旋轉骨頭。注意 Mixamo 骨頭的本地軸向和原本 pivot 不同，請換算到正確方向（例如手臂下垂/舉起）。A-pose 起始，請讓「垂手」姿勢自然。程式畫的五官（眼睛、眉毛、淚、嘴）不再需要，表情改用：情緒狀態時在 Head 骨頭上疊加小型淚滴、烏雲等既有特效即可；臉部貼圖不動。
4. 大小比例與參考圖一致：小人高度約島寬 18%，名牌在頭頂上方。
5. 效能：低階手機也要順；共用材質/貼圖；GLB 加入 PWA 快取（vite.config.ts includeAssets 或 runtimeCaching）。
6. npm run build 與 npm test 通過，不要 git commit。用繁中列出做了什麼、哪些模型目前不存在而走備援。

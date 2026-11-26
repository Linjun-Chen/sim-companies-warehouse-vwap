# Sim Companies 倉庫 VWAP

[選擇語言](README.md)

在倉庫查看各商品與星級的成交量加權平均價（VWAP）及折後單價。預設使用上一個已收盤的 UTC 日。讀取官方分星級日線需要遊戲的 Supporter 權限。

## 安裝與更新

1. 在 **Assets** 下載 `warehouse-vwap-v*.zip` 並解壓縮。[最新版本](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. 開啟 `chrome://extensions`，啟用「開發人員模式」，選擇「載入未封裝項目」，並選取含有 `manifest.json` 的 `warehouse-vwap` 資料夾。
3. 登入遊戲並開啟倉庫。展開「倉庫 VWAP」查看庫存報價，或開啟商品詳情查看各星級的價格。

更新時請用新版檔案覆蓋原先載入的資料夾，在原擴充功能卡片點選重新載入圖示，再重新整理倉庫頁。沿用原資料夾可保留本機設定與報價快取。

## 折扣與語言

在商品詳情頁點選折後單價旁的百分比，可編輯商品預設折扣及 Q0 至 Q12 的折扣。留白會沿用上層設定，填 0 表示不套用折扣。儲存後立即重算折後價。

介面預設跟隨 Chrome 語言。點選工具列的擴充功能圖示，進入「完整設定 → 語言」即可切換。

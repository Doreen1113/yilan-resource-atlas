# resources.json 欄位定義

每筆資料為一個 JSON 物件，欄位如下：

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | string | 唯一編號，格式 `{分類代碼}-{三位數流水號}`，例如 `CUL-001` |
| name | string | 資源名稱 |
| category | string | 大分類：`culture`(文化場館/文化資產) / `library`(公共圖書館) / `digital`(數位機會中心) / `youth`(青年/志工據點與平台) / `education`(教育資源指標點) |
| township | string | 所屬鄉鎮市，須為 12 鄉鎮市之一，或 `unknown`（線上平台無實體地址時） |
| address | string | 完整地址；若為線上平台則填 `null` |
| lat | number\|null | 緯度；找不到官方座標時為 `null` |
| lng | number\|null | 經度；找不到官方座標時為 `null` |
| geocode_status | string | `official`(官方公布座標) / `needs_geocoding`(僅有地址，尚待地理編碼) / `no_address`(線上平台無實體地址) |
| description | string | 一句話說明 |
| source_org | string | 資料提供機關 |
| source_url | string | 實際查證的網頁或 API 連結，不可留空 |
| last_verified | string | 查核日期 YYYY-MM-DD |
| confidence | string | `high`(官方頁面直接列出) / `medium`(第三方頁面或需推論) |

## 分類代碼

- CUL：文化場館與文化資產
- LIB：公共圖書館
- DOC：數位機會中心
- YTH：青年／志工據點與平台
- EDU：教育資源指標點（偏遠學校等）

## 限制聲明（務必在網站上同步顯示）

本資料集為人工蒐集自政府公開網頁與開放資料 API，非完整普查；資料缺漏可能來自尚未開放、尚未數位化、或未列入本次查核範圍。座標若標記為 `needs_geocoding`，代表尚未經地理編碼校正，地圖上以地址概略定位表示，非精確座標。

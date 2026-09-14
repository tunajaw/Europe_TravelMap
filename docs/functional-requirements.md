FR-NAV-01 (Primary Subpage Navigation)：Travel Map 與 Expense subpage 上方皆顯示黑底白字 topbar，提供 Travel Map／Expense 兩個連結自由切換。目前所在 subpage 必須有明確的選取狀態，並同步反映在 URL；瀏覽器上一頁／下一頁需能還原 subpage。鍵盤操作與 focus indicator 必須保留。

FR-MAP-01(Europe map)：進入 Travel Map 時顯示 Europe map，我去過的國家的首都地理位置都有一個灰點代標該國家，該國家的國界線變粗，點上方以深灰色標示該國家名稱。Italy 為避免與 Vatican City 重疊，顯示點使用 Milano Centrale 的已審核座標，但 Rome 仍為 Italy 的首都。

FR-MAP-02 (Country selection): 當我的滑鼠移到點附近時，該國家的所有國界線（包含與其他國家重疊的邊界）變粗加黑，文字變黑色，點稍微放大一點點且變黑以顯示不同之處。靠近點時應容易觸發，移開後不應容易閃爍；移開則恢復原狀。滑鼠操作不顯示點周圍的加粗方框，但鍵盤 focus indicator 必須保留。左鍵滑鼠點下該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示國家名稱、依時間排序的三張國家旅遊圖片集錦與"Enter"。按下 "Enter" 或連點兩下該國家 marker，則 zoom-in 該國家地圖，開啟 Country Map。按到小 box 以外的地方則回到 Europe Map，縮回小 box，取消國家"鎖定"狀態；marker、Segment、metadata card 與地圖控制項不視為 box 外部。如果點擊 marker (即使不是現在的鎖定國家)本身，切換到該 marker 代表國家的鎖定狀態及圖片。圖片左右兩側提供上一張／下一張按鈕，第一張只顯示下一張，最後一張只顯示上一張；圖片切換使用滑動效果，按鈕為較小的半透明正方形且文字置中。切換國家時，右側 bar 使用滑動填滿效果。動畫需遵守 reduced-motion 設定。Europe Map、國家預覽與 Country Map 狀態需由 URL hash 支援直接開啟及瀏覽器上一頁／下一頁。

造訪國家不必具有 Segment。Vatican City 在 MVP 顯示為袖珍國家 marker，浮動 box 可顯示國家名稱及圖片；因為沒有 Segment，marker interaction 不 highlight 路線，Transportation 統計顯示無資料而不是 0。

FR-MAP-03 (City selection): 在國家地圖正中間標示該國家的名稱，淺灰色半透明。我去過的城市都有一個點，點上方以較深灰色（#273449）標示該城市名稱。Country Map 也需顯示與該國可見 Segment 相連的鄰國城市及 Transit Point，並調整地圖範圍，使 Segment 端點對應到可見的 City marker。當我的滑鼠移到點上時，文字變黑色，點稍微放大一點點以顯示不同之處。MVP 點擊 City marker 或按 Enter／Space 時，鎖定該 City、保留相關 Segment highlight，並顯示只有城市名稱與 "Unlock city" 的小卡；城市照片與 City Map 導覽仍屬於 FR-MAP-03+。

FR-MAP-03+ (City selection) [MVP+]: 左鍵滑鼠點下該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示城市名稱、城市旅遊圖片集錦與"Enter"。則 zoom-in 該城市地圖，開啟 City Map，按到 小 box 以外的地方則回到 Country Map，縮回 小 box，取消城市"鎖定"狀態。如果點擊 marker (即使不是現在的鎖定城市)本身，切換到該 marker 代表城市的鎖定"狀態，該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示城市名稱、城市旅遊圖片集錦與"Enter"。

FR-MAP-04 (Back to previous level): 地圖左上角有一個按鈕，按下去會依照 (City Map -> ) Country Map -> Europe Map 的層級 zoom out。MVP 的 Country Map 提供 "Back to Europe"；City Map -> Country Map 屬於 MVP+。地圖層級切換使用動畫，reduced-motion 時直接切換。

FR-MAP-05 (Toggle segment visibility): 地圖的左上角有一個 [Checkbox] "Show travel routes"，預設是打開軌跡的狀態，按下會顯示/隱藏旅行軌跡。Country Map 另有一個預設關閉的 [Checkbox] "Only show domestic routes"；開啟後只顯示起點與終點 Country 都是目前國家的 Segment，並依保留的 Segment 與 Transit Point 重新調整地圖範圍，同時保留目前國家的所有 visited City。保留 Segment 的外國 Transit Point 不會被移除。兩個 checkbox 的狀態在地圖層級切換後仍保留；"Only show domestic routes" 在 Europe Map 不生效，也不影響 dashboard、Expense 統計、raw data 或 Segment 定義。切換篩選時清除 City／Segment 鎖定。

FR-MAP-06 (Segment rendering): 如果是打開軌跡的狀態，顯示旅行軌跡，用很淡偏細的半透明拋物線繪製。Europe Map 永久隱藏起點與終點為同一 Country 的 Segment；Country Map 與統計仍保留這些 Segment。Country Map 顯示其 path 中任何 City（包含 Transit Point）屬於目前國家的 Segment，並套用 FR-MAP-05 的篩選。Endpoint Transfer 不繪製為獨立 Segment。兩段 Segment 即使起/終點相同也不要重疊，在 hover/click 之前雖然會畫多條但不展開，以很小的曲度差異疊加 (視覺上加粗)，但 hover / click 後展開呈明顯多條的 Segment。
。無論真實出發的城市為何，在 Europe Map 中一律以地圖上的 Country 顯示點為端點；在 Country Map 中以 City 顯示點依 origin、Transit Point、destination 順序繪製；在 City Map 中不顯示 Segment。一般線寬為 1.6px，展開時為 2.5px，且不隨 zoom 改變。地圖與 dashboard 使用相同六類：High-speed Rail（深紅色 #780d25）、Train（深粉紅色 #c65c82）、City Bus（淺綠色 #a2d9b0）、InterCity Bus（綠色 #34855b）、Plane（深藍色 #254e85）、Ferry / Cruise（淺藍色 #8bc8e5）。確切 raw subtype 仍保留於 metadata。

FR-MAP-07 (Marker Interaction): 當在 Europe Map 時，當我的滑鼠 hover/focus 或鎖定某一 Country marker，所有可見 Segment path 中包含該 Country 的 Segment 維持 highlight，path 中其他 Country 的文字與點變深；移開時取消暫時狀態，但保留已鎖定 marker 的狀態。當在 Country Map 時，當我的滑鼠 hover/focus 或鎖定某一 City marker，所有可見 Segment path 中包含該 City 的 Segment 維持 highlight，path 中其他 City 的文字與點變深。origin、destination 與 Transit Point 都參與互動；Europe Map 將 City 對應為 Country。隱藏的 Segment 與沒有相關 Segment 的 Country 不產生 highlight。

FR-MAP-08 (Segment Interaction): 
* Europe Map：
	* 當滑鼠 hover/focus 任一 Segment 時，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當滑鼠移開 Segment 時，恢復該 Segment 原本的顯示狀態。
	* 當某一國家處於「鎖定」狀態時，滑鼠 hover 該國家所對應的 Segment，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當某一國家處於「鎖定」狀態時，該國家所對應的 Segment 維持 highlight 狀態，不因滑鼠移開 marker 而恢復。
* Country Map：
	* 當滑鼠 hover/focus 任一 Segment 時，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當滑鼠移開 Segment 時，恢復該 Segment 原本的顯示狀態。
	* 當某一城市處於「鎖定」狀態時，滑鼠 hover 該城市所對應的 Segment，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當某一城市處於「鎖定」狀態時，該城市所對應的 Segment 維持 highlight 狀態，不因滑鼠移開 marker 而恢復。

當滑鼠 hover/focus Segment 時，該 Segment 的 origin、destination 與所有 Transit Point 標籤變為粗體（Europe Map 顯示對應 Country，Country Map 顯示 City）。相同端點的一組 Segment 可以一起展開，但 metadata 必須對應目前 hover/focus 或鎖定的單一 Segment。左鍵點擊 Segment 或按 Enter／Space 可鎖定該筆 metadata；Close 只關閉 metadata，不退出 Country Map。Escape 依序解除 Segment interaction、City selection、Country navigation。切換地圖層級或 route filter 時，清除暫時與鎖定的 City／Segment interaction 狀態。

FR-MAP-09 (Segment Path metadata): 包含出發點-抵達點、日期、Segment base fare（EUR，明確標示不包含 Transfers）、確切原始交通分類、分析交通類別、公司、依序排列的 Transit Point 與備註。0 元顯示為 EUR 0.00；缺少的 optional field 應明確顯示未記錄。metadata 顯示在 SVG 下方，不遮住路線。除 City Bus 外，公司名稱最後端在有本機 icon 時顯示各自公司的網站 icon；InterCity Bus 仍顯示 icon。若找不到或載入失敗則保留文字，不可在 runtime 向第三方服務請求 icon。

FR-EXP-01 (Expense Page Selection): Expense 畫面最左上方兩個互斥按鍵: Transportation / Accommodation 代表現在 Show 的頁面是交通還是住宿相關的資訊，預設是 Transportation

FR-EXP-02 (Transportation Element Component): 
Transportation :
畫面左上方有六種交通類別的按鈕(類別 div 本體是按鈕):
High-speed Rail: ...
Train: ...
City Bus: ...
InterCity Bus: ...
Plane: Total 550/Avg 20
Ferry / Cruise: ...

交通類別由 raw subtype 正規化：高鐵 → High-speed Rail；火車 → Train；公車 → City Bus；客運 → InterCity Bus；飛機 → Plane；郵輪 → Ferry / Cruise。Segment-level 與 Country-level aggregation、地圖和 dashboard filter 都使用相同六類，metadata 同時保留 raw subtype。

接續的是兩個 checkbox: 
* 考慮市區到機場接駁。
* Include 0-Cost Segments
預設：開啟

畫面中間左側，有兩種選單:
顯示: 總價錢、每百公里
排列: 由大到小、由小到大、按時間排列

畫面右側有橫向 barplot，畫出被篩選 Segment 數值。

畫面左下方右側有 heatmap，畫出歐洲地圖。

FR-EXP-03 (Transporatation Data Calculation):
* Endpoint Transfer（Airport 或 local 港口／車站接駁）不是 Segment，而是依附於 parent Segment。
* Segment 距離為依序連接起點 City reference point、所有正式 Transit Point reference point 與終點 City reference point 的各段直線距離（haversine）總和。沒有 Transit Point 時，即為起點到終點的直線距離；此規則同時適用於不同端點與相同 City 起終點的 Segment。City reference point 通常是中央火車站；沒有單一主要車站或沒有鐵路的城市必須使用經人工確認的替代點。
* 非 0 元的 local Endpoint Transfer 永遠把費用及其兩個已確認 GPS 端點間的直線距離加入 parent Segment；它不建立獨立 Segment，也不建立自己的交通類別或 Country aggregation，而是繼承 parent Segment。
* checkbox "考慮市區到機場接駁" 決定 Airport Transfer 是否納入 Transportation 統計。啟用時，只有非 0 元的單程接駁會把費用及 City reference point → Airport 的直線距離加入對應 Segment。
* Endpoint Transfer 不需在 raw data 手動填寫日期或距離；分析距離由 preprocessing 根據已確認的地點座標推導。

FR-EXP-03-01 (Zero-Cost Segment Filter)

Transportation analysis 提供 Include 0-Cost Segments checkbox，預設為開啟。
當 checkbox 開啟時，0 元 Segment 納入 Transportation 的 barplot、heatmap 與統計計算。
當 checkbox 關閉時，0 元 Segment 不納入上述分析。

Segment 是否為 0 元，應以固定納入 local Endpoint Transfer，並套用目前 Airport Transfer checkbox 後的最終 Segment cost 判定。

FR-EXP-04 (Transportation Filter):
交通類別按鈕如果按下，代表納入分析，呈現在下方的視覺圖中。沒按下則不納入分析。
barplot 與 heatmap 的視覺化資料由交通類別按鈕的篩選資料與選單決定的類別呈現。選單 "顯示" 會影響 barplot/heatmap，選單"排列" 會影響 barplot。

FR-EXP-05 (Transportation Barplot Render):
橫向 barplot，列出所有篩選過後的 Segment，如果數值相同以時間排序前面者優先。每個 bar 最右邊顯示數值；Bar 固定合併 local Endpoint Transfer，並在 checkbox 開啟時合併 Airport Transfer。bar 與 Map Segment 使用 FR-MAP-06 定義的相同六類色彩。bar 初次顯示及篩選或 metric 改變時使用平滑動畫；使用者偏好 reduced motion 時停用動畫。

FR-EXP-06 (Transportation Barplot Interaction):
滑鼠滾輪可以檢視上/下被摺疊的 bar。
滑鼠移到 bar 上時暫時列出該 Segment 的 metadata；滑鼠離開 barplot 後，metadata 回復為目前鎖定的 Segment。點擊 bar 可鎖定該 Segment，其 bar 持續顯示較深底色；點擊其他 bar 會改鎖定該 Segment，再次點擊已鎖定的 bar 可解除鎖定。Hover 或鎖定顯示的 metadata 可以拆出 Base Segment / Departure Transfer / Arrival Transfer，包含以下架構:
* Segment 
	* 交通公司
	* 備註 (如有)
* 出發接駁
	* 價錢
	* 交通公司
	* 備註 (如有)
* 抵達接駁
	* 價錢
	* 交通公司
	* 備註 (如有)

Raw 備註依 `Segment 備註/出發接駁備註/抵達接駁備註` 三個位置解析。接駁交通方式與公司若存在於對應備註中，必須顯示於該接駁 metadata；空白位置不可在 parsing 時省略。
Base Segment、Departure Transfer 與 Arrival Transfer 的 Notes 使用相同顯示規則：未記錄時顯示 `-`；有內容時以 `/` 作為換行分隔符，去除各段前後空白，並以 Markdown `*` 對應的 unordered-list 圓點樣式呈現，不顯示字面上的 `*`。

Base Segment 的公司名稱沿用 FR-MAP-09 的本機 company icon 規則；City Bus 不顯示 icon，找不到或載入失敗時保留公司文字。

FR-EXP-07 (Transportation Heatmap Render):
Heatmap 畫出歐洲地圖，以篩選後的 Segment 為 aggregation unit，Country heatmap 顯示該國的平均 metric。迷你袖珍小國(會在資料中定義) 額外在歐洲地圖該國的位置上上設一個點代表該國。同一種 metric 在不同 sort/filter 狀態下保持相同 scale；不同 metric 各自有自己的 scale。No data 使用中性灰色，與有資料但 metric 為 0 的淺藍色明確區隔。所有 Country boundary 使用一致的較粗線寬；hover、focus 或選取 Country 時不可顯示矩形 outline。

跨國 Segment 一律歸屬至出發地 Country，不重複計入目的地 Country。

FR-EXP-08 (Transportation Heatmap Interaction):
地圖可以用滾輪縮放。
滑鼠移到 heatmap 上暫時列出該國家的 metadata；點擊 Country 可鎖定該國家與 metadata，並在最上層加粗顯示該國完整 boundary。Hover 其他 Country 時暫時切換 metadata，滑鼠離開後恢復鎖定的 Country；再次點擊已鎖定的 Country 可解除鎖定。metadata 包含以下架構:
* 國家名稱
* 幾段 Segment
* 平均數值 (+-標準差)
* 排名

FR-EXP-09 (Accommodation Element Component):
畫面左上方有三種住宿類別的按鈕(類別 div 本體是按鈕):
Airbnb: Total Cost 550/Avg. Cost 20/Avg. Commute 60min
Hostel: ...
Hotel: Total Cost 1000/Avg. Cost 30/Avg. Commute 40min

接續的是一個 checkbox: 考慮機場過夜。


畫面中間左側，有兩種選單:
顯示: 每晚平均價錢、到主火車站通勤時間
排列: 由大到小、由小到大、按時間排列、按評級排列。按評級排列時，以個人評價總分由高至低排序；總分相同時，以時間較早者優先。

畫面右側有橫向 barplot，畫出被篩選 Accommodation 數值。

畫面左下方右側有 heatmap，畫出歐洲地圖。

FR-EXP-10 (Accommodation Data Calculation):
* 以住宿晚數計算加權平均，如Σ(commute time × nights) / Σ(nights)。
* 同一 Visit 有多個 Accommodation 時，分別顯示。
* 如果選擇 "考慮機場過夜"，國家住宿平均價格的計算，以該國篩選後 Accommodation 的住宿晚數與總住宿費用計算。機場過夜一定是0元，但通勤時間不考慮機場過夜的天數。
* Raw Airport commute 可記為 0，但 preprocessing 必須轉成不適用，不得納入 commute 平均。
* MVP 不另外計算手續費、稅、退款或分攤。
* Accommodation 的 Country 由 preprocessing 後的住宿 City 推導。啟用機場過夜時，即使機場不在關聯 City 的行政範圍內，仍計入其指定 Country。


FR-EXP-11 (Accommodation Filter)
住宿類別按鈕如果按下，代表納入分析，呈現在下方的視覺圖中。沒按下則不納入分析。
barplot 與 heatmap 的視覺化資料由住宿類別按鈕的篩選資料與選單決定的類別呈現。選單 "顯示" 會影響 barplot/heatmap，選單"排列" 會影響 barplot。

FR-EXP-12 (Accommodation Barplot Render):
橫向 barplot，列出所有篩選過後的 Accommodation，如果數值相同以時間排序前面者優先。每個 bar 最右邊顯示數值。一個 Accommodation = 一個 bar。Airbnb、Hostel、Hotel 為三個獨立類型，顏色依序為淡紅色、淺綠色、藍色；如果勾選"考慮機場過夜"，Airport 在價格 barplot 中以黃色最小寬度標記呈現，數值顯示為 0。Airport commute 為不適用，仍不出現在通勤時間 barplot。

FR-EXP-13 (Accommodation Barplot Interaction):
滑鼠滾輪可以檢視上/下被摺疊的 bar。
滑鼠移到 bar 上列出該 Accommodation 的 metadata，包含以下架構:
* 另一項資訊 (如現在顯示價錢的話 metadata 就顯示通勤時間)
* 最近的大眾運輸站名；Airport 過夜顯示 `-`
* 個人評價：總分以五星制顯示；個別評分須顯示 rubric 項目名稱，並依該項目的 scale 畫出離散長方形格。例如價錢的 0.0～1.0 scale 以四格呈現，0.75 填滿三格。含負值的「其他加分」以零為中心，負分與正分使用不同方向及顏色呈現。
* 備註 (如有)

Accommodation Notes 未記錄時顯示 `-`；有內容時以 `/` 作為換行分隔符，去除各段前後空白，並以 Markdown `*` 對應的 unordered-list 圓點樣式呈現，不顯示字面上的 `*`。

FR-EXP-14 (Accommodation Heatmap Render):
Heatmap 畫出歐洲地圖，以篩選後的 Accommodation 為 aggregation unit，Country heatmap 顯示該國的平均 metric。迷你袖珍小國(會在資料中定義) 額外在歐洲地圖該國的位置上設一個點代表該國；點的底色必須使用該國實際平均 metric 對應的 heatmap 顏色。同一種 metric 在不同 sort/filter 狀態下保持相同 scale；不同 metric 各自有自己的 scale。

FR-EXP-15 (Accommodation Heatmap Interaction):
地圖可以用滾輪縮放。
滑鼠移到或鎖定迷你袖珍小國的點時，只放大點並加粗邊界，不得覆蓋代表 expense 的底色。
滑鼠移到 heatmap 上的國家區域時，列出該國家的 metadata，包含以下架構:
* 國家名稱
* 幾晚上
* 平均數值 (+-標準差)
* 排名

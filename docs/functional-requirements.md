FR-MAP-01(Europe map)：進入 Travel Map 時顯示 Europe map，我去過的國家的首都地理位置都有一個灰點代標該國家，該國家的國界線變粗，點上方以深灰色標示該國家名稱。

FR-MAP-02 (Country selection): 當我的滑鼠移到點上時，該國家的國界線變粗加黑，文字變黑色，點稍微放大一點點且變黑以顯示不同之處。移開則恢復原狀。左鍵滑鼠點下該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示國家名稱、國家旅遊圖片集錦與"Enter"。則 zoom-in 該國家地圖，開啟 Country Map，按到 小 box 以外的地方則回到 Europe Map，縮回 小 box，取消國家"鎖定"狀態。如果點擊 marker (即使不是現在的鎖定國家)本身，切換到該 marker 代表國家的鎖定"狀態，該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示國家名稱、國家旅遊圖片集錦與"Enter"。

FR-MAP-03 (City selection): 在國家地圖正中間標示該國家的名稱，淺灰色半透明。我去過的城市都有一個點，點上方以深灰色標示該城市名稱。當我的滑鼠移到點上時，文字變黑色，點稍微放大一點點以顯示不同之處。

FR-MAP-03+ (City selection) [MVP+]: 左鍵滑鼠點下該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示城市名稱、城市旅遊圖片集錦與"Enter"。則 zoom-in 該城市地圖，開啟 City Map，按到 小 box 以外的地方則回到 Country Map，縮回 小 box，取消城市"鎖定"狀態。如果點擊 marker (即使不是現在的鎖定城市)本身，切換到該 marker 代表城市的鎖定"狀態，該點開啟該點的浮動小 box (位置盡量在 Segment 重疊最少的地方)，顯示城市名稱、城市旅遊圖片集錦與"Enter"。


FR-MAP-04 (Back to previous level): 地圖左上角有一個按鈕，按下去會依照 (City Map -> ) Country Map -> Europe Map 的層級 zoom out。

FR-MAP-05 (Toggle segment visibility): 地圖的左上角有一個 [Checkbox]顯示旅行軌跡，預設是打開軌跡的狀態。按下會顯示/隱藏旅行軌跡。

FR-MAP-06 (Segment rendering): 如果是打開軌跡的狀態，顯示所有的旅行軌跡，用很淡偏細的半透明拋物線繪製，兩段 Segment 即使起/終點相同也不要重疊，在 hover/click 之前雖然會畫多條但不展開，以很小的曲度差異疊加 (視覺上加粗)，但 hover / click 後展開呈明顯多條的 Segment。
。無論真實出發的城市為何，在 Europe Map 中一律以地圖上的顯示點為端點；在 Country Map 中以城市上的顯示點為端點；在 City Map 中不顯示 Segment。地圖與 dashboard 使用相同六類：High-speed Rail（紅色）、Train（粉紅色）、City Bus（淺綠色）、InterCity Bus（綠色）、Plane（深藍色）、Ferry / Cruise（淺藍色）。確切 raw subtype 仍保留於 metadata。

FR-MAP-07 (Marker Interaction): 當在 Europe Map 時，當我的滑鼠移到點上時，相對應  Segment 另一頭的國家文字變深灰色，也變深灰點，移開則恢復原狀。左鍵滑鼠點下該點開啟該點的浮動小 box，相對應  Segment 另一頭的國家文字變深灰色，也變深灰點。當在 Country Map 時，當我的滑鼠移到點上時，相對應  Segment 另一頭的城市文字變深灰色，也變深灰點，移開則恢復原狀。左鍵滑鼠點下該點開啟該點的浮動小 box，相對應 Segment 另一頭的城市文字變深灰色，也變深灰點。

FR-MAP-08 (Segment Interaction): 
* Europe Map：
	* 當滑鼠 hover 任一 Segment 時，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當滑鼠移開 Segment 時，恢復該 Segment 原本的顯示狀態。
	* 當某一國家處於「鎖定」狀態時，滑鼠 hover 該國家所對應的 Segment，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當某一國家處於「鎖定」狀態時，該國家所對應的 Segment 維持 highlight 狀態，不因滑鼠移開 marker 而恢復。
* Country Map：
	* 當滑鼠 hover 任一 Segment 時，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當滑鼠移開 Segment 時，恢復該 Segment 原本的顯示狀態。
	* 當某一城市處於「鎖定」狀態時，滑鼠 hover 該城市所對應的 Segment，該 Segment 加粗並切換為對應交通方式的彩色，同時顯示該 Segment 的詳細 metadata。
	* 當某一城市處於「鎖定」狀態時，該城市所對應的 Segment 維持 highlight 狀態，不因滑鼠移開 marker 而恢復。

FR-MAP-09 (Segment Path metadata): 包含出發點-抵達點，日期，價錢，確切原始交通分類、分析交通類別與備註。

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
* Airport Transfer 不是 Segment。
* Segment 距離為起點 City reference point 到終點 City reference point 的直線距離。City reference point 通常是中央火車站；沒有單一主要車站或沒有鐵路的城市必須使用經人工確認的替代點。
* checkbox "考慮市區到機場接駁" 決定 Airport Transfer 是否納入 Transportation 統計。啟用時，只有非 0 元的單程接駁會把費用及 City reference point → Airport 的直線距離加入對應 Segment。
* Airport Transfer 不需在 raw data 手動填寫日期或距離；分析距離由 preprocessing 根據已確認的地點座標推導。

FR-EXP-03-01 (Zero-Cost Segment Filter)

Transportation analysis 提供 Include 0-Cost Segments checkbox，預設為開啟。
當 checkbox 開啟時，0 元 Segment 納入 Transportation 的 barplot、heatmap 與統計計算。
當 checkbox 關閉時，0 元 Segment 不納入上述分析。

Segment 是否為 0 元，應以套用 Airport Transfer 計算規則後的最終 Segment cost 判定。

FR-EXP-04 (Transportation Filter):
交通類別按鈕如果按下，代表納入分析，呈現在下方的視覺圖中。沒按下則不納入分析。
barplot 與 heatmap 的視覺化資料由交通類別按鈕的篩選資料與選單決定的類別呈現。選單 "顯示" 會影響 barplot/heatmap，選單"排列" 會影響 barplot。

FR-EXP-05 (Transportation Barplot Render):
橫向 barplot，列出所有篩選過後的 Segment，如果數值相同以時間排序前面者優先。每個 bar 最右邊顯示數值，Bar 顯示合併機場接駁 (如有勾選 checkbox) 的費用。bar 與 Map Segment 使用相同六類色彩：High-speed Rail（紅色）、Train（粉紅色）、City Bus（淺綠色）、InterCity Bus（綠色）、Plane（深藍色）、Ferry / Cruise（淺藍色）。

FR-EXP-06 (Transportation Barplot Interaction):
滑鼠滾輪可以檢視上/下被摺疊的 bar。
滑鼠移到 bar 上列出該 Segment 的 metadata，Hover metadata 可以拆出 Base Segment / Departure Transfer / Arrival Transfer，包含以下架構:
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

FR-EXP-07 (Transportation Heatmap Render):
Heatmap 畫出歐洲地圖，以篩選後的 Segment 為 aggregation unit，Country heatmap 顯示該國的平均 metric。迷你袖珍小國(會在資料中定義) 額外在歐洲地圖該國的位置上上設一個點代表該國。同一種 metric 在不同 sort/filter 狀態下保持相同 scale；不同 metric 各自有自己的 scale。

跨國 Segment 一律歸屬至出發地 Country，不重複計入目的地 Country。

FR-EXP-08 (Transportation Heatmap Interaction):
地圖可以用滾輪縮放。
滑鼠移到 heatmap 上列出該國家的 metadata，包含以下架構:
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
排列: 由大到小、由小到大、按時間排列

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
橫向 barplot，列出所有篩選過後的 Accommodation，如果數值相同以時間排序前面者優先。每個 bar 最右邊顯示數值。一個 Accommodation = 一個 bar。Airbnb、Hostel、Hotel 為三個獨立類型；如果勾選"考慮機場過夜"，Airport 使用黃色，但因為價錢為 0，不會出現在價格 bar。Hostel 的確切顏色另行決定。

FR-EXP-13 (Accommodation Barplot Interaction):
滑鼠滾輪可以檢視上/下被摺疊的 bar。
滑鼠移到 bar 上列出該 Accommodation 的 metadata，包含以下架構:
* 另一項資訊 (如現在顯示價錢的話 metadata 就顯示通勤時間)
* 個人評價
* 備註 (如有)

FR-EXP-14 (Accommodation Heatmap Render):
Heatmap 畫出歐洲地圖，以篩選後的 Accommodation 為 aggregation unit，Country heatmap 顯示該國的平均 metric。迷你袖珍小國(會在資料中定義) 額外在歐洲地圖該國的位置上上設一個點代表該國。同一種 metric 在不同 sort/filter 狀態下保持相同 scale；不同 metric 各自有自己的 scale。

FR-EXP-15 (Accommodation Heatmap Interaction):
地圖可以用滾輪縮放。
滑鼠移到 heatmap 上的國家區域時，列出該國家的 metadata，包含以下架構:
* 國家名稱
* 幾晚上
* 平均數值 (+-標準差)
* 排名

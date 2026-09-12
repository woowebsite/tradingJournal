# 📊 Chart Analytics Indicator

Indicator phân tích và thống kê toàn diện hành vi nến theo cơ chế **Tự động chuyển đổi hiển thị thông minh theo Timeframe**:

- 🕒 **Khung thời gian Intraday (`< D1` như `M1`, `M5`, `M15`, `M30`, `H1`, `H4`):**
  - **Tự động hiển thị:**
    - 💡 **Nhận xét tổng hợp Symbol (`summaryLabel` / `summaryTable`):** Luôn hiển thị nhận xét tự động về xu hướng, khung giờ vàng Mua/Bán, giờ biến động và khuyến nghị.
    - 🔔 **Tháp phân phối Hình Chuông (Bell Curve Distribution):** Thống kê phân bổ mật độ biến động của toàn bộ các nến Intraday.
    - 📊 **Bảng Thống kê Biên độ (Spread) Intraday:** Ma trận 10 mức biên độ phân bổ theo từng khung giờ mở nến trong ngày.
  - **Tự động ẩn:** Bảng Weekday, Bảng Monthly, Bảng Spread theo Thứ.
- ☀️ **Khung thời gian Ngày (`Daily / D1`):**
  - **Tự động hiển thị:**
    - 💡 **Nhận xét tổng hợp Symbol (`summaryLabel` / `summaryTable`):** Luôn hiển thị.
    - 🔔 **Tháp phân phối Hình Chuông (Bell Curve Distribution):** Thống kê phân bổ biên độ nến Daily.
    - 📅 **Bảng Thống kê theo Thứ trong tuần (Weekday Table)**.
    - 📈 **Bảng 10 Mức Spread theo Thứ trong tuần (Spread Table)**.
  - **Tự động ẩn:** Bảng Monthly, Bảng Spread Intraday.
- 📅 **Khung thời gian Tuần (`Weekly / W1`):**
  - **Tự động hiển thị:**
    - 💡 **Nhận xét tổng hợp Symbol (`summaryLabel` / `summaryTable`):** Luôn hiển thị phân tích chu kỳ mùa vụ, xu hướng dài hạn.
    - 🗓️ **Bảng Thống kê theo Tháng trong năm (Monthly Seasonality Table):** Phân tích 12 tháng và Top 3 tháng tăng trưởng mạnh nhất.
    - 🔔 **Tháp phân phối Hình Chuông (Bell Curve Distribution):** Thống kê phân bổ biên độ của các cây nến Tuần.
  - **Tự động ẩn:** Bảng Weekday, Bảng Spread theo Thứ, Bảng Spread Intraday.

---

## 🟢🔴 1. Bản chất & Phân loại Nến Xanh (Green) và Nến Đỏ (Red)

Indicator cung cấp 2 chế độ nhận diện nến tùy theo trường phái giao dịch của bạn:

```
          [Nến XANH / Green]                   [Nến ĐỎ / Red]
             High ───┬───                         High ───┬───
                     │                                    │
           Close ┌───┴───┐                      Open  ┌───┴───┐
                 │       │ (Thân nến tăng)            │       │ (Thân nến giảm)
           Open  └───┬───┘                      Close └───┬───┘
                     │                                    │
              Low ───┴───                          Low ───┴───
```

### 🔹 Chế độ 1: `Close > Open` (Mặc định - Chuẩn Price Action)
So sánh giá đóng cửa với giá mở cửa của **chính cây nến đó**:
- 🟢 **Green Candle (Nến Xanh - Phe Mua thắng):** $\text{Close} > \text{Open}$.  
  $\rightarrow$ Trong phiên giao dịch đó, phe Mua (Buyers) chiếm ưu thế đẩy giá từ lúc mở cửa lên cao hơn khi kết thúc phiên.
- 🔴 **Red Candle (Nến Đỏ - Phe Bán thắng):** $\text{Close} < \text{Open}$.  
  $\rightarrow$ Trong phiên giao dịch đó, phe Bán (Sellers) áp đảo ép giá đóng cửa thấp hơn lúc mở cửa.
- ⚪ **Doji (Nến Đứng giá / Cân bằng):** $\text{Close} == \text{Open}$.  
  $\rightarrow$ Cung cầu giằng co cân bằng, không phân thắng bại.

### 🔹 Chế độ 2: `Close > Close[1]` (So với phiên hôm trước - Momentum)
So sánh giá đóng cửa hôm nay với giá đóng cửa phiên trước:
- 🟢 **Green Candle:** $\text{Close} > \text{Close}[1]$ (Thị trường tăng điểm so với hôm qua).
- 🔴 **Red Candle:** $\text{Close} < \text{Close}[1]$ (Thị trường giảm điểm so với hôm qua).

---

## 📐 2. Cấu hình Loại Spread (`Spread Type`) & Bước nhảy (`Spread Step`)

Indicator cung cấp 2 chế độ tính toán biên độ nến trong nhóm **Cấu hình tính toán**:

| Loại Spread (`spreadType`) | Ý nghĩa | Công thức tính toán | Đơn vị trên Header (`unitStr`) | Ví dụ `spreadStep` |
| :--- | :--- | :--- | :---: | :--- |
| **`Percent`** (Mặc định) | Đo lường biên độ biến động theo **phần trăm (%)**. | $$\text{Spread} = \frac{\text{High} - \text{Low}}{\text{Low}} \times 100\%$$ | `%` | Nhập `0.5` $\rightarrow$ các mức: `0-0.5%`, `0.5-1%`, ..., `>4.5%`. |
| **`Bước giá`** | Đo lường biên độ biến động theo **khoảng giá / điểm số (Points/Ticks)** tuyệt đối. | $$\text{Spread} = \text{High} - \text{Low}$$ | *(Không kèm `%`)* | Nhập `1.0` $\rightarrow$ các mức: `0-1`, `1-2`, ..., `>9`. |

---

## 💡 3. Nhận Xét Tổng Hợp Symbol (Symbol Insights Label & Table)

Tự động tổng hợp và đưa ra đánh giá, nhận xét định lượng và định tính sắc bén về hành vi giao dịch của Symbol dựa trên tất cả các bảng dữ liệu đang hiển thị:

### 🖼️ Minh họa nội dung Nhận xét tổng hợp:

```
📊 NHẬN XÉT: BTCUSDT (30)
────────────────────────────────
🎯 Xu hướng: 🟢 Tăng giá (Bullish 63.5% Xanh)
🟢 Giờ Mua tốt nhất: 09:30 (78.6% Xanh | 22/6)
🔴 Giờ Bán áp đảo: 14:00 (71.4% Đỏ | 8/20)
💥 Giờ biến động mạnh: 10:00 (Biến động Spread mạnh nhất)
💤 Giờ đi ngang (Sideway): 11:30 (Nến hẹp / Thị trường đi ngang)
🔔 Biên độ điển hình (Peak): 0.50-1.00% (34.2% nến)
🛡️ Vùng an toàn (80% CDF): ≤ 1.50% (80% nến)
────────────────────────────────
💡 Khuyến nghị: Ưu tiên vị thế Mua theo xu hướng lúc 09:30. Hạn chế mở lệnh lúc 14:00.
```

### 🔹 Các dạng hiển thị (`summaryDisplay`):
1. **`Label trên Chart` (Mặc định):** Đặt hộp nhận xét nổi bên phải thanh nến hiện tại (tùy chỉnh khoảng cách bằng `labelOffset` để không che nến).
2. **`Bảng nhận xét (Summary Table)`:** Hiển thị bảng tóm tắt cố định tại vị trí tùy chọn (`summaryTablePos`, mặc định `Top Left`).
3. **`Cả hai (Label & Table)`:** Kích hoạt đồng thời cả Label nổi và Bảng cố định.

---

## 🔔 4. Tháp Phân Phối Hình Chuông (Bell Curve Distribution Table)

Bảng phân phối hình chuông được thiết kế nhằm trực quan hóa **mật độ xác suất (Probability Density) và hình thái phân phối chuẩn (Gaussian Bell Shape)** của biên độ giá thị trường.

### 🖼️ Minh họa cấu trúc Tháp Hình Chuông (Bell Curve Table):

```
┌──────────────┬──────┬─────────┬────────┬─────────────────────────────┬──────────┐
│ Mức (Spread) │  Nến │  G / R  │ % Dist │ Tháp Hình Chuông (Bell)     │ Tích lũy │
├──────────────┼──────┼─────────┼────────┼─────────────────────────────┼──────────┤
│   0-0.5%     │  45  │  25/20  │  6.2%  │ ██ 6.2%                     │   6.2%   │
│   0.5-1%     │ 120  │  68/52  │ 16.5%  │ █████ 16.5%                 │  22.7%   │
│   1-1.5%     │ 240  │ 135/105 │ 33.0%  │ ██████████ 33.0%  ★ (Đỉnh)  │  55.7%   │
│   1.5-2%     │ 175  │  90/85  │ 24.1%  │ ███████ 24.1%               │  79.8%   │
│   2-2.5%     │  90  │  42/48  │ 12.4%  │ ████ 12.4%                  │  92.2%   │
│   2.5-3%     │  35  │  16/19  │  4.8%  │ █ 4.8%                      │  97.0%   │
│   3-3.5%     │  14  │   6/8   │  1.9%  │ █ 1.9%                      │  98.9%   │
│   3.5-4%     │   5  │   2/3   │  0.7%  │ 0.7%                        │  99.6%   │
│   4-4.5%     │   2  │   1/1   │  0.3%  │ 0.3%                        │  99.9%   │
│   >4.5%      │   1  │   0/1   │  0.1%  │ 0.1%                        │ 100.0%   │
├──────────────┼──────┼─────────┼────────┼─────────────────────────────┼──────────┤
│    Total     │ 727  │ 385/342 │  100%  │ Đỉnh: 1-1.5% (33.0%)        │   100%   │
└──────────────┴──────┴─────────┴────────┴─────────────────────────────┴──────────┘
```

### 🔹 Ý nghĩa các cột trong bảng:
1. **`Mức (Period/Spread)`**: 10 khoảng giá trị biên độ (từ mức thấp đến mức biến động cực đại `> 9 * spreadStep`).
2. **`Nến`**: Tổng số lượng nến xuất hiện trong mức biên độ đó.
3. **`G / R`**: Số nến Xanh (Green) / Đỏ (Red) tương ứng tại mức biến độ đó.
4. **`% Dist` (Tỷ lệ phân phối)**: Tỷ lệ phần trăm số nến tại mức đó so với tổng toàn bộ nến:
   $$\% \text{Dist} = \frac{\text{Count}}{\text{Total Bars}} \times 100\%$$
5. **`Tháp Hình Chuông (Bell Curve)`**: Đồ thị thanh khối ngang (`███████`) biểu diễn độ cao tương đối so với mức đỉnh (Peak Mode), tạo hình silhouette tháp chuông chuẩn xác.
6. **`Tích lũy` (Cumulative Distribution Function - CDF)**: Tỷ lệ phần trăm tích lũy từ mức thấp nhất đến mức hiện tại:
   $$\text{CDF}_k = \sum_{i=0}^{k} \% \text{Dist}_i$$
   $\rightarrow$ Giúp trader xác định mức độ tin cậy (VD: 80% nến trong ngày có biên độ không vượt quá 2.0%).

---

## ⏰ 5. Bảng Thống kê Biên độ (Spread) Intraday theo Khung Giờ (Hiển thị khi `< D1`)

Khi mở biểu đồ Intraday (ví dụ: `M1`, `M5`, `M15`, `M30`, `H1`, `H4`), bảng này bóc tách **phân phối biên độ Spread và tương quan nến Xanh (Green) / Đỏ (Red)** vào 10 mức Spread chi tiết theo từng khung giờ mở nến trong ngày.

### 🖼️ Minh họa cấu trúc bảng Spread Intraday (ví dụ M30, Percent):
- **Các Dòng dọc:** Từng khung giờ mở nến trong ngày (`09:00`, `09:30`, `10:00`...).
- **10 Cột Mức Spread ngang:** `0-0.5%`, `0.5-1.0%`, ..., `>4.5%` + cột `Total`.

```
┌───────────┬────────┬────────┬────────┬───────┬─────┬──────┐
│ Time (30) │ 0-0.5% │ 0.5-1% │ 1-1.5% │ ..... │ >4% │Total │  <-- Cột Spread nằm NGANG
├───────────┼────────┼────────┼────────┼───────┼─────┼──────┤
│   09:00   │  18/5  │  12/4  │  6/2   │ ..... │ 1/0 │ 45/20│
│   09:30   │  10/8  │  14/9  │  8/3   │ ..... │ 2/1 │ 38/27│
│   10:00   │  15/12 │   8/10 │  4/6   │ ..... │ 0/1 │ 30/35│  <-- Khung giờ nằm DỌC
│   .....   │  ...   │   ...  │  ...   │ ..... │ ... │ ...  │
│   14:00   │  12/4  │  16/8  │  9/5   │ ..... │ 3/0 │ 42/23│
├───────────┼────────┼────────┼────────┼───────┼─────┼──────┤
│   Total   │ 110/65 │  95/72 │  54/38 │ ..... │ 8/4 │320/26│  <-- Dòng tổng cộng
└───────────┴────────┴────────┴────────┴───────┴─────┴──────┘
```

### 🔹 Chế độ hiển thị ô dữ liệu (`spreadDisplayMode`):
1. **`G/R (Xanh/Đỏ)` (Mặc định):** Hiển thị số nến `Xanh / Đỏ` (VD: `18/5`). Màu xanh nếu $\text{Green} > \text{Red}$, màu đỏ nếu $\text{Red} > \text{Green}$.
2. **`Total (Tổng nến)`:** Hiển thị tổng số nến rơi vào mức spread đó.
3. **`% Green (Tỷ lệ Xanh)`:** Hiển thị tỷ lệ nến xanh (VD: `78%`).

---

## 📅 6. Bảng Thống kê theo Thứ (Weekday) & Tháng (Monthly) (Hiển thị khi `>= D1`)

| Cột | Ý nghĩa | Công thức / Điều kiện |
| :--- | :--- | :--- |
| **Day / Months** | Thứ trong tuần (`Mon` $\rightarrow$ `Sun`) hoặc Tháng trong năm (`Jan` $\rightarrow$ `Dec`). | Dựa theo thời gian mở nến (`time`). |
| **Green** | Số lượng nến **Tăng** (Xanh). | $\text{Close} > \text{Open}$ (hoặc $\text{Close} > \text{Close}[1]$). |
| **Red** | Số lượng nến **Giảm** (Đỏ). | $\text{Close} < \text{Open}$ (hoặc $\text{Close} < \text{Close}[1]$). |
| **Total** | **Tổng số cây nến** xuất hiện trong chu kỳ đó. | $\text{Total} = \text{Green} + \text{Red} + \text{Doji}$ |
| **% Green** | **Tỷ lệ nến Xanh** (Xác suất tăng giá). | $$\% \text{Green} = \frac{\text{Green}}{\text{Total}} \times 100\%$$ |
| **Avg %** | **Mức biến động % trung bình** mỗi nến. | $$\text{Avg \%} = \frac{1}{\text{Total}} \sum \left( \frac{\text{Close} - \text{Open}}{\text{Open}} \times 100\% \right)$$ |

---

## 📈 7. Bảng thống kê 10 Mức Spread theo Thứ trong tuần (Hiển thị khi `>= D1`)

Tương tự bảng Spread Intraday, nhưng gom dữ liệu theo từng **Thứ trong tuần (`Mon` $\rightarrow$ `Fri` / `Sun`)** để phân tích biên độ biến động theo ngày.

---

## ✨ 8. Cơ chế Tự động Highlight thông minh

1. **Tháp phân phối Hình Chuông (Bell Curve):**
   - 🌟 **Mức Đỉnh (Peak Distribution):** Highlight nền **Vàng hổ phách (Amber `#f59e0b`)** toàn bộ dòng của mức biên độ có mật độ xuất hiện cao nhất.

2. **Bảng Spread Intraday & Bảng Spread theo Thứ:**
   - 🎯 **Cột Total (Bên phải cùng):**
     - 🟢 **Khung giờ / Ngày có số Green nhiều nhất (`Max Green`):** Highlight nền **Xanh ngọc (Emerald `#089981`)** với chữ trắng in đậm — Cho biết khung giờ / ngày nào phe Mua thắng nhiều nhất.
     - 🔴 **Khung giờ / Ngày có số Red nhiều nhất (`Max Red`):** Highlight nền **Đỏ (Ruby `#f23645`)** với chữ trắng in đậm — Cho biết khung giờ / ngày nào phe Bán xả hàng nhiều nhất.
     - 🟣 **Khung giờ đồng thời có cả Green & Red lớn nhất:** Highlight nền **Tím (Purple `#8b5cf6`)**.
   - 🛡️ **10 Cột Mức Spread:** Giữ nền trong suốt nguyên bản giúp giao diện bảng cực kỳ sạch sẽ, tập trung và dễ theo dõi.

3. **Bảng theo Thứ (Weekday):**
   - 🌟 Highlight toàn bộ dòng của **Thứ có `Avg %` lớn nhất** bằng màu vàng hổ phách (**Amber Highlight**).

4. **Bảng theo Tháng (Monthly):**
   - 🟣 **Top 1 Tháng có `Avg %` lớn nhất:** Highlight nền **Tím (Purple)**.
   - 🟢 **Top 2 Tháng có `Avg %` lớn nhì:** Highlight nền **Xanh lục (Green)**.
   - 🔵 **Top 3 Tháng có `Avg %` lớn ba:** Highlight nền **Xanh dương (Blue)**.

---

## ⚙️ 9. Cấu hình cài đặt chính (Inputs)

1. **`Cấu hình tính toán (grp_calc)`**:
   - `Tiêu chuẩn nến xanh (calcMode)`: `Close > Open` hoặc `Close > Close[1]`.
   - `Năm thống kê (filterYear)`: `0` (Toàn bộ) hoặc năm cụ thể.
   - `Loại Spread (spreadType)`: `Percent` hoặc `Bước giá`.
   - `Bước nhảy mỗi mức Spread (spreadStep)`: Nhập bước nhảy tương ứng theo Loại Spread (VD: `0.5` cho Percent, hoặc `1.0` cho Bước giá).
2. **`Nhận xét tổng hợp (grp_summary)`**:
   - `Hiển thị Nhận xét tổng hợp (showSummary)`: Bật/tắt phân tích (Mặc định `true`).
   - `Kiểu hiển thị (summaryDisplay)`: `Label trên Chart`, `Bảng nhận xét (Summary Table)`, hoặc `Cả hai (Label & Table)`.
   - `Độ lệch Label về bên phải (labelOffset)`: Mặc định `5` bars.
   - `Vị trí bảng nhận xét (summaryTablePos)`: Mặc định `Top Left`.
3. **`Bảng Biên độ (Spread) Intraday (grp_intra_spread)`**:
   - `Hiển thị bảng Biên độ (Spread) Intraday`: Tự động kích hoạt khi ở timeframe `< D1`.
   - `Vị trí bảng Spread Intraday`: Mặc định `Bottom Left`.
   - `Chế độ gom giờ`: `Theo nến (Bar Time HH:MM)` (Mặc định), `Theo từng giờ (Hourly)`, `Khung 30m`, `Khung 1h`.
   - `Số dòng hiển thị tối đa`: Mặc định `24` dòng.
   - `Hiển thị tháp hình chuông (showBellTable)`: Mặc định `true`.
   - `Vị trí tháp hình chuông (bellPos)`: Mặc định `Bottom Right`.
4. **`Bảng Weekday, Monthly, Spread theo Thứ`**:
   - Tự động hiển thị khi ở timeframe `>= D1`.
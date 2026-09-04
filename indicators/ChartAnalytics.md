# 📊 Chart Analytics Indicator

Indicator phân tích và thống kê hành vi nến theo **Thứ trong tuần (Weekday)**, **Tháng trong năm (Monthly Seasonality)** và **10 Mức Biên độ nến (Spread Distribution)** trên TradingView (Pine Script v5).

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

## 📑 2. Ý nghĩa các cột & Công thức tính toán

| Cột | Ý nghĩa | Công thức / Điều kiện |
| :--- | :--- | :--- |
| **Day / Months** | Thứ trong tuần (`Mon` $\rightarrow$ `Sun`) hoặc Tháng trong năm (`Jan` $\rightarrow$ `Dec`). | Dựa theo thời gian mở nến (`time`). |
| **Green** | Số lượng nến **Tăng** (Xanh). | $\text{Close} > \text{Open}$ (hoặc $\text{Close} > \text{Close}[1]$). |
| **Red** | Số lượng nến **Giảm** (Đỏ). | $\text{Close} < \text{Open}$ (hoặc $\text{Close} < \text{Close}[1]$). |
| **Total** | **Tổng số cây nến** xuất hiện trong chu kỳ đó. | $\text{Total} = \text{Green} + \text{Red} + \text{Doji}$ |
| **% Green** | **Tỷ lệ nến Xanh** (Xác suất tăng giá). | $$\% \text{Green} = \frac{\text{Green}}{\text{Total}} \times 100\%$$ |
| **Avg %** | **Mức biến động % trung bình** mỗi nến. | $$\text{Avg \%} = \frac{1}{\text{Total}} \sum_{i=1}^{\text{Total}} \left( \frac{\text{Close}_i - \text{Open}_i}{\text{Open}_i} \times 100\% \right)$$ |

---

## 📌 3. Dòng Tổng kết (`Tổng / TB`)

Dòng cuối cùng của mỗi bảng tổng hợp dữ liệu toàn bộ chu kỳ:

- **Tổng nến Xanh / Đỏ / Tổng:** 
  $$\sum \text{Green}, \quad \sum \text{Red}, \quad \sum \text{Total}$$
- **% Xanh trung bình toàn bộ:**
  $$\text{Total \% Green} = \frac{\sum \text{Green}}{\sum \text{Total}} \times 100\%$$
- **Mức biến động % trung bình toàn bộ:**
  $$\text{Total Avg \%} = \frac{\sum \text{Biến động } \%}{\sum \text{Total}}$$

---

## 💡 4. Ví dụ minh họa thực tế (Dễ hình dung)

Giả sử trong **Thứ Hai (Mon)** có tổng cộng **5 cây nến** trong lịch sử với diễn biến như sau:

| Ngày | Giá Mở (`Open`) | Giá Đóng (`Close`) | Loại nến | Biến động $\%$ của nến |
| :---: | :---: | :---: | :---: | :---: |
| **Nến 1** | 100 | 103 | 🟢 Xanh | **$+3.0\%$** |
| **Nến 2** | 100 | 101.5 | 🟢 Xanh | **$+1.5\%$** |
| **Nến 3** | 100 | 98 | 🔴 Đỏ | **$-2.0\%$** |
| **Nến 4** | 100 | 99.5 | 🔴 Đỏ | **$-0.5\%$** |
| **Nến 5** | 100 | 100 | ⚪ Doji | **$0.0\%$** |

### 🧮 Kết quả tính toán:
1. **`Total`:** $5$ nến.
2. **`Green`:** $2$ nến | **`Red`:** $2$ nến.
3. **`% Green` (Tỷ lệ xanh):**
   $$\% \text{Green} = \frac{2}{5} \times 100\% = \mathbf{40.0\%}$$
4. **`Avg %` (Biến động trung bình):**
   $$\text{Tổng biến động } \% = (+3.0\%) + (+1.5\%) + (-2.0\%) + (-0.5\%) + (0.0\%) = +2.0\%$$
   $$\text{Avg \%} = \frac{+2.0\%}{5} = \mathbf{+0.40\%}$$

### 🎯 Ý nghĩa thực chiến của `Avg %`:
- **Khi `Avg %` có màu Xanh $(+)$:** Lực mua chiếm ưu thế, kỳ vọng toán học dương (**Positive Expectancy**). Dù `% Green` chỉ đạt 40%, nhưng mỗi phiên tăng có biên độ lớn đủ để bù đắp các phiên giảm.
- **Khi `Avg %` có màu Đỏ $(-)$:** Lực bán chiếm ưu thế, trung bình mỗi phiên tài khoản bị bào mòn.

| Trạng thái | Ý nghĩa thị trường | Hành động gợi ý |
| :--- | :--- | :--- |
| 🟢 **`Avg %` Xanh** + 🟢 **`% Green > 50%`** | **Lý tưởng nhất (Best Edge):** Vừa dễ thắng, vừa ăn dày. | **Ưu tiên gia tăng tỷ trọng / Mua mạnh.** |
| 🟢 **`Avg %` Xanh** + 🔴 **`% Green < 50%`** | **Bùng nổ đột biến:** Số phiên giảm nhiều hơn nhưng phiên tăng bùng nổ rất mạnh. | **Cẩn trọng bắt đáy, ưu tiên đánh Breakout.** |
| 🔴 **`Avg %` Đỏ** | **Bất lợi cho phe Mua:** Áp lực điều chỉnh cao. | **Hạn chế Mua mới, ưu tiên quản trị rủi ro.** |

---

## 📈 5. Bảng thống kê 10 Mức Spread theo Thứ trong tuần (Layout Ngang - Dọc)

Bảng này phân tích **phân phối tần suất biên độ nến (Volatility Distribution)** và bóc tách cụ thể **Số nến Xanh (G) / Đỏ (R)** trong từng mức biên độ theo từng ngày trong tuần.

### 🖼️ Minh họa cấu trúc hiển thị bảng:
- **Các Thứ trong tuần (`Mon` $\rightarrow$ `Fri` / `Sun`):** Nằm **dọc** (mỗi thứ là 1 dòng).
- **10 Mức Biên độ (`Spread`):** Nằm **ngang** (mỗi mức biên độ là 1 cột).

```
┌──────┬────────┬────────┬────────┬───────┬─────┬──────┐
│ Day  │ 0-0.5% │ 0.5-1% │ 1-1.5% │ ..... │ >4% │Total │  <-- Cột Spread nằm NGANG
├──────┼────────┼────────┼────────┼───────┼─────┼──────┤
│ Mon  │  12/4  │  8/3   │  5/2   │ ..... │ 1/0 │ 32/15│
│ Tue  │  10/5  │  7/4   │  4/1   │ ..... │ 0/1 │ 28/18│
│ Wed  │  14/2  │  9/6   │  6/3   │ ..... │ 2/1 │ 35/16│  <-- Thứ trong tuần nằm DỌC
│ Thu  │   9/7  │  6/5   │  3/2   │ ..... │ 0/0 │ 25/20│
│ Fri  │  11/3  │  8/4   │  5/4   │ ..... │ 1/2 │ 30/17│
├──────┼────────┼────────┼────────┼───────┼─────┼──────┤
│Total │  56/21 │  38/22 │  23/12 │ ..... │ 4/4 │150/86│  <-- Dòng tổng cộng
└──────┴────────┴────────┴────────┴───────┴─────┴──────┘
```

### 🔹 Chế độ hiển thị ô dữ liệu (`spreadDisplayMode`):
1. **`G/R (Xanh/Đỏ)` (Mặc định):** Hiển thị trực tiếp `Xanh / Đỏ` (VD: `12/4` nghĩa là mức đó có 12 nến Xanh và 4 nến Đỏ). Tô màu xanh nếu $\text{Green} > \text{Red}$, tô màu đỏ nếu $\text{Red} > \text{Green}$.
2. **`Total (Tổng nến)`:** Hiển thị tổng số nến rơi vào mức spread đó.
3. **`% Green (Tỷ lệ Xanh)`:** Hiển thị tỷ lệ nến xanh của mức spread đó (VD: `75%`).

### 🔹 Cách tính Spread:
1. **`High - Low (%)` (Mặc định):**
   $$\text{Spread \%} = \frac{\text{High} - \text{Low}}{\text{Low}} \times 100\%$$
   *(Đo lường toàn bộ biên độ quét từ đỉnh cao nhất đến đáy thấp nhất của cây nến).*
2. **`|Close - Open| (%)`:**
   $$\text{Spread \%} = \frac{|\text{Close} - \text{Open}|}{\text{Open}} \times 100\%$$
   *(Đo lường độ dài thực của thân nến).*
3. **`High - Low (Points)`:** $\text{High} - \text{Low}$ (Chênh lệch giá trị tuyệt đối).

### 🔹 10 Mức Spread (Dựa trên `spreadStep`, mặc định `0.5%`):
- **Cột 1:** `0.0 - 0.5%`
- **Cột 2:** `0.5 - 1.0%`
- **Cột 3:** `1.0 - 1.5%`
- **Cột 4:** `1.5 - 2.0%`
- **Cột 5:** `2.0 - 2.5%`
- **Cột 6:** `2.5 - 3.0%`
- **Cột 7:** `3.0 - 3.5%`
- **Cột 8:** `3.5 - 4.0%`
- **Cột 9:** `4.0 - 4.5%`
- **Cột 10:** `> 4.5%`
- **Cột 11:** `Total` (Tổng cộng cho từng ngày).

---

## ✨ 6. Cơ chế Tự động Highlight thông minh

Indicator tích hợp tính năng tự động tìm kiếm và làm nổi bật (Highlight) các điểm sáng quan trọng nhất trên thị trường:

1. **Bảng theo Thứ (Weekday):**
   - 🌟 Tự động highlight toàn bộ dòng của **Thứ có `Avg %` lớn nhất** bằng màu vàng hổ phách (**Amber Highlight**).
   - Giúp bạn nhận diện ngay ngày trong tuần có tỷ suất sinh lời vượt trội nhất.

2. **Bảng theo Tháng (Monthly):**
   - 🌟 Tự động highlight toàn bộ dòng của **Tháng có `Avg %` lớn nhất** bằng màu vàng hổ phách (**Amber Highlight**).
   - Giúp bạn nhận diện ngay tháng có hiệu suất tăng trưởng trung bình mạnh nhất trong năm.

3. **Bảng 10 Mức Spread (Volatility Matrix):**
   - 🟢 **Ô có số nến Green nhiều nhất (`Max Green`):** Highlight nền màu **Xanh ngọc (Emerald)**. Cho biết thứ nào và ở mức biên độ nào phe Mua thắng áp đảo với số lượng nến bùng nổ nhất.
   - 🔴 **Ô có số nến Red nhiều nhất (`Max Red`):** Highlight nền màu **Đỏ (Ruby)**. Cho biết thứ nào và ở mức biên độ nào phe Bán xả hàng mạnh nhất.
   - 🟣 **Ô đồng thời có cả Green và Red lớn nhất:** Highlight nền màu **Tím (Purple)**.

---

## 📌 7. Lưu ý về nến Doji / Đứng giá

- Khi $\text{Close} == \text{Open}$, nến được coi là **Doji (Không đổi)**.
- Mặc định, Doji **không tính vào Green** và **không tính vào Red**, nhưng **vẫn được tính vào Total**.
- Do đó: $\text{Total} \ge \text{Green} + \text{Red}$.
- *(Nếu muốn tính Doji là nến Xanh, bạn có thể bật tùy chọn `Tính Doji là Xanh` trong phần Settings).*

---

## ⚙️ 8. Cấu hình cài đặt chính (Inputs)

1. **`Tiêu chuẩn nến xanh (calcMode)`**: `Close > Open` hoặc `Close > Close[1]`.
2. **`Năm thống kê (filterYear)`**: `0` (Tất cả lịch sử) hoặc nhập năm cụ thể (VD: `2024`, `2025`).
3. **`Bảng Spread (showSpreadTable)`**:
   - `Hiển thị ô dữ liệu Spread`: Chọn `G/R (Xanh/Đỏ)`, `Total (Tổng nến)` hoặc `% Green (Tỷ lệ Xanh)`.
   - `Cách tính Spread`: `High - Low (%)`, `Body (%)`, `Points`.
   - `Bước nhảy Spread (%)`: Mặc định `0.5%`.
4. **`Hiển thị Thứ 7 & Chủ Nhật (showWeekend)`**: Dành cho thị trường Crypto / Forex giao dịch 24/7.
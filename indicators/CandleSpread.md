# Hướng dẫn Chỉ báo Candle Spread Percentile Filter (`CandleSpread.pine`)

## 1. Giới thiệu tổng quan
Chỉ báo **Candle Spread Percentile Filter** đo lường biên độ dao động nến (`Spread = High - Low`) và so sánh với lịch sử $N$ nến trước đó (mặc định 100 nến) dựa trên phương pháp **Phân vị thống kê (Percentile Rank / Nearest Rank)**.

Chỉ báo giúp trader:
- Phát hiện các thời điểm thị trường **bùng nổ biến động (Expansion / Volatility Breakout)**.
- Nhận diện các giai đoạn **nén biên độ / tích lũy hẹp (Compression / Squeeze / Narrow Range)** để chuẩn bị cho nhịp di chuyển lớn tiếp theo.
- Lọc bớt nhiễu khi thị trường giao dịch ở biên độ trung bình.

---

## 2. Ý nghĩa các mức ngưỡng phân vị (Percentile Thresholds)

Chỉ báo thiết lập 3 mốc phân vị quan trọng trong chu kỳ $N$ nến (Lookback = 100):

| Mức phân vị | Tên gọi trạng thái | Ý nghĩa thống kê & Hành động giá | Màu mặc định |
| :--- | :--- | :--- | :--- |
| **$\ge 80\%$** | **Spread Bùng nổ (Expansion)** | Nến có biên độ lớn hơn 80% số nến trong 100 nến qua. Báo hiệu dòng tiền vào mạnh, momentum bứt phá, nến Marubozu hoặc nến Breakout quan trọng. | **Tím (Purple)** |
| **$50\% - 80\%$** | **Spread Mở rộng (Above Median)** | Biên độ nến nằm trên mức trung vị ($50\%$), thể hiện động lượng tốt hơn mức trung bình của thị trường. | **Xanh dương (Blue)** |
| **$20\% - 50\%$** | **Spread Bình thường (Normal Range)** | Biên độ nến dao động quanh mức trung bình thông thường, thanh khoản và biến động ổn định. | **Xám (Gray)** |
| **$\le 20\%$** | **Spread Nén / Thu hẹp (Compression)** | Biên độ nến nhỏ hơn 80% số nến trước đó (thuộc nhóm 20% nến nhỏ nhất). Báo hiệu thị trường sideway chặt chẽ, nén nén VCP, Inside Bar hoặc dấu hiệu tích lũy trước nhịp bứt phá. | **Cam vàng (Orange)** |

---

## 3. Cấu hình tham số (Inputs)

### Nhóm 1: Cấu hình Chu kỳ & Ngưỡng Phân vị
- **Chu kỳ lịch sử (`Lookback`)** *(Mặc định: 100)*: Số lượng nến quá khứ được dùng để tính phân vị.
- **Ngưỡng Nén / Thấp (`p_low_val`)** *(Mặc định: 20.0%)*: Mức phân vị xác định nến biên độ hẹp.
- **Ngưỡng Trung vị (`p_mid_val`)** *(Mặc định: 50.0%)*: Mức phân vị xác định nến đạt mức trung bình/trung vị.
- **Ngưỡng Bùng nổ / Cao (`p_high_val`)** *(Mặc định: 80.0%)*: Mức phân vị xác định nến bùng nổ biến động.

### Nhóm 2: Hiển thị & Màu sắc
- **Hiển thị đường Ngưỡng 20%, 50%, 80%**: Bật/tắt đường ngang giá trị ngưỡng trên biểu đồ phụ.
- **Đổi màu nến trên biểu đồ chính (`paint_bars`)**: Tự động tô màu các cây nến trên biểu đồ giá chính tương ứng với từng trạng thái spread.
- **Tùy chỉnh màu sắc**: Tự do đổi màu theo sở thích cho 4 phân vùng (80%, 50-80%, Bình thường, 20%).

---

## 4. Ứng dụng trong giao dịch

1. **Giao dịch Breakout**:
   - Khi xuất hiện tín hiệu phá vỡ đỉnh/đáy kèm nến đạt **Spread $\ge 80\%$ (Màu tím)** $\rightarrow$ Tín hiệu Breakout có độ tin cậy cao, xác nhận có sự tham gia của dòng tiền lớn.
2. **Săn cơ hội nén tích lũy (Pre-Breakout)**:
   - Khi thị trường xuất hiện chuỗi nến **Spread $\le 20\%$ (Màu cam vàng)** sau một nhịp tăng/giảm mạnh $\rightarrow$ Cảnh báo mô hình cờ đuôi nheo, tam giác hoặc VCP đang ở giai đoạn cuối của quá trình nén, sắp bùng nổ sang xu hướng mới.
3. **Quản lý rủi ro**:
   - Tránh vào lệnh đuổi khi nến đã kéo dài vượt xa ngưỡng 80% (nguy cơ kiệt sức / climax), hoặc hạn chế giao dịch theo xu hướng khi nến liên tục nằm dưới mức 50%.

# Hướng dẫn Chiến lược Supertrend VCP Consolidation Breakout (`SupertrendVCP.pine`)

## 1. Giới thiệu tổng quan
Chiến lược **Supertrend VCP Consolidation Breakout** kết hợp **Bộ lọc Xu hướng Supertrend**, **Bộ lọc Xu hướng dài hạn SMA (Follow Trend)** và **Các Mô hình Thu hẹp Biến động / Tích lũy (VCP / Narrow Range / ATR vs SMA)** để thực hiện các giao dịch cả 2 chiều **LONG (Mua)** và **SHORT (Bán khống)**.

---

## 2. Quy tắc giao dịch (Trading Rules)

### A. Vị thế MUA (LONG)
1. **Xu hướng chính**: Supertrend đang trong xu hướng **TĂNG (Xanh)**.
2. **Bộ lọc Follow Trend SMA (Tùy chọn)**: Giá đóng cửa `Close > SMA(288)` (hoặc chu kỳ SMA tùy chỉnh).
3. **Tích lũy**: Xuất hiện nén biến động thỏa mãn ít nhất 1 trong 4 nhóm (2.1, 2.2, 2.3, 2.4).
4. **Kích hoạt (Entry Long)**: Giá bứt phá vượt lên trên đỉnh $N$ nến trước.
5. **Thoát lệnh Long**: Khi Supertrend đảo chiều sang **GIẢM (Đỏ)** hoặc chạm SL/TP.

### B. Vị thế BÁN KHỐNG (SHORT)
1. **Xu hướng chính**: Supertrend đang trong xu hướng **GIẢM (Đỏ)**.
2. **Bộ lọc Follow Trend SMA (Tùy chọn)**: Giá đóng cửa `Close < SMA(288)` (hoặc chu kỳ SMA tùy chỉnh).
3. **Tích lũy**: Xuất hiện nén biến động thỏa mãn ít nhất 1 trong 4 nhóm (2.1, 2.2, 2.3, 2.4).
4. **Kích hoạt (Entry Short)**: Giá phá vỡ xuyên xuống dưới đáy $N$ nến trước.
5. **Thoát lệnh Short**: Khi Supertrend đảo chiều sang **TĂNG (Xanh)** hoặc chạm SL/TP.

---

## 3. Cấu hình tham số mới trong Group 3

### Nhóm 3: Cấu hình Vào lệnh (Entry Logic)
- **Follow Trend (Lọc xu hướng theo SMA)** (`followTrend` - Mặc định: *Bật*): Bật để yêu cầu kiểm tra giá so với đường SMA Trend.
- **Chu kỳ SMA Trend** (`smaTrendLen` - Mặc định: `288`): Chu kỳ đường trung bình xác định xu hướng lớn.
- **Tiêu chuẩn Breakout/Breakdown**: Chọn giữa `Râu nến vượt đỉnh/đáy (High/Low)` hoặc `Đóng cửa vượt đỉnh/đáy (Close)`.
- **Yêu cầu nến thuận chiều**: Nến Xanh khi Long, nến Đỏ khi Short.
- **Bộ lọc Khối lượng (Volume Filter)**: Tùy chọn lọc Volume Breakout $\ge 1.1 \times SMA(Volume, 10)$.

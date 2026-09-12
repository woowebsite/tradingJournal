# Chiến Lược ZigZag Wizard Strategy (Pine Script v6)

## 1. Tổng quan & Ý tưởng Chiến lược

Chiến lược **ZigZag Wizard Strategy** là hệ thống giao dịch theo cấu trúc sóng đa năng, kết hợp giữa **Cấu trúc sóng ZigZag** và hai tùy chọn chỉ báo xu hướng hàng đầu:
1. **Supertrend (10, 3)** tính trên Đỉnh/Đáy ZigZag.
2. **Donchian Channel (Length = 20)** tính trên Đỉnh/Đáy ZigZag.

Khác với các chỉ báo thông thường lấy dữ liệu nến (`close`, `high`, `low`), **ZigZag Wizard sử dụng trực tiếp các mức Đỉnh (High) và Đáy (Low) đã xác nhận của sóng ZigZag** làm nguồn dữ liệu đầu vào.

---

## 2. Các Chế Độ Chỉ Báo (Indicator Mode)

Người dùng có thể chọn chỉ báo đi kèm ngay tại mục **1. Cấu hình ZigZag** qua dropdown `Indicator`:

### 2.1. Chế độ Supertrend (Mục 2A)
- **Nguồn dữ liệu**: Trung điểm đỉnh đáy $zzHL2 = \frac{\text{High} + \text{Low}}{2}$ hoặc giá đỉnh/đáy theo hướng sóng.
- **Biến động**: $zzATR = \text{RMA}(\text{True Range của ZigZag}, 10)$.
- **Dải Trailing**:
  - Upper Band = $zzSource + 3.0 \times zzATR$
  - Lower Band = $zzSource - 3.0 \times zzATR$
- **Điều kiện tín hiệu**:
  - **LONG**: Sóng ZigZag TĂNG ($\text{zzDir} = 1$) **VÀ** Supertrend ZigZag đang **UP (Xanh)**.
  - **SHORT**: Sóng ZigZag GIẢM ($\text{zzDir} = -1$) **VÀ** Supertrend ZigZag đang **DOWN (Đỏ)**.

### 2.2. Chế độ Donchian Channel (Mục 2B)
- **Nguồn dữ liệu**:
  - **Upper Band**: Đỉnh ZigZag cao nhất trong $N$ nến ($\text{highest}(zzHigh, \text{dcLength})$).
  - **Lower Band**: Đáy ZigZag thấp nhất trong $N$ nến ($\text{lowest}(zzLow, \text{dcLength})$).
  - **Basis (Trung tuyến)**: $\frac{\text{Upper Band} + \text{Lower Band}}{2}$.
- **Thông số cơ bản**: `Length` (Mặc định: `20`).
- **Tiêu chuẩn Trend Donchian**:
  - *Vượt Trung Tuyến (Basis)*: UP khi sóng/giá ZigZag nằm trên Basis ($\text{zzSource} \ge \text{Basis}$), DOWN khi nằm dưới Basis.
  - *Chạm/Phá Dải Biên*: UP khi chạm dải trên, DOWN khi chạm dải dưới.
- **Điều kiện tín hiệu**:
  - **LONG**: Sóng ZigZag TĂNG ($\text{zzDir} = 1$) **VÀ** Donchian ZigZag đang **UP**.
- **Quy tắc bộ lọc Bắt buộc**:
  - Lệnh **LONG** chỉ được phép kích hoạt khi giá đóng cửa $\text{Close} > \text{Supertrend Line}$ (nếu dùng Supertrend) hoặc $\text{Close} > \text{Donchian Basis}$ (nếu dùng Donchian).
  - Lệnh **SHORT** chỉ được phép kích hoạt khi giá đóng cửa $\text{Close} < \text{Supertrend Line}$ (nếu dùng Supertrend) hoặc $\text{Close} < \text{Donchian Basis}$ (nếu dùng Donchian).

---

## 3. Quản Lý Rủi Ro & Khớp Lệnh

- **Stop Loss (SL)**:
  - Tùy chọn 1: *Đáy/Đỉnh ZigZag gần nhất* (Dưới đáy Zigzag cho Long, trên đỉnh Zigzag cho Short).
  - Tùy chọn 2: *Theo dải Indicator* (Bám theo đường Supertrend hoặc Donchian Basis).
  - Tùy chọn 3: *Theo ATR nến*.
- **Take Profit (TP)**:
  - Tỷ lệ Risk:Reward (RRR) tùy chỉnh (Mặc định: 2.0).
  - **Chốt lời 50% từng phần (Partial TP)**: Tự động chốt 50% vị thế tại Đỉnh/Đáy cũ của sóng trước; 50% còn lại gồng theo RRR.
  - **Break-Even**: Tự động dời SL về mức hòa vốn sau khi đạt 1.0R hoặc sau khi chốt lời 50% TP1.

---

## 4. Bảng Cấu Hình Tham Số

| Nhóm thông số | Tên cài đặt | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| **1. ZigZag Settings** | `Indicator` | `Supertrend` | Chọn giữa `Supertrend` hoặc `Donchian`. |
| | `Pivot Depth` | `5` | Số nến trái/phải để xác nhận điểm xoay Zigzag. |
| | `Dùng ATR Deviation` | `true` | Bộ lọc độ lệch thích ứng theo ATR. |
| **2A. Supertrend on ZZ**| `Chu kỳ ATR (Period)` | `10` | Chu kỳ tính ATR Supertrend. |
| | `Hệ số nhân (Factor)` | `3.0` | Hệ số mở rộng dải Supertrend. |
| **2B. Donchian on ZZ** | `Donchian Length` | `20` | Chu kỳ tính dải Upper/Lower Donchian từ Đỉnh/Đáy Zigzag. |
| | `Tiêu chuẩn Trend` | `Vượt Trung Tuyến` | Xác định đảo chiều theo Basis hoặc dải biên. |
| **3. Entry Logic** | `Entry Mode` | `Cùng chiều` | • `Cùng chiều`: **LONG** khi Break Đỉnh ZigZag cũ + Indicator TĂNG; **SHORT** khi Break Đáy ZigZag cũ + Indicator GIẢM.<br>• `Ngược chiều`: **LONG** khi Break Đáy ZigZag cũ + Indicator TĂNG; **SHORT** khi Break Đỉnh ZigZag cũ + Indicator GIẢM. |
| | `Tiêu chuẩn Break` | `Giá Đóng Cửa (Close)` | Chọn giữa `Giá Đóng Cửa (Close)` hoặc `Râu nến (High/Low)`. |
| **4. Risk & Exits** | `Thoát lệnh theo ZigZag` | `true` | Đóng vị thế LONG khi giá $\text{Close} < \text{Đáy ZigZag giảm trước đó}$; Đóng vị thế SHORT khi giá $\text{Close} > \text{Đỉnh ZigZag tăng trước đó}$. |
| | `Thoát lệnh theo Indicator` | `true` | Đóng vị thế khi có 1 sóng ZigZag giảm hoàn thành dưới Supertrend/DC Basis (với Long), hoặc sóng ZigZag tăng hoàn thành trên Supertrend/DC Basis (với Short). |
| | `Phương thức SL` | `Đáy/Đỉnh ZigZag` | Cách đặt điểm cắt lỗ ban đầu. |
| | `Tỷ lệ RRR` | `2.0` | Tỷ lệ Risk : Reward cho mục tiêu TP2. |
| | `Break-Even (Hòa vốn)` | `true` (1.0R) | Dời SL về entry bảo toàn vốn. |

---

## 5. Bảng Dashboard & Cảnh Báo

- **Dashboard thời gian thực**: Hiển thị chế độ chỉ báo đang chọn (`Supertrend` hoặc `Donchian`), trạng thái Sóng ZigZag, trạng thái Trend Indicator, Đỉnh/Đáy Zigzag gần nhất, Mức dải hỗ trợ/kháng cự, Vị thế mở, PnL, Winrate và Profit Factor.
- **Alerts**: Tích hợp sẵn thông báo cho tín hiệu Long/Short, Indicator đảo chiều và Zigzag tạo đỉnh/đáy mới.

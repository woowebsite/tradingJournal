# Chiến Lược Giao Dịch Sideway / Range Trading Với Donchian Channels (20 & 50)

---

## 1. Giới Thiệu & Bản Chất Chiến Lược

Chiến lược **Sideway Range Donchian Strategy** được thiết kế chuyên biệt cho thị trường đi ngang (Sideway / Consolidation / Ranging Market), dựa trên nguyên lý **Mean Reversion (Hồi quy về giá trị trung bình & biên dao động)** kết hợp giữa hai chu kỳ Donchian:
- **Donchian 20 (Chu kỳ ngắn):** Phản ánh trạng thái vị thế và động lượng cục bộ của giá.
- **Donchian 50 (Chu kỳ dài):** Xác định khung biên độ tổng thể của vùng Sideway (Upper Band là đỉnh biên độ, Lower Band là đáy biên độ).

---

## 2. Quy Tắc Giao Dịch Chi Tiết

### 2.1. Quy Tắc Vào Lệnh (Entry Rules)

#### A. Lệnh Mua (Long)
1. **Trạng thái cấu trúc:** `Đường Donchian 20 (Basis) < Đường Donchian 50 (Basis)` (Vùng quá bán/vùng hỗ trợ sideway).
2. **Kích hoạt tín hiệu:** `Giá đóng cửa (Close) > Đường Donchian 20 (Basis)` (Xác nhận dòng tiền bắt đáy và động lực bật nảy).
3. **Bộ lọc khoảng cách:** Thỏa mãn điều kiện độ lệch giữa 2 đường Basis (`validSpreadLong`).

#### B. Lệnh Bán (Short)
1. **Trạng thái cấu trúc:** `Đường Donchian 20 (Basis) > Đường Donchian 50 (Basis)` (Vùng quá mua/vùng kháng cự sideway).
2. **Kích hoạt tín hiệu:** `Giá đóng cửa (Close) < Đường Donchian 20 (Basis)` (Xác nhận lực bán từ chối giá).
3. **Bộ lọc khoảng cách:** Thỏa mãn điều kiện độ lệch giữa 2 đường Basis (`validSpreadShort`).

---

### 2.2. Quy Tắc Thoát Lệnh (Exit & Risk Management)

Chiến lược hỗ trợ **3 tùy chọn Chốt lời (Take Profit) độc lập** có thể bật/tắt bằng checkbox:

| Tùy chọn Thoát lệnh | Lệnh Long | Lệnh Short | Cơ chế thực thi |
| :--- | :--- | :--- | :--- |
| **1. Chạm Upper50 / Lower50 (`useBandExit`)** | Giá chạm **Upper Band Donchian 50** | Giá chạm **Lower Band Donchian 50** | `strategy.exit(..., limit = target)` |
| **2. Cross Donchian (`useCrossExit`)** | Đường **Basis 20 cắt lên Basis 50** | Đường **Basis 20 cắt xuống Basis 50** | `strategy.close(..., comment = "TP Cross DC")` |
| **3. Theo thời gian (`useTimeExit`)** | Đóng vị thế sau **50 nến** (hoặc N nến cài đặt) | Đóng vị thế sau **50 nến** (hoặc N nến cài đặt) | `strategy.close(..., comment = "TP Sau N nến")` |
| **Cắt lỗ Donchian 50 (Dynamic/Fixed)** | Đặt tại **Lower Band Donchian 50** | Đặt tại **Upper Band Donchian 50** | `strategy.exit(..., stop = sl)` |
| **Cắt lỗ Donchian 20 (Dynamic)** | Đặt tại **Lower Band Donchian 20** | Đặt tại **Upper Band Donchian 20** | `strategy.exit(..., stop = sl)` |

---

## 3. Hệ Thống Phát Hiện Bất Thường Swing vs Donchian (Anomaly Detection)

### 3.1. Bản Chất Hiện Tượng Bất Thường (Tại sao Donchian Upper/Lower không trùng Đỉnh/Đáy Swing?)
- **Cơ chế Rolling Window:** Dải Donchian 50 là cửa sổ trượt 50 nến gần nhất (`highest(high, 50)`, `lowest(low, 50)`).
- **Hiện tượng sụt giảm dải (Donchian Decay/Shift):** Khi một Đỉnh Swing mạnh xuất hiện cách đây hơn 50 nến, nó sẽ rơi ra khỏi chu kỳ Donchian 50 $\rightarrow$ Dải `Upper 50` sẽ **bị tụt dốc xuống sâu hơn**.
- **Hệ quả bẫy giá (Trap):** Khi giá tăng trở lại và phá qua `Upper 50` mới, các hệ thống Breakout thông thường sẽ báo "Xu hướng tăng tiếp diễn". Nhưng trên thực tế cấu trúc giá, **giá vẫn nằm dưới Đỉnh Swing cũ chưa hề vượt qua**! Điều này dẫn đến bẫy mua đu đỉnh (Bull Trap) ngay tại vùng cản Swing.

### 3.2. Các Dạng Bất Thường Được Đánh Dấu Trên Biểu Đồ

| Ký hiệu trên Chart | Tên Bất Thường | Điều kiện Kỹ thuật | Ý nghĩa Giao dịch |
| :---: | :--- | :--- | :--- |
| ⚠️ **`Trap Upper (< Swing High)`** | **Bẫy phá vỡ Donchian Upper** | `High > Upper50[1]` nhưng `High < LastSwingHigh` | Donchian báo Breakout do dải bị tụt dốc, nhưng giá vẫn nằm dưới cản đỉnh Swing $\rightarrow$ Cảnh báo không mua đuổi! |
| ⚠️ **`Trap Lower (> Swing Low)`** | **Bẫy phá vỡ Donchian Lower** | `Low < Lower50[1]` nhưng `Low > LastSwingLow` | Donchian báo Breakdown do dải dâng đáy, nhưng giá vẫn nằm trên hỗ trợ đáy Swing $\rightarrow$ Cảnh báo không bán tháo! |
| ⚡ **`SFP Sweep` (Đỉnh)** | **Quét thanh khoản Đỉnh (SFP)** | `High > LastSwingHigh` nhưng `Close < LastSwingHigh` | Giá chọc thủng đỉnh Swing để quét thanh khoản nhưng không đóng nến được phía trên $\rightarrow$ Tín hiệu đảo chiều giảm. |
| ⚡ **`SFP Sweep` (Đáy)** | **Quét thanh khoản Đáy (SFP)** | `Low < LastSwingLow` nhưng `Close > LastSwingLow` | Giá thò chân qua đáy Swing để quét thanh khoản nhưng rút chân đóng phía trên $\rightarrow$ Tín hiệu đảo chiều tăng. |

---

## 4. Các Thông Số Cấu Hình (Inputs)

| Tham số | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `lenShort` | `20` | Chu kỳ Donchian ngắn |
| `lenLong` | `50` | Chu kỳ Donchian dài |
| `allowLong` | `true` | Bật/Tắt giao dịch chiều Long |
| `allowShort` | `true` | Bật/Tắt giao dịch chiều Short |
| `spreadMode` | `Auto` | Cách tính khoảng cách Basis: `Phần trăm (%)`, `Điểm giá (Points/Ticks)`, `Auto` |
| `minSpread` | `1.0` | Khoảng cách tối thiểu giữa Basis 20 và Basis 50 |
| `useTimeExit` | `true` | Checkbox: Bật/Tắt TP theo thời gian (mặc định 50 nến) |
| `exitBars` | `50` | Số nến tối đa giữ vị thế |
| `useBandExit` | `true` | Checkbox: Bật/Tắt TP khi chạm Upper50 (Long) hoặc Lower50 (Short) |
| `useCrossExit` | `false` | Checkbox: Bật/Tắt TP khi Basis 20 cắt qua Basis 50 |
| `slType` | `Cố định tại thời điểm vào lệnh` | Kiểu SL: `Cố định`, `Bám theo Donchian 50 (Dynamic)`, `Bám theo Donchian 20 (Dynamic)` |
| `slBufferTicks` | `0` | Số tick đệm an toàn ngoài dải Band |
| `showAnomaly` | `true` | Bật/Tắt đánh dấu cảnh báo Bất thường trên nến |
| `showSwingLines` | `true` | Bật/Tắt vẽ 2 đường Đỉnh / Đáy Swing (Cản cấu trúc) |
| `swingLeft` / `swingRight` | `5` | Chu kỳ xác nhận Đỉnh/Đáy Swing Pivot |
| `showTable` | `true` | Hiển thị bảng Dashboard thông số trực quan |

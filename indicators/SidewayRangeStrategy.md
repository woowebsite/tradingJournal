# Chiến Lược Giao Dịch Sideway / Range Trading Với Donchian Channels (20 & 50)

---

## 1. Giới Thiệu & Bản Chất Chiến Lược

Chiến lược **Sideway Range Donchian Strategy** được thiết kế chuyên biệt cho thị trường đi ngang (Sideway / Consolidation / Ranging Market), hỗ trợ 2 chế độ vào lệnh:
1. **Donchian Basis Rebound (Hồi quy trung tâm):** Kết hợp chu kỳ Donchian 20 và Donchian 50. Mua khi Donchian 20 ở vùng đáy và giá vượt lên Basis 20; Bán khi Donchian 20 ở vùng đỉnh và giá thủng dưới Basis 20.
2. **False Breakout Hit (Đánh ngược bẫy giá / SFP):** Đánh ngược bẫy giá khi xuất hiện phá vỡ biên Donchian 50 (Long khi Breakdown Lower 50, Short khi Breakout Upper 50).

---

## 2. Quy Tắc Vào Lệnh (Entry Rules)

### 2.1. Chế Độ 1: Donchian Basis Rebound

- **Lệnh Long:**
  - `Đường Donchian 20 (Basis) < Đường Donchian 50 (Basis)` (Vùng quá bán).
  - `Giá đóng cửa (Close) > Đường Donchian 20 (Basis)` (Xác nhận lực bật nảy).
- **Lệnh Short:**
  - `Đường Donchian 20 (Basis) > Đường Donchian 50 (Basis)` (Vùng quá mua).
  - `Giá đóng cửa (Close) < Đường Donchian 20 (Basis)` (Xác nhận từ chối giá).

---

### 2.2. Chế Độ 2: False Breakout Hit

- **Lệnh Mua (Long):**
  - Kích hoạt khi giá **Breakdown Lower 50** (`Close < Lower50[1]` hoặc `Low < Lower50[1]`).
  - **Bộ lọc độ giãn Basis (`validSpreadLong`):** Phải thỏa mãn điều kiện độ lệch giữa Basis 20 và Basis 50 theo cấu hình `spreadMode` (Auto / % / Điểm giá).
- **Lệnh Bán (Short):**
  - Kích hoạt khi giá **Breakout Upper 50** (`Close > Upper50[1]` hoặc `High > Upper50[1]`).
  - **Bộ lọc độ giãn Basis (`validSpreadShort`):** Phải thỏa mãn điều kiện độ lệch giữa Basis 20 và Basis 50 theo cấu hình `spreadMode` (Auto / % / Điểm giá).

---

## 3. Quy Tắc Thoát Lệnh (Exit & Risk Management)

Toàn bộ các chế độ vào lệnh đều tuân thủ và đồng bộ theo cấu hình quản lý thoát lệnh tại **Mục 3**:

| Tùy chọn Thoát lệnh | Lệnh Long | Lệnh Short | Cơ chế thực thi |
| :--- | :--- | :--- | :--- |
| **1. Chạm Upper50 / Lower50 (`useBandExit`)** | Giá chạm **Upper Band Donchian 50** | Giá chạm **Lower Band Donchian 50** | `strategy.exit(..., limit = target)` |
| **2. Cross Donchian (`useCrossExit`)** | Đường **Basis 20 cắt lên Basis 50** | Đường **Basis 20 cắt xuống Basis 50** | `strategy.close(..., comment = "TP Cross DC")` |
| **3. Theo thời gian (`useTimeExit`)** | Đóng vị thế sau **50 nến** (hoặc N nến cài đặt) | Đóng vị thế sau **50 nến** (hoặc N nến cài đặt) | `strategy.close(..., comment = "TP Sau N nến")` |
| **Cắt lỗ Donchian 50 (Dynamic/Fixed)** | Đặt tại **Lower Band Donchian 50** | Đặt tại **Upper Band Donchian 50** | `strategy.exit(..., stop = sl)` |
| **Cắt lỗ Donchian 20 (Dynamic)** | Đặt tại **Lower Band Donchian 20** | Đặt tại **Upper Band Donchian 20** | `strategy.exit(..., stop = sl)` |

---

## 4. Các Thông Số Cấu Hình (Inputs)

| Tham số | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `lenShort` | `20` | Chu kỳ Donchian ngắn |
| `lenLong` | `50` | Chu kỳ Donchian dài |
| `entryMode` | `Donchian Basis Rebound` | Chế độ vào lệnh: `Donchian Basis Rebound` hoặc `False Breakout Hit` |
| `fbTrigger` | `Đóng cửa ngoài dải (Close Break)` | Kiểu kích hoạt FBO: `Close Break` hoặc `High/Low Break` |
| `allowLong` | `true` | Bật/Tắt giao dịch chiều Long |
| `allowShort` | `true` | Bật/Tắt giao dịch chiều Short |
| `spreadMode` | `Auto` | Cách tính khoảng cách Basis cho Rebound |
| `minSpread` | `1.0` | Khoảng cách tối thiểu giữa Basis 20 và Basis 50 |
| `useTimeExit` | `true` | Checkbox: Bật/Tắt TP theo thời gian (mặc định 50 nến) |
| `exitBars` | `50` | Số nến tối đa giữ vị thế |
| `useBandExit` | `true` | Checkbox: Bật/Tắt TP khi chạm Upper50 (Long) hoặc Lower50 (Short) |
| `useCrossExit` | `false` | Checkbox: Bật/Tắt TP khi Basis 20 cắt qua Basis 50 |
| `slType` | `Cố định tại thời điểm vào lệnh` | Kiểu SL: `Cố định`, `Bám theo Donchian 50 (Dynamic)`, `Bám theo Donchian 20 (Dynamic)` |
| `slBufferTicks` | `0` | Số tick đệm an toàn ngoài dải Band |
| `showTable` | `true` | Hiển thị bảng Dashboard thông số trực quan |

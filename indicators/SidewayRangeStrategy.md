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
1. **Trạng thái cấu trúc:** `Đường Donchian 20 (Basis) < Đường Donchian 50 (Basis)`
   - *Ý nghĩa:* Vùng giá ngắn hạn 20 nến đang nằm lệch xuống nửa dưới của vùng tích lũy 50 nến (vùng quá bán/vùng hỗ trợ sideway).
2. **Kích hoạt tín hiệu:** `Giá đóng cửa (Close) > Đường Donchian 20 (Basis)`
   - *Ý nghĩa:* Giá bứt phá ngược lên trên đường trung tâm Donchian 20, xác nhận dòng tiền bắt đáy và động lực bật nảy (bounce) từ biên dưới hướng về biên trên.
3. **Thực thi:** `strategy.entry("Long", strategy.long)`

#### B. Lệnh Bán (Short)
1. **Trạng thái cấu trúc:** `Đường Donchian 20 (Basis) > Đường Donchian 50 (Basis)`
   - *Ý nghĩa:* Vùng giá ngắn hạn 20 nến đang nằm lệch lên nửa trên của vùng tích lũy 50 nến (vùng quá mua/vùng kháng cự sideway).
2. **Kích hoạt tín hiệu:** `Giá đóng cửa (Close) < Đường Donchian 20 (Basis)`
   - *Ý nghĩa:* Giá gãy xuống dưới đường trung tâm Donchian 20, xác nhận lực bán từ chối giá (rejection) từ biên trên hướng về biên dưới.
3. **Thực thi:** `strategy.entry("Short", strategy.short)`

---

### 2.2. Quy Tắc Thoát Lệnh (Exit & Risk Management)

Chiến lược hỗ trợ **3 tùy chọn Chốt lời (Take Profit) độc lập** có thể bật/tắt bằng checkbox:

| Tùy chọn Take Profit | Lệnh Long | Lệnh Short | Cơ chế thực thi |
| :--- | :--- | :--- | :--- |
| **1. Chạm Upper50 / Lower50 (`useBandExit`)** | Giá chạm **Upper Band Donchian 50** | Giá chạm **Lower Band Donchian 50** | `strategy.exit(..., limit = target)` |
| **2. Cross Donchian (`useCrossExit`)** | Đường **Basis 20 cắt lên Basis 50** | Đường **Basis 20 cắt xuống Basis 50** | `strategy.close(..., comment = "TP Cross DC")` |
| **3. Theo thời gian (`useTimeExit`)** | Đóng vị thế sau **50 nến** (hoặc N nến cài đặt) | Đóng vị thế sau **50 nến** (hoặc N nến cài đặt) | `strategy.close(..., comment = "TP Sau N nến")` |
| **Cắt lỗ Donchian 50 (Dynamic/Fixed)** | Đặt tại **Lower Band Donchian 50** | Đặt tại **Upper Band Donchian 50** | `strategy.exit(..., stop = sl)` |
| **Cắt lỗ Donchian 20 (Dynamic)** | Đặt tại **Lower Band Donchian 20** | Đặt tại **Upper Band Donchian 20** | `strategy.exit(..., stop = sl)` |

---

## 3. Tuân Thủ Ràng Buộc & Yêu Cầu

1. **Không sử dụng `plotshape`:** Script không vẽ các mũi tên hoặc nhãn tín hiệu bằng `plotshape`, hoàn toàn sử dụng cơ chế lệnh chuẩn của TradingView Strategy Engine.
2. **Hỗ trợ Backtest toàn diện:** Tích hợp đầy đủ `strategy.entry`, `strategy.exit` (hỗ trợ cả `limit` và `stop`), và `strategy.close`.
3. **Đơn vị tiền tệ mặc định:** Đặt mặc định là **USD** (`currency = currency.USD`).
4. **Không phụ thuộc chỉ báo ngoài:** Không dùng RSI, MACD, EMA, Volume, ATR hay bất kỳ chỉ báo ngoài nào khác, thuần túy dựa trên 2 đường Donchian 20 và 50.

---

## 4. Các Thông Số Cấu Hình (Inputs)

| Tham số | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `lenShort` | `20` | Chu kỳ Donchian ngắn |
| `lenLong` | `50` | Chu kỳ Donchian dài |
| `allowLong` | `true` | Bật/Tắt giao dịch chiều Long |
| `allowShort` | `true` | Bật/Tắt giao dịch chiều Short |
| `spreadMode` | `Phần trăm (%)` | Kiểu tính khoảng cách Basis: `Phần trăm (%)`, `Điểm giá (Points/Ticks)`, `Auto` (Entry tới SL < Basis 20 tới Basis 50) |
| `minSpread` | `1.0` | Khoảng cách tối thiểu giữa Basis 20 và Basis 50 (Áp dụng khi chọn `%` hoặc `Điểm giá`) |
| `useTimeExit` | `true` | Checkbox: Bật/Tắt TP theo thời gian (mặc định 50 nến) |
| `exitBars` | `50` | Số nến tối đa giữ vị thế |
| `useBandExit` | `true` | Checkbox: Bật/Tắt TP khi chạm Upper50 (Long) hoặc Lower50 (Short) |
| `useCrossExit` | `false` | Checkbox: Bật/Tắt TP khi Basis 20 cắt qua Basis 50 |
| `slType` | `Cố định tại thời điểm vào lệnh` | Kiểu SL: `Cố định`, `Bám theo Donchian 50 (Dynamic)`, `Bám theo Donchian 20 (Dynamic)` |
| `slBufferTicks` | `0` | Số tick đệm an toàn ngoài dải Band |
| `showTable` | `true` | Hiển thị bảng Dashboard thông số trực quan |

---

## 5. Hướng Dẫn Sử Dụng Trên TradingView

1. Mở TradingView và vào phần **Pine Editor** ở thanh công cụ phía dưới.
2. Tạo mới một **Strategy Script** hoặc sao chép toàn bộ mã nguồn từ file `SidewayRangeStrategy.pine`.
3. Nhấn **Save** và chọn **Add to chart** (Thêm vào biểu đồ).
4. Mở tab **Strategy Tester** (Kiểm tra chiến lược) để xem các báo cáo hiệu suất:
   - **Net Profit (Lợi nhuận ròng)**
   - **Win Rate (Tỷ lệ thắng)**
   - **Profit Factor (Hệ số lợi nhuận)**
   - **Max Drawdown (Mức sụt giảm tối đa)**
   - **Danh sách từng lệnh giao dịch (List of Trades)**

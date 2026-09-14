# 📈 Chiến Lược Adaptive Supertrend & Sideway Detection (Pine Script v6)

Chiến lược giao dịch chuyên sâu trên TradingView sử dụng thuật toán **Adaptive Supertrend (Supertrend Thích ứng)**, kết hợp công cụ **Nhận diện Sideway Up / Sideway Down** tự động và hệ thống quản trị rủi ro **RRR 2:1 / 4:1** kèm **Bảng Thống kê Dashboard chi tiết**.

---

## 🌟 Các Tính Năng Cốt Lõi

### 1. Cơ Chế Thích Ứng (isAdaptive Mode)
- **Khi BẬT `isAdaptive`:**
  - Tự động điều chỉnh **ATR Period** trong dải `[5 - 20]` và **Multiplier Factor** trong dải `[2.0 - 5.0]`.
  - Sử dụng chỉ số hiệu quả chuyển động **Kaufman Efficiency Ratio (KER)** và **Normalized Volatility Rank**:
    - **Thị trường có xu hướng mượt mà ($KER \to 1.0$):** Thu nhỏ ATR Period về 5 và Factor về 2.0 để phản ứng nhanh, bám sát bước giá và tối ưu điểm chốt lời.
    - **Thị trường hỗn loạn / Sideway ($KER \to 0.0$):** Tăng ATR Period lên tới 20 và Factor lên tới 5.0 nhằm lọc nhiễu, hạn chế tối đa các tín hiệu bẫy (whipsaw).
- **Khi TẮT `isAdaptive`:**
  - Sử dụng thông số cố định theo tiêu chuẩn người dùng nhập (mặc định: `Period = 10`, `Factor = 3.0`).

---

### 2. Phát Hiện Trạng Thái Sideway Ngay Khi Giá Nằm Trên / Dưới Supertrend
- **Sideway Up ⏸️:** Giá vẫn đang nằm trên đường Supertrend (Supertrend màu xanh / Bullish), nhưng thị trường bị nén biên độ hoặc mất động lượng xu hướng (ADX yếu, Choppiness cao hoặc nến giằng co).
- **Sideway Down ⏸️:** Giá vẫn đang nằm dưới đường Supertrend (Supertrend màu đỏ / Bearish), nhưng xuất hiện sự chững lại của đà giảm và nén biên độ.
- **Phương pháp nhận diện linh hoạt:** Hỗ trợ nhiều bộ lọc:
  - **`Narrow Sideway` (Cấu trúc Price Action & FVG):**
    - **Narrow Sideway Up:** Bắt đầu khi đỉnh nến thấp hơn đáy cây nến cao nhất trước đó hoặc nằm dưới đáy FVG giảm trong xu hướng tăng; **yêu cầu chứa tối thiểu 3 nến** (trong đó có ít nhất 1 nến tăng và 1 nến giảm); kết thúc khi có nến đóng cửa cao hơn đỉnh 2 nến trước hoặc chạm vào FVG giảm. Nếu xuất hiện FVG giảm mới thì bắt đầu tính lại vùng Sideway theo FVG đó.
    - **Narrow Sideway Down:** Bắt đầu khi đáy nến cao hơn đỉnh cây nến thấp nhất trước đó hoặc nằm trên đỉnh FVG tăng trong xu hướng giảm; **yêu cầu chứa tối thiểu 3 nến** (trong đó có ít nhất 1 nến tăng và 1 nến giảm); kết thúc khi có nến đóng cửa thấp hơn đáy 2 nến trước hoặc chạm vào FVG tăng. Nếu xuất hiện FVG tăng mới thì bắt đầu tính lại vùng Sideway theo FVG đó.
  - *Kết hợp (ADX + Kaufman ER + Choppiness Index)*
  - *ADX Thấp* ($ADX < 20$)
  - *Choppiness Index Cao* ($CHOP > 60$)
  - *Kaufman ER Thấp* ($KER < 0.30$)
  - *Biên độ dải Bollinger Bands bị co thắt (BB Width Squeeze)*
- **Trực quan hóa:**
  - **Hộp chữ nhật động (Dynamic Sideway Box):** Tự động tạo và mở rộng một hình chữ nhật bao trọn toàn bộ cụm nến (từ đỉnh cao nhất đến đáy thấp nhất) trong suốt giai đoạn Sideway Up (khung viền vàng cam) hoặc Sideway Down (khung viền hồng).

---

### 3. Vào Lệnh (Entry) & Quản Trị Rủi Ro RRR 2:1 / 4:1
- **Tùy chọn Kiểu Vào Lệnh (`entryType`):**
  - **`Supertrend Flip`:** Vào lệnh ngay khi Supertrend đổi màu / đảo chiều xu hướng.
  - **`Break Sideway`:** Vào lệnh khi giá phá vỡ đỉnh (đối với Long) hoặc đáy (đối với Short) của bất kỳ vùng Sideway nào xuất hiện trong sóng Supertrend hiện tại, miễn là lúc đó chưa có vị thế mở (`strategy.position_size == 0`).
  - **`First Pullback`:**
    - **Lệnh Long:** Bắt đầu tính từ cây nến đầu tiên phá qua đáy 3 nến trước đó (`Low < min(Low[1..3])`), kết thúc khi xuất hiện nến phá đỉnh 2 nến trước đó (`Close > max(High[1..2])`) hoặc khi đạt tối đa số nến bằng ATR Period kể từ nến Reversal đảo chiều Supertrend. Vào lệnh Long sau khi vùng Pullback này kết thúc và giá vẫn đóng cửa trên đường Supertrend.
    - **Lệnh Short:** Bắt đầu tính từ cây nến đầu tiên phá qua đỉnh 3 nến trước đó (`High > max(High[1..3])`), kết thúc khi xuất hiện nến phá đáy 2 nến trước đó (`Close < min(Low[1..2])`) hoặc khi đạt tối đa số nến bằng ATR Period kể từ nến Reversal. Vào lệnh Short sau khi vùng Pullback này kết thúc và giá vẫn đóng cửa dưới đường Supertrend.
    - **Đồ họa:** Vùng First Pullback được vẽ viền nổi bật độ dày `linewidth = 2` (Xanh dương cho Pullback Up, Tím cho Pullback Down).
- **Tùy chọn Kiểu Stop Loss (`slType`):**
  - **`Supertrend`:** Đặt Stop Loss tại đường Supertrend tại thời điểm nến vào lệnh.
  - **`Sideway Zone`:** Đặt Stop Loss dưới đáy vùng Sideway / Pullback đối với lệnh Long, và trên đỉnh vùng Sideway / Pullback đối với lệnh Short.
- **Mục tiêu Chốt lời (Take Profit - TP):**
  - **TP1 (RRR 2:1):** $Entry \pm 2.0 \times Risk$ (Chốt 50% khối lượng vị thế).
  - **TP2 (RRR 4:1):** $Entry \pm 4.0 \times Risk$ (Chốt toàn bộ khối lượng còn lại).
- **Tính năng Dời SL về Hòa vốn (Break-Even):**
  - Ngay khi giá cắn mức **TP1**, hệ thống tự động dời SL của phần khối lượng còn lại về mức giá vào lệnh $Entry$ để bảo toàn vốn.
- **Hộp Đồ họa trực quan (Visual Trade Box):**
  - Tự động vẽ khung màu Xanh lá (vùng lợi nhuận TP1/TP2) và Đỏ (vùng rủi ro SL) cho từng lệnh.

---

### 4. Bảng Thống Kê Dashboard Chuyên Nghiệp
Bảng thông số góc màn hình cập nhật liên tục các số liệu:
1. **Chế độ Supertrend:** Hiển thị chế độ đang chạy (Adaptive hay Cố định) kèm thông số `[Period | Factor]` thực tế của nến hiện tại.
2. **Trạng thái thị trường:** `Trending Up 🚀`, `Trending Down 🔻`, `Sideway Up ⏸️`, `Sideway Down ⏸️`.
3. **Vị thế hiện tại:** `LONG`, `SHORT`, hoặc `FLAT` kèm khối lượng.
4. **Tổng số lệnh đã mở:** Tổng lượt kích hoạt chiến lược.
5. **🛑 Số lần dính Stoploss (SL):** Đếm chính xác số lần chạm SL cùng tỷ lệ `%`.
6. **🎯 Số lần Chạm TP1 (2:1):** Đếm số lần đạt mục tiêu RRR 2:1 cùng tỷ lệ `%`.
7. **🏆 Số lần Chạm TP2 (4:1):** Đếm số lần đạt mục tiêu RRR 4:1 cùng tỷ lệ `%`.
8. **Tỷ lệ Thắng (Win Rate) & Lợi nhuận ròng (Net Profit):** Dữ liệu hiệu suất tổng thể.
9. **Max Drawdown:** Mức sụt giảm tài khoản lớn nhất trong quá trình kiểm thử.

---

## 🛠️ Hướng Dẫn Cài Đặt Trên TradingView

1. Mở TradingView và vào mục **Pine Editor** ở thanh công cụ phía dưới.
2. Mở file [indicators/AdaptiveSupertrendStrategy.pine](file:///d:/PROGRAMMING/MyGithub/tradingJournal/indicators/AdaptiveSupertrendStrategy.pine).
3. Sao chép toàn bộ nội dung mã nguồn và dán vào cửa sổ **Pine Editor**.
4. Nhấn **Save** (Lưu) và nhấn **Add to chart** (Thêm vào biểu đồ).
5. Mở cài đặt bánh răng ⚙️ trên tên chiến lược để tùy chỉnh:
   - Bật/tắt `isAdaptive`.
   - Chọn phương pháp lọc Sideway mong muốn.
   - Điều chỉnh tỷ lệ RRR (mặc định 2:1 và 4:1).
   - Chọn vị trí hiển thị bảng Dashboard (Góc trên/dưới, trái/phải).

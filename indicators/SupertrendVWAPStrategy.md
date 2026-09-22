# 📈 Chiến Lược Adaptive Supertrend & Sideway Detection (Pine Script v6)

Chiến lược giao dịch chuyên sâu trên TradingView sử dụng thuật toán **Adaptive Supertrend (Supertrend Thích ứng)**, kết hợp công cụ **Nhận diện Sideway Up / Sideway Down** tự động và hệ thống quản trị rủi ro **RRR 2:1 / 4:1** kèm **Bảng Thống kê Dashboard chi tiết**.

---

## 🌟 Các Tính Năng Cốt Lõi

### 0. Cấu hình Nhanh theo Template (Presets)
Dropdown `Template` ở group **Common** cho phép chọn nhanh các bộ tham số chuẩn mà không cần thiết lập từng mục:
1. **`Scalp using Supertrend`:**
   - **Entry Type:** `Supertrend Flip`
   - **Filter by Supertrend:** `Follow Trend`
   - **Filter by VWAP:** `Tắt (false)`
   - **Stoploss Type:** `Supertrend`
   - **Take Profit Type:** `ATR` (RRR TP1 = 1.5, RRR TP2 = 3.0)
   - **Dời SL về hòa vốn:** `TP 1`
   - **Đóng vị thế còn lại:** `Supertrend đảo ngược chiều`
2. **`Scalp using VWAP`:**
   - **Filter by VWAP:** `Bật (true)`
   - **Chu kỳ neo VWAP:** `Day` (Neo theo Ngày)
   - **VWAP Trend Type:** `Follow Trend`
   - **Vùng giữa VWAP:** `In Middle`
   - **Entry Type:** `Breakdown`
   - **Stoploss Type:** `Entry Candle`
   - **Take Profit Type:** `VWAP` (Chốt theo dải Upper/Lower 2 và 3)
   - **Dời SL về hòa vốn:** `TP 1`
   - **Đóng vị thế còn lại:** `Chạm VWAP`
3. **`VCP`:**
   - **Sideway Method:** `VCP`
   - **Filter by Supertrend:** `Follow Trend`
   - **Filter by VWAP:** `Tắt (false)`
   - **Entry Type:** `Break Sideway`
   - **Stoploss Type:** `Sideway Zone`
   - **Dời SL về hòa vốn:** `TP 1`
   - **Đóng vị thế còn lại:** `None`
4. **`None (Default)`:**
   - Sử dụng các tùy chọn thủ công do người dùng điều chỉnh bên dưới.

### 1. Cơ Chế Thích Ứng (isAdaptive Mode)
- **Khi BẬT `isAdaptive`:**
  - Tự động điều chỉnh **ATR Period** trong dải `[5 - 20]` và **Multiplier Factor** trong dải `[2.0 - 5.0]`.
  - Sử dụng chỉ số hiệu quả chuyển động **Kaufman Efficiency Ratio (KER)** và **Normalized Volatility Rank**:
    - **Thị trường có xu hướng mượt mà ($KER \to 1.0$):** Thu nhỏ ATR Period về 5 và Factor về 2.0 để phản ứng nhanh, bám sát bước giá và tối ưu điểm chốt lời.
    - **Thị trường hỗn loạn / Sideway ($KER \to 0.0$):** Tăng ATR Period lên tới 20 và Factor lên tới 5.0 nhằm lọc nhiễu, hạn chế tối đa các tín hiệu bẫy (whipsaw).
- **Khi TẮT `isAdaptive`:**
  - Sử dụng thông số cố định theo tiêu chuẩn người dùng nhập (mặc định: `Period = 10`, `Factor = 3.0`).

### 1.1. Bộ Lọc Xu Hướng Supertrend (Filter by Supertrend)
- **`Follow Trend` (Thuận xu hướng Supertrend):**
  - Mở lệnh **Long** khi giá nằm trên đường Supertrend ($Close > Supertrend$).
  - Mở lệnh **Short** khi giá nằm dưới đường Supertrend ($Close < Supertrend$).
- **`Counter Trend` (Ngược xu hướng Supertrend):**
  - Mở lệnh **Long** khi giá nằm dưới đường Supertrend ($Close < Supertrend$).
  - Mở lệnh **Short** khi giá nằm trên đường Supertrend ($Close > Supertrend$).
- **`Swing` (Trạng thái Swing của Supertrend):**
  - Cho phép **Long** khi đang trong sóng tăng và $Supertrend_{\text{Tăng}} < Supertrend_{\text{Giảm trước đó}}$ (Trạng thái thị trường "Tăng").
  - Cho phép **Short** khi đang trong sóng giảm và $Supertrend_{\text{Giảm}} > Supertrend_{\text{Tăng trước đó}}$ (Trạng thái thị trường "Giảm").
- **`Strong Trend` (Trạng thái Xu hướng mạnh của Supertrend):**
  - Cho phép **Long** khi đang trong sóng tăng và $Supertrend_{\text{Tăng}} > Supertrend_{\text{Giảm trước đó}}$.
  - Cho phép **Short** khi đang trong sóng giảm và $Supertrend_{\text{Giảm}} < Supertrend_{\text{Tăng trước đó}}$.

### 1.2. Bộ Lọc Xu Hướng Anchored VWAP (Filter by VWAP)
- **`Follow Trend`**: Long khi $Close > VWAP$, Short khi $Close < VWAP$.
- **`Counter Trend`**: Long khi $Close < VWAP$, Short khi $Close > VWAP$.
- **`mustInMiddle`**: Lọc vị trí vào lệnh nằm trong hoặc ngoài dải Upper 1 / Lower 1 của VWAP.

### 1.3. Bộ Lọc Phân Vị Biên Độ Nến (1.3 Spread Filter)
Lọc tín hiệu Entry theo phân vị biên độ nến ($Spread = High - Low$) so với lịch sử $N$ nến trước đó (mặc định 100 nến):
- **`None`**: Không áp dụng bộ lọc biên độ nến.
- **`Spread Bùng nổ >= 80%`**: Chỉ cho phép vào lệnh khi cây nến đạt biên độ lớn hơn hoặc bằng phân vị 80% ($Spread \ge P_{80}$). Phù hợp với chiến thuật Breakout / Momentum bùng nổ.
- **`Spread Mở rộng 50-80%`**: Chỉ vào lệnh khi biên độ nến nằm trong khoảng phân vị từ 50% đến 80% ($P_{50} \le Spread < P_{80}$).
- **`Spread Bình thường 20-50%`**: Chỉ vào lệnh khi biên độ nến dao động ở mức thông thường ($P_{20} \le Spread < P_{50}$).
- **`Spread nén <= 20%`**: Chỉ vào lệnh khi biên độ nến bị nén chặt ($Spread \le P_{20}$), phù hợp cho chiến thuật săn nén tích lũy trước sóng lớn.

---

### 2. Phát Hiện Trạng Thái Sideway Ngay Khi Giá Nằm Trên / Dưới Supertrend
- **Sideway Up ⏸️:** Giá vẫn đang nằm trên đường Supertrend (Supertrend màu xanh / Bullish), nhưng thị trường bị nén biên độ hoặc mất động lượng xu hướng (ADX yếu, Choppiness cao hoặc nến giằng co).
- **Sideway Down ⏸️:** Giá vẫn đang nằm dưới đường Supertrend (Supertrend màu đỏ / Bearish), nhưng xuất hiện sự chững lại của đà giảm và nén biên độ.
- **Phương pháp nhận diện linh hoạt:** Hỗ trợ nhiều bộ lọc:
  - **`Narrow Sideway` (Cấu trúc Price Action & FVG):**
    - **Narrow Sideway Up:** Bắt đầu khi đỉnh nến thấp hơn đáy cây nến cao nhất trước đó hoặc nằm dưới đáy FVG giảm trong xu hướng tăng; **yêu cầu chứa tối thiểu 3 nến** (trong đó có ít nhất 1 nến tăng và 1 nến giảm); kết thúc khi có nến đóng cửa cao hơn đỉnh 2 nến trước hoặc chạm vào FVG giảm. Nếu xuất hiện FVG giảm mới thì bắt đầu tính lại vùng Sideway theo FVG đó.
    - **Narrow Sideway Down:** Bắt đầu khi đáy nến cao hơn đỉnh cây nến thấp nhất trước đó hoặc nằm trên đỉnh FVG tăng trong xu hướng giảm; **yêu cầu chứa tối thiểu 3 nến** (trong đó có ít nhất 1 nến tăng và 1 nến giảm); kết thúc khi có nến đóng cửa thấp hơn đáy 2 nến trước hoặc chạm vào FVG tăng. Nếu xuất hiện FVG tăng mới thì bắt đầu tính lại vùng Sideway theo FVG đó.
  - **`VCP` (Volatility Contraction Pattern theo dải VMA ATR Bands `ubx` & `lbx`):**
    - **VCP Up (Sóng Tăng - Mở lệnh Long):**
      - **1.** Toàn bộ nến trong mô hình VCP đều có giá mở cửa nằm trong dải Bands ($lband \le Open \le uband$).
      - **2.** **Không có bất kỳ Low nào của nến nhỏ hơn Lower Band** ($Low \ge lband$).
      - **3.** Tất cả các nến đều có giá đóng cửa nằm trên Lower Band ($Close \ge lband$).
      - **4.** Vùng giá có ít nhất 2 nến có đỉnh nằm dưới Upper Band ($High < uband$).
      - **5.** Vùng giá kết thúc khi xuất hiện nến đóng cửa vượt lên trên dải Upper Band ($Close > uband$).
      - **6.** Tối thiểu phải chứa từ 3 nến trở lên (không bao gồm nến Breakout khỏi Upper Band).
    - **VCP Down (Sóng Giảm - Mở lệnh Short):**
      - **1.** Toàn bộ nến trong mô hình VCP Down đều có giá mở cửa nằm trong dải Bands ($lband \le Open \le uband$).
      - **2.** **Không có bất kỳ High nào của nến lớn hơn Upper Band** ($High \le uband$).
      - **3.** Tất cả các nến đều có giá đóng cửa nằm dưới Upper Band ($Close \le uband$).
      - **4.** Vùng giá có ít nhất 2 nến có đáy nằm trên Lower Band ($Low > lband$).
      - **5.** Vùng giá kết thúc khi xuất hiện nến đóng cửa phá xuống dưới dải Lower Band ($Close < lband$).
      - **6.** Tối thiểu phải chứa từ 3 nến trở lên (không bao gồm nến Breakdown khỏi Lower Band).
    - **Trực quan:** Tự động tính toán đường **VMA** (Variable Moving Average với chu kỳ `vmaLen = 6`) kèm dải **ATR Bands** (`vmaMult = 1.5` $\times$ ATR) gồm **`ubx` (UpperBand)** và **`lbx` (LowerBand)** hiển thị trên biểu đồ khi chọn chế độ này. Hỗ trợ tùy chọn đổi màu đường VMA và tô màu nến theo chiều xu hướng.
  - *Kết hợp (ADX + Kaufman ER + Choppiness Index)*
  - *ADX Thấp* ($ADX < 20$)
  - *Choppiness Index Cao* ($CHOP > 60$)
  - *Kaufman ER Thấp* ($KER < 0.30$)
  - *Biên độ dải Bollinger Bands bị co thắt (BB Width Squeeze)*
- **Trực quan hóa:**
  - **Hộp chữ nhật động (Dynamic Sideway Box):** Tự động tạo và mở rộng một hình chữ nhật bao trọn toàn bộ cụm nến (từ đỉnh cao nhất đến đáy thấp nhất) trong suốt giai đoạn Sideway Up hoặc Sideway Down (đồng nhất khung viền và nền màu vàng cam `#f59e0b`).

---

### 3. Vào Lệnh (Entry) & Quản Trị Rủi Ro RRR 2:1 / 4:1
- **Tùy chọn Kiểu Vào Lệnh (`entryType`):**
  - **`Supertrend Flip`:** Vào lệnh ngay khi Supertrend đổi màu / đảo chiều xu hướng.
  - **`Break Sideway`:** Vào lệnh khi giá phá vỡ đỉnh (đối với Long) hoặc đáy (đối với Short) của vùng Sideway gần nhất trong sóng Supertrend hiện tại, **với điều kiện khoảng cách từ lúc kết thúc Sideway tới nến phá vỡ tối đa không quá 3 nến** (`distance <= 3 nến`), loại bỏ hoàn toàn các trường hợp giá trôi dạt quá xa vùng Sideway cũ.
  - **`First Pullback`:**
    - **Lệnh Long:** Bắt đầu tính từ cây nến đầu tiên phá qua đáy 3 nến trước đó (`Low < min(Low[1..3])`), kết thúc khi xuất hiện nến phá đỉnh 2 nến trước đó (`Close > max(High[1..2])`) hoặc khi đạt tối đa số nến bằng ATR Period kể từ nến Reversal đảo chiều Supertrend. Vào lệnh Long sau khi vùng Pullback này kết thúc và giá vẫn đóng cửa trên đường Supertrend.
    - **Lệnh Short:** Bắt đầu tính từ cây nến đầu tiên phá qua đỉnh 3 nến trước đó (`High > max(High[1..3])`), kết thúc khi xuất hiện nến phá đáy 2 nến trước đó (`Close < min(Low[1..2])`) hoặc khi đạt tối đa số nến bằng ATR Period kể từ nến Reversal. Vào lệnh Short sau khi vùng Pullback này kết thúc và giá vẫn đóng cửa dưới đường Supertrend.
    - **Đồ họa:** Vùng First Pullback được vẽ viền nổi bật độ dày `linewidth = 1` (đồng nhất màu xanh dương `#3b82f6` cho cả First Pullback Up và First Pullback Down).
  - **`Pullback + Sideway` (Kết hợp Pullback và Break Sideway):**
    - **Cơ chế hoạt động:** Cho phép chiến lược vào lệnh khi xuất hiện tín hiệu **First Pullback** HOẶC **Break Sideway** (trong vòng 3 nến).
    - **Liên hoàn vị thế (Chaining trades):** Sau khi lệnh First Pullback đã chốt lời hoàn tất (trạng thái tài khoản trở về `Flat`), nếu trong cùng con sóng Supertrend đó tiếp tục hình thành vùng tích lũy Sideway mới và giá phá vỡ vùng này trong vòng 3 nến, hệ thống sẽ **tự động mở tiếp lệnh theo Break Sideway**.
  - **`Breakdown`:**
    - **Lệnh Long:** Vào lệnh khi nến đỏ đóng cửa phá vỡ giá thấp nhất của nến trước ($Close < Open$ và $Close < Low[1]$).
    - **Lệnh Short:** Vào lệnh khi nến xanh đóng cửa vượt giá cao nhất của nến trước ($Close > Open$ và $Close > High[1]$).
  - **`VMA Reversal` (Đảo chiều theo dải VMA ATR Bands):**
    - **Lệnh Long:**
      - **Signal Bar Long:** Nến đảo chiều cắt ngược qua VMA có $Open < VMA$ và $Close > VMA$, đồng thời trong chu kỳ $N$ nến trước đó ($N = vmaLen$) bắt buộc phải có ít nhất 1 nến có đáy nhúng xuống dưới dải Lower Band ($Low < lband$).
      - **Entry Bar Long:** Cây nến tiếp theo đóng cửa vượt qua giá đỉnh của cây Signal Bar ($Close > High_{\text{Signal Bar}}$).
    - **Lệnh Short:**
      - **Signal Bar Short:** Nến đảo chiều cắt ngược xuống dưới VMA có $Open > VMA$ và $Close < VMA$, đồng thời trong chu kỳ $N$ nến trước đó ($N = vmaLen$) bắt buộc phải có ít nhất 1 nến có đỉnh vượt lên trên dải Upper Band ($High > uband$).
      - **Entry Bar Short:** Cây nến tiếp theo đóng cửa phá thủng giá đáy của cây Signal Bar ($Close < Low_{\text{Signal Bar}}$).
    - **Trực quan:** Hiển thị tự động đường **VMA** kèm 2 dải **Upper Band (ubx)** / **Lower Band (lbx)** và đánh dấu biểu tượng **Signal** ngay tại các cây nến Signal Bar.
- **Tùy chọn Kiểu Stop Loss (`slType`):**
  - **`Supertrend`:** Đặt Stop Loss tại đường Supertrend tại thời điểm nến vào lệnh.
  - **`Sideway Zone`:** Đặt Stop Loss dưới đáy vùng Sideway / Pullback đối với lệnh Long, và trên đỉnh vùng Sideway / Pullback đối với lệnh Short.
  - **`Entry Candle`:** Đặt Stop Loss tại giá **Low** của chính cây nến vào lệnh (đối với Long) hoặc giá **High** của cây nến vào lệnh (đối với Short).
  - **`Previous Candle`:** Đặt Stop Loss tại giá **Low** của cây nến liền trước đó `Low[1]` (đối với Long) hoặc giá **High** của cây nến liền trước đó `High[1]` (đối với Short).
- **Tùy chọn Kiểu Take Profit (`tpType`):**
  - **`Percent` (Theo tỷ lệ RRR / Risk):**
    - Khoảng cách TP1 = $Entry \pm rrrTp1 \times Risk$ (với $Risk = |Entry - SL|$).
    - Khoảng cách TP2 = $Entry \pm rrrTp2 \times Risk$.
  - **`ATR` (Theo biến động ATR hiện tại):**
    - Khoảng cách TP1 = $Entry \pm rrrTp1 \times ATR$ (với chu kỳ ATR Period hiệu dụng tại thời điểm vào lệnh).
    - Khoảng cách TP2 = $Entry \pm rrrTp2 \times ATR$.
  - **`ATR (HTF)` (Theo ATR 6 phiên của khung thời gian lớn HTF):**
    - Tùy chọn khung thời gian HTF (`htfTf`): `M5`, `M30`, `H4`, `D1`, `W1`.
    - Khoảng cách TP1 = $Entry \pm rrrTp1 \times ATR(6)_{HTF}$ (Ví dụ: HTF là D1 có $ATR(6) = 18$ và $rrrTp1 = 2 \implies 18 \times 2 = 36$ giá).
    - Khoảng cách TP2 = $Entry \pm rrrTp2 \times ATR(6)_{HTF}$.
  - **`Spread` (Theo số tick giá / syminfo.mintick):**
    - Khoảng cách TP1 = $Entry \pm rrrTp1 \times syminfo.mintick$ (tính theo số tick giá tối thiểu của sản phẩm).
    - Khoảng cách TP2 = $Entry \pm rrrTp2 \times syminfo.mintick$.
  - **`VWAP` (Theo 3 dải Upper/Lower của Anchored VWAP):**
    - **3 Dải Upper & Lower:**
      - $\text{Upper 1} / \text{Lower 1} = \text{VWAP} \pm (1.0 \times \text{StDev}_{\text{VWAP}})$ (Cố định tỷ lệ 1.0x, nét chấm xanh dương).
      - $\text{Upper 2} / \text{Lower 2} = \text{VWAP} \pm (\text{TP1} \times \text{StDev}_{\text{VWAP}})$ (Tính theo hệ số TP1, nét đứt tím).
      - $\text{Upper 3} / \text{Lower 3} = \text{VWAP} \pm (\text{TP2} \times \text{StDev}_{\text{VWAP}})$ (Tính theo hệ số TP2, nét liền đỏ/xanh lá).
    - **Lệnh Long:** Chốt lời theo **Upper 2** (TP1) và **Upper 3** (TP2).
    - **Lệnh Short:** Chốt lời theo **Lower 2** (TP1) và **Lower 3** (TP2).
    - Mức giá chốt lời cập nhật động theo từng nến chạy theo các dải biên của VWAP.
- **Phương thức Chốt lời TP1 / TP2 (`tp1Mode`, `tp2Mode`):**
  - **`Theo RRR / Tỷ lệ`:** Chốt lời theo mức giá TP cố định/động theo hệ số $rrrTp1$ / $rrrTp2$ và kiểu $tpType$.
  - **`Next (n) Candle`:** Thoát lệnh sau $n$ cây nến kể từ nến vào lệnh Entry ($n = rrrTp1$ hoặc $rrrTp2$). Ví dụ: nếu đặt $rrrTp1 = 1$, lệnh sẽ tự động chốt lời tại cây nến tiếp theo ngay sau nến Entry (vào hôm nay, chốt ngày mai).
  - **`Breakout2` (Chỉ chốt khi đang có lời & cách Entry $\ge 3$ nến):** Long chốt khi $Close > \max(High[1], High[2])$, $Close > Entry$ và nến TP cách nến Entry tối thiểu 3 nến ($bar\_index - entryBarIdx \ge 3$); Short chốt khi $Close < \min(Low[1], Low[2])$, $Close < Entry$ và $bar\_index - entryBarIdx \ge 3$.
  - **`Breakout3` (Chỉ chốt khi đang có lời & cách Entry $\ge 3$ nến):** Long chốt khi $Close > \max(High[1], High[2], High[3])$, $Close > Entry$ và nến TP cách nến Entry tối thiểu 3 nến ($bar\_index - entryBarIdx \ge 3$); Short chốt khi $Close < \min(Low[1], Low[2], Low[3])$, $Close < Entry$ và $bar\_index - entryBarIdx \ge 3$.
  - **`FVG` (Chỉ chốt khi đang có lời & nến [2] sau Entry):** Long chốt khi xuất hiện khoảng trống tăng ($Low > High[2]$), $Close > Entry$ và nến số 2 ($High[2]$) phải xuất hiện sau nến vào lệnh ($bar\_index - 2 > entryBarIdx$); Short chốt khi xuất hiện khoảng trống giảm ($High < Low[2]$), $Close < Entry$ và nến số 2 ($Low[2]$) phải xuất hiện sau nến vào lệnh.
- **Mục tiêu Chốt lời (Take Profit - TP):**
  - **TP1:** Chốt 50% khối lượng vị thế (hoặc theo `%` cấu hình).
  - **TP2:** Chốt toàn bộ khối lượng còn lại.
- **Tính năng Dời SL về Hòa vốn (Break-Even):**
  - Cung cấp Dropdown linh hoạt với các lựa chọn:
    - **`RRR = 1`:** Tự động nâng/hạ Stoploss về giá $Entry$ ngay khi giá đi được quãng đường $1R$ (bằng đúng khoảng cách Risk ban đầu).
    - **`TP 1`:** Tự động dời SL về $Entry$ ngay khi giá chạm mục tiêu **TP1** (chốt lời 50%).
    - **`TP 2`:** Tự động dời SL về $Entry$ khi giá chạm mục tiêu **TP2**.
    - **`Không (None)`:** Giữ nguyên Stoploss ban đầu, không tự động dời.
- **Hộp Đồ họa trực quan (Visual Trade Box):**
  - Tự động vẽ khung màu Xanh lá (vùng lợi nhuận TP1/TP2) và Đỏ (vùng rủi ro SL) cho từng lệnh.

---

### 3.1. Bộ Lọc Xu Hướng Anchored VWAP
Bộ lọc khối lượng & giá bình quân đa khung thời gian giúp chọn lọc hướng giao dịch thuận lợi nhất:
- **Chu kỳ neo (Anchor Period):** `Year` (Năm), `Quarter` (Quý - 3 tháng), `Month` (Tháng), `Week` (Tuần), `Day` (Ngày).
- **Kiểu theo xu hướng (Trend Type):**
  - **`Follow Trend` (Thuận xu hướng VWAP):** Chỉ cho phép mở lệnh **Long** khi $Close > VWAP$, và chỉ mở lệnh **Short** khi $Close < VWAP$.
  - **`Counter Trend` (Đánh ngược xu hướng VWAP):** Chỉ cho phép mở lệnh **Long** khi $Close < VWAP$, và chỉ mở lệnh **Short** khi $Close > VWAP$.
- **Điều kiện vùng giữa VWAP (`mustInMiddle`):**
  - **`In Middle`:** Điểm vào lệnh (Entry) bắt buộc phải nằm **bên trong** dải giữa Upper 1 và Lower 1 ($\text{Lower 1} \le Entry \le \text{Upper 1}$).
  - **`Out Middle`:** Điểm vào lệnh bắt buộc phải nằm **bên ngoài** dải Upper 1 và Lower 1 ($Entry > \text{Upper 1}$ hoặc $Entry < \text{Lower 1}$).
  - **`None`:** Giữ nguyên logic cũ, không lọc theo vị trí dải giữa.
- **Trực quan:** Đường Anchored VWAP vẽ màu trắng nét liền (`linewidth = 2`) và 3 dải Upper/Lower trên biểu đồ.

---

### 4. Bảng Thống Kê Dashboard Chuyên Nghiệp
Bảng thông số góc màn hình cập nhật liên tục các số liệu:
1. **Chế độ Supertrend:** Hiển thị chế độ đang chạy (Adaptive hay Cố định) kèm thông số `[Period | Factor]` thực tế của nến hiện tại.
2. **Trạng thái thị trường (`marketState`):**
   - **Tăng mạnh 🚀:** Supertrend Up và Supertrend sóng tăng > Supertrend sóng giảm trước đó.
   - **Tăng 📈:** Supertrend Up (sóng tăng bình thường / chưa vượt cản sóng giảm trước).
   - **Giảm mạnh 🔻:** Supertrend Down và Supertrend sóng giảm < Supertrend sóng tăng trước đó.
   - **Giảm 📉:** Supertrend Down (sóng giảm bình thường / chưa ép thủng hỗ trợ sóng tăng trước).
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

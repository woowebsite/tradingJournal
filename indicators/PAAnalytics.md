# 🎯 PA Analytics Strategy & Indicator

Tài liệu hướng dẫn sử dụng chi tiết và giải thích cơ chế hoạt động của chiến lược **PA Analytics (`PAAnalytics.pine`)** trên TradingView (Pine Script v5).

---

## 📖 1. Tổng quan chiến lược (Strategy Overview)

**PA Analytics** là hệ thống chiến lược định lượng kết hợp giữa **Price Action thực chiến**, **hệ thống lọc xu hướng đa tầng (Multi-layer Filters)** và **công cụ phân tích hiệu suất chuyên sâu (Performance Analytics Table)**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KIẾN TRÚC HỆ THỐNG                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. TÍN HIỆU PRICE ACTION (7 Mẫu hình nến cơ sở)                            │
│     ├── Engulfing        ├── Larry Williams     ├── Continue (Tiếp diễn)    │
│     ├── Breakout Opp     ├── Sweep (Quét đáy)   ├── Include Opposite        │
│     └── Absorption (Hấp thụ Volume)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. BỘ LỌC ĐA TẦNG (Multi-Layer Filter Matrix)                              │
│     ├── Adaptive ADX / DMI  (Đo lường sức mạnh xu hướng động)               │
│     ├── ATR Candle Filter   (Loại trừ nến đột biến/FOMO)                   │
│     ├── Volume Spike Filter (Xác nhận dòng tiền vào)                        │
│     ├── SuperTrend Trend    (Lọc xu hướng chính)                            │
│     └── SuperStructure      (Đường Trendline cấu trúc đỉnh/đáy)             │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. QUẢN TRỊ RỦI RO & THOÁT LỆNH (Risk & Exit Engine)                       │
│     ├── Stoploss: Tick Offset / ATR Buffer / Supertrend Exit                │
│     └── Takeprofit: RRR (1:1, 2:1, 3:1) hoặc Dynamic Candle Break (1, 2, 9) │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. THỐNG KÊ & PHÂN TÍCH HIỆU SUẤT TRỰC QUAN (Analytics Dashboard)         │
│     ├── Weekday Table (Thống kê hiệu suất theo từng Thứ trong tuần)         │
│     ├── Monthly Table (Thống kê mùa vụ theo 12 Tháng)                       │
│     ├── Holding Duration Table (Hiệu suất theo số nến nắm giữ lệnh)         │
│     └── Visual Trade Tracer (Vẽ đường nối Entry-Exit trực quan trên chart)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🕯️ 2. Chi tiết 7 Mẫu hình Price Action vào lệnh

Chiến lược hỗ trợ giao dịch 2 chiều (**Long & Short**) với 7 mẫu hình nến Price Action độc lập, có thể bật/tắt linh hoạt:

```
    [ENGULFING]           [LARRY WILLIAMS]           [CONTINUE]
  High ──┬───               High ──┬───                High ──┬───
         │                         │                          │
   ┌─────┴─────┐             ┌─────┴─────┐              ┌─────┴─────┐
   │ 🟢 GREEN  │ ─── High[1] │ 🟢 GREEN  │ ─── High[1]  │ 🟢 GREEN  │ ─── High[1]
   │ (Bao trùm)│             │ (Close >  │              │ (Tiếp     │
   │           │ ─── Low[1]  │   High[1])│              │   diễn)   │
   └─────┬─────┘             └─────┬─────┘              └─────┬─────┘
         │                         │                          │
   Low ──┴───                Low ──┴───                 Low ──┴───
   (Vượt cả Đỉnh & Đáy)      (Nến trước tạo Đáy)        (Phá Đỉnh nến Xanh trước)
```

---

### 1️⃣ Engulfing (Nhấn chìm / Bao phủ nến đối diện)
*Mô hình đảo chiều mạnh khi nến hiện tại mở rộng biên độ nuốt trọn toàn bộ cây nến trước.*

- 🟢 **Điều kiện Long (`fb_long`):**
  - Nến hiện tại là nến **Xanh** (`curr_green`).
  - Nến liền trước là nến **Đỏ** (`prev_red`).
  - Nến hiện tại phá cả 2 đầu nến trước: $\text{High} > \text{High}[1]$ và $\text{Low} < \text{Low}[1]$.
- 🔴 **Điều kiện Short (`fb_short`):**
  - Nến hiện tại là nến **Đỏ** (`curr_red`).
  - Nến liền trước là nến **Xanh** (`prev_green`).
  - Nến hiện tại phá cả 2 đầu: $\text{High} > \text{High}[1]$ và $\text{Low} < \text{Low}[1]$.

---

### 2️⃣ Larry Williams (Phá vỡ cực trị đảo chiều)
*Mô hình kinh điển của Larry Williams: Đóng cửa vượt qua đỉnh của cây nến tạo đáy thấp nhất.*

- 🟢 **Điều kiện Long (`lw_long`):**
  - Nến hiện tại là nến **Xanh** (`curr_green`).
  - Nến trước là nến **Đỏ** và tạo đáy sâu hơn nến trước đó: $\text{Low}[1] < \text{Low}[2]$.
  - Giá đóng cửa nến hiện tại vượt đỉnh nến đỏ: $\text{Close} > \text{High}[1]$.
- 🔴 **Điều kiện Short (`lw_short`):**
  - Nến hiện tại là nến **Đỏ** (`curr_red`).
  - Nến trước là nến **Xanh** và tạo đỉnh cao hơn nến trước đó: $\text{High}[1] > \text{High}[2]$.
  - Giá đóng cửa nến hiện tại thủng đáy nến xanh: $\text{Close} < \text{Low}[1]$.

---

### 3️⃣ Continue (Đà tăng / giảm tiếp diễn)
*Mô hình giao dịch thuận xu hướng khi xung lực đẩy tiếp tục phá vỡ đỉnh/đáy nến trước.*

- 🟢 **Điều kiện Long (`bp_long`):**
  - Nến hiện tại là nến **Xanh** và phá đỉnh trước: $\text{High} > \text{High}[1]$.
  - Nến trước là nến **Xanh** HOẶC nến trước có $\text{Close}[1] > \text{Close}[2]$.
- 🔴 **Điều kiện Short (`bp_short`):**
  - Nến hiện tại là nến **Đỏ** và phá đáy trước: $\text{Low} < \text{Low}[1]$.
  - Nến trước là nến **Đỏ** HOẶC nến trước có $\text{Close}[1] < \text{Close}[2]$.

---

### 4️⃣ Breakout Opposite (Phá vỡ đỉnh/đáy nến đối màu)
*Vào lệnh ngay khi có nến quay đầu vượt qua đỉnh/đáy của nến ngược chiều liền trước.*

- 🟢 **Điều kiện Long (`fbo_long`):**
  - Nến hiện tại là nến **Xanh** (`curr_green`).
  - Nến liền trước là nến **Đỏ** (`prev_red`).
  - Đỉnh nến hiện tại vượt đỉnh nến đỏ: $\text{High} > \text{High}[1]$.
- 🔴 **Điều kiện Short (`fbo_short`):**
  - Nến hiện tại là nến **Đỏ** (`curr_red`).
  - Nến liền trước là nến **Xanh** (`prev_green`).
  - Đáy nến hiện tại đâm thủng đáy nến xanh: $\text{Low} < \text{Low}[1]$.

---

### 5️⃣ Sweep (Quét thanh khoản cực trị Lookback 3)
*Mô hình săn thanh khoản (Liquidity Sweep) tại các vùng Swing High/Swing Low 3 nến.*

- 🟢 **Điều kiện Long (`sw_long`):**
  - Nến liền trước $[1]$ là **Đáy thấp nhất** trong phạm vi 3 nến trước đó ($\text{Low}[1] == \text{lowest}(\text{Low}[1], 4)$).
  - Nến hiện tại là nến **Xanh** và đóng cửa vượt đỉnh nến $[1]$: $\text{Close} > \text{High}[1]$.
- 🔴 **Điều kiện Short (`sw_short`):**
  - Nến liền trước $[1]$ là **Đỉnh cao nhất** trong phạm vi 3 nến trước đó ($\text{High}[1] == \text{highest}(\text{High}[1], 4)$).
  - Nến hiện tại là nến **Đỏ** và đóng cửa đâm thủng đáy nến $[1]$: $\text{Close} < \text{Low}[1]$.

---

### 6️⃣ Include Opposite (Bứt phá khỏi vùng tích lũy 3 phiên)
*Phá vỡ biên dao động cao nhất/thấp nhất của chu kỳ 3 nến trước đó.*

- 🟢 **Điều kiện Long (`ico_long`):**
  - Nến hiện tại là nến **Xanh** đóng cửa vượt mức đỉnh cao nhất của 3 nến tính từ nến $[2]$:  
    $$\text{Close} > \max(\text{High}[2], \text{High}[3], \text{High}[4])$$
  - Có sự xuất hiện của nến giảm trước đó (`prev_red` hoặc $\text{Close}[2] < \text{Open}[2]$).
- 🔴 **Điều kiện Short (`ico_short`):**
  - Nến hiện tại là nến **Đỏ** đóng cửa thấp hơn mức đáy thấp nhất của 3 nến tính từ nến $[2]$:  
    $$\text{Close} < \min(\text{Low}[2], \text{Low}[3], \text{Low}[4])$$
  - Có sự xuất hiện của nến tăng trước đó (`prev_green` hoặc $\text{Close}[2] > \text{Open}[2]$).

---

### 7️⃣ Absorption (Hấp thụ Volume & VSA - Volume Spread Analysis)
*Mô hình Volume Spread Analysis: Nhận diện hiện tượng cá mập hấp thụ cung/cầu (Spread nến hẹp lại nhưng Volume tăng đột biến).*

- 🟢 **Điều kiện Long (`abs_long`):**
  - **Tín hiệu nến trước (`preAbsorption`):**  
    $$(\text{High}[1] - \text{Low}[1]) < (\text{High}[2] - \text{Low}[2]) \quad \text{AND} \quad \text{Volume}[1] > \text{Volume}[2]$$
    *(Biên độ nến hẹp lại nhưng khối lượng lại tăng vọt $\rightarrow$ Phe Mua hấp thụ hết lực xả).*
  - Nến hiện tại là nến **Xanh** và có giá đóng cửa cao hơn: $\text{Close} > \text{Close}[1]$.
- 🔴 **Điều kiện Short (`abs_short`):**
  - Tương tự với tín hiệu hấp thụ ở nến $[1]$ và nến hiện tại là nến **Đỏ** với $\text{Close} < \text{Close}[1]$.

---

## 🛡️ 3. Hệ thống Bộ lọc Đa Tầng (Multi-Layer Filter Engine)

Để loại bỏ các tín hiệu nhiễu (False Signals) trong thị trường đi ngang (Sideway) hoặc các bẫy giá (Bull/Bear Trap), chiến lược trang bị 5 bộ lọc phối hợp:

```
[Tín hiệu Price Action]
          │
          ▼
   ┌──────────────┐      FALSE
   │  ADX Filter  │ ───────────────► ❌ BỎ QUA TÍN HIỆU
   └──────┬───────┘
          │ TRUE
          ▼
   ┌──────────────┐      FALSE
   │  ATR Candle  │ ───────────────► ❌ LOẠI TRỪ NẾN QUÁ LỚN / FOMO
   └──────┬───────┘
          │ TRUE
          ▼
   ┌──────────────┐      FALSE
   │  Big Volume  │ ───────────────► ❌ THIẾU DÒNG TIỀN XÁC NHẬN
   └──────┬───────┘
          │ TRUE
          ▼
   ┌──────────────┐      FALSE
   │  SuperTrend  │ ───────────────► ❌ ĐI NGƯỢC XU HƯỚNG CHÍNH
   └──────┬───────┘
          │ TRUE
          ▼
   ┌──────────────┐      FALSE
   │SuperStructure│ ───────────────► ❌ CẤU TRÚC ĐỈNH ĐÁY KHÔNG THUẬN
   └──────┬───────┘
          │ TRUE
          ▼
  🚀 VÀO LỆNH (ENTRY EXECUTED)
```

---

### 1. Bộ lọc ADX & Adaptive ADX (Đo xung lực xu hướng)
- **Chuẩn hóa thông minh (Adaptive ADX):** Tự động điều chỉnh độ dài chu kỳ (`dyn_len`) và làm mượt (`dyn_smooth`) theo tỷ lệ biến động ATR:
  $$v_{\text{ratio}} = \frac{\text{SMA}(\text{TR}, \text{base\_len})}{\text{SMA}(\text{TR}, \text{base\_len} \times 3)}$$
  Giúp ADX phản ứng nhanh hơn khi thị trường bùng nổ biến động và làm mượt khi thị trường đi chậm.
- **Các điều kiện lọc tùy chọn:**
  - `Follow Trend (DI+ > DI-)`: Chỉ Long khi $DI^+ > DI^-$ và chỉ Short khi $DI^- > DI^+$.
  - `Strong Trend (ADX > 20)`: Chỉ vào lệnh khi độ mạnh xu hướng $ADX > 20$.
  - `Trend Strengthening (ADX is Rising)`: ADX đang dốc lên ($ADX > ADX[1]$ hoặc $ADX > \text{SMA}(ADX, 9)$).

---

### 2. Bộ lọc Kích thước nến ATR (`useATRCandle`)
- Đo biên độ nến tín hiệu trước đó: $\text{Range}[1] = |\text{High}[1] - \text{Low}[1]|$.
- **Quy tắc:** Chỉ chấp nhận vào lệnh nếu $\text{Range}[1] < 1.618 \times \text{ATR}(14)$.
- **Mục đích:** Ngăn chặn việc nhảy vào lệnh đu đỉnh/đáy sau một cây nến xả hoặc đẩy giá quá dài bất thường (tránh bị cạn kiệt xung lực hoặc Stop Hunt).

---

### 3. Bộ lọc Khối lượng lớn (`useBigVolume`)
- So sánh khối lượng hiện tại với trung bình 3 phiên: $\text{Volume} > 1.2 \times \text{SMA}(\text{Volume}, 3)$.
- **Mục đích:** Đảm bảo có sự tham gia của dòng tiền lớn (Smart Money) tại thời điểm bứt phá.

---

### 4. Bộ lọc Xu hướng SuperTrend (`useSuperTrend`)
- Sử dụng SuperTrend với tham số chuẩn $(3.0, 10)$.
- **Quy tắc:**
  - 🟢 **Chỉ Long** khi SuperTrend báo Tăng (Vùng giá nằm trên dải xanh, `stDir < 0`).
  - 🔴 **Chỉ Short** khi SuperTrend báo Giảm (Vùng giá nằm dưới dải đỏ, `stDir > 0`).

---

### 5. Bộ lọc Cấu trúc SuperStructure (`useSuperStructure`)
- Tự động ghi nhận 2 điểm đảo chiều xoay chiều gần nhất của SuperTrend và vẽ đường Trendline dẫn hướng (`stUpLine`, `stDownLine`).
- **Quy tắc xác nhận xu hướng cấu trúc:**
  - **Long:** Yêu cầu đáy SuperTrend mới phải cao hơn đáy cũ (Higher Low: $stUpArr[0] > stUpArr[1]$).
  - **Short:** Yêu cầu đỉnh SuperTrend mới phải thấp hơn đỉnh cũ (Lower High: $stDownArr[0] < stDownArr[1]$).

---

## 🎯 4. Quản trị Rủi ro, Stop Loss & Take Profit

Chiến lược hỗ trợ các phương pháp chốt lời và cắt lỗ từ cố định theo tỷ lệ R:R đến thoát lệnh động theo hành vi nến (Dynamic Exits):

```
                        [LỆNH LONG VÍ DỤ]
     High ───┬─── ─── Take Profit (RRR 2:1 hoặc Breakout 9 candle)
             │
   Entry ────┼─── Giá vào lệnh (Close nến tín hiệu)
             │
     Low ────┴─── ─── Stop Loss (Low - sl_offset: Tick Offset hoặc ATR Buffer)
```

### 🛑 1. Phương pháp Cắt lỗ (Stop Loss Methods)
1. **`Tick Offset` (Mặc định):**
   - Đặt Stop Loss ngay sát ngoài râu nến tín hiệu cộng/trừ 1 tick sàn (`syminfo.mintick`).
   - Long SL $= \text{Low} - \text{mintick}$, Short SL $= \text{High} + \text{mintick}$.
   - Phù hợp cho chiến lược lướt sóng Scalping / Price Action độ chính xác cao với tỷ lệ R:R cực lớn.
2. **`ATR Buffer`:**
   - Tạo vùng đệm thở cho biến động: $\text{Offset} = \text{ATR}(14) \times \text{atrMultiplier}$ (mặc định $0.5 \times \text{ATR}$).
   - Giúp tránh việc bị quét râu nến (Whipsaw) trong các thị trường có độ biến động cao.
3. **`Supertrend`:**
   - Quản lý Stop Loss theo đường SuperTrend động. Lệnh sẽ được đóng khi giá đóng cửa đâm thủng hoặc Supertrend đổi màu.

---

### 💰 2. Phương pháp Chốt lời (Take Profit Methods)
Chiến lược hỗ trợ 6 tùy chọn Chốt lời linh hoạt trong menu `Choose TakeProfit`:

| Phương pháp | Loại | Cơ chế kích hoạt thoát lệnh |
| :--- | :---: | :--- |
| **`RRR 1:1`** | Limit Cố định | $\text{TP} = \text{Entry} + (\text{Risk} \times 1)$ |
| **`RRR 2:1`** | Limit Cố định | $\text{TP} = \text{Entry} + (\text{Risk} \times 2)$ |
| **`RRR 3:1`** | Limit Cố định | $\text{TP} = \text{Entry} + (\text{Risk} \times 3)$ |
| **`Break 1 candle`** | Dynamic Price Action | Thoát Long khi $\text{Close} < \text{Low}[1]$, thoát Short khi $\text{Close} > \text{High}[1]$. |
| **`Break 2 candle`** | Dynamic Price Action | Thoát Long khi $\text{Close} < \text{Low}[2]$, thoát Short khi $\text{Close} > \text{High}[2]$. |
| **`Breakout 9 candle`**| Trend Following | Thoát Long khi $\text{Close} > \max(\text{High}[1 \dots 9])$, thoát Short khi $\text{Close} < \min(\text{Low}[1 \dots 9])$. |

> [!TIP]
> Tất cả mức giá Stop Loss và Take Profit đều được tự động làm tròn chuẩn xác theo bước giá của sàn thông qua hàm `f_tick_round()` để tránh lỗi bị sàn từ chối lệnh (Order Rejected).

---

## 📊 5. Bảng Thống kê & Phân tích Dữ liệu (Analytics Tables)

Một điểm đặc biệt vượt trội của `PA Analytics` là khả năng tổng hợp toàn bộ lịch sử giao dịch trực tiếp lên màn hình mà không cần mở tab Strategy Tester.

### 📅 1. Bảng Thống kê theo Thứ trong tuần (`Weekday Stats Table`)
Thống kê chi tiết từng ngày từ Thứ Hai đến Chủ Nhật:
- **`Day`**: Thứ trong tuần (`Mon` $\rightarrow$ `Sun`).
- **`Buy/Sell`**: Tỷ lệ số lệnh Mua (B) và lệnh Bán (S).
- **`TP/SL (count)`**: Số lần chạm Chốt lời / Cắt lỗ.
- **`Winrate`**: Tỷ lệ thắng của ngày hôm đó ($\text{TP} / \text{Total} \times 100\%$).
- **`PnL`**: Tổng số tiền lời/lỗ ($) mang lại. Tô màu xanh khi dương, màu đỏ khi âm.

```
┌──────┬────────────┬─────────────┬─────────┬──────────┐
│ Day  │  Buy/Sell  │TP/SL (count)│ Winrate │   PnL    │
├──────┼────────────┼─────────────┼─────────┼──────────┤
│ Mon  │ B:15 / S:8 │ TP:14 / SL:9│  60.9%  │ +245.50$ │
│ Tue  │ B:12 / S:11│ TP:16 / SL:7│  69.6%  │ +412.30$ │
│ Wed  │ B:10 / S:14│ TP:11 / SL:13│ 45.8%  │  -85.20$ │
│ Thu  │ B:18 / S:9 │ TP:19 / SL:8│  70.4%  │ +520.10$ │
│ Fri  │ B:14 / S:12│ TP:13 / SL:13│ 50.0%  │  +15.40$ │
└──────┴────────────┴─────────────┴─────────┴──────────┘
```

---

### 📆 2. Bảng Thống kê theo Tháng trong năm (`Monthly Stats Table`)
Phân tích tính chu kỳ và mùa vụ qua 12 tháng (`Jan` $\rightarrow$ `Dec`):
- Giúp bạn dễ dàng nhận biết tháng nào trong năm chiến lược hoạt động thăng hoa nhất và tháng nào thị trường khó chịu để giảm khối lượng giao dịch.

---

### ⏳ 3. Bảng Phân tích Thời lượng Lệnh (`Analytics Table - Holding Duration`)
Phân tích Winrate dựa trên **Số nến nắm giữ vị thế** (Holding Duration in Bars) và tự động tìm ra khoảng thời gian chốt lời tối ưu nhất.

```
┌──────────────┬────────┬─────┬───────────┐
│    Số nến    │ Thắng  │ Lỗ  │  Winrate  │
├──────────────┼────────┼─────┼───────────┤
│   1 nến      │   18   │  8  │   69.2%   │
│ ⭐ 2 nến     │   35   │  9  │  79.5% ⭐ │  <-- DÒNG TỐI ƯU NHẤT (Amber Highlight)
│   3 nến      │   12   │  6  │   66.7%   │
│   4 nến      │    7   │  5  │   58.3%   │
└──────────────┴────────┴─────┴───────────┘
```

#### 🌟 Thuật toán Xác định Dòng Tối Ưu Nhất (Wilson Score Lower Bound)
> [!IMPORTANT]
> **Tại sao không đơn thuần chọn Winrate cao nhất?**  
> Nếu một mốc chỉ có 2 lệnh và thắng cả 2 (Winrate 100%), đây là hiện tượng **mẫu quá nhỏ (Small Sample Size)** và không có ý nghĩa thống kê. Trong khi đó, một mốc có 40 lệnh với 32 lần thắng (Winrate 80%) mang lại lợi thế toán học (Edge) vượt trội và đáng tin cậy hơn rất nhiều.

Chiến lược sử dụng công thức **Wilson Score Interval Lower Bound (Độ tin cậy 90%)** để chấm điểm từng mốc thời gian:
$$p = \frac{\text{Thắng}}{\text{Tổng số lệnh}}, \quad z = 1.645$$
$$\text{Score} = \frac{p + \frac{z^2}{2n} - z \sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

- 🌟 Dòng có điểm Wilson Score cao nhất (và $\text{Winrate} \ge 50\%$) sẽ được **tự động Highlight nền Vàng Hổ Phách (Amber)** kèm biểu tượng **ngôi sao ⭐**.
- Tùy chỉnh tham số `minAnaTrades` (mặc định = 5) để chỉ hiển thị các mốc thời lượng có số lượng mẫu lệnh đủ lớn.

---

### 🎨 4. Đường nét trực quan hóa lệnh giao dịch (`Closed Trades Visual`)
- Tự động vẽ các đường nối nét đứt (**Dotted Line**) từ điểm vào lệnh (`Entry`) đến điểm đóng lệnh (`Exit`):
  - 🟢 **Màu Xanh lá cây:** Giao dịch có Lợi nhuận (Win/Take Profit).
  - 🔴 **Màu Đỏ:** Giao dịch Thua lỗ (Loss/Stop Loss).
- Giới hạn vẽ trong vòng 500 nến gần nhất để đảm bảo hiệu năng mượt mà trên TradingView.

---

## ⚙️ 6. Bảng Tra cứu Cấu hình Tham số (Inputs Reference)

| Nhóm cài đặt | Tên tham số | Kiểu dữ liệu | Mặc định | Ý nghĩa & Khuyến nghị |
| :--- | :--- | :---: | :---: | :--- |
| **Price Action** | `Continue: Bull - Bull` | Boolean | `true` | Bật/tắt mẫu hình Tiếp diễn. |
| | `Engulfing: Bear - Bull` | Boolean | `true` | Bật/tắt mẫu hình Nhấn chìm. |
| | `Breakout Opposite` | Boolean | `true` | Bật/tắt mẫu hình Vượt đỉnh/đáy nến đối màu. |
| | `Larry William` | Boolean | `true` | Bật/tắt mẫu hình Larry Williams. |
| | `Sweep: Lowest(3)` | Boolean | `true` | Bật/tắt mẫu hình Quét đáy/đỉnh 3 nến. |
| | `Include Opposite` | Boolean | `true` | Bật/tắt mẫu hình Phá vỡ biên 3 nến. |
| | `Absorption` | Boolean | `true` | Bật/tắt mẫu hình Hấp thụ VSA. |
| **ADX** | `Use ADX` | Boolean | `true` | Bật bộ lọc xu hướng ADX. |
| | `Follow Trend (DI+ > DI-)` | Boolean | `true` | Bắt buộc thuận chiều DI. |
| | `Strong Trend (ADX > 20)` | Boolean | `false` | Lọc thị trường có trend mạnh ($ADX > 20$). |
| | `Adaptive ADX Length` | Boolean | `true` | Tự động thích ứng chu kỳ ADX theo biến động. |
| | `Trend Strengthening` | Boolean | `false` | ADX phải đang có xu hướng dốc lên. |
| **TP/SL** | `Choose TakeProfit` | Option | `Break 1 candle` | Lựa chọn cơ chế chốt lời (`RRR 1:1`, `2:1`, `3:1`, `Break 1`, `Break 2`, `Breakout 9`). |
| | `Stop Loss Method` | Option | `Tick Offset` | Chọn cách cắt lỗ (`Tick Offset`, `ATR Buffer`, `Supertrend`). |
| | `ATR Multiplier` | Float | `0.5` | Hệ số nhân ATR cho vùng đệm SL (khi chọn `ATR Buffer`). |
| **Long/Short** | `Enable Long` / `Enable Short` | Boolean | `true` | Bật/tắt chiều giao dịch cụ thể. |
| **Other filters** | `Use ATR Candle` | Boolean | `false` | Lọc bỏ nến tín hiệu quá lớn bất thường. |
| | `Use Big Volume` | Boolean | `false` | Yêu cầu khối lượng bùng nổ $> 1.2 \times \text{SMA}(3)$. |
| | `Use SuperTrend` | Boolean | `true` | Bật bộ lọc xu hướng SuperTrend $(3.0, 10)$. |
| | `Use Super Structure` | Boolean | `false` | Bật lọc cấu trúc Trendline đỉnh đáy SuperTrend. |
| **Tables** | `Show Weekday Stats Table` | Boolean | `false` | Bật bảng thống kê hiệu suất theo Thứ. |
| | `Show Monthly Stats Table` | Boolean | `false` | Bật bảng thống kê hiệu suất theo Tháng. |
| | `Show Analytics Table` | Boolean | `false` | Bật bảng phân tích thời lượng nắm giữ nến. |
| | `Min Trades for Analytics Table` | Integer | `5` | Số lượng lệnh tối thiểu để hiển thị mốc thời lượng nến. |


---

## 🚀 7. Hướng dẫn sử dụng & Tối ưu hóa Thực chiến

### 📌 Bước 1: Cài đặt vào TradingView
1. Mở biểu đồ bất kỳ trên [TradingView](https://www.tradingview.com).
2. Mở tab **Pine Editor** ở thanh công cụ phía dưới màn hình.
3. Tạo mới một script và dán toàn bộ mã nguồn `PAAnalytics.pine` vào.
4. Nhấn **Save** (Lưu) và chọn **Add to chart** (Thêm vào biểu đồ).

---

### 📌 Bước 2: Tinh chỉnh cho từng loại thị trường

#### 🟡 Thị trường Crypto (Bitcoin, Altcoins):
- **Đặc thù:** Độ biến động cao, quét râu nhiều.
- **Khuyến nghị cấu hình:**
  - `Stop Loss Method`: Chọn `ATR Buffer` với `ATR Multiplier = 0.5 - 0.8`.
  - `Choose TakeProfit`: Chọn `RRR 2:1` hoặc `Break 2 candle`.
  - `Use SuperTrend`: Bật `true`.
  - `Use Big Volume`: Bật `true` để xác nhận dòng tiền cá mập đẩy giá.

#### 🔵 Thị trường Forex / Vàng (XAUUSD):
- **Đặc thù:** Biên độ trong phiên rõ ràng, hay có sóng quét thanh khoản London/New York.
- **Khuyến nghị cấu hình:**
  - `Price Action`: Ưu tiên bật `Engulfing`, `Sweep`, `Larry William`.
  - `Choose TakeProfit`: `RRR 1:1` hoặc `Break 1 candle` (phù hợp Scalping M5 - M15).
  - `Stop Loss Method`: `Tick Offset` để tối ưu R:R cực ngắn.

#### 🟢 Thị trường Chứng khoán / Index (VN30, S&P 500, Nasdaq):
- **Đặc thù:** Xu hướng tiếp diễn rõ ràng, ít khi đảo chiều đột ngột giữa phiên.
- **Khuyến nghị cấu hình:**
  - `Price Action`: Ưu tiên `Continue` và `Include Opposite`.
  - `Use SuperStructure`: Bật `true` để chỉ đánh thuận theo cấu trúc đỉnh sau cao hơn đỉnh trước.
  - `Choose TakeProfit`: `Breakout 9 candle` để gồng lãi trọn vẹn con sóng lớn (Trend Following).

---

### 📌 Bước 3: Đọc hiểu Dashboard để tìm Lợi thế (Trading Edge)
1. **Bật `Show Weekday Stats Table`:** Xem thứ mấy trong tuần chiến lược có Winrate $> 60\%$ và PnL dương lớn nhất $\rightarrow$ Tập trung giao dịch mạnh vào các ngày này, giảm volume vào các ngày hay dính SL.
2. **Bật `Show Analytics Table`:** Nhìn vào cột **Số nến** và **Winrate** để biết đặc tính lệnh:
   - Nếu lệnh thắng tập trung ở `1 - 2 nến` $\rightarrow$ Chiến lược có xu hướng phản ứng nhanh, chốt lời ngắn hạn là tối ưu.
   - Nếu Winrate cao ở `10+ nến` $\rightarrow$ Bạn đang theo đuổi phong cách Swing/Trend Following, hãy kiên nhẫn gồng lãi.

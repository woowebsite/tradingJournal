# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```
## Webhook
```
/api/webhook/receive/:token
``` 
Test

```
Invoke-RestMethod -Uri "http://localhost:1337/api/webhooks/receive/tradingview-crypto-multi-symbols" -Method Post -ContentType "application/json" -Body '{"symbol": "BTCUSDT", "action": "BUY", "price": "65000"}'
```

## NgRok
Download https://ngrok.com/download, không dùng npx vì npx không sử dụng free account 
Tạo token cho ngrok
Truy cập vào https://dashboard.ngrok.com/get-started/setup/windows để lấy token
```
ngrok config add-authtoken token_here
```
Sau đó chạy lệnh sau để khởi tạo domain
```
npx ngrok http 1337
```

## 📚 TCBS API
### Dư mua / Dư bán - limit order
https://apiextaws.tcbs.com.vn/futures-insight/v1/intraday/41I1G9000/bid-ask?mode=baAll
```json
{
  "avgOBPercent": [
    {
      "aobp": 0.509, // Trung bình 5 ngày dư mua % (5-day Average Over-Bid %)
      "avsp": 0.22,  // Trung bình spread (Average Spread)
      "t": "09:00"   // Thời gian hiện tại (HH:MM)
    }
  ],
  "overBidAskLog": [
    {
      "bs": 17421,  // Khối lượng dư mua (Buy Size / Bid Volume)
      "oa": 39631,  // Khối lượng dư bán (Over Ask / Ask Volume)
      "obp": 0.305, // Tỷ lệ dư mua % (Over-Bid %)
      "osp": 0.695, // Tỷ lệ dư bán % (Over-Ask %)
      "sp": 0.2,    // Spread giữa giá mua và giá bán (Price Spread)
      "t": "09:00"   // Thời gian hiện tại (HH:MM)
    }
  ],
  "ticker": "41I1G9000"
}
```
 {
    n: số lệnh khớp,
    tv: Khối lượng,
    p: price
 }

### Cung cầu - market order
https://apiextaws.tcbs.com.vn/futures-insight/v1/intraday/41I1G9000/bsa-ext?timeWindow=5&tWindow=60m&type=all
 {
    "bu": 699, // Mua chủ động số lệnh,
    "bms": 699, // Mua chủ động số lệnh,
    "bup": 0.257, // Mua chủ động %,
    "sd": 2017, // Bán chủ động số lệnh,
    "sms": 2017, // Bán chủ động số lệnh,
    "sdp": 0.743, // Bán chủ động %,
    "bsr": 0.347, // Tỷ lệ mua/bán,
    "t": "09:00", // Thời gian hiện tại (HH:MM),
    "s": 1787882400 // Thời gian hiện tại (Timestamp),
}
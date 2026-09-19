# iramX OSINT Bot (v7.3)

A high-performance OSINT intelligence lookup application with both an interactive Web Console and native Telegram Bot support.

## Features

- **Vehicle RC Lookup**: Complete vehicle ownership, registration, RTO details, insurance, fitness, engine/chassis numbers, and technical specifications.
- **Num2 Mobile Lookup**: Telecom operator, circle, and subscriber intelligence records.
- **Aadhaar Verification & Family**: Aadhaar registration and household/family linkage lookup.
- **Voter ID (EPIC)**: Electoral roll and constituency records.
- **LPG Gas Consumer**: LPG connection details across Indian Oil, Bharat Gas, and HP Gas.
- **UPI to Mobile**: Virtual payment address resolution to associated account/mobile.
- **GST Search Suite**: GST by Name, GST by PAN, and full 15-digit GSTIN compliance records.
- **License & Quota System**: Built-in 20 free lookups/day with redeem code voucher engine for unlimited premium access.
- **Dual Runtime**: Interactive Web Console in the browser + optional Telegram Bot polling engine when configured.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server port | `3000` |
| `ADMIN_USER_ID` | Telegram admin user ID | `5225326313` |
| `TELEGRAM_BOT_TOKEN` | Optional Telegram Bot API token | (Optional) |

## Development

```bash
# Start development server with Vite middleware
npm run dev

# Production build
npm run build

# Start production server
npm start
```

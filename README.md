# PayGate Platform — Bangladeshi Merchant MFS Gateway SaaS

PayGate enables Bangladeshi merchants to accept **bKash**, **Nagad**, and **Rocket** payments with **zero provider direct API integration**. Customers pay to a PayGate-managed wallet pool quoting an 8-character typo-checked reference. A fleet of forwarder phones pushes confirmation SMS messages to the ingest pipeline, the atomic matching engine verifies the transaction, the merchant receives an HMAC-SHA256 signed webhook, and net funds are recorded in a double-entry ledger for scheduled bank payout.

Built with **React 19**, **Vite 8**, **Tailwind CSS v4**, and the **Gate UI Design System**, fully compliant with Progressive Web App (PWA) standards.

---

## 🚀 Key Features

- **Merchant SaaS Portal**:
  - **Overview**: Real-time volume, net revenue after 5% fee, paid transaction metrics, and attention queue.
  - **Payments Table**: Live search, provider/status filters, CSV export, and drawer inspector with timeline and SMS evidence proof.
  - **Pricing Plans**: Server-authoritative plans in paisa (`amount_paisa`) with immutable versioning.
  - **Settlements & Double-Entry Ledger**: Double-entry accounting ledger statements, balance tracking, and maker-checker payouts (minimum Tk 1,000 threshold).
  - **Developers & Webhooks**: Live and test API keys (`sk_live_...`, `sk_test_...`), interactive HMAC-SHA256 signature verifier tester, webhook delivery log with manual resend button, and code snippets.
  - **Settings & KYB**: Trade license, e-TIN, NID verification status, payout bank/MFS accounts, auto-confirm toggle, and 2FA status.
- **Enhanced Customer Checkout (PRD v3.1)**:
  - **Dual Integration Modes**: Direct hosted redirect (`/pay/:id`) and modal popup overlay (`paygate.js` simulation).
  - **6 UI States**: Initial instructions, active TrxID entry, loading state with live pulse animation, verified paid state, needs review state, and 15-minute typo lockout.
  - **Bilingual Interface**: Seamless toggle between English and **বাংলা** (with +10% line-height compensation for Bengali glyphs).
- **Progressive Web App (PWA) & Mobile Responsiveness**:
  - Installable across Chromium, Android, and iOS Safari.
  - In-app install button (`PWAInstallButton`) with native prompt and iOS Safari modal instructions.
  - Responsive collapsible sidebar ($240\text{px} \leftrightarrow 64\text{px}$) and touch-friendly mobile bottom navigation bar ($56\text{px}$ touch targets).
  - Ambient offline connectivity indicator.
- **Security & Integrity**:
  - Typo-checked 8-character reference with polynomial check character.
  - Single-use references, unique TrxID per wallet claim, and balance continuity monitoring.
  - HMAC-SHA256 signed webhooks (`PayGate-Signature: t=<unix>,v1=<hex>`).

---

## 📁 Project Structure

```
├── public/                       # Static PWA assets & icons
│   ├── icon.svg                  # Brand SVG vector
│   ├── pwa-192x192.png           # Android launcher icon
│   ├── pwa-512x512.png           # High-DPI splash icon
│   ├── pwa-maskable-512x512.png  # Adaptive maskable icon
│   └── apple-touch-icon.png      # iOS Safari home screen icon
├── src/
│   ├── components/
│   │   ├── auth/                 # Sign In & Merchant KYB Registration pages
│   │   ├── gate-ui/              # Shared Gate UI design system components
│   │   │   ├── GateButton.tsx    # Standard button (primary, secondary, danger)
│   │   │   ├── GateInput.tsx     # 44px input with inline validation
│   │   │   ├── StatusChip.tsx    # Status chip with dot and label
│   │   │   ├── ReferenceChip.tsx # Mono chip with one-tap copy
│   │   │   ├── ProviderBadge.tsx # Official MFS provider brand dots
│   │   │   ├── StatCard.tsx      # Tabular metric cards
│   │   │   ├── CommandPalette.tsx# ⌘K global fuzzy search modal
│   │   │   └── PaymentDrawer.tsx # Detailed payment inspection drawer
│   │   ├── layout/               # CollapsibleSidebar, TopNavbar, MobileBottomNav
│   │   ├── merchant/             # Merchant SaaS tabs (Overview, Payments, Plans, Settlements, Developers, Settings)
│   │   ├── pay/                  # HostedPayPage & PayGatePopupModal (6 checkout states)
│   │   ├── pwa/                  # PWAInstallButton & OfflineIndicator
│   │   └── simulator/            # Phone fleet SMS forwarder simulator
│   ├── context/
│   │   └── PayGateContext.tsx    # State store, matching engine actions, ledger, webhooks
│   ├── hooks/
│   │   ├── usePWAInstall.ts      # Native PWA install event listener
│   │   └── useOnlineStatus.ts    # Online/offline network status hook
│   ├── router/
│   │   └── index.tsx             # HTML5 pushState client router (/signin, /registration, /pay/:id, /)
│   ├── types/
│   │   └── index.ts              # Domain models (Payment, Merchant, Plan, Ledger, Payout)
│   ├── utils/
│   │   ├── matchingEngine.ts     # Atomic transaction claim & conflict resolver
│   │   ├── reference.ts          # 8-char reference generator & polynomial check validator
│   │   ├── smsParser.ts          # bKash, Nagad, and Rocket SMS regex parsers
│   │   └── webhook.ts            # Web Crypto HMAC-SHA256 signature generator & verifier
│   ├── tokens.json               # Gate UI design tokens
│   ├── App.tsx                   # Master application shell
│   └── index.css                 # CSS variables & Tailwind v4 setup
├── DESIGN.md                     # Gate UI Design System specification
├── PRD.md                        # Product Requirements Document v3.1
└── vite.config.ts                # Vite configuration with VitePWA plugin
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher
- **npm** or **bun**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-org/paygate-platform.git
cd paygate-platform

# Install dependencies
npm install
```

### 3. Development Server
```bash
# Start Vite dev server on http://localhost:3000
npm run dev
```

### 4. Code Quality & Type Checking
```bash
# Type check TypeScript codebase
npm run lint

# Production build with PWA service worker generation
npm run build
```

---

## 📲 Progressive Web App (PWA) Installation

- **Desktop (Chrome / Edge / Brave)**: Click the **"Install App"** button in the top navigation bar or the browser URL bar install icon.
- **Android**: Tap the **"Install App"** button to open the native web APK install prompt.
- **iOS (Safari)**: Tap the **"Install App"** button to open the guided instructions:
  1. Tap the **Share** button in the Safari bottom bar.
  2. Tap **"Add to Home Screen"**.
  3. Tap **"Add"** to install PayGate to your iPhone or iPad home screen.

---

## 🔌 API & Integration Guide

### Creating a Payment
```bash
curl -X POST https://api.paygate.com/v1/payments \
  -H "Authorization: Bearer sk_live_8e1d2c3b4a5f607182934" \
  -H "Idempotency-Key: req_09182310" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "plan_pro_monthly",
    "order_id": "ORD-94812",
    "provider": "bkash",
    "callback_url": "https://api.yourdomain.com/webhooks/paygate",
    "success_url": "https://yourdomain.com/checkout/success"
  }'
```

**Response**:
```json
{
  "id": "pay_01ha9x201",
  "order_id": "ORD-94812",
  "amount_paisa": 120000,
  "currency": "BDT",
  "reference": "K7M4X2QH",
  "provider": "bkash",
  "wallet": {
    "provider": "bkash",
    "number": "01712-750278",
    "holder_name": "Rahim Ahmed (Primary 1)"
  },
  "pay_url": "https://pay.paygate.com/p/pay_01ha9x201",
  "expires_at": "2026-10-12T16:00:00Z"
}
```

### Verifying Webhooks (Node.js / Express)
```javascript
import crypto from 'crypto';

app.post('/webhooks/paygate', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = req.headers['paygate-signature']; // t=17918...,v1=hex...
  const [tPart, v1Part] = signatureHeader.split(',');
  const timestamp = tPart.split('=')[1];
  const receivedHash = v1Part.split('=')[1];

  // Prevent replay attacks (> 5 minutes old)
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)) > 300) {
    return res.status(401).send('Timestamp expired');
  }

  const payload = timestamp + '.' + req.body.toString();
  const expectedHash = crypto.createHmac('sha256', process.env.PAYGATE_WEBHOOK_SECRET)
                             .update(payload)
                             .digest('hex');

  if (expectedHash !== receivedHash) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());
  if (event.event === 'payment.paid') {
    console.log(`Payment confirmed for Order: ${event.order_id}, Net: Tk ${event.net_paisa / 100}`);
    // Fulfill customer order in your database
  }

  res.json({ received: true });
});
```

---

## 🧪 Interactive Testing Lab

1. **Test Checkout**: Click the **"Test Checkout"** button in the top navigation bar to open the popup modal.
2. **Review Exception Queue**: In the Payments tab, inspect flagged payments to see customer claims vs forwarded SMS evidence.
3. **PWA Offline Mode**: Open Developer Tools (`F12`), toggle Network to **Offline**, and verify that the ambient offline badge appears while cached data remains accessible.
4. **Bilingual Verification**: Toggle between **EN** and **বাংলা** to verify typography and natural phrasing.

---

## 📄 License & Compliance

© 2026 PayGate Technologies Bangladesh Ltd. All rights reserved.  
Complies with Bangladesh Bank National Payment Switch Guidelines and MFS Pooling Runbook v3.1.

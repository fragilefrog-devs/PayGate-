# PayGate Platform — Bangladeshi Merchant MFS Gateway SaaS (v4.0)

PayGate enables Bangladeshi merchants to accept **bKash**, **Nagad**, **Rocket**, **Upay**, and **Cellfin** (IBBL) payments with **zero provider direct API integration**. Customers pay to a PayGate-managed wallet pool quoting an 8-character polynomial typo-checked reference. A dedicated Super Admin Android handset relays confirmation SMS messages over an IP-whitelisted endpoint, the atomic matching engine verifies the transaction, the merchant receives an HMAC-SHA256 signed webhook, and net funds are recorded in a double-entry ledger for automated BEFTN bank payout batching.

Built with **React 19**, **Vite 8**, **Tailwind CSS v4**, and the **Gate UI Design System**, fully compliant with Progressive Web App (PWA) standards and structured across a robust **Multi-Domain Subdomain Architecture**.

---

## 🌐 Multi-Domain Architecture

PayGate v4.0 separates concerns across three subdomains with native Host header resolution in production and an **Ambient Domain Switcher** in preview/development:

| Subdomain | Portal Name | Primary Features & Routes |
| :--- | :--- | :--- |
| **`merchant.example.com`** | **Merchant SaaS Portal** | • **Overview**: GMV, net revenue after 5% fee, active conversion rate, attention queue.<br>• **Payments**: Real-time payments table, filters, drawer inspector, CSV export.<br>• **Plans**: Server-authoritative pricing plans denominated in integer paisa.<br>• **Settlements**: Double-entry ledger statements and payout initiation (Tk 1,000 threshold).<br>• **Developers**: Live & test API keys, webhook logs, and HMAC verifier.<br>• **Settings**: KYB verification (trade license, TIN, NID), payout bank accounts, 2FA. |
| **`admin.example.com`** | **Ops Admin Console & Super Admin Device** | • **Super Admin Forwarder**: Dedicated Android handset profile, hardware telemetry, and **Strict CIDR / IP Whitelist Firewall**.<br>• **Wallet Pool**: Liquidity monitoring and 80% daily regulatory limit auto-drain.<br>• **Review Queue**: Split-screen discrepancy matching (underpaid, overpaid, wrong wallet).<br>• **Payout Approvals**: Automated **BEFTN payout batching** with maker-checker clearing.<br>• **Audit Trail**: Immutable compliance log with IP, actor, and timestamp. |
| **`api.example.com`** | **API Backend & Sandbox** | • **REST API Reference**: Full endpoint documentation for `/v1/payments`, `/v1/sms/webhook`, `/v1/devices/heartbeat`, `/v1/payouts`.<br>• **Interactive Sandbox**: In-browser request runner, custom headers, payload editing, and live latency metrics.<br>• **Code Snippets**: Auto-generated cURL, Node.js, and Python requests. |

---

## 🚀 Key Platform Features

- **5 MFS & Digital Banking Providers**:
  - Full support for **bKash**, **Nagad**, **Rocket**, **Upay**, and **Cellfin** (IBBL).
  - Custom provider themes, official brand badges, and specialized regex parsers for each carrier format.
- **Super Admin SMS Forwarder & IP Firewall**:
  - Total extraction of forwarder simulation tools from the merchant portal into the Ops Admin console.
  - Hardware telemetry: IMEI profile, Dual SIM slot assignment (bKash/Nagad on SIM 1, Rocket/Upay/Cellfin on SIM 2), battery ring, and latency ping test.
  - **Zero-Trust IP Whitelisting**: Strict CIDR and IP checks (e.g., `103.145.74.0/24`, `192.168.1.105`, `127.0.0.1`); unauthorized forwarder calls are dropped with `403 Forbidden` and logged to the security audit trail.
- **Automated BEFTN Payout Batching**:
  - Individual merchant settlement requests are bundled into clearing batches (`pob_...`).
  - Strict maker-checker workflow: Ops maker initiates the batch, independent compliance checker approves with 2FA, clearing references are stamped, and net bank transfers clear.
- **Enhanced Customer Checkout**:
  - **Dual Integration Modes**: Direct hosted redirect (`/pay/:id`) and modal popup overlay (`paygate.js`).
  - **6 Gate UI States**: Initial instructions, active TrxID entry, loading state with live pulse animation, verified paid state, needs review state, and 15-minute typo lockout.
  - **Bilingual Interface**: Seamless toggle between English and **বাংলা** (with +10% line-height compensation for Bengali glyphs).
- **Progressive Web App (PWA)**:
  - Installable across Chromium, Android, and iOS Safari with guided install prompts.
  - Responsive collapsible sidebar ($240\text{px} \leftrightarrow 64\text{px}$) and touch-friendly mobile bottom navigation ($56\text{px}$ targets).
  - Ambient offline connectivity status indicator.

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
│   │   ├── admin/                # Ops Admin Portal & Super Admin Device
│   │   │   ├── AdminDashboardLayout.tsx   # Ops Admin master shell & sub-navigation
│   │   │   ├── SuperAdminDeviceTab.tsx    # Forwarder handset, IP firewall & SMS terminal
│   │   │   ├── WalletPoolTab.tsx          # MFS wallet pool liquidity & auto-drain
│   │   │   ├── ReviewQueueTab.tsx         # Split-screen dispute & discrepancy resolution
│   │   │   ├── PayoutApprovalsTab.tsx     # BEFTN batching & maker-checker clearing
│   │   │   └── AuditLogTab.tsx            # Immutable compliance audit log
│   │   ├── api/                  # API Sandbox & Documentation
│   │   │   └── ApiSandboxLayout.tsx       # Live REST runner, curl generator, playground
│   │   ├── auth/                 # Sign In & Merchant KYB Registration pages
│   │   ├── gate-ui/              # Shared Gate UI design system components
│   │   │   ├── GateButton.tsx    # Standard button (primary, secondary, ghost, danger)
│   │   │   ├── GateInput.tsx     # 44px input with inline validation
│   │   │   ├── StatusChip.tsx    # Status chip with dot and label
│   │   │   ├── ReferenceChip.tsx # Mono chip with one-tap copy
│   │   │   ├── ProviderBadge.tsx # Official MFS provider brand dots (bKash/Nagad/Rocket/Upay/Cellfin)
│   │   │   ├── StatCard.tsx      # Tabular metric cards
│   │   │   ├── CommandPalette.tsx# ⌘K global fuzzy search modal
│   │   │   └── PaymentDrawer.tsx # Detailed payment inspection drawer
│   │   ├── layout/               # Shell layout components
│   │   │   ├── AmbientDomainSwitcher.tsx  # Dev domain switcher bar (merchant/admin/api)
│   │   │   ├── CollapsibleSidebar.tsx     # Desktop collapsible sidebar
│   │   │   ├── TopNavbar.tsx              # Universal top navigation bar
│   │   │   └── MobileBottomNav.tsx        # Mobile bottom navigation bar
│   │   ├── merchant/             # Merchant SaaS tabs (Overview, Payments, Plans, Settlements, Developers, Settings)
│   │   ├── pay/                  # HostedPayPage & PayGatePopupModal (6 checkout states)
│   │   └── pwa/                  # PWAInstallButton & OfflineIndicator
│   ├── context/
│   │   └── PayGateContext.tsx    # State store, matching engine, IP firewall, BEFTN batching, ledger
│   ├── router/
│   │   └── index.tsx             # Multi-domain & path router with domain switcher state
│   ├── types/
│   │   └── index.ts              # Domain types (Payment, Merchant, Device, PayoutBatch, ParsedSmsResult)
│   ├── utils/
│   │   ├── matchingEngine.ts     # Atomic transaction claim & conflict resolver
│   │   ├── reference.ts          # 8-char reference generator & polynomial check validator
│   │   ├── smsParser.ts          # bKash, Nagad, Rocket, Upay, and Cellfin SMS regex parsers
│   │   └── webhook.ts            # Web Crypto HMAC-SHA256 signature generator & verifier
│   ├── tokens.json               # Gate UI design tokens
│   ├── App.tsx                   # Master application router & layout orchestrator
│   └── index.css                 # CSS variables & Tailwind v4 setup
├── supabase/migrations/          # PostgreSQL schema migrations (v3.0 core, v4.0 Upay/Cellfin & BEFTN batching)
├── DESIGN.md                     # Gate UI Design System specification
├── PRD.md                        # Product Requirements Document v4.0
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

## 🔌 API & Integration Guide

### Creating a Payment
```bash
curl -X POST https://api.example.com/v1/payments \
  -H "Authorization: Bearer sk_live_8e1d2c3b4a5f607182934" \
  -H "Idempotency-Key: req_09182310" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "plan_pro_monthly",
    "order_id": "ORD-94812",
    "provider": "upay",
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
  "provider": "upay",
  "wallet": {
    "provider": "upay",
    "number": "01912-345678",
    "holder_name": "PayGate Pool Upay 1"
  },
  "pay_url": "https://pay.example.com/pay/pay_01ha9x201",
  "expires_at": "2026-10-13T16:00:00Z"
}
```

### Ingesting SMS from Forwarder Handset (Super Admin Device)
```bash
curl -X POST https://api.example.com/v1/sms/webhook \
  -H "X-Device-Token: dev_sec_superadmin_9921" \
  -H "X-Forwarded-For: 103.145.74.12" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "Upay",
    "raw_sms": "Received Tk 1200.00 from 01812345678. Trx ID 9K2LMN84. Ref: K7M4X2QH. Fee Tk 0.00. Balance Tk 14500.00. 13/10/2026 15:30",
    "sim_slot": 2
  }'
```

*(Note: If `X-Forwarded-For` is not in the Super Admin CIDR whitelist, the endpoint immediately returns `403 Forbidden` and logs an unauthorized intrusion attempt).*

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

1. **Ambient Domain Switcher**: Use the top domain switcher bar to test across `merchant.example.com`, `admin.example.com`, and `api.example.com`.
2. **Super Admin Device & Firewall Test**:
   - Switch to **Ops Admin** → **Forwarder Device**.
   - Test the Ping Device latency diagnostic.
   - Inject a test SMS using the pre-configured templates (bKash, Nagad, Rocket, Upay, Cellfin).
   - Test IP firewall blocking by setting an unauthorized client IP (e.g. `198.51.100.4`) and observe the 403 Forbidden rejection and audit log entry.
3. **Automated BEFTN Batching**:
   - Navigate to **Ops Admin** → **Payout Approvals**.
   - Create a BEFTN clearing batch from pending payouts and verify the maker-checker authorization flow.
4. **API Sandbox**:
   - Switch to **API Backend** to run live interactive requests against `/v1/payments`, `/v1/sms/webhook`, and `/v1/payouts`.
5. **Customer Checkout Flow**:
   - Click **"Test Checkout"** in the top navigation bar to test the 6 Gate UI states in both English and Bengali.

---

## 📄 License & Compliance

© 2026 PayGate Technologies Bangladesh Ltd. All rights reserved.  
Complies with Bangladesh Bank National Payment Switch Guidelines and MFS Pooling Runbook v4.0.

# Multi-Domain Restructuring & Super Admin Forwarder Device Plan

This plan restructures PayGate into three decoupled, domain-oriented applications sharing a unified state and persistence engine:
1. **Merchant App (`merchant.example.com`)**: Self-service merchant portal (`/signin`, `/payments`, `/plans`, `/settlements`, `/developers`, `/settings`).
2. **Admin App (`admin.example.com`)**: PayGate internal command center (`/signin`, `/payments`, `/wallets`, `/review`, `/payouts`, `/device`, `/audit`).
3. **API Backend Console (`api.example.com`)**: Public and internal API service reference, health endpoint, webhook documentation, and live REST testbench (`/v1/*`).

The phone fleet telemetry is silenced in favor of a **single Super Admin SMS Forwarder Device** secured by **IP whitelisting**, and the SMS Forwarder Simulator is completely extracted from the Merchant portal into the Admin portal.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices:
> - **Domain Architecture**: Subdomain-aware page router supporting production host headers (`merchant.*`, `admin.*`, `api.*`) with an ambient Dev Domain Switcher bar in preview environments.
> - **Simulator Relocation**: SMS Forwarder Simulator is removed from the Merchant app and placed exclusively in the Admin App under the new **Forwarder Device** tab.
> - **Device & IP Whitelisting**: Multi-device fleet system is silenced. A single authoritative Super Admin SMS Forwarder Device is implemented with an editable IP whitelist, auto-detected caller IP, token verification, and connection status.

---

## 1. Overview & Core Concept

### Domain Separation Architecture

| Domain | Role & Audience | Route Surface (Page Router) | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **`merchant.example.com`** | Merchant Staff & Owners | `/signin`, `/registration`, `/payments`, `/plans`, `/settlements`, `/developers`, `/settings`, `/` | Payment generation, ledger balance, pricing plans, signed webhooks, payout requests. Zero forwarder/simulator exposure. |
| **`admin.example.com`** | PayGate Super Admin & Ops | `/signin`, `/payments`, `/wallets`, `/review`, `/payouts`, `/device`, `/audit`, `/` | Single Super Admin forwarder device configuration, IP whitelisting, review queue, BEFTN batch approval. |
| **`api.example.com`** | Third-party Integrators & Apps | `/docs`, `/v1/payments`, `/v1/sms/webhook`, `/v1/devices/heartbeat`, `/health`, `/` | API gateway reference, payload specification, live REST sandbox, and HMAC signature validator. |

### Super Admin Forwarder Device (IP Whitelisted)
Instead of a complex fleet of remote handsets:
- A single **Super Admin Device** (`dev_super_admin_01`) represents the primary Android MFS gateway terminal.
- **IP Whitelisting**: Admin can add authorized IPv4/IPv6 addresses (e.g. `103.114.98.0/24`, `127.0.0.1`, current client IP).
- Incoming SMS webhooks and device pings verify both the device token and that the source IP matches the whitelist.
- The SMS Forwarder Simulator is embedded directly inside this Admin Device management tab as a live testing terminal.

---

## 2. User Experience & Visual Design

```
┌────────────────────────────────────────────────────────────────────────┐
│ [DEV] Active Domain: ◉ merchant.example.com  ○ admin.example.com  ○ api.example.com [Switch] │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Ambient Domain Switcher (Dev & Preview Banner)**:
   - Subtle top bar (height $32\text{px}$) that detects the host name.
   - When on a generic preview URL (e.g. `ais-dev-...run.app`), it allows 1-click toggling between `merchant.example.com`, `admin.example.com`, and `api.example.com`.
   - On custom domains, it automatically locks to the matching application.
2. **Merchant Portal (`merchant.example.com`)**:
   - Clean, professional SaaS dashboard without any simulator controls, fleet mentions, or admin shortcuts.
   - Standard merchant sidebar and navigation items.
3. **Admin Portal (`admin.example.com`)**:
   - High-density operations dashboard.
   - **Forwarder Device Tab**: Shows the Super Admin Device status (Online/Offline, Heartbeat, IP Whitelist manager, Active MSISDNs, and the embedded Forwarder Simulator).
4. **API Console (`api.example.com`)**:
   - Developer documentation style with interactive endpoints (`POST /v1/payments`, `POST /v1/sms/webhook`, `POST /v1/devices/heartbeat`).
   - Curl snippets and live response inspector.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Subdomain Routing with Ambient Dev Switcher
- **Chosen Approach**: The router inspects `window.location.hostname`. If it matches `admin.*`, it renders the Admin App; if `api.*`, it renders the API Console; if `merchant.*` or root, it renders the Merchant App. In the AI Studio preview environment where the hostname is a Cloud Run URL, an ambient domain switcher allows switching simulated domains with `localStorage` persistence.
- **Why**: Allows deploying either as 3 independent subdomains behind a reverse proxy or running unified in development without breaking routes.

### Decision 2: Silencing Fleet in Favor of Super Admin Device
- **Chosen Approach**: Replace multi-node fleet monitoring with a focused **Super Admin SMS Forwarder Device** module. The module includes:
  - Device Token & Auth Secret
  - IP Whitelist entries (CIDR or single IP, with "Add Current IP" button)
  - Connection status and latency indicator
  - Linked SIM wallets (bKash, Nagad, Rocket, Upay, Cellfin)
  - Integrated forwarder simulator for testing matching logic
- **Why**: Drastically simplifies operations overhead, eliminates fleet noise, and enforces stringent IP security.

---

## 4. Technical Architecture & Component Strategy

### System Layout Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Host & Domain Resolver                          │
│     (window.location.hostname OR Ambient Dev Domain Switcher)          │
└──────────────┬─────────────────────────┬───────────────────────────────┘
               │                         │                               │
    [merchant.example.com]      [admin.example.com]              [api.example.com]
               ▼                         ▼                               ▼
    ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
    │     Merchant App     │  │      Admin App       │  │     API Console      │
    ├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
    │ • /signin            │  │ • /signin            │  │ • /docs              │
    │ • /payments          │  │ • /payments          │  │ • /v1/payments       │
    │ • /plans             │  │ • /wallets           │  │ • /v1/sms/webhook    │
    │ • /settlements       │  │ • /review            │  │ • /v1/devices        │
    │ • /developers        │  │ • /payouts (Batches) │  │ • Live Playground    │
    │ • /settings          │  │ • /device (Super SIM)│  │ • Health Check       │
    └──────────────────────┘  │ • /audit             │  └──────────────────────┘
                              └──────────────────────┘
                                         │
                                         ▼
                    ┌────────────────────────────────────────┐
                    │ Super Admin Device & IP Whitelist Engine│
                    │ • Device: Google Pixel 6a (Master SIM) │
                    │ • Whitelisted IPs: [103.114.98.12, ...]│
                    │ • Embedded SMS Ingest Simulator        │
                    └────────────────────────────────────────┘
```

### Component Structure
1. `src/router/index.tsx`:
   - Updated with domain detection (`domain: 'merchant' | 'admin' | 'api'`).
   - Domain switcher state stored in `localStorage('paygate_active_domain')`.
   - Path-based routing within each domain (e.g. `/payments`, `/signin`, `/device`).
2. `src/components/layout/DomainSwitcherBar.tsx`:
   - Floating/ambient top banner displayed in dev/preview mode showing active domain and subdomains.
3. `src/components/admin/SuperAdminDeviceTab.tsx`:
   - Super Admin Forwarder Device settings, IP whitelist manager (add/remove IP, toggle enforcement, check client IP), device status, and integrated simulator.
4. `src/components/api/ApiConsoleLayout.tsx`:
   - API documentation, live endpoint tester, and HMAC signature sandbox.
5. `src/components/merchant/` & `src/components/layout/CollapsibleSidebar.tsx`:
   - Stripped of any simulator or admin mentions. Pure merchant focus.

---

## 5. Verification & Test Plan

1. **Domain Routing Verification**:
   - Switch to `merchant.example.com`: Verify only merchant tabs (`/payments`, `/plans`, `/settlements`, etc.) appear. Confirm no simulator or admin links.
   - Switch to `admin.example.com`: Verify admin tabs (`/device`, `/payouts`, `/review`, `/audit`).
   - Switch to `api.example.com`: Verify API documentation and live endpoint runner.
2. **Super Admin Device & IP Whitelisting**:
   - Navigate to Admin $\to$ Device tab.
   - Add/remove IP from whitelist. Click "Whitelist Current IP".
   - Test simulator SMS ingestion: verify it succeeds when caller IP is in whitelist, and displays an IP blocked warning if IP verification is rejected.
3. **Build & Quality Check**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.

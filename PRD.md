# PayGate Platform — Product Requirements Document (PRD v3.1)

**Document Title**: PayGate Platform — Product Requirements Document v3.1 (Enhanced Checkout Flow)  
**System Architecture**: Merchant SaaS (Next.js + Supabase) · Progressive Web App (PWA)  
**Design System**: Gate UI Design System  
**Companion Document**: PayGate SMS Forwarder PRD v3.0  
**Date**: 13 October 2026  
**Status**: Draft for Review / Production Architecture  

---

## 1. Product at a Glance

PayGate enables Bangladeshi online merchants to accept **bKash**, **Nagad**, and **Rocket** mobile financial services (MFS) payments without needing direct provider API integrations, personal merchant numbers, or merchant-side phone infrastructure. 

Customers transfer funds to a PayGate-managed wallet pool quoting an 8-character, typo-checked reference. A fleet of dedicated Android handsets running the PayGate Forwarder app ingests and relays confirmation SMS messages to the server. The matching engine atomically verifies the payment, fires signed webhooks to the merchant, and records double-entry ledger entries for scheduled bank or MFS payout.

The Core Promise: A frictionless, secure, and transparent payment experience where the customer is guided step-by-step from the merchant’s app to a confirmed payment state in under 15 seconds.

### 1.1 Actor Responsibility Matrix

| Actor | Responsibilities | Forbidden Actions |
| :--- | :--- | :--- |
| **Merchant** | Defines pricing plans, calls `/v1/payments`, receives HMAC-SHA256 signed webhooks, requests bank or MFS payouts. | Never installs forwarder apps, never handles personal MFS wallets, never parses SMS. |
| **Customer** | Opens hosted page or popup, copies wallet number and reference, executes transfer in wallet app, enters TrxID, confirms payment. | Never requires an account or app installation, never enters MFS PIN on PayGate. |
| **PayGate Server** | Assigns pool wallets, parses incoming SMS, matches TrxID and reference, enforces double-entry ledger, dispatches signed webhooks. | Never trusts phone client telemetry; the server database is the sole authority. |
| **PayGate Ops** | Operates wallet pool and phone fleet, resolves review queue exceptions, executes maker-checker payout approvals. | Never matches payments manually unless flagged with an exception note. |

### 1.2 Scope Matrix

- **In Scope**:
  - Merchant SaaS portal: overview, payments table, pricing plans, settlements, developers, and settings.
  - Server-authoritative pricing plans (in integer paisa, versioned, snapshot-backed).
  - Payments REST API with idempotency key enforcement.
  - Hosted pay page (`pay.paygate.com/p/<id>`) and popup overlay (`paygate.js`).
  - Automated SMS ingest and regex parsers for bKash, Nagad, and Rocket.
  - Atomic matching engine cross-referencing TrxID, reference, amount, wallet, and time window.
  - Double-entry ledger with automatic 5% platform fee deduction (`fee_rate_bps = 500`).
  - Maker-checker payout approval workflow (minimum Tk 1,000 threshold).
  - Android phone fleet telemetry (heartbeats, battery, queue depth, remote token revocation).
  - Progressive Web App (PWA) compliance with offline caching and native installability.
- **Out of Scope**:
  - Direct card network processing (Visa, Mastercard, Amex).
  - Direct telco provider API connections (using SIM fleet parsing instead).
  - Executing automated refunds inside telco wallets (refunds are recorded in ledger only).
  - iOS SMS forwarder (Android fleet only).

### 1.3 System Journey Map

```
[Merchant App / Site]
        │
        │ 1. POST /v1/payments (plan_id, order_id, callback_url)
        ▼
[PayGate Server]
        │
        │ 2. Assigns pool wallet + generates 8-char reference (e.g., K7M4X2QH)
        ▼
[Hosted Pay Page / Popup Modal]
        │
        │ 3. Customer copies Wallet Number & Reference, completes transfer in wallet app
        │ 4. Customer submits TrxID and clicks "Confirm Payment"
        ▼
[Phone Fleet (Forwarder App)] ──(Tower SMS)──> [SMS Ingest (/v1/sms/webhook)]
                                                       │
                                                       │ 5. Parses amount, TrxID, wallet, ref
                                                       ▼
                                             ┌──────────────────┐
                                             │  Matching Engine │
                                             └──────────────────┘
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼                                                       ▼
                [Confirmed Match]                                         [Conflict / Typos]
                           │                                                       │
        ┌──────────────────┴──────────────────┐                                    ▼
        ▼                                     ▼                             [Review Queue]
  Status → paid                       HMAC Webhook Fired                    (underpaid, overpaid,
(UI shows green check)             (payment.paid dispatched)                wrong_wallet, late)
        │
        ▼
  [Ledger Entries]
  - Credit Merchant Payable (Gross)
  - Debit 5% Platform Fee
  - Available Balance accumulates towards Tk 1,000 payout
```

---

## 2. Core User Journey (Enhanced v3.1)

1. **Initiation**: The end user clicks "Subscribe" or "Pay" on the merchant’s app or website.
2. **Routing**: The user is seamlessly redirected to the hosted PayGate page (`pay.paygate.com/p/<id>`) OR the PayGate UI opens as a secure popup overlay (via `paygate.js`).
3. **Instruction & Copy**: The UI renders the exact amount, provider tabs (bKash/Nagad/Rocket), the receiving wallet number with one-tap copy, and the unique 8-character reference with one-tap copy.
4. **Payment Execution**: The customer switches to their mobile wallet app, chooses "Send Money", pastes the recipient number, enters the exact amount, and pastes the reference into the wallet app's reference field.
5. **Proof Submission**: The customer returns to PayGate, pastes or types the Transaction ID (TrxID) into the designated input field.
6. **Confirmation Trigger**: The customer clicks the "Confirm Payment" button.
7. **Matching State**: The UI immediately transitions to a "Loading / Verifying" state with a live pulse animation. The backend matching engine holds the request for up to 90 seconds while cross-referencing incoming SMS evidence.
8. **Resolution**:
   - **Success (Paid)**: Match found; UI shows green checkmark, order ID, and amount paid. Webhook fired to merchant.
   - **Needs Review**: Conflict in amount or wallet; UI shows clear explanation and support contact.
   - **Locked / Expired**: 5 failed TrxID attempts locks checkout for 15 minutes to prevent brute-forcing.

---

## 3. Detailed Checkout & Confirm Flow

### 3.1 Integration Modes

| Mode | Behavior | Proof Requirement |
| :--- | :--- | :--- |
| **Redirect** | Merchant server creates payment → redirects user to `pay_url`. After completion, PayGate redirects to `success_url` or `cancel_url`. | Redirect is never proof. Merchant verifies via `payment.paid` webhook or `GET /v1/payments/:id`. |
| **Popup (Overlay)** | `paygate.js` opens checkout in modal overlay. Listens to Realtime events and relays `paid`, `needs_review`, `expired`, and `closed` events. | Overlay event is never proof. Merchant must verify signed webhook. |

### 3.2 The 6 Pay Page UI States (Gate UI Design System)

The pay page is mobile-first (360px minimum), under 150KB, and supports English and বাংলা natively.

| State | UI Presentation | Customer Action | Next Transition |
| :--- | :--- | :--- | :--- |
| **Stage 1: Initial** | Displays Amount, Provider Logo, Wallet Number (copy icon), Reference (accented chip with copy icon), disabled/gated TrxID field. | Customer taps "Copy" on wallet/reference, switches to wallet app to pay. | Taps "I Have Transferred" → Stage 2. |
| **Stage 2: Ready to Confirm** | TrxID input field activates with format check. "Confirm Payment" button activates in primary accent. | Customer inputs/pastes TrxID, taps "Confirm Payment". | Triggers `POST /v1/pay/:id/confirm` → Stage 3. |
| **Stage 3: Loading / Verifying** | Full-screen prominent overlay with live pulse animation: *"Verifying your payment with the network..."*. 90s countdown bar. | Customer waits while backend checks Supabase Realtime stream. | Match → Stage 4; Conflict → Stage 5; 90s timeout → Stage 3 (Still checking). |
| **Stage 4: Success (Paid)** | Success green badge, *"Payment Received"* message with amount, order ID, TrxID, and *"Back to Merchant"* button. | Customer taps return or modal closes, triggering order fulfillment. | Terminal state. |
| **Stage 5: Needs Review** | Warning badge: *"We received Tk X but expected Tk Y. Our team is reviewing this manually."* Support link provided. | Customer reviews discrepancy and contacts support. | Moves to Ops review queue. |
| **Stage 6: Error / Expired / Locked** | Danger badge: *"This payment link has expired"* or *"Too many failed attempts. Locked for 15 minutes."* | Customer returns to shop or waits out lockout timer. | Terminal state. |

---

## 4. Plans, References, and Matching Engine

### 4.1 Server-Authoritative Pricing Plans
- Merchants define plans mirroring their catalog.
- Amounts are stored exclusively as integer **paisa** ($1\text{ BDT} = 100\text{ paisa}$).
- `POST /v1/payments` accepts `plan_id`; the server sets the amount, preventing client-side price tampering.
- Editing a plan increments its version (`version: 2`); payments in flight retain their immutable snapshot.

### 4.2 8-Character Typo-Checked Reference
- **Length**: Exactly 8 characters (7 random alphanumeric + 1 check character).
- **No Prefix**: No `REF` prefix; the parser identifies values via the `Ref` label in the SMS.
- **Charset**: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 characters). Excludes confusing look-alikes `0`, `O`, `1`, `I`, `L`.
- **Typo Catching**: Weighted prime modulo-31 checksum catches 100% of single-character typos and common adjacent swaps.
- **Normalization**: Uppercase, strip whitespace, dashes, and punctuation prior to evaluation.

### 4.3 Provider Launch Gate Check
Before deploying fleet nodes, verify on physical handsets for bKash, Nagad, and Rocket:
1. Whether the consumer wallet app includes an active reference field for the transaction type used.
2. Character and length limitations of that reference field.
3. Exact wording of the received-money SMS confirming whether the reference is echoed.
*Note: If a provider does not echo the reference, the TrxID is primary proof; the reference acts as a secondary cross-check where present.*

### 4.4 Wallet Pool Assignment & Auto-Drain Rules
- **Selection Criteria**: Active wallet matching provider whose handset heartbeat is $<3\text{ minutes}$ old, with daily limit headroom and fewer pending payments than concurrency cap. Selects the least recently assigned.
- **Offered Wallets Array**: Payments retain `offered_wallet_ids` (primary + backups). If the customer sends funds to an offered backup wallet, matching completes successfully.
- **Auto-Drain**: Wallets reaching $\ge 80\%$ of their daily regulatory limit (e.g., Tk 50,000 for bKash personal) automatically enter `draining` mode and receive no new payments.

### 4.5 Matching Engine Invariant Rules

The customer's TrxID is the claim; the forwarded SMS is the evidence.

| Scenario | Matching Behavior | System Result | Customer View |
| :--- | :--- | :--- | :--- |
| **TrxID matches & all agree** | TrxID, amount, wallet, and reference agree. | Status → `paid`. `matched_by = 'trxid+reference'` | Animated green checkmark, payment receipt. |
| **Claim arrives before SMS** | TrxID format valid; no SMS in pool yet. | Holds `POST /confirm` up to 90s; listens on Realtime. | "Verifying payment with network..." pulse animation. |
| **Amount mismatch** | TrxID matches; amount received is higher or lower. | Status → `needs_review` (`underpaid` or `overpaid`). | "We received Tk X but expected Tk Y. Under review." |
| **Wrong wallet / provider** | TrxID matches; receiving wallet not in `offered_wallet_ids`. | Status → `needs_review` (`wrong_wallet`). | "Payment received on unexpected wallet. Under review." |
| **Reference conflict** | TrxID matches; SMS reference differs from payment. | Status → `needs_review` (`conflict`). | Flagged for manual review. |
| **Duplicate TrxID claim** | TrxID already claimed by another payment record. | Claim rejected immediately. First valid claim wins. | "This TrxID was already used." |
| **Late SMS after expiry** | SMS arrives after payment 30-minute expiry window. | Status → `needs_review` (`late_payment`). | Payment marked expired; money sent to review queue. |
| **Typo Protection** | Customer mistypes TrxID repeatedly. | Format validation blocks obvious typos; 5 failures locks page for 15 minutes. | Lockout screen with 15-minute countdown timer. |
| **Auto-Confirm Mode** | Merchant enables auto-confirm; SMS arrives with matching reference & amount. | Status → `paid` without requiring customer to click Confirm. | Seamless zero-click confirmation. |
| **Duplicate SMS** | Same SMS received twice from cellular network. | Ignored via `client_msg_id` deduplication. | No double claim. |

### 4.6 Fees, Balances & Maker-Checker Settlements
- **Platform Fee**: Flat 5.00% charged on gross paid amount (`fee_rate_bps = 500`).
- **Paisa Precision**: `fee_amount = round(amount * fee_rate_bps / 10000)`, `net_amount = amount - fee_amount`.
- **Double-Entry Ledger**: Every paid transaction records a credit to `Merchant Payable` and a debit to `Platform Fee`.
- **Payout Threshold**: Payouts to registered bank or MFS accounts require minimum available balance of **Tk 1,000.00**.
- **Maker-Checker Rule**: Payouts must be initiated by one staff member (Maker) and approved by an independent officer (Checker) before funds are disbursed.

---

## 5. System Features by Priority

| Area | Feature | Priority | Technical Specification |
| :--- | :--- | :--- | :--- |
| **Merchant** | Onboarding & KYB | P0 | Trade license, e-TIN, NID verification, registered payout account, mandatory 2FA. |
| **Merchant** | Pricing Plans | P0 | Create, version, archive; amount in paisa; `external_sku` mapping. |
| **Merchant** | Payments API | P0 | `POST /v1/payments`, `Idempotency-Key` header, get, list, cancel. |
| **Merchant** | Signed Webhooks | P0 | HMAC-SHA256 signatures, retry backoff (10s to 24h), delivery log, manual resend. |
| **Merchant** | Dashboard & Settlements | P0 | Overview, payments drawer, double-entry statements, CSV export, min Tk 1,000 payout. |
| **Customer** | Hosted Pay Page & Popup | P0 | Gate UI design system, mobile-first (360px), copy buttons, 6 states, EN and বাংলা. |
| **Platform** | Matching Engine | P0 | Atomic claim evaluation, reference cross-check, auto-confirm toggle, race condition handling. |
| **Platform** | SMS Ingest & Parser | P0 | Regex parsers for bKash, Nagad, and Rocket; `client_msg_id` deduplication. |
| **Platform** | Wallet Pool Management | P0 | Assignment algorithm, limit meters, auto-drain at 80%, heartbeat checks. |
| **Ops** | Fleet Console | P0 | Android handsets, heartbeat monitor (<3 min), battery ring, remote revoke/flush. |
| **Ops** | Reconciliation Queue | P0 | Split-screen comparing customer claim vs SMS evidence with staff resolution actions. |
| **Ops** | Payout Approvals | P0 | Two-person maker-checker approval for bank and MFS disbursements. |
| **Ops** | Compliance Audit Log | P0 | Immutable logging of every manual and automated action with actor, IP, and timestamp. |

---

## 6. Architecture, Data Model & API Specifications

### 6.1 Database Schema (Postgres)

- **`merchants`**:
  - `id`: Text (e.g., `merch_01h...`)
  - `name`: Text
  - `status`: Text (`active`, `suspended`, `pending`)
  - `kyb_status`: Text (`verified`, `in_review`, `rejected`)
  - `payout_account`: JSONB (`{ type, accountNumber, accountName, bankName, branchName, routingNumber }`)
  - `fee_rate_bps`: Integer (default `500`)
  - `risk_tier`: Text (`standard`, `low_risk`, `high_volume`)
  - `webhook_secret`: Text (hashed at rest)
  - `webhook_url`: Text
  - `auto_confirm`: Boolean (default `false`)
  - `balance_paisa`: BigInt (available balance)
  - `held_paisa`: BigInt (balance held in pending payouts)
  - `test_api_key`: Text
  - `live_api_key`: Text

- **`pricing_plans`**:
  - `id`: Text (`plan_...`)
  - `merchant_id`: Text (FK `merchants.id`)
  - `name`: Text
  - `amount_paisa`: Integer
  - `currency`: Text (`BDT`)
  - `external_sku`: Text
  - `version`: Integer (starts at `1`)
  - `status`: Text (`active`, `archived`)
  - `created_at`: Timestamptz

- **`wallets`**:
  - `id`: Text (`wlt_...`)
  - `provider`: Text (`bkash`, `nagad`, `rocket`)
  - `msisdn`: Text (e.g., `01712-750278`)
  - `holder_name`: Text
  - `device_id`: Text (FK `devices.id`)
  - `sim_slot`: Integer (`1` or `2`)
  - `status`: Text (`active`, `draining`, `disabled`)
  - `daily_limit_paisa`: BigInt
  - `monthly_limit_paisa`: BigInt
  - `today_total_paisa`: BigInt
  - `concurrency_cap`: Integer
  - `active_pending_count`: Integer
  - `last_assigned_at`: Timestamptz

- **`devices`**:
  - `id`: Text (`dev_...`)
  - `name`: Text
  - `model`: Text
  - `app_version`: Text
  - `status`: Text (`online`, `offline`, `revoked`)
  - `last_heartbeat_at`: Timestamptz
  - `battery`: Integer (0–100)
  - `queue_depth`: Integer
  - `permissions`: JSONB (`{ smsRead, smsReceive, batteryOptimizationDisabled }`)

- **`payments`**:
  - `id`: Text (`pay_...`)
  - `merchant_id`: Text (FK `merchants.id`)
  - `plan_id`: Text (FK `pricing_plans.id`)
  - `plan_snapshot`: JSONB (`{ name, amountPaisa }`)
  - `order_id`: Text
  - `provider`: Text (`bkash`, `nagad`, `rocket`)
  - `wallet_id`: Text (FK `wallets.id`)
  - `offered_wallet_ids`: Text[]
  - `amount_paisa`: Integer
  - `fee_amount_paisa`: Integer
  - `net_amount_paisa`: Integer
  - `reference`: Text (Unique 8 characters, indexed)
  - `status`: Text (`created`, `awaiting_payment`, `confirming`, `paid`, `needs_review`, `expired`, `cancelled`)
  - `review_reason`: Text (`underpaid`, `overpaid`, `wrong_wallet`, `conflict`, `late_payment`)
  - `matched_by`: Text (`trxid`, `trxid+reference`, `auto_confirm`, `manual_review`)
  - `submitted_trx_id`: Text
  - `confirmed_at`: Timestamptz
  - `expires_at`: Timestamptz
  - `paid_at`: Timestamptz
  - `created_at`: Timestamptz

- **`incoming_txns`**:
  - `id`: Text (`txn_...`)
  - `provider`: Text (`bkash`, `nagad`, `rocket`)
  - `trx_id`: Text (indexed)
  - `wallet_id`: Text (FK `wallets.id`)
  - `amount_paisa`: Integer
  - `balance_after_paisa`: Integer
  - `ref_raw`: Text
  - `ref_normalized`: Text (indexed)
  - `raw_sms`: Text (encrypted at rest)
  - `client_msg_id`: Text (unique deduplication key)
  - `sim_slot`: Integer
  - `claimed_payment_id`: Text (FK `payments.id`, nullable)
  - `received_at`: Timestamptz

- **`ledger_entries`**:
  - `id`: Text (`ledg_...`)
  - `merchant_id`: Text
  - `payment_id`: Text (nullable)
  - `payout_id`: Text (nullable)
  - `type`: Text (`pay_in`, `fee`, `merchant_payable`, `payout`, `adjustment`)
  - `debit_paisa`: Integer
  - `credit_paisa`: Integer
  - `balance_paisa_after`: BigInt
  - `description`: Text
  - `created_at`: Timestamptz

- **`payouts`**:
  - `id`: Text (`payout_...`)
  - `merchant_id`: Text
  - `amount_paisa`: BigInt
  - `status`: Text (`pending`, `approved`, `rejected`, `completed`)
  - `payout_account`: JSONB
  - `maker_id`: Text
  - `checker_id`: Text (nullable)
  - `requested_at`: Timestamptz
  - `approved_at`: Timestamptz

- **`webhook_deliveries`**:
  - `id`: Text (`whd_...`)
  - `payment_id`: Text
  - `event`: Text (`payment.paid`, `payment.needs_review`, `payment.expired`, `payment.cancelled`)
  - `url`: Text
  - `status`: Text (`success`, `failed`, `retrying`)
  - `attempt`: Integer
  - `max_attempts`: Integer
  - `payload`: JSONB
  - `signature`: Text
  - `status_code`: Integer
  - `last_attempt_at`: Timestamptz

- **`audit_log`**:
  - `id`: Text (`aud_...`)
  - `actor`: Text
  - `role`: Text (`owner`, `staff`, `developer`, `system`)
  - `action`: Text
  - `entity_type`: Text
  - `entity_id`: Text
  - `details`: Text
  - `ip`: Text
  - `created_at`: Timestamptz

### 6.2 Key REST Endpoints

| Endpoint | Auth | Description |
| :--- | :--- | :--- |
| `POST /v1/plans` | Merchant API Key | Creates a new pricing plan. |
| `PATCH /v1/plans/:id` | Merchant API Key | Updates a pricing plan (increments version). |
| `POST /v1/payments` | Merchant Key + Idempotency-Key | Creates a payment session with assigned wallet and reference. |
| `GET /v1/payments/:id` | Merchant API Key | Retrieves verified payment status and proof. |
| `GET /v1/pay/:id` | Public (10 req/min/IP) | Fetches checkout page data for customer. |
| `POST /v1/pay/:id/confirm` | Public (10 req/min/IP) | Submits customer TrxID; holds up to 90s while matching. |
| `POST /v1/sms/webhook` | Device Token | Handset forwarder pushes parsed SMS payload. |
| `POST /v1/devices/heartbeat` | Device Token | Handset pushes health, battery, and queue depth. |
| `POST /v1/payouts` | Merchant API Key | Requests a balance payout (minimum Tk 1,000.00). |
| `POST /v1/admin/payouts/:id/approve` | Staff Session + 2FA | Independent checker authorizes payout disbursement. |

### 6.3 Signed Webhook Protocol

- **Header**: `PayGate-Signature: t=<unix_timestamp>,v1=<hex_signature>`
- **Signing Algorithm**: $v1 = \text{HMAC-SHA256}(\text{webhook\_secret}, t + "." + \text{rawBody})$
- **Replay Protection**: Merchants reject timestamps older than 300 seconds (5 minutes).
- **Retry Schedule**: Exponential retry backoff at $10\text{s}, 1\text{m}, 5\text{m}, 30\text{m}, 2\text{h}, 6\text{h}, 24\text{h}$.

---

## 7. Security, Fraud & Compliance Protocols

1. **Layered Anti-Spoofing Architecture**:
   - Device tokens are 256-bit random secrets, stored hashed, and rotated every 90 days.
   - Senders on the phone are strictly allowlisted (e.g. `bKash`, `16216`, `Nagad`); unknown senders are dropped.
   - Allowlisted headers alone are never trusted by the server: the server enforces unique TrxID per wallet, balance continuity (`balance_after - balance_before = amount`), and reference cross-checking.
2. **Typo Protection & Anti-Brute-Force Lockout**:
   - TrxID inputs must pass provider format regular expressions.
   - 5 failed TrxID attempts within a payment session triggers a strict 15-minute lockout.
   - PayGate never reveals another customer's TrxID or status.
3. **Data Privacy**:
   - Raw SMS text is encrypted at rest using AES-GCM and redacted after 90 days.
   - Customer phone numbers are masked in the merchant UI (e.g. `017****0278`) with audited unmasking.
4. **Regulatory & Compliance Runbook**:
   - Pool funds are segregated in escrow accounts for merchant payable obligations.
   - Daily automated reconciliation job ensures wallet balances match ledger balances ($0.00\text{ BDT}$ variance).

---

## 8. Operational Targets & Service Level Agreements (SLAs)

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Confirm Success Rate** | $\ge 95\%$ | Paid confirmations over all submitted claims without manual ops action. |
| **Matching Latency** | $p95 < 5\text{ seconds}$ | Time from pressing "Confirm" to `paid` state when SMS is already in pool. |
| **SMS Ingest Latency** | $p95 < 3\text{ seconds}$ | Handset SMS arrival to database `incoming_txns` entry. |
| **Reference Coverage** | $\ge 90\%$ | Proportion of received-money SMS containing valid reference per provider. |
| **Review Load** | $< 1\%$ | Proportion of payments flagged in `needs_review` queue. |
| **Message Loss** | $0$ per $100,000$ | Monitored via sequential `client_msg_id` gaps. |
| **Webhook Delivery** | $\ge 99\%$ within 3 attempts | Successful HTTP 2xx acknowledgement from merchant endpoints. |
| **Availability** | $99.9\%$ monthly | Uptime across SMS ingest pipeline and customer pay page. |

---

## 9. Roadmap & Open Questions

1. **Provider Spike (Phase 0 Launch Gate)**:
   - Validate on real devices for bKash personal/merchant, Nagad, and Rocket personal that the received-money SMS reliably echoes the reference field across all app versions.
2. **Payout Cost Assignment**:
   - Clarify whether the BFTN bank transfer or MFS cash-out fee is borne by PayGate or deducted from merchant proceeds.
3. **Regional Hosting**:
   - Deploy Supabase Postgres instances in Singapore or Mumbai to maintain latency under 60ms to Bangladesh cellular networks.

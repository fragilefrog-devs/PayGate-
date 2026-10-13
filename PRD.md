# PayGate Platform — Product Requirements Document (PRD v4.0)

**Document Title**: PayGate Platform — Product Requirements Document v4.0 (Multi-Domain Architecture & 5-Provider MFS Gateway)  
**System Architecture**: Multi-Domain Subdomain Architecture (`merchant.*`, `admin.*`, `api.*`) · Next.js / React 19 + Supabase · Progressive Web App (PWA)  
**Design System**: Gate UI Design System  
**Companion Documents**: PayGate SMS Forwarder PRD v4.0 · Gate UI Tokens & Design Specification  
**Date**: 13 October 2026  
**Status**: Production Architecture & Multi-Domain Implementation  

---

## 1. Product at a Glance

PayGate enables Bangladeshi online merchants to accept **bKash**, **Nagad**, **Rocket**, **Upay**, and **Cellfin** (IBBL) mobile financial and digital banking payments with **zero provider direct API integration**, no personal merchant numbers, and no merchant-side phone infrastructure.

Customers transfer funds to a PayGate-managed wallet pool quoting an 8-character, polynomial typo-checked reference. A dedicated Super Admin Android Forwarder handset running the PayGate Forwarder app pushes confirmation SMS messages to the server over an IP-whitelisted endpoint. The atomic matching engine verifies the transaction, fires HMAC-SHA256 signed webhooks to the merchant, and records double-entry ledger entries for automated BEFTN bank or MFS payout batching.

The Core Promise: A frictionless, secure, and transparent payment experience where the customer is guided step-by-step from checkout to confirmed payment state in under 15 seconds, backed by a strict multi-domain architecture.

### 1.1 Multi-Domain Routing & Actor Matrix

The PayGate platform is divided into three distinct subdomains, ensuring complete isolation of merchant tools, internal operations, and public developer APIs:

| Domain | Portal / Target | Primary Actors | Key Routes & Responsibilities |
| :--- | :--- | :--- | :--- |
| **`merchant.example.com`** | Merchant SaaS Portal | Online Merchants, Store Owners, Finance Teams | `/overview`, `/payments`, `/plans`, `/settlements`, `/developers`, `/settings`, `/registration`, `/signin`. Self-service payment monitoring, pricing plan management, double-entry statement auditing, webhook management, and payout initiation. |
| **`admin.example.com`** | Ops Admin Console & Super Admin Device | PayGate Operations, Risk Officers, Platform Engineers | `/admin` (overview), `/admin/device` (Super Admin SMS Forwarder & IP Firewall), `/admin/wallets` (pool limits & auto-drain), `/admin/review` (split-screen discrepancy resolution), `/admin/payouts` (BEFTN batching & maker-checker clearing), `/admin/audit` (immutable audit trail). |
| **`api.example.com`** | API Backend & Developer Sandbox | Merchant Developers, Automated Ingest Systems | `/v1/payments`, `/v1/sms/webhook`, `/v1/devices/heartbeat`, `/v1/payouts`, `/v1/batches`. Provides interactive REST sandbox, API reference documentation, curl code generators, and simulated webhook delivery tests. |
| **`pay.example.com`** | Customer Checkout (Hosted & Modal) | End-User Buyers | Hosted checkout `/pay/:id` and popup overlay (`paygate.js`). Renders provider instructions, one-tap copy, TrxID submission, and 6 Gate UI states. |

*In preview and local development environments where custom DNS subdomains may not resolve, an **Ambient Domain Switcher** bar simulates host routing and role contexts seamlessly while maintaining 100% fidelity to production Host header behavior.*

### 1.2 Scope Matrix

- **In Scope**:
  - Multi-domain routing supporting Host header routing and ambient development simulation.
  - 5 MFS & DFS Providers: **bKash**, **Nagad**, **Rocket**, **Upay**, and **Cellfin** (IBBL) with specialized regex parsers.
  - Super Admin SMS Forwarder Device management with hardware profile, SIM slot tracking, battery health, and connection handshake.
  - Strict CIDR / IP Whitelist Firewall (e.g., `103.145.74.0/24`, `192.168.1.105`, `127.0.0.1`) rejecting unauthorized ingestion with 403 Forbidden.
  - Total extraction of forwarder simulation tools from the merchant portal into the Ops Admin console.
  - Automated BEFTN payout batching (`payout_batches` table, `pob_...` IDs) with maker-checker clearing authorization.
  - Server-authoritative pricing plans (in integer paisa, versioned, snapshot-backed).
  - Hosted pay page (`/pay/:id`) and popup overlay (`paygate.js`) supporting 6 Gate UI states.
  - Atomic matching engine cross-referencing TrxID, reference, amount, wallet, and time window.
  - Double-entry ledger with automatic 5% platform fee deduction (`fee_rate_bps = 500`).
  - Progressive Web App (PWA) compliance with offline caching and native installability.
- **Out of Scope**:
  - Direct card network processing (Visa, Mastercard, Amex).
  - Direct telco provider API connections (using SIM fleet parsing instead).
  - Executing automated refunds inside telco wallets (refunds are recorded in ledger only).
  - iOS SMS forwarder (Android handset with background SMS receiver service only).

### 1.3 System Journey Map

```
[Merchant App / Site]
        │
        │ 1. POST https://api.example.com/v1/payments (plan_id, order_id, callback_url)
        ▼
[PayGate API Server]
        │
        │ 2. Assigns pool wallet + generates 8-char reference (e.g., K7M4X2QH)
        ▼
[Hosted Pay Page / Popup Modal (pay.example.com)]
        │
        │ 3. Customer copies Wallet Number & Reference, completes transfer in MFS app
        │ 4. Customer submits TrxID and clicks "Confirm Payment"
        ▼
[Super Admin Forwarder Handset] ──(Tower SMS)──> [SMS Ingest: POST /v1/sms/webhook]
                                                        │
                                                        │ 4.5. IP Whitelist Firewall Check
                                                        │     (Pass: 200 Ingested | Fail: 403 Forbidden)
                                                        │
                                                        │ 5. Parses amount, TrxID, wallet, ref
                                                        ▼
                                              ┌──────────────────┐
                                              │  Matching Engine │
                                              └──────────────────┘
                                                        │
                                ┌───────────────────────┴───────────────────────┐
                                ▼                                               ▼
                     [Confirmed Match]                                 [Conflict / Typos]
                                │                                               │
             ┌──────────────────┴──────────────────┐                            ▼
             ▼                                     ▼                     [Review Queue]
       Status → paid                       HMAC Webhook Fired            (underpaid, overpaid,
     (UI shows green check)             (payment.paid dispatched)        wrong_wallet, late)
             │
             ▼
       [Ledger Entries]
       - Credit Merchant Payable (Gross)
       - Debit 5% Platform Fee
       - Available Balance accumulates towards Tk 1,000 threshold
             │
             ▼
   [Automated BEFTN Batching]
   - Payout requests grouped into clearing batch (pob_...)
   - Ops Maker creates batch → Independent Checker approves with 2FA
   - Net funds cleared to merchant bank accounts
```

---

## 2. Core User Journey

1. **Initiation**: The customer clicks "Subscribe" or "Pay" on the merchant’s storefront.
2. **Routing**: The customer is redirected to the hosted PayGate page (`https://pay.example.com/pay/:id`) OR the Gate UI opens as an embedded modal popup (via `paygate.js`).
3. **Instruction & Copy**: The UI renders the exact amount, provider tabs (**bKash / Nagad / Rocket / Upay / Cellfin**), the assigned wallet number with one-tap copy, and the unique 8-character reference with one-tap copy.
4. **Payment Execution**: The customer switches to their mobile wallet app, chooses "Send Money", pastes the recipient number, enters the exact amount, and pastes the reference into the wallet app's reference field.
5. **Proof Submission**: The customer returns to PayGate and submits their Transaction ID (TrxID).
6. **Confirmation Trigger**: The customer clicks "Confirm Payment".
7. **Matching State**: The UI enters the "Loading / Verifying" state with a live pulse animation. The matching engine holds the request for up to 90 seconds while cross-referencing incoming SMS evidence from the Super Admin forwarder.
8. **Resolution**:
   - **Success (Paid)**: Match found; UI shows green checkmark, order ID, and amount paid. Signed HMAC-SHA256 webhook fired to merchant.
   - **Needs Review**: Discrepancy detected (amount mismatch or wrong wallet); UI shows clear explanation and support contacts.
   - **Locked / Expired**: 5 failed TrxID attempts locks checkout for 15 minutes to prevent brute-forcing.

---

## 3. Provider Matrix & Regex Specifications

PayGate v4.0 provides complete regex parsing and wallet pooling across 5 Bangladeshi MFS & DFS providers:

| Provider | Brand Color | Senders / Shortcodes | Reference Echoed in SMS? | Typical Regex Patterns & Parsing Rules |
| :--- | :--- | :--- | :--- | :--- |
| **bKash** | `#E2136E` | `bKash`, `16247` | Yes (`Ref: <REF>`) | `You have received Tk ([0-9,.]+) from ... TrxID ([A-Z0-9]+) ... Ref ([A-Za-z0-9_-]+)` |
| **Nagad** | `#F6921E` | `Nagad`, `16167` | Partial / Note | `Received Tk ([0-9,.]+) from ... TxnID:? ([A-Z0-9]+)` |
| **Rocket** | `#8C3494` | `16216`, `Rocket`, `DBBL` | No (A/C balance based) | `Tk([0-9,.]+) received from ... TxnId:? ([0-9]+) ... A/C Balance:? Tk([0-9,.]+)` |
| **Upay** | `#FF5B00` | `Upay`, `16268`, `UCB` | Yes (`Ref: <REF>`) | `Received Tk\.?\s*([0-9,.]+) from ... Trx\s*ID\s*[:\s]*([A-Za-z0-9]+) ... Ref\s*[:\s]*([A-Za-z0-9_-]+)` |
| **Cellfin** | `#008A44` | `Cellfin`, `IBBL`, `16259` | Yes (`Remarks: <REF>`) | `Received Tk\.?\s*([0-9,.]+) from ... Trx(?:ID|No)\s*[:\s]*([A-Za-z0-9]+) ... (?:Ref\|Remarks)\s*[:\s]*([A-Za-z0-9_-]+)` |

---

## 4. Super Admin SMS Forwarder & IP Firewall Architecture

To prevent unauthorized, spoofed, or manipulated SMS injection into the payment matching pipeline, PayGate implements a zero-trust Super Admin Forwarder architecture:

1. **Extraction from Merchant View**:
   - The forwarder device simulator and telemetry are completely extracted from the merchant SaaS portal.
   - Only Ops Admin officers with Super Admin clearance can access `/admin/device`.
2. **Dedicated Hardware Profile**:
   - Single authoritative handset (`Samsung Galaxy M14 5G` or dedicated industrial Android terminal) tracked with IMEI, firmware, app build version, and Dual SIM slot routing.
   - Dual SIM configuration:
     - SIM 1: bKash & Nagad primary receiver (`01712-750278`).
     - SIM 2: Rocket, Upay & Cellfin receiver (`01912-345678`).
3. **Strict CIDR / IP Whitelist Firewall**:
   - Configurable IP whitelist supporting single IPv4 addresses and CIDR subnets (e.g., `103.145.74.0/24`, `192.168.1.105`, `127.0.0.1`).
   - Every incoming request to `/v1/sms/webhook` extracts the caller IP (via socket or `X-Forwarded-For`).
   - If the client IP does not match the whitelist:
     - The request is immediately rejected with `403 Forbidden`.
     - An unauthorized breach attempt is logged to `audit_log` with IP, timestamp, and payload metadata.
     - A security alert notification is dispatched to Ops Admin.
4. **Handshake & Heartbeat Telemetry**:
   - Device transmits continuous heartbeats to `POST /v1/devices/heartbeat` with battery percentage, charging state, SIM signal strength, and offline queue depth.
   - Latency ping test verifies round-trip server connectivity in real time.

---

## 5. Automated BEFTN Payout Batching

Merchant settlements are structured through the Bangladesh Electronic Fund Transfer Network (BEFTN) with maker-checker security:

1. **Threshold & Eligibility**:
   - Minimum payout request threshold is **Tk 1,000.00**.
   - Available balance is calculated strictly from double-entry ledger entries minus pending holds.
2. **Batching Pipeline (`payout_batches`)**:
   - Individual merchant payout requests are aggregated into clearing batches (`pob_...`).
   - Each batch calculates gross sum, fee deductions, merchant count, and target settlement rail (`beftn`).
3. **Maker-Checker Clearing Workflow**:
   - **Maker Step**: Ops officer bundles verified payout requests into a new batch and generates the BEFTN clearing manifest.
   - **Checker Step**: Independent compliance officer reviews the bank account routing numbers, beneficiary names, and batch totals, authorizing clearing with 2FA.
   - **Settlement Execution**: Once approved, clearing references (e.g., `BEFTN-CLR-20261013-001`) are recorded and ledger payout entries transition to `completed`.

---

## 6. Database Schema Specifications (Postgres v4.0)

### 6.1 Core Tables & Relations

- **`merchants`**: Store KYB verification, bank accounts, 5% fee rate, live/test API keys, webhook configurations, and ledger balance cache.
- **`pricing_plans`**: Server-authoritative plans denominated in integer paisa with version tracking.
- **`wallets`**: Pool wallets mapped to SIM slots and providers with daily limits (e.g., Tk 50,000) and 80% auto-drain triggers.
- **`devices`**: Super Admin handset profile, active client IP, whitelist rules, heartbeat, and hardware health.
- **`payments`**: Payment records with plan snapshot, 8-character reference, offered wallets, provider (`bkash`, `nagad`, `rocket`, `upay`, `cellfin`), status, and review reasons.
- **`incoming_txns`**: Ingested SMS messages from forwarder handset with deduplication key (`client_msg_id`), parsed amount, TrxID, sender, and raw encrypted body.
- **`payouts`**: Individual merchant withdrawal requests with bank routing numbers and batch foreign key link.
- **`payout_batches`**: BEFTN clearing batches with batch number, total amount paisa, payout count, maker/checker actors, and clearing reference.
- **`ledger_entries`**: Immutable double-entry ledger entries (`pay_in`, `fee`, `merchant_payable`, `payout`, `adjustment`).
- **`audit_log`**: Comprehensive compliance and security audit trail tracking every actor, IP, action, and timestamp.

---

## 7. Security, Fraud & Operational SLAs

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Firewall Accuracy** | $100\%$ | All non-whitelisted forwarder ingestion calls dropped with 403 Forbidden. |
| **Matching Latency** | $p95 < 5\text{ seconds}$ | Time from customer "Confirm" to `paid` status when SMS exists in pool. |
| **SMS Ingest Latency** | $p95 < 3\text{ seconds}$ | Handset SMS reception to database `incoming_txns` row insertion. |
| **Typo Lockout Enforcement** | $100\%$ | 5 failed TrxID attempts within a session triggers immediate 15-minute lock. |
| **Maker-Checker Isolation** | $100\%$ | Checker actor cannot equal maker actor on any BEFTN clearing batch. |
| **Availability** | $99.9\%$ monthly | Uptime across SMS ingestion pipeline, API sandbox, and hosted pay page. |

---

## 8. Version Changelog

- **v4.0 (October 2026)**:
  - Introduced multi-domain architecture (`merchant.*`, `admin.*`, `api.*`) with Ambient Domain Switcher.
  - Added support for **Upay** and **Cellfin** (IBBL) alongside bKash, Nagad, and Rocket.
  - Extracted SMS Forwarder from merchant portal to Ops Admin portal.
  - Built Super Admin Forwarder Device with CIDR / IP Whitelist Firewall and ping latency diagnostics.
  - Added automated BEFTN payout batching with maker-checker authorization workflow.
  - Implemented interactive API Sandbox with request tester, cURL generator, and webhook playground.
- **v3.1 (October 2026)**:
  - Enhanced checkout flow with 6 Gate UI states, pulse animation, bilingual Bengali support, and PWA integration.

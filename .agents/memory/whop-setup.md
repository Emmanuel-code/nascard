---
name: Whop integration setup
description: CardVault Pro subscription details and Whop account info
---

Whop connection: conn_whop_01KWXS5QBV6H62V49Y95DDS7FR (healthy)
Company ID: biz_HRId8MA5nrVXPq (stored as WHOP_COMPANY_ID config)
Product ID: prod_lHG2IbQHWRDdj (CardVault Pro)
Plan ID: plan_4x6V5EzDcXzH2 (stored as WHOP_PLAN_ID config) — $4.99/mo renewal

**Why:** These IDs are needed for checkout and access verification and are not in source code (stored as Replit configs).

**How to apply:** When adding new plans or modifying checkout, retrieve these from process.env.WHOP_COMPANY_ID and WHOP_PLAN_ID. Direct plan URL fallback: https://whop.com/checkout/plan_4x6V5EzDcXzH2

Whop SDK version: @whop/sdk@0.0.40
- checkoutConfigurations.create({ plan_id, redirect_url }) — correct method name
- memberships.list({ company_id }) returns { data: [...] } with user.email and status fields
- Use getWhopClient() from artifacts/api-server/src/whopClient.ts (never import in frontend)

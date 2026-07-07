---
name: Regulated card edit policy
description: Which card types have locked fields and why
---

Card types 'id' and 'health' are government-issued documents — editing core identity fields (title, nameOnCard, idNumber, expiryDate) could constitute document fraud.

**Why:** User explicitly asked for this restriction citing regulatory compliance.

**How to apply:** See artifacts/cardvault/app/edit-card.tsx — LOCKED_TYPES constant + isFieldLocked() function. Photos and notes are always editable on all card types. The edit screen shows a regulation banner explaining the restriction to the user.

If a 'drivers_license' card type is ever added, include it in LOCKED_TYPES.

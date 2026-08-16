# Club Chevelle — Review, 16 August 2026

## Scope and honesty note

This is a review of the **written specification**, not of the code. The repository
`Drikus1985/chevelle-mem-sales` is empty (no commits on any branch), the live site at
`https://club-chevelle.netlify.app` is blocked by the review environment's network egress
policy, and no copy of `club-chevelle.zip`, `site/index.html`, `_readme_claims.mjs` or
`_chev_regress.mjs` exists in the container.

Every finding below is therefore derived from the description. Some may already be handled in
code. Each is written so it can be checked in a few seconds against the actual `index.html`.

The R99 flat delivery fee is **settled** (Drikus, 9 Aug 2026) and is not reopened here.

---

## What is internally consistent

Checked arithmetic against the stated figures — all of it holds:

| Claim | Check | Result |
|---|---|---|
| 14 categories covering 558 plates | 105+98+115+60+45+27+23+22+17+13+12+11+6+4 | **558 exactly** |
| 558 thumbs at ~9.6 KB | 5.23 MB | matches stated 5.2 MB |
| 12 images/page, 53-page PDF | 46.5 product pages, ~6 pages front/back matter | plausible |
| 60-per-batch paging | first paint ≈ 576 KB, not 5.2 MB | correct call for SA mobile data |

The category counts summing to exactly 558 with no remainder is good evidence the extraction
did not drop or double-count a category. The 558 codes / 558 thumbnails / no-code-without-an-image
build check is the right invariant to assert.

Also right, and worth keeping: deriving the card disclaimer from `yocoName !== BRAND.name`
rather than hard-coding it, excluding pre-orders from the payable total, disabling the card
button on a pre-order-only basket, and putting the fully pre-filled payment link behind the
Copy button instead of the bare page URL.

---

## Findings

### 1. Order reference collides at minute resolution — blocking

`CHEV-YYMMDD-HHMM` has no per-order entropy. Two customers who check out in the same clock
minute receive **the same reference**.

This matters more here than in a normal shop because the reference is the *sole* reconciliation
key, and it is now baked into the Yoco link. A collision produces two card payments carrying one
reference against two different baskets, with no way to tell them apart in the Yoco dashboard.
There is no server-side order record to fall back on.

Fix is one line:

```js
const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
const ref  = `CHEV-${yy}${mm}${dd}-${hh}${mi}-${rand}`;   // CHEV-260816-1432-K7Q
```

Note this changes the documented format, so `_readme_claims.mjs`'s reference-format assertion
and the README both need updating in the same commit.

### 2. A card payment can arrive with no order attached — blocking

The card button and the WhatsApp message are independent paths. A customer can tap **Pay by card
now**, complete the Yoco payment, and never send the WhatsApp message. The result is money in the
Yoco dashboard under reference `CHEV-…` with nothing anywhere recording which plates were bought.

The reference identifies *an* order; nothing maps it to line items. Recommended sequencing, in
order of cost:

- Cheapest: make the card row copy/instruction read "send your WhatsApp order first, then pay" and
  reorder the panel so WhatsApp sits above Pay by card.
- Better: have the card button open WhatsApp with the order message *and* the payment link, so the
  order is transmitted as a side effect of paying.
- Proper: a form endpoint (Netlify Forms is free and needs no backend) capturing the basket JSON
  against the reference at checkout time.

Given this is the one failure mode that loses a paying customer's order silently, the third option
is worth the hour.

### 3. Mixed baskets have an unfunded second delivery

A pre-order-only basket correctly carries no delivery fee. A **mixed** basket charges R99 once,
but ships twice — the in-stock plates now, the pre-order when it lands. The second courier leg is
unfunded, and nothing in the customer-facing copy says which behaviour to expect.

Two defensible answers, both copy-only changes:

- Hold the whole order and ship together once the pre-order arrives (one fee, one shipment,
  customer waits).
- Ship in stages and quote the second delivery fee on confirmation.

Pick one and state it in the WhatsApp message and next to the pre-order tag. This is currently
undecided rather than wrong, but a customer will hit it before the open items list is cleared.

### 4. `soldOut` needs a redeploy, and the stepper allows 99

Marking a plate sold requires editing the `BRAND` object, re-zipping and re-dragging to Netlify.
Between a plate selling out and that redeploy, it stays purchasable at full price.

The typed-quantity test normalises `999999 → 99`, so the stepper permits 99 of any plate. That is
fine if stock is deep. If these are shallow or one-off vintage pieces, both the cap and the
redeploy latency are a problem — you will take money for plates you cannot ship, and the pre-order
mechanism only helps for items already known to be sold.

**Question for Drikus: what is typical stock depth per code?** If it is often 1–3, the quantity cap
should drop and `soldOut` should become a per-code quantity map rather than an array.

### 5. The Yoco locked-parameter behaviour is an undocumented dependency

The whole payment flow rests on Yoco rendering `?amount=&reference=` as locked text. That is
observed behaviour on a hosted page you do not control, not a documented API contract. If Yoco
changes their payment page rendering, the failure is silent: customers land on a R0.00 page with
collapsed sections, exactly the useless state already identified for the bare URL.

Two things follow:

- Add the live R1 card test (already an open item) as a **recurring** check, not a one-off. A
  monthly manual click-through is enough.
- Locked in the UI is not locked on the wire. A customer can edit the `amount` in the address bar
  and pay R1 for a R99 plate, and it will arrive with a *valid* reference. So reconciliation must
  verify **amount as well as reference** before shipping. Worth stating explicitly in the README's
  operating instructions, because "the reference always matches" reads as "nothing to check".

### 6. Publishing the bank account number — concrete mitigation

The exposure is correctly identified but no mitigation is offered. The practical one in South
Africa: call FNB and place a **debit order block / DebiCheck-only instruction** on account
6307 4689 771 so no unauthenticated debit can be collected against it. That neutralises most of
the published-account-number risk and takes one phone call.

Beyond that, PayShap to 064 943 7890 plus the card button already covers the overwhelming majority
of customers. The EFT details are the only piece creating exposure, and they could be supplied on
request over WhatsApp instead of printed on a public page. Recommendation: **block the debits, then
decide** — the block is worth doing whichever way the visibility question goes.

### 7. Image mapping is positional and only spot-verified

558 photos mapped to codes by page and reading order is a positional assumption. A single page
with 11 or 13 extractable images, or one decorative graphic picked up as a product photo, shifts
every subsequent plate by one — and the failure is invisible in the build check, because
558 codes / 558 images / no-gaps still passes.

The count matching exactly is meaningful evidence the assumption held, and spot-verification
against printed names raises confidence further. But the cost of being wrong is a customer
receiving a different plate from the one pictured, one at a time, with no systematic signal.

Cheap hardening: OCR the printed name under each extracted image and assert it matches the mapped
code's name. If that is too much, verify the **first and last image on every page** — an off-by-one
anywhere in a page's reading order will surface at a boundary.

### 8. The deploy pipeline is the biggest structural weakness — and this repo is the fix

"Edit index.html inside the zip, re-zip, drag onto Netlify, then switch visibility Private→Public"
is a manual pipeline with a single copy of the artefact and no history. The open items list already
carries "an offsite copy of the zip" as a to-do. The repository that solves it is this one, and it
is sitting empty.

Committing `site/` here and pointing Netlify at the repo (**Site configuration → Build & deploy →
Link repository**, publish directory `site`) retires four separate problems at once:

- offsite copy — done, permanently, and versioned
- re-zip-and-drag — replaced by `git push`
- the Private→Public flip after every drop — site config persists across git deploys, so it stops
  being a per-deploy chore
- no rollback — every past version becomes deployable from history

It also lets the two test suites run in CI on every push instead of by hand, which is where 58
passing checks actually start earning their keep.

I have added a `netlify.toml` to this repo ready for that move. It publishes `site/`, and adds
security headers the drag-and-drop deploy cannot easily set — `X-Frame-Options: DENY` matters on a
page that displays banking details, since it blocks the page being framed by a lookalike site.

---

## Suggested order of work

| # | Action | Cost | Blocking a real order? |
|---|---|---|---|
| 1 | Register ShapID against 064 943 7890 | phone call | **yes** |
| 2 | Add entropy to the order reference (finding 1) | 1 line + test | **yes** |
| 3 | Capture the basket server-side or force WhatsApp-before-pay (finding 2) | ~1 hour | **yes** |
| 4 | Live R1 card test; confirm amount *and* reference land | 10 min | **yes** |
| 5 | Place a debit-order block on the FNB account (finding 6) | phone call | no, but do it now |
| 6 | Decide mixed-basket delivery and write the copy (finding 3) | copy only | no |
| 7 | Confirm stock depth; adjust quantity cap if shallow (finding 4) | depends | no |
| 8 | Move `site/` into this repo, link Netlify to git (finding 8) | ~30 min | no |
| 9 | Page-boundary image verification (finding 7) | ~1 hour | no |
| 10 | Full end-to-end test order | 20 min | final gate |

Items 1–4 should all be closed before the site takes a real customer order. Items 5 and 8 are
cheap enough to do in the same sitting.

Still open beyond this list, unchanged from the brief: a real domain, a courier agreement.

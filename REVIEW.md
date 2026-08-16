# Club Chevelle — Review, 16 August 2026

Reviewed against the live shipped code, fetched from `https://club-chevelle.netlify.app`
(`index.html`, 715 lines, 81 KB) and all 558 thumbnails. The site is now committed to this
repo under `site/`, so it is under version control for the first time.

The R99 flat delivery fee is **settled** (Drikus, 9 Aug 2026) and is not reopened here.

---

## Verified against the live site

| Claim | Method | Result |
|---|---|---|
| 558 products, no duplicates | parsed `CATS` from shipped HTML | **558 items, 558 unique codes** |
| 14 categories, stated counts | compared each against the brief | **all 14 match exactly** |
| 558 thumbnails, none missing | HTTP request for every `img/<code>.webp` | **558/558 served** |
| ~9.6 KB per thumb, 5.2 MB total | measured all 558 files | **5.24 MB, 9.6 KB average** |
| Card disclaimer removed | `yocoName` === `BRAND.name`, so the branch is dormant | **confirmed, and correctly derived** |
| Renders with Google Fonts blocked | browser test with `fonts.*` aborted | **confirmed** |
| Quantity normalisation | `Math.max(0,Math.min(99,Math.floor(q)||0))` | **confirmed** |
| Pre-order totals split | browser test, mixed and pre-order-only baskets | **confirmed** |

The build-time integrity claims hold. One cosmetic note: `Ford Genuine Parts V8` appears twice
under different codes. Two plates can legitimately share a printed name, so this is worth a
glance rather than a fix.

---

## Fixed on this branch

### 1. Order reference collided at minute resolution — was blocking

`ref()` produced `CHEV-YYMMDD-HHMM` with no per-order entropy, so two customers checking out in
the same clock minute received **the same reference**. That matters more here than in a normal
shop: the reference is the sole reconciliation key, it is baked into the Yoco link, and there is
no server-side order record to fall back on. A collision meant two card payments carrying one
reference against two different baskets.

Now `CHEV-YYMMDD-HHMM-XXX`, with three characters drawn from an alphabet that omits B/8, I/1,
O/0, S/5 and Z/2 — 17,576 references per minute, and no character pair that can be misread when
someone reads the reference over the phone or types it into banking.

**This changes the documented format**, so `_readme_claims.mjs`'s reference assertion and the
README both need updating to `CHEV-YYMMDD-HHMM-XXX`.

### 2. A card payment could arrive with no order attached — was blocking

`#bYoco` opened the Yoco link directly. Nothing required the customer to have sent the WhatsApp
message first, so it was possible to pay and never transmit the order — money in the dashboard
under a reference that mapped to nothing.

The button now tracks whether the order was actually sent or copied, and warns before opening
Yoco if it wasn't, quoting the reference. This is a guard, not a cure: the real fix is capturing
the basket server-side (Netlify Forms is free and needs no backend), which is worth the hour and
would also give you an order history you currently don't have.

### 3. Orders could be placed with no delivery address

`#cNote` was an optional field, and `orderText()` emitted `Deliver to:` only `if(note)`. A
customer could send a complete, payable order with nowhere to ship it. Sending now requires an
address whenever something ships immediately; a pre-order-only basket still doesn't ask, because
the address is taken again when stock lands.

### 4. Scrim regression, caught before it shipped

The first version of the address guard called `openPan()`. `.pan` only gets
`position:fixed; z-index:50` inside `@media(max-width:960px)`; above that it is a static sidebar,
so on desktop the call dropped a full-screen `z-index:45` scrim over the entire page. The call
turned out to be dead weight in any case — the buttons that trigger the guard live inside the
panel, so it is already open on mobile and always visible on desktop — and was removed. There is
a regression test for it.

---

## Still open

### 5. Mixed baskets have an unfunded second delivery

`totals()` computes `del = nStock === 0 ? 0 : fee`. A pre-order-only basket correctly carries no
fee, but a **mixed** basket charges R99 once and ships twice — in-stock now, pre-order later. The
second courier leg is unfunded, and nothing in the customer-facing copy says which to expect.

Two defensible answers, both copy-only: hold the whole order and ship together, or ship in stages
and quote the second fee on confirmation. Pick one and put it in the footnote and next to the
pre-order tag. This is undecided rather than wrong, but a customer will hit it.

### 6. "Locked" is UI-only, not wire-level

`yocoURL()` builds `?amount=<total>&reference=<ref>`. Yoco renders both as locked text, but they
are query parameters: a customer can edit `amount` in the address bar and pay R1 with a perfectly
valid reference. Reconciliation must check **amount as well as reference** before dispatch.
Worth stating in the README, because "the reference always matches" reads as "nothing to check".

The locked-rendering behaviour is also observed, not contracted. If Yoco changes it, the failure
is silent — customers land on the R0.00 page. Make the live card test recurring, not a one-off.

### 7. `soldOut` needs a redeploy, and the stepper allows 99

`soldOut` is `[]` on the live site, so nothing is currently marked sold. Marking a plate sold
means editing `BRAND`, re-zipping and redeploying; until then it stays purchasable. The stepper
permits 99 of any code.

Both are fine if stock is deep. **If it is often 1–3, the cap should drop and `soldOut` should
become a per-code quantity map rather than an array** — otherwise you will take money for plates
you cannot ship. Needs Drikus's answer on typical stock depth.

### 8. Publishing the bank account number — concrete mitigation

The exposure was flagged without a remedy. The practical one: call FNB and place a **debit order
block / DebiCheck-only instruction** on account 6307 4689 771, so no unauthenticated debit can be
collected. One phone call, and it neutralises most of the risk of publishing the number.

PayShap plus the card button already covers most customers; the EFT block is the only piece
creating exposure, and it could be supplied on request over WhatsApp instead. **Block the debits
either way**, then decide on visibility separately.

### 9. Image mapping is positional and only spot-verified

558 photos mapped by page and reading order. Counts match exactly, which is real evidence, but a
single page with 11 or 13 extractable images shifts every subsequent plate by one — and
558-codes/558-images still passes in that case. Cost of being wrong is a customer receiving a
different plate from the one pictured.

Cheapest meaningful hardening: verify the **first and last image on every page**, where an
off-by-one inside a page's reading order must surface.

---

## Deploy pipeline

Live response headers confirm what a drag-and-drop deploy sends:

```
strict-transport-security: max-age=31536000; includeSubDomains; preload   <- present (Netlify default)
x-frame-options            <- absent
content-security-policy    <- absent
referrer-policy            <- absent
```

`X-Frame-Options` matters on a page that displays banking details, since without it the page can
be framed by a lookalike site. `netlify.toml` in this repo sets all three, plus immutable caching
for `img/` and no-store for `index.html`.

It takes effect once the Netlify project is linked to this repo (**Site configuration → Build &
deploy → Link repository**, publish directory `site`). That also retires the offsite-copy to-do,
replaces re-zip-and-drag with `git push`, stops the Private→Public flip after every drop, and
makes every past version redeployable.

---

## Tests

`test/_verify.mjs` — 18 browser checks via Playwright against `site/`, covering the three fixes,
the scrim regression, and the documented behaviour they must not break (R198 + R99 = R297, the
pre-order split, the disabled card button and withheld copy link, Yoco amount and reference
matching the panel, rendering with Google Fonts blocked). All green.

Run with `node test/_verify.mjs`. This complements `_readme_claims.mjs` and `_chev_regress.mjs`
rather than replacing them; those two aren't in this repo and should be committed alongside it,
at which point all three can run in CI on every push.

---

## Suggested order of work

| # | Action | Cost | Blocking a real order? |
|---|---|---|---|
| 1 | Register ShapID against 064 943 7890 | phone call | **yes** |
| 2 | Live R1 card test; confirm amount *and* reference land | 10 min | **yes** |
| 3 | Update README + `_readme_claims.mjs` for the new reference format | 10 min | **yes** |
| 4 | Capture the basket server-side (finding 2, proper fix) | ~1 hour | strongly advised |
| 5 | Debit-order block on the FNB account (finding 8) | phone call | no, but do it now |
| 6 | Decide mixed-basket delivery, write the copy (finding 5) | copy only | no |
| 7 | Confirm stock depth; adjust cap if shallow (finding 7) | depends | no |
| 8 | Link Netlify to this repo | ~30 min | no |
| 9 | Page-boundary image verification (finding 9) | ~1 hour | no |
| 10 | Full end-to-end test order | 20 min | final gate |

Items 1–3 close before the site takes a real order. Still open beyond this list, unchanged: a
real domain and a courier agreement.

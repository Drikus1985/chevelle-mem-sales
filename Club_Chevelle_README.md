# Club Chevelle — Metal Plate Catalogue & Order App

**Live:** https://club-chevelle.netlify.app
**Source:** `site/` in this repository — `index.html` plus `img/`, 559 files.

558 vintage metal wall plates, every one R99, built from the 53-page PDF catalogue.

---

## The catalogue

All 558 product codes and names were parsed from the PDF and checked against the contents
page, with no missing items across the 14 categories. The 558 embedded photos were extracted,
mapped to codes by page and reading order (12 per page, 1:1), spot-checked against the printed
names, and compressed to 300px WebP thumbnails at 9.6 KB each — 5.24 MB in total.

| Category | Plates | Category | Plates |
|---|---:|---|---:|
| Beer & Cider | 115 | Parking & Warning | 23 |
| Cars & Classics | 105 | Trucks & Tractors | 22 |
| Petrol & Motor Oil | 98 | Route 66 & Road | 17 |
| Spirits & Cocktails | 60 | Music & Bands | 13 |
| Garage & Tyres | 45 | Pin-Up & Humour | 12 |
| Motorcycles | 27 | Kitchen & Recipes | 11 |
| | | Coca-Cola & Soft Drinks | 6 |
| | | Lifestyle & Americana | 4 |

Only 60 plates render at a time, so the page opens on about 576 KB rather than the full 5.24 MB.

---

## Commercial rules

- **Every plate R99**, flat.
- **Delivery R99 flat per order**, anywhere in South Africa. Confirmed 9 August 2026.
- **Delivery time 3–5 working days.**
- **One delivery fee per order, never two.** Sold plates stay visible under a semi-transparent
  SOLD banner and can still be added as pre-orders. Pre-order lines are priced but excluded
  from the payable total and listed separately in the WhatsApp message. A basket mixing
  in-stock and pre-order plates is **held and shipped complete** once the pre-order lands, so
  the single R99 covers it; the panel and the WhatsApp message both say so, and offer to split
  the order on request. A pre-order-only basket carries no delivery fee, because nothing ships.

> Noted and overruled by decision: R99 courier on a R99 plate is a 100% uplift on a
> single-item order. If basket size becomes the problem, free delivery above a threshold lifts
> average order value without cutting the fee. The flat R99 stands unless revisited.

---

## Contact and payment

WhatsApp **064 943 7890** (27649437890). PayShap to the same number, plus **FNB Gold Business
Account 6307 4689 771**, branch **252155 Bedford Gardens**, held by **Get Buzzed (Pty) Ltd
t/a Club Chevelle**.

Card is live. Yoco has no prohibited-goods issue with metal signs, so the app carries a
**Pay by card now** button pointed at https://pay.yoco.com/get-buzzed. The page displays
Club Chevelle with the Chevelle logo, so the earlier GET BUZZED mismatch is resolved and the
in-app disclaimer is gone.

The app appends `?amount=<total>&reference=<ref>`, which Yoco renders as locked text — no
amount box and no reference box for the customer to change. The card reference therefore always
equals the order reference. The same pre-filled link goes into the WhatsApp message and sits
behind the Copy button on the Card row. A pre-order-only basket disables the card button and
withholds the link, so nothing is charged before stock is confirmed.

**The bare page URL is useless — it opens at R0.00 with the payment sections collapsed. Never
send it to a customer.** Every path the app offers builds the full link.

> **Check the amount, not just the reference.** The amount is locked in Yoco's interface, but it
> travels as a URL parameter, so a customer can edit it and pay less with a valid reference.
> Confirm the amount received before dispatch.

---

## Order references

Format **`CHEV-YYMMDD-HHMM-XXX`** — date, time to the minute, then three random characters, e.g.
`CHEV-260816-1302-W7W`.

The three characters exist because the reference is the only thing tying a payment back to an
order. Without them, two customers checking out in the same minute would share a reference and
their payments could not be told apart. The alphabet omits B/8, I/1, O/0, S/5 and Z/2, so a
reference read over the phone or typed into banking cannot come back as a different one.

---

## Order capture

Every order is posted to the Netlify form **`orders`** as it is sent — reference, name, contact,
address, total, shipping state and the full line items. They appear under **Forms → orders** in
the Netlify dashboard.

This exists so a card payment can never arrive with nothing on record saying what it was for.
Capture is fire-and-forget: if it fails, the customer is never blocked and the WhatsApp message
still carries everything. Re-sending the same reference does not create a duplicate row.

Requires the Netlify project to be linked to this repository — Netlify detects the form at
deploy time. Set `captureOrders: false` in `BRAND` to switch it off.

---

## Maintaining it

Everything editable sits in the **`BRAND` object** at the top of the script in
`site/index.html`: name, legal entity, WhatsApp, price, delivery fee and time, the Yoco page URL
and the trading name it displays, PayShap and bank details, `captureOrders`, the footnote, and
`soldOut`.

- **Marking a plate sold:** add its code to `soldOut`, e.g. `soldOut: ["CC-CAR-014"]`. The SOLD
  banner, the pre-order tag, the totals split, the held-shipment note and the WhatsApp message
  all follow automatically. Setting a code's `stock` to 0 does exactly the same thing.
- **Stock levels:** stock runs 1–3 per plate, so the basket is capped at what is on hand.
  `defaultStock` applies to every code not listed in `stock`, and is **1** — guessing high
  means taking money for a plate you cannot ship, while guessing low costs at most one
  marginal sale, and a customer who wants two can ask on WhatsApp. Give the generous codes
  their own entry: `stock: { "CC-CAR-014": 3 }`. When a customer hits the cap the app says
  why and points them at WhatsApp, rather than a stepper that silently refuses.
- **Removing the card button:** clear the `yoco` value and the button, the card row and the card
  note all disappear.
- **The card note is derived, not hard-coded.** If `yocoName` ever stops matching `BRAND.name`,
  the app reinstates the "the page shows X, which is us" disclaimer on its own, so a future
  rename cannot leave stale reassurance on the page.

### Republishing

Commit to this repository and Netlify redeploys. The URL stays the same.

`netlify.toml` sets `X-Frame-Options: DENY` (this page shows banking details, so it must not be
framable by a lookalike site), a Content-Security-Policy, `Referrer-Policy`, immutable caching
for `img/`, and no-store for `index.html`.

---

## Features beyond the catalogue

Search across name, code and category; category tabs with counts; 60-per-batch paging so 558
image cards never render at once; tap-to-zoom lightbox with prev/next arrows and keyboard
navigation; hide-sold toggle; broken-image fallback to the plate name; one-tap copy for every
payment field, with the card row copying the fully pre-filled payment link rather than the bare
page URL; a delivery address requirement on anything that ships now.

---

## Verification

`test/_verify.mjs` — 37 browser checks via Playwright against the shipped `site/`, covering the
reference format and uniqueness, the totals split, the disabled card button and withheld copy
link on a pre-order-only basket, R198 + R99 = R297, the Yoco amount and reference matching the
panel, the held-shipment copy, order capture end to end, the stock cap and its per-code
override, the address requirement, and rendering with Google Fonts blocked. Run with `npm test`.

`test/_catalogue.mjs` — checks the files on disk rather than the running page: every product code
has a thumbnail and every thumbnail belongs to a code, so a build that drops or duplicates one
cannot ship a plate with a broken image. Run with `node test/_catalogue.mjs`.

Both run automatically on every push and pull request via `.github/workflows/verify.yml`, so the
checks no longer depend on anyone remembering to run them.

---

## To do

**Before taking a real order**

1. Register the ShapID against 064 943 7890 in FNB banking, and send an R1 PayShap to confirm it
   lands. PayShap to that number fails until this is done.
2. Run one live R1 card payment. Confirm both the amount and the reference reach the Yoco
   dashboard, and time the payout to FNB.
3. Link the Netlify project to this repository so order capture goes live and the security
   headers take effect.
4. Place a full test order end to end.

**Soon**

5. Call FNB and place a debit-order block / DebiCheck-only instruction on account
   6307 4689 771. The published account number carries the usual SA debit-order fraud exposure;
   this neutralises most of it in one phone call. Then decide separately whether the account
   number stays on the public page — PayShap and card already cover most customers.
6. Fill in `stock` for any plate you hold more than one of. Everything defaults to 1, which is
   safe but conservative.
7. Verify the first and last image on each PDF page. The photo mapping is positional, so a page
   with 11 or 13 extractable images would shift everything after it — and the 558/558 count
   check still passes in that case.

**Then**

8. A real domain, a courier agreement, and an offsite copy — the last of which this repository
   now provides.

---

*Get Buzzed (Pty) Ltd t/a Club Chevelle*

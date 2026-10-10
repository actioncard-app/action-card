# Action Card (working name), prototype PWA

> **⚠️ Disclaimer: this app can be wrong. It is not legal or medical advice.** Always check the original document.
> For medicine, the app only quotes the label and tells you to confirm with a pharmacist; it never gives dosing advice.

**Live prototype:** https://actioncard-app.github.io/action-card/

You point the phone at a document written in a language you can't fully read, and the app gives you a card with:
**document type · deadline (plus days left) · money at stake · the ONE next action · a short reply in the document's language and in yours**.
It is not a translator.

- Stack: Vite 8 + React 19 + TypeScript, vite-plugin-pwa (Workbox generateSW), Tesseract.js 7 (WASM OCR), idb (IndexedDB), jsPDF.
- Everything runs on the device. There's no account, no analytics and no trackers. Photos and cards stay in the browser's storage; OCR runs in the browser.
- AI mode is optional and off by default. The user pastes their own xAI key, which is kept only in that browser's `localStorage` (never in this repo). Only the OCR **text** gets sent, straight to `https://api.x.ai/v1/chat/completions`.
- Languages: English, German, French, Spanish, Italian, Portuguese.

## Run / build / test

```bash
npm install
npm run build          # generates icons + copies OCR assets into public/, type-checks, builds dist/ + service worker (base path /)
npm run build:pages    # same, for a subpath: BASE_PATH=/action-card/ (GitHub Pages project site)
npm run preview        # serves dist/ on http://0.0.0.0:4173
npm run dev            # dev server (service worker is only active in the production build)

npm run test:unit        # relative-deadline cases + image-geometry (page detection, deskew, orientation) + OCR-robustness rule tests + WCAG AA colour-contrast check of the light and dark themes (no OCR)
npm run test:ui:screens  # APP_URL=... TAG=after: UI screenshots (iPhone 14 WebKit + Pixel 7 Chromium, light + dark) into test-results/ui-redesign/
npm run test:rules       # fast loop: rule extractor on cached OCR text (test-results/ocr-text.json)
npm run test:rules:ci    # same on the committed fixtures (clean samples + simulated phone photos); fails on any regression (runs in CI)
npm run test:ocr         # real OCR accuracy: headless Chromium drives the BUILT app on :4173, all sets
npm run test:e2e         # 79 end-to-end checks (incl. trust panel, 44px tap targets, dark mode, CSP, reload survival, multi-page, sample, UI language), Chromium + Pixel 7 emulation (serves dist/ itself on :4180/:4181)
npm run test:e2e:webkit  # same suite, Playwright WebKit + iPhone 14 emulation
npm run test:e2e:subpath # builds with BASE_PATH=/action-card/ into dist-sub/ and runs the suite in Chromium AND WebKit under /action-card/
npm run test:pwa         # PWA audit in Chrome via CDP (installability, manifest, icons, iOS tags, SW control)
LIVE_URL=https://actioncard-app.github.io/action-card/ npm run test:e2e   # run the e2e suite against the deployed site
npm run make-new-docs    # regenerate the 'new' blind set (other sets: scripts/make_*_docs.py)
npm run make-phone-photos # 76 simulated phone photos of the samples into test-docs/phone/ (needs opencv-python + numpy)
APP_URL=http://localhost:4173/ npm run test:ocr:phone   # real OCR accuracy on the simulated phone photos
npm run make-rotated-photos # 38 of those photos turned 90/180/270 deg into test-docs/phone-rotated/ (needs opencv-python)
APP_URL=http://localhost:4173/ npm run test:ocr:rotated # real OCR accuracy on the sideways / upside-down photos
```
The tests use `/usr/bin/google-chrome` for Chromium (set `CHROME_PATH` to change it) and Playwright's WebKit build
(`npx playwright install webkit`, plus `npx playwright install-deps webkit` on Linux). Outputs go to `test-results/`, screenshots to `screenshots/`.
**The sample images (`test-docs/*.png|jpg`) are not in this repository** (binary files); regenerate them with `pip install pillow numpy` and the `scripts/make_*_docs.py` scripts before running `test:ocr` or the e2e suite. `test-docs/expected.json` (the answer key) is committed.

**Base path.** `BASE_PATH` (default `/`) sets Vite's `base`. The manifest `start_url`/`scope`/`id`, the service-worker scope,
navigation fallback and runtime-cache rule, the icons, and the Tesseract worker/core/traineddata URLs all derive from it
(`import.meta.env.BASE_URL` in code). The subpath e2e run checks every precached URL and the SW scope are under `/action-card/`.

## Interface

System font stack (no web fonts, no CDN, works offline), one teal accent matching the app icon, rounded cards with soft shadows, inline SVG icons. Light and dark themes follow the phone setting (`prefers-color-scheme`); every text/background colour pair in both themes is checked for WCAG AA 4.5:1 by `tests/ui-contrast.mjs`, and the e2e suite checks every visible control is at least 44x44 px. Big camera and gallery buttons; the card is a focused screen (no tab bar, a Back button) that opens with a "what to do" block on the first screen: deadline and money chips with a plain confidence word (Clear / Check this / Guess), the next action, and Remind me (.ics calendar file, all-day event with an alarm 3 days before) and Share (share sheet or copy); confidence on each field is a coloured dot plus a label; reading shows friendly steps (preparing, orientation & language, reading, building the card) with a progress bar and skeleton; the card has a single fixed bottom action bar (Save / PDF / New scan) respecting iOS safe-area insets. Transitions are short and are switched off for `prefers-reduced-motion`.

Safety: app updates install in the background but the page only reloads when no OCR is running, and the open card is kept in `sessionStorage` so it survives a reload (`src/lib/update.ts`, `src/lib/session.ts`). After the first save the app asks for persistent storage (`navigator.storage.persist`); the Saved list warns that browsers (Safari) may delete data of sites not added to the Home Screen. A Content-Security-Policy meta tag allows only this site plus `https://api.x.ai` (optional AI mode); e2e fails on any CSP violation.

### Free upgrades (10 Oct 2026)

- **Language:** the interface is in English, German, French, Spanish, Italian and Portuguese (`src/lib/i18n.ts`, natural translations, register matching the card templates). First start follows the phone language; Settings → Your language changes it and is saved. `tests/i18n-unit.ts` checks every string exists in all 6 languages with the same placeholders and that no English text is left in the components.
- **Multi-page documents:** "Add page" on the card OCRs another photo, re-reads the card from all pages (your edits are kept), snippets say which page they come from, the full text has page markers, and saved cards, the reload copy and the PDF keep every page (the PDF ends with one photo page per document page). Test doc: `npm run make-multipage-docs`.
- **First run:** a short explainer with "Try a sample document": a made-up German parking ticket drawn on a canvas on the phone (no image file, offline; deadline always 14 days ahead). Settings → About can show it again.
- **Saved list:** Overdue first (most recently missed on top), then Coming up by nearest deadline, then cards without a deadline.
- **Readability:** confidence words are Clear / Check this / Guess everywhere (fields, chips, PDF, screen readers); chip dates use a short one-line format (19 Oct 2026) that fits 320 px; secondary/help text is at least 7:1 contrast in light and dark (checked by `tests/ui-contrast.mjs`); shorter processing screen without the skeleton when the photo preview is shown.
- **Code splitting:** jsPDF, the AI client and the OCR client load on demand (all precached for offline). Initial JS 774 KB → 346 KB (249 → 111 KB gzip).
- **Real photos:** `test-docs/real/` holds real phone photos (first: Ben's iPhone camera view of the test-pack parking ticket, 6/6 fields). Their OCR text is cached in `tests/fixtures/ocr-text-real.json` and checked in `npm run test:rules:ci`. `scripts/prepare_real_photo.py` strips EXIF/GPS and blacks out personal data before a photo is added.

## How it works

1. **Capture**: `<input type="file" accept="image/*" capture="environment">` (camera) plus a second input for the gallery.
2. **Preprocessing** (`src/lib/image.ts`): EXIF orientation, page detection + perspective correction, downscale to 2000 px (or upscale small images), grayscale, shadow and uneven-light flattening (divide by a per-cell paper-brightness map), a **sideways check** (text lines make the row profile much "spikier" than the column profile; if the columns are 1.8x spikier the page is turned 90 deg), deskew, then a contrast stretch.
3. **OCR** (`src/lib/ocr.ts`): Tesseract.js LSTM. The worker, the SIMD core and the `eng/deu/fra/spa/ita/por` traineddata (`4.0.0_best_int`) are served from `/tesseract/…` by the app and precached by the service worker, so nothing comes from a CDN at runtime. In auto-language mode it does a quick English pass, detects the language from stop-words, then does a full pass in that language. If the quick pass looks like junk (confidence under 60% or few real words), the page is also read turned 180 deg and the upside-down version is kept only if it gives clearly more real words. (Tesseract's own orientation detection, OSD, needs the legacy engine plus `osd.traineddata`, about 10 MB more to download and a bigger core, so this cheap check is used instead.) Progress is shown while it runs.
   *Google ML Kit can't be used here: its text recognition only exists as native Android/iOS SDKs.*
4. **Extraction, offline rules** (`src/lib/extract/`): multilingual keyword scoring for the doc type. Dates are parsed in `dd.mm.yyyy`, `dd/mm/yyyy`, `yyyy-mm-dd`, written months in 6 languages, `mm/yyyy` expiry, and US `mm/dd/yyyy` when `$` is present. The deadline is picked by the nearest cue word (bis, until, avant, antes de, entro, até, spätestens, EXP, …), and negative cues (Tatzeit, arrival, letter dateline…) count against a date. Money is found from currency symbols/codes, with per-doc-type "stake" cues (penalty, deposit, Gesamtbetrag, fianza…). The reference number comes from labelled case/booking numbers (also when a two-column layout puts the label and the number on different lines). Itemised tables: if a "Total"/"Gesamtbetrag" line equals the sum of the amounts above it, the total is used unless the pick is a deposit/penalty and the text never refers to the total.
   **Relative deadlines** (`src/lib/extract/relative.ts`): "within 14 days", "innerhalb von zwei Wochen", "dans un délai de 15 jours", "en un plazo de 20 días hábiles", "entro 60 giorni", "no prazo de 30 dias", "48 hours before arrival", "7 Tage vor Mietbeginn"… (number words in 6 languages; days/weeks/months/hours; working days). The start date is the document's own issue date ("Datum:", "Date d'envoi", "Sent:", a letter dateline like "Lyon, le 30 septembre 2026") or the event date for "before arrival/appointment/move-in". The card shows the math ("1 October 2026 (document date) + 14 days = 15 October 2026") and both source snippets. If no start date is printed, the deadline stays empty and reads "2 weeks after the day you received it (start date unknown, not printed)" with low confidence, and the next action quotes the rule. **Today's date is never used as the start date.** "From receipt/notification" rules are counted from the document date as the earliest possible start, with low confidence and a note. Working days skip weekends only (public holidays are not known). An explicit dated deadline wins over a relative one; the others are listed under "Other deadlines". Next action and reply come from per-type templates in all 6 languages (`src/lib/templates.ts`).
5. **Trust rules**: every value shows the exact OCR line(s) it came from and a high/medium/low confidence. Anything not found shows **"Not found"**: a deadline is only proposed when a cue word supports it, and the other dates/amounts found are listed with a "Use" button. Every field can be edited with a tap. The disclaimer appears at the top and bottom of every card and in the PDF. Medicine labels only quote the label's own dosing text, and the next action is always "confirm with a pharmacist". A warning appears when OCR confidence is below 60%.
6. **AI mode** (`src/lib/ai.ts`): the request uses `response_format: json_schema` (strict). The answer is then validated: enums, real calendar dates, ISO currency, and **every quoted snippet must appear verbatim in the OCR text**. If a snippet can't be found, the AI value for that field is thrown out and the offline value is kept. Any HTTP, JSON or schema error, a timeout, or being offline makes the whole card fall back to the offline rules, with a note saying so. Medicine next actions are never model text. The default model is `grok-4.20-0309-non-reasoning`. Re-checked on 6 Oct 2026: it is still listed on docs.x.ai's models page and in its public model list ($1.25 / $2.50 per 1M input/output tokens), and it is not on the retirement list. xAI recommends `grok-4.7` as its most capable model ($2 / $6); the default stays on the cheaper, faster non-reasoning model for this short extraction task, and it can be changed in Settings. AI mode has never been run against the real API with a real key. Note that xAI now labels Chat Completions as "legacy" and recommends the Responses API; Chat Completions still works and is what this uses.
   **The key goes straight from the phone to xAI. That's OK for a personal prototype, but a public launch needs a server proxy.**
7. **Storage**: IndexedDB keeps the card, a 360 px thumbnail and a 1600 px JPEG of the photo. History supports opening and deleting cards, and Settings can delete everything.
8. **PDF**: jsPDF. It includes all fields, confidence, source snippets, next action, both replies, the full OCR text and the disclaimer. On phones it opens the share sheet (Save to Files etc.); otherwise it downloads.

## Test results (honest version)

The sample documents are synthetic. They're rendered with Pillow, and some have simulated phone effects (rotation, perspective, blur, noise, shadows, glare, low resolution). Real photos of real paper will be harder: curled pages, tiny print, stamps, handwriting.

| Set | What it is | First run (before tuning) | After fixes (final run, 6 Oct 2026) |
|---|---|---|---|
| dev (8 docs) | written together with the extractor | 32/32 core, 48/48 all | 32/32, 48/48 |
| holdout (8 docs) | written after the extractor | **30/32 core (93.8%), 43/48 all (89.6%)** | 32/32, 48/48 |
| fresh (6 docs) | written after the holdout fixes | **23/24 core (95.8%), 33/36 all (91.7%)** | 24/24, 36/36 |
| new (13 docs) | harder: two-column layouts, tables, several amounts incl. early-payment discounts, relative deadlines, skew/glare/shadow, 0.5–0.85x resolution; all 7 types, all 6 languages | **44/52 core (84.6%), 65/78 all (83.3%)** | 52/52, 77/78 |
| stress (3 docs) | deliberately bad photos | 8/12 core, 11/18 all | 8/12, 11/18 (not tuned) |

"Core" = doc type, deadline, amount, currency. "All" adds document language and reference. **The first-run numbers are the better estimate of real accuracy**; "after fixes" numbers no longer measure generalisation because the fixes target the failures seen (they were kept general, e.g. "a Total line that equals the sum of the rows above it", not per-document rules).
The new set's first run was scored after relative-deadline support was added but before any other tuning. Its 8 core misses: 4 amounts (deposit/fee/first row picked instead of a table total; one total lost because a stray margin digit after "€" was read as a separate amount), 3 deadlines (hours-before-arrival split across lines by OCR margin noise; an email "Sent:" date not recognised so a flight date was used as the start date; a dateline after other text on the same OCR line), 1 doc type (eye-drops box not recognised as medicine). The one remaining miss is an OCR error (`KVR-II` read as `KVR-11`). Stress-set failures are unchanged: a tiny blurry photo gives "Not found" everywhere plus the low-quality warning (language misdetected as Portuguese), and a rotated photo misreads one letter of a reference.

### Simulated phone photos (8 Oct 2026)

`scripts/make_phone_photos.py` turns each of the 38 samples into 2 "phone photos" (76 images): page on a table with a border, perspective tilt 5-15 deg, rotation (up to 12 deg), defocus/motion blur, lighting gradient and shadow, noise, JPEG compression, arm's-length low resolution, and some photos of a screen (subpixel grid / moire, glare). Variants of the dev + new documents are the **tuning set** (42 images); variants of holdout + fresh + stress documents are **held out** (34 images) and were not used to choose any fix. Results are from the real app (built, headless Chromium, real Tesseract.js):

| Field | Tuning set before -> after | Held-out before -> after |
|---|---|---|
| doc language | 38 -> 41 /42 | 29 -> 31 /34 |
| doc type | 36 -> 41 /42 | 28 -> 31 /34 |
| deadline | 26 -> 33 /42 | 24 -> 28 /34 |
| amount | 31 -> 34 /42 | 25 -> 28 /34 |
| currency | 39 -> 39 /42 | 28 -> 28 /34 |
| reference | 23 -> 35 /42 | 17 -> 25 /34 |
| **core (type, deadline, amount, currency)** | **78.6% -> 87.5%** | **77.2% -> 84.6%** |

What changed: the image is now flattened before OCR (the page or screen is found by flood-filling the background from the photo edges and perspective-corrected; conservative, so when the outline isn't a clean quadrilateral the whole photo is used), small pages are upscaled up to 1.6x, remaining text rotation up to 20 deg is measured (projection profile, ignoring solid dark areas) and straightened, and a third OCR pass runs only when the full pass clearly reads as a different language than the quick detection pass. Rules: misread keywords are repaired for matching (same-length letter substitutions against the app's own keyword list, e.g. "Ausiinderbehurde"; and rn/m swaps), "§" read as "$" before "Abs."/"StVO" is not money, misread "nº" ("n.9", "n*", "1") before a reference, a label whose code is on the next line in two-column letters, and OCR junk lines / edge symbols are dropped from the text and snippets. The clean sample sets did not regress (core 140/140 excluding stress; stress 8/12 core unchanged, 13/18 all, was 11/18). Rules alone on the OLD OCR text give the same core score (237/304), so the gain comes mainly from the image step. Time per document in desktop headless Chrome, interleaved on 10 photos on a quiet machine: median 2.4 s before, 2.5 s after (preprocessing about 0.3 s); the slowest case (a very low-res photo, upscaled) went from 2.5 s to 4.1 s. Phone timings are unmeasured and will be slower.

### Sideways / upside-down photos, junk amounts, digit misreads (9 Oct 2026)

`scripts/make_rotated_photos.py` takes every second phone photo and turns it 90, 180 or 270 deg (38 images: 13 x 90, 13 x 180, 12 x 270; same tuning / held-out split by source document). Before this change the app had no orientation handling at all:

| Set | Before (core / all) | After (core / all) |
|---|---|---|
| rotated, tuning (21) | 7/84 = 8.3% / 11/126 | **80/84 = 95.2%** / 117/126 |
| rotated, held out (17) | 8/68 = 11.8% / 13/102 | **56/68 = 82.4%** / 84/102 |
| upright phone photos, tuning (42) | 147/168 = 87.5% / 223/252 | **153/168 = 91.1%** / 229/252 |
| upright phone photos, held out (34) | 115/136 = 84.6% / 171/204 | **117/136 = 86.0%** / 173/204 |
| clean sample sets (excl. stress) | 140/140 / 209/210 | 140/140 / 209/210 (no change) |

Orientation was right for 37 of 38 rotated photos (the miss: the tiny blurry stress photo upside down). Rule changes: an impossible month is repaired when exactly one OCR digit confusion gives a valid one ("EXP 62/2028" -> 02/2028), a year far from all the other years in the document is repaired the same way (2076 -> 2026, only if another year appears at least twice) and both are marked **low confidence** with a note; amounts right after a licence-plate / ID / IBAN / phone label are ignored; tiny amounts without decimals ("$1") need a strong money cue, otherwise the field says **Not found**; a lost decimal separator ("£214 60") is repaired with a note; "2.850.00" (comma misread as a dot) is read as 2850.00; if a "Total" line below has no readable amount, the pick gets low confidence. Roman-numeral reference repair (KVR-11 vs KVR-II) was **not** done: it can't be decided safely from the text. Honesty notes: the sideways threshold (1.8) was picked on the tuning photos (upright max 1.17, sideways min 2.47; held-out upright max 1.57, sideways min 1.95); the junk-amount rule was partly prompted by a held-out failure (a Portuguese plate read as "$1"), so that held-out gain is not a clean measurement. Time (interleaved, quiet machine, 14 photos): median 2.4 s before, 2.5 s after; upright photos whose quick pass looks weak get one extra small 180 deg check pass (16 of 76 upright phone photos; +0.4 to +1.1 s each).

**End-to-end (final run):** Chromium + Pixel 7 emulation 43/43 at `/` and 43/43 under `/action-card/`; WebKit + iPhone 14 emulation 42/42 at `/` and 42/42 under `/action-card/`, with 1 check skipped on WebKit (see below). PWA audit 14/14 (root and subpath). Lighthouse 13.5 mobile (simulated throttling): performance 94, accessibility 100, best practices 100, SEO 100 (root and subpath); FCP 2.2 s, LCP 2.6 s, TBT 10 ms, CLS 0. Lighthouse 12+ has no PWA category any more, hence `tests/pwa-audit.mjs`.

**WebKit findings.** (1) Saving failed: WebKit refuses Blobs in IndexedDB in ephemeral/private contexts, so photos are now stored as ArrayBuffer + MIME type (fixes Safari private tabs too; save errors are now shown). (2) Playwright WebKit's `context.route()` does not intercept fetches from a service-worker-controlled page (`tests/diag-webkit-sw-route.mjs`), and one earlier WebKit run sent about 4 mocked-mode requests carrying the fake test key `xai-THIS-IS-A-FAKE-TEST-KEY` and the synthetic sample's OCR text to the real api.x.ai, which rejected them with HTTP 400. The AI-mode tests with a fake key now run in a context with service workers blocked, after a probe proves interception works, and they assert that the number of page requests to api.x.ai equals the number intercepted. (3) Playwright WebKit's `setOffline()` also breaks reading local Blobs (`tests/diag-webkit-offline-blob.mjs`), so on WebKit the offline test stops the server instead (the SW must serve everything) and the "AI on + offline" check is skipped. **WebKit emulation is not a real iPhone:** no real camera, share sheet, iOS storage eviction or home-screen PWA shell were tested.

Accuracy reports (`test-results/accuracy-report-*.txt`), e2e JSON per engine, `pwa-audit*.json` and Lighthouse output are written to `test-results/` when you run the tests; they are not committed.

## Trust panel (10 Oct 2026)

Four ideas taken from the "Due & Do" prototype, all offline and rule-based (`src/lib/trust.ts`, `src/lib/steps.ts`, `src/components/TrustPanel.tsx`):

- **Who pays**: the money field is classified as You pay / Refund to you / Deposit (returnable) / Fee or charge, from keywords in 6 languages on the amount's line (Clear), the line next to it (Check this) or two lines away (Guess). No keyword means **Unclear**; it never guesses. Shown on the summary chip and under the money field with the words it is based on. Wording like "no payment is required" / "keine Zahlung" is detected and quoted.
- **Steps**: 2-4 concrete steps per document type (card language, 6 languages), tickable. Ticks are stored on the card (`card.stepsDone`), written straight to the saved copy, and included in the PDF and Share text.
- **What needs checking?**: automatic list of gaps: no deadline, start date not printed, deadline counted from receipt, deadline guess, repaired or ambiguous date, appointment instead of deadline, no amount, amount guess, unclear who pays, no reference, no way to reply/pay found (address, email, website, IBAN...), low OCR confidence, unknown document type. Edited fields are never flagged. Also in the PDF.
- **Meaning (approximate)**: under each quoted snippet (only when the document is not in your interface language): a sentence built from the value the app read ("You are asked to pay €35.00") plus a glossary of words it recognised in the snippet ("Verwarnungsgeld" = fine). It is labelled as approximate and is **not a translation**. AI mode does not add a translation (not implemented).
- Tagline "Understand it. Know what's due. Get it done." under the home headline (translated).

Money-direction accuracy on cached OCR text (`npm run test:rules:ci`, answer keys `moneyDirection` in the `expected.json` files; documents without an amount are not scored). Every miss is "Unclear"; a wrong direction shown as fact: **0** in all sets.

| set | tuning | held-out |
|---|---|---|
| clean synthetic (38) | 19/19 | 13/14 (holdout + fresh + stress) |
| simulated phone photos (76) | 35/38 | 23/28 |
| rotated phone photos (38) | 17/19 | 11/14 |
| real iPhone photo (1) | - | 1/1 |

Caveat: the labels were written after reading all document texts, and the keyword lists are general but were checked against the tuning set; held-out documents were not used to tune.

## Known weaknesses

- Who pays: keyword based. Wording that is far from the amount, or an amount picked wrongly, gives "Unclear". "Fee or charge" vs "You pay" is a judgement: fees you must actively pay (fines, visa fees) count as "You pay", charges that are applied to you (late-cancellation penalties) as "Fee or charge". A deposit you have to transfer shows as "Deposit".
- Meaning (approximate) is not a translation: it only covers the value the app read and words in its glossary (about 150 terms).

- Rules are keyword heuristics. New phrasings, unusual layouts or other countries' formats will be missed. Usually that shows up as "Not found", but it can also pick the wrong date or amount, so the snippet always needs checking.
- "Money at stake" is a judgement call (full fine vs early-payment reduction, penalty vs total stay, refund vs compensation). The app picks one and lists all the amounts it found.
- Relative deadlines: "from receipt/notification" can only be estimated from the document date (earliest possible); public holidays are not counted for working days; "N hours before" is rounded to whole days on the early side.
- US vs European day/month order can be ambiguous. These dates are flagged and get lower confidence.
- Auto language detection needs a reasonable amount of text. Very short or garbled text can be misdetected; pick the language manually in that case.
- The interface is translated into all 6 languages, but a few technical texts still come out in English: field notes from the extractor (e.g. "Detected from common words in the text"), the relative-deadline calculation line, and the start-date label inside it. A card keeps the language it was made in if you switch language later.
- Multi-page: each page is OCR'd separately and the card is re-read from all pages; there is no way yet to remove or reorder a page (start a new scan instead).
- First install downloads about 15 MB (OCR core plus 6 language files). OCR speed on real phones hasn't been measured; it's about 1.5–3 s per page in desktop headless Chrome.
- Simulated phone photos are not real photos: every simulated photo has a visible table border, so page detection almost always succeeds there (75 of 76). Real photos where the page fills the frame, runs off the edge, or lies on a white or cluttered surface fall back to the whole photo plus deskew. Orientation is a cheap heuristic, not Tesseract OSD: very blurry or nearly empty pages can stay sideways/upside down. Repaired digits (months/years) are guesses and are always shown with low confidence.
- iOS: service worker, camera input and Add to Home Screen need **HTTPS** (localhost is exempt). One real iPhone test so far (Safari, German parking ticket off a screen, all fields correct; now a regression case in `test-docs/real/`). Not tested on Android.

## Hosting notes

Any static host works (serve the build output). Requirements: HTTPS, and `sw.js` should not be cached for long. The `.traineddata.gz` files can be served with or without `Content-Encoding: gzip`, because Tesseract.js detects either. The app has no client-side routes, so no SPA rewrite is needed.

**GitHub Pages:** `.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, unit tests, the rule-extractor regression test, `npm run build:pages` (base path `/action-card/`), then deploys `dist/` with the official Pages actions. Repository setting needed once: Settings → Pages → Source = **GitHub Actions**.

**Repository contents.** No binary files are committed. The icons are generated at build time by `scripts/make-icons.mjs` (dependency-free Node), the OCR files are copied from npm packages by `scripts/copy-ocr-assets.mjs` (`public/tesseract/worker.min.js` from `tesseract.js`; `core/tesseract-core-{simd-,}lstm.wasm.js` from `tesseract.js-core`, with the WASM embedded; `lang/{eng,deu,fra,spa,ita,por}.traineddata.gz` from `@tesseract.js-data/*` `4.0.0_best_int`). Not in the repo: the 38 synthetic sample images and the screenshots.

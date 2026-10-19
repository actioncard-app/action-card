# App Store listing (LetterScan 1.0)

Applied to App Store Connect through the API on 19 Oct 2026. Not submitted for review.

| Field | Value |
|---|---|
| Name | LetterScan: What To Do |
| Subtitle | Foreign paperwork, decoded |
| Primary category | Utilities |
| Price | Free (all territories except China mainland, which needs an ICP filing) |
| Age rating | 4+ (every questionnaire answer "None"/"No") |
| Copyright | 2026 Benjamin Ferguson |
| Support URL | https://actioncard-app.github.io/action-card/support.html |
| Privacy policy URL | https://actioncard-app.github.io/action-card/privacy.html |
| Content rights | Does not use third-party content |
| Keywords | `foreign,letter,deadline,fine,parking,ticket,visa,residence,expat,document,scan,mail,notice,refund` |

## Promotional text
Photograph a letter in a language you can't fully read. See the deadline, the money at stake and the next step, each with the text it came from. Works offline.

## Description
Got a letter, fine or notice in a language you can't fully read? Take a photo. LetterScan reads it on your iPhone and turns it into one simple card:

• The deadline, with a countdown
• The money at stake: a fine, fee, deposit or refund
• The one next step to take
• The exact text from the document that each value came from, so you can check it yourself

WORKS BEST WITH
• Parking and traffic fines
• Hotel and airline cancellations
• Visa, residence and entry letters
• Rental move-in sheets
• Medicine labels (expiry date; never dosing advice)

It reads documents in English, German, French, Spanish, Italian and Portuguese. The app's screens are also available in Turkish, Polish, Russian, Ukrainian and Arabic (card texts are in English for those).

MORE
• Letter has more pages? Add them to the same card
• Open PDFs from Files or Mail
• A step-by-step checklist you can tick off
• A short, polite reply in the document's language and in yours
• Things to double-check: signs that also appear in fake letters, such as gift-card payments or a link that hides where it goes
• Links to free help services for letters, debts and scams
• Reminders before the deadline, as notifications on your iPhone
• Save cards on your phone, export a card as a PDF or share it
• Tap any value to correct it
• A made-up sample letter to try it out

PRIVATE BY DESIGN
• No account, no ads, no analytics, no trackers
• Text recognition runs on your iPhone, so it works offline
• Photos and saved cards stay on your phone

OPTIONAL AI MODE (OFF BY DEFAULT)
If you have your own xAI API key, you can turn on AI mode in Settings. Before anything is sent, the app asks for your permission and explains what is shared. With AI mode on, the text read from a document (never the photo) goes straight from your iPhone to xAI to help fill in the card. Every value must quote text that is really in the document; anything else falls back to the built-in offline rules.

IMPORTANT
LetterScan is not a translator and not legal, financial or medical advice. It can be wrong, so always check every date and amount against the original document. For medicine, follow the label and ask a pharmacist or doctor.

## Review notes
LetterScan needs no account or login, and has no in-app purchases.

How to test: on the Scan tab, tap "Try a sample document" (a made-up German parking ticket that ships with the app; works offline), or photograph or pick any letter. The app reads the text on the device (Apple Vision text recognition) and shows the deadline, the amount and the next step, each with the source text. Cards can be saved (Saved tab), exported as PDF or shared. "Remind me" asks for notification permission and schedules local notifications only.

Optional AI mode (Settings > AI mode): off by default, and the app works fully without it. It is only for users who already have their own xAI API key (from console.x.ai); we do not provide a key, run no server and receive no data. Turning the switch on first shows a consent screen that explains that the text read from each scanned document (never the photo) will be sent from the phone to xAI (api.x.ai) using the user's own key, that documents can contain personal details, and that xAI's terms and privacy policy apply. Nothing is sent unless the user taps "Agree and turn on"; Cancel leaves AI mode off. AI mode can be turned off at any time, and without a key the app simply uses its offline rules. No reviewer action or key is needed to review the app.

Privacy policy: https://actioncard-app.github.io/action-card/privacy.html

## App Privacy (set by hand in App Store Connect: App Privacy)
Recommended answer: **Data Not Collected**.
- The developer runs no server and receives nothing; there are no analytics, ads or tracking SDKs.
- Photos, OCR text, cards, settings and the optional xAI key stay on the device.
- Optional AI mode (off by default, explicit consent): the OCR text, today's date and the chosen language go from the
  device straight to xAI with the user's own API key, under the user's own agreement with xAI. The developer has no
  access. Apple counts data as "collected" only when the developer or its partners can access it, so this is not
  collection by the developer. If Ben prefers the most conservative label instead: Data types > User Content >
  "Other User Content": used for App Functionality, not linked to the user, not used for tracking.
- Tracking: No.

## Screenshots
Made on the iOS Simulator by `.github/workflows/ios-screenshots.yml` (6.9" iPhone, 1320x2868) from the fake letters in
`src/lib/shots-letters.ts`, processed by the app's normal on-device pipeline.

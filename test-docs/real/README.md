# Real phone photos (regression set)

Photos taken with a real phone camera, not generated. Each one is a regression case: `expected.json` holds the
correct values and `tests/fixtures/ocr-text-real.json` caches the OCR text so `npm run test:rules:ci` re-checks the
rules on every build without needing the images.

| file | what | source |
|---|---|---|
| `de_parking_ticket_iphone_frame.jpg` | test-pack German parking ticket shown on a computer screen, photographed sideways on an iPhone (9 Oct 2026) | frame from Ben's screen recording, cropped to the camera viewfinder. It is a downscaled screenshot of the live camera preview, so it is softer than a real saved photo. Fake document, no personal data. Result: 6/6 fields correct. |

## Adding a photo

1. Only use documents you may share. Black out names, addresses, plates, account numbers, signatures and anything
   else personal, plus other apps visible on screen.
2. `python3 scripts/prepare_real_photo.py IN.jpg test-docs/real/<lang>_<type>_<date>.jpg --crop ... --blur ...`
   (drops EXIF/GPS, blacks out regions, downscales). Look at the output before committing.
3. Add the expected values to `expected.json` (same format as `test-docs/expected.json`, `"set": "real"`).
4. Serve a build and run `npm run test:ocr:real`, then copy `test-results/ocr-text-real.json` to
   `tests/fixtures/ocr-text-real.json` and raise the `--min-core/--min-all` numbers for the real set in `test:rules:ci`.

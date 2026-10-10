// "Try a sample": a made-up German parking ticket drawn on a canvas on the phone itself, so it needs no image file,
// no download and works offline. The payment deadline is always 14 days from today so the card shows a live countdown.
// Names, plate and numbers are invented.

export function sampleDeadline(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
}
const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

export function sampleLines(now = new Date()): { title: string; lines: string[] } {
  const seen = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
  return {
    title: 'Verwarnung mit Verwarnungsgeld',
    lines: [
      'Stadt Beispielstadt - Ordnungsamt',
      'Aktenzeichen: 512.07.330184.9',
      '',
      `Tattag: ${dmy(seen)}, 09:40 Uhr`,
      'Tatort: Marktplatz 4, Beispielstadt',
      'Kennzeichen: BS-XY 42 (Beispiel)',
      'Tatvorwurf: Parken ohne gültigen Parkschein',
      '',
      'Verwarnungsgeld: 35,00 €',
      '',
      `Bitte überweisen Sie den Betrag bis zum ${dmy(sampleDeadline(now))}`,
      'unter Angabe des Aktenzeichens.',
      '',
      'Mit freundlichen Grüßen',
      'Ihr Ordnungsamt (MUSTER - kein echtes Schreiben)',
    ],
  };
}

export async function makeSampleFile(now = new Date()): Promise<File> {
  const W = 1240, H = 1500;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fcfbf8'; g.fillRect(0, 0, W, H);
  const { title, lines } = sampleLines(now);
  g.fillStyle = '#14285a'; g.font = 'bold 44px Arial, Helvetica, "DejaVu Sans", sans-serif';
  g.fillText(title, 90, 130);
  g.fillStyle = '#191919'; g.font = '34px Arial, Helvetica, "DejaVu Sans", sans-serif';
  let y = 230;
  for (const ln of lines) { if (ln) g.fillText(ln, 90, y); y += 56; }
  const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('canvas'))), 'image/png'));
  return new File([blob], 'sample-parking-ticket.png', { type: 'image/png' });
}

const INTRO_KEY = 'actioncard.intro.v1';
export const introSeen = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return true; } };
export const setIntroSeen = (seen: boolean) => { try { if (seen) localStorage.setItem(INTRO_KEY, '1'); else localStorage.removeItem(INTRO_KEY); } catch { /* ignore */ } };

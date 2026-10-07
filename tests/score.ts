export const FIELDS = ['docLanguage', 'docType', 'deadline', 'amount', 'currency', 'reference'] as const;
export interface Got { docLanguage: string | null; docType: string | null; deadline: string | null; amount: number | null; currency: string | null; reference: string | null; conf?: Record<string, string | null>; snippets?: Record<string, string | null> }
export interface Row { file: string; results: Record<string, { ok: boolean; expected: unknown; got: unknown }>; got: Got }

export function scoreCard(file: string, e: any, got: Got): Row {
  const results: Row['results'] = {};
  for (const f of FIELDS) {
    const exp = e[f] ?? null;
    const g = (got as any)[f] ?? null;
    let ok: boolean;
    if (f === 'amount') ok = exp === null ? g === null : g !== null && Math.abs(g - exp) < 0.005;
    else if (f === 'reference') ok = exp === null ? g === null : g !== null && String(g).replace(/\s/g, '') === String(exp);
    else ok = exp === g;
    results[f] = { ok, expected: exp, got: g };
  }
  return { file, results, got };
}

export function printReport(rows: Row[], verbose = false) {
  let ok = 0, total = 0;
  const core = ['docType', 'deadline', 'amount', 'currency'];
  let coreOk = 0, coreTotal = 0;
  for (const r of rows) {
    const parts = FIELDS.map((f) => {
      const x = r.results[f];
      total++; if (x.ok) ok++;
      if (core.includes(f)) { coreTotal++; if (x.ok) coreOk++; }
      return x.ok ? `${f}:OK` : `${f}:WRONG(exp ${JSON.stringify(x.expected)} got ${JSON.stringify(x.got)})`;
    });
    console.log(`${r.file}\n   ${parts.join('  ')}`);
    if (verbose && r.got.conf) console.log('   conf', JSON.stringify(r.got.conf), '\n   snippets', JSON.stringify(r.got.snippets));
  }
  console.log(`\nCore fields (docType, deadline, amount, currency): ${coreOk}/${coreTotal} = ${((100 * coreOk) / coreTotal).toFixed(1)}%`);
  console.log(`All fields (incl. docLanguage, reference): ${ok}/${total} = ${((100 * ok) / total).toFixed(1)}%`);
  return { ok, total, coreOk, coreTotal };
}

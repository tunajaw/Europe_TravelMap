// Explicit, public company websites only. Run manually; never during CI/build.
import { mkdir, writeFile } from 'node:fs/promises';
const companies = {
  db: 'https://www.bahn.de/', ryanair: 'https://www.ryanair.com/ie/en',
  flixbus: 'https://www.flixbus.de/', vueling: 'https://www.vueling.com/',
  alsa: 'https://www.alsa.com/', easyjet: 'https://www.easyjet.com/',
  sncf: 'https://www.sncf-connect.com/', 'cd.cz': 'https://www.cd.cz/',
  'wizz air': 'https://www.wizzair.com/', sbb: 'https://www.sbb.ch/',
  pegasus: 'https://www.flypgs.com/', ajet: 'https://ajet.com/',
  volotea: 'https://www.volotea.com/', blablacar: 'https://www.blablacar.com/',
  costa: 'https://www.costacruises.com/', ns: 'https://www.ns.nl/',
  ret: 'https://www.ret.nl/', sncb: 'https://www.belgiantrain.be/',
};
const output = new URL('../public/images/companies/', import.meta.url);
await mkdir(output, { recursive: true });
const results = {};
const request = (url) => fetch(url, { signal: AbortSignal.timeout(12000) });
for (const batch of [Object.entries(companies).slice(0, 6), Object.entries(companies).slice(6, 12), Object.entries(companies).slice(12)]) {
  await Promise.all(batch.map(async ([company, website]) => {
    const candidates = [];
    try {
      const response = await request(website);
      if (response.ok) {
        const html = await response.text();
        for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
          if (!/rel\s*=\s*["'][^"']*icon/i.test(tag)) continue;
          const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
          if (href && /\.(png|ico)(?:\?|$)/i.test(href)) candidates.push(new URL(href, response.url).href);
        }
      }
    } catch { /* Try the conventional icon URL next. */ }
    candidates.push(new URL('/favicon.ico', website).href);
    for (const url of [...new Set(candidates)].slice(0, 3)) {
      try {
        const response = await request(url);
        if (!response.ok) continue;
        const bytes = Buffer.from(await response.arrayBuffer());
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const ico = bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]));
        if ((!png && !ico) || bytes.length > 500000) continue;
        const file = `${company.replace(/[^a-z0-9]+/g, '-')}.${png ? 'png' : 'ico'}`;
        await writeFile(new URL(file, output), bytes);
        results[company] = { path: `images/companies/${file}`, website, source: response.url, retrieved: new Date().toISOString().slice(0, 10) };
        console.log(`${company}: ${file}`);
        return;
      } catch { /* A missing icon must not prevent other companies working. */ }
    }
    console.log(`${company}: no verified PNG/ICO; text only`);
  }));
}
await writeFile(new URL('sources.json', output), JSON.stringify(Object.fromEntries(Object.entries(results).sort()), null, 2) + '\n');

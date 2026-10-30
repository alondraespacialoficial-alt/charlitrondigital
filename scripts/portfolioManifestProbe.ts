// Sonda de solo lectura: GET p\u00fablico de current.json por proyecto. Sin cuentas ni escrituras.
// Verifica c\u00f3mo responde Supabase ante un manifiesto inexistente antes de activar la lectura en el build.
import { config as loadEnv } from 'dotenv';
import { PROJECTS } from '../src/data/projects';
import { currentPortfolioManifestUrl, readPortfolioManifest } from '../src/features/projects/portfolioManifest';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const EXPECTED_PROJECT_REF = process.env.PORTFOLIO_AUDIT_PROJECT_REF ?? 'rvvqhpbtqgjpzflopflv';

async function main() {
  const url = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!url) throw new Error('Falta VITE_SUPABASE_URL (.env.local).');
  if (new URL(url).hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`) {
    throw new Error(`La URL no corresponde al proyecto ${EXPECTED_PROJECT_REF}. No se hizo ninguna conexi\u00f3n.`);
  }

  // Respuesta cruda de la misma petición que se clasifica: un solo GET por proyecto.
  const last: { raw?: { status: number; contentType: string; body: string } } = {};
  const takeRaw = () => last.raw;
  const capture: typeof fetch = async (input, init) => {
    const response = await fetch(input, { ...init, method: 'GET' });
    last.raw = {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '(sin content-type)',
      body: (await response.clone().text()).slice(0, 300),
    };
    return response;
  };

  let errors = 0;
  for (const project of PROJECTS) {
    last.raw = undefined;
    const result = await readPortfolioManifest(url, project.slug, capture);
    const raw = takeRaw();
    const detail = result.status === 'ok' ? `versi\u00f3n ${result.manifest.version}` : result.status === 'error' ? `${result.reason} ${result.detail}` : 'objeto inexistente';
    if (result.status === 'error') errors += 1;
    console.log(`GET   ${currentPortfolioManifestUrl(url, project.slug)}`);
    console.log(raw ? `HTTP  ${raw.status} | ${raw.contentType}` : 'HTTP  (sin respuesta)');
    if (raw?.body) console.log(`cuerpo ${JSON.stringify(raw.body)}`);
    console.log(`${result.status.toUpperCase().padEnd(6)} ${project.slug} \u2014 ${detail}`);
    console.log('');
  }
  console.log(errors === 0 ? '\nTodas las respuestas se clasificaron (ok o ausente).' : `\n${errors} respuesta(s) NO clasificadas como ok/ausente: revisar antes de activar.`);
  process.exitCode = errors === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

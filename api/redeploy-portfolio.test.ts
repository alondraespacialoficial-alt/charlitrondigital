import assert from 'node:assert/strict';
import test from 'node:test';
import handler from './redeploy-portfolio';
import { isPortfolioProductionMainEnvironment } from '../scripts/portfolioPreviewPolicy';

test('portfolio regeneration is enabled only on Vercel Production/main', () => {
  assert.equal(isPortfolioProductionMainEnvironment({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), true);
  assert.equal(isPortfolioProductionMainEnvironment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/portafolio-proyectos-v2' }), false);
  assert.equal(isPortfolioProductionMainEnvironment({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'feat/portafolio-proyectos-v2' }), false);
  assert.equal(isPortfolioProductionMainEnvironment({ VERCEL_ENV: 'development', VERCEL_GIT_COMMIT_REF: 'main' }), false);
});

test('Preview regeneration rejects before Supabase or hook fetch with fake credentials', async () => {
  const originalEnv = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    PORTFOLIO_DEPLOY_HOOK_URL: process.env.PORTFOLIO_DEPLOY_HOOK_URL,
  };
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_GIT_COMMIT_REF = 'feat/portafolio-proyectos-v2';
  process.env.SUPABASE_URL = 'https://fake-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'FAKE_PREVIEW_KEY';
  process.env.PORTFOLIO_DEPLOY_HOOK_URL = 'https://fake-hook.invalid';
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error('network must not be used by Preview');
  };

  const response = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader() { return this; },
  };

  try {
    await handler({ method: 'POST', headers: { authorization: 'Bearer fake-token' } } as never, response as never);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { ok: false, error: 'production_main_only' });
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
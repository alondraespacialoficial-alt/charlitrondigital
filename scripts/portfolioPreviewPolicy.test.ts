import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPortfolioPreviewEnvironment,
  isPortfolioPublicMediaEnabled,
  isPortfolioPublishEnabled,
  portfolioPilotProject,
  isPortfolioStorageEnabled,
} from './portfolioPreviewPolicy';

test('public manifest reads need Production/main AND the explicit flag', () => {
  const production = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };
  assert.equal(isPortfolioPublicMediaEnabled(production), false);
  assert.equal(isPortfolioPublicMediaEnabled({ ...production, PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'false' }), false);
  assert.equal(isPortfolioPublicMediaEnabled({ ...production, PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'true' }), true);
  for (const environment of [
    { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'otra-rama' },
    {},
  ]) {
    assert.equal(isPortfolioPublicMediaEnabled({ ...environment, PORTFOLIO_PUBLIC_MEDIA_ENABLED: 'true' }), false);
  }
});

test('real Storage is off unless explicitly enabled', () => {
  assert.equal(isPortfolioStorageEnabled({}), false);
  assert.equal(isPortfolioStorageEnabled({ PORTFOLIO_STORAGE_ENABLED: 'false' }), false);
  assert.equal(isPortfolioStorageEnabled({ PORTFOLIO_STORAGE_ENABLED: '1' }), false);
});

test('real Storage can be enabled only for local builds', () => {
  assert.equal(isPortfolioStorageEnabled({ PORTFOLIO_STORAGE_ENABLED: 'true' }), true);
});

test('on Vercel, real Storage needs Production/main AND the explicit flag', () => {
  const production = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };
  assert.equal(isPortfolioStorageEnabled(production), false);
  assert.equal(isPortfolioStorageEnabled({ ...production, PORTFOLIO_STORAGE_ENABLED: 'false' }), false);
  assert.equal(isPortfolioStorageEnabled({ ...production, PORTFOLIO_STORAGE_ENABLED: 'true' }), true);
  const base = { PORTFOLIO_STORAGE_ENABLED: 'true' };
  assert.equal(isPortfolioStorageEnabled({ ...base, VERCEL: '1' }), false);
  assert.equal(isPortfolioStorageEnabled({ ...base, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'otra-rama' }), false);
  assert.equal(isPortfolioStorageEnabled({ ...base, VERCEL: '1', VERCEL_ENV: 'production' }), false);
  assert.equal(isPortfolioStorageEnabled({ ...base, VERCEL_ENV: 'development' }), false);
});

test('no Preview can enable real Storage even with an inherited flag', () => {
  for (const ref of ['feat/portafolio-proyectos-v2', 'main', 'otra-rama']) {
    const environment = { PORTFOLIO_STORAGE_ENABLED: 'true', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: ref };
    assert.equal(isPortfolioStorageEnabled(environment), false, ref);
  }
  assert.equal(
    isPortfolioPreviewEnvironment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/portafolio-proyectos-v2' }),
    true,
  );
});

test('publishing needs real Storage plus its own flag; Preview never publishes', () => {
  const local = { PORTFOLIO_STORAGE_ENABLED: 'true' };
  const production = { ...local, VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };
  assert.equal(isPortfolioPublishEnabled(local), false);
  assert.equal(isPortfolioPublishEnabled({ ...local, PORTFOLIO_PUBLISH_ENABLED: 'true' }), true);
  assert.equal(isPortfolioPublishEnabled({ PORTFOLIO_PUBLISH_ENABLED: 'true' }), false);
  assert.equal(isPortfolioPublishEnabled({ ...local, PORTFOLIO_PUBLISH_ENABLED: 'true', VERCEL: '1' }), false);
  assert.equal(isPortfolioPublishEnabled(production), false);
  assert.equal(isPortfolioPublishEnabled({ ...production, PORTFOLIO_PUBLISH_ENABLED: 'true' }), true);
  assert.equal(
    isPortfolioPublishEnabled({ ...production, VERCEL_ENV: 'preview', PORTFOLIO_PUBLISH_ENABLED: 'true' }),
    false,
  );
});

test('the pilot project limits only local builds; Production manages every project', () => {
  const local = { PORTFOLIO_STORAGE_ENABLED: 'true' };
  const production = { ...local, VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };
  assert.equal(portfolioPilotProject({ ...local, PORTFOLIO_PILOT_PROJECT: ' planeaslp-celebra-tu-evento ' }), 'planeaslp-celebra-tu-evento');
  assert.equal(portfolioPilotProject({ ...local }), '');
  assert.equal(portfolioPilotProject({ PORTFOLIO_PILOT_PROJECT: 'x' }), '');
  assert.equal(portfolioPilotProject({ ...production, PORTFOLIO_PILOT_PROJECT: 'planeaslp-celebra-tu-evento' }), '');
});

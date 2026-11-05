import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {
  aliadosSupabaseBuildConfig,
  aliadosSupabaseWasIgnored,
} from './scripts/aliadosSupabasePolicy.ts';
import {
  isPortfolioPreviewEnvironment,
  isPortfolioPublicMediaEnabled,
  isPortfolioPublishEnabled,
  isPortfolioStorageEnabled,
  portfolioPilotProject,
} from './scripts/portfolioPreviewPolicy.ts';

const isolatePortfolioPreview = isPortfolioPreviewEnvironment(process.env);

export default defineConfig(({mode}) => {
  // Las variables ALIADOS_* no llevan prefijo VITE_: solo entran al bundle por la politica de aliadosSupabasePolicy.
  const aliadosEnv = {...loadEnv(mode, process.cwd(), ''), ...process.env};
  if (aliadosSupabaseWasIgnored(aliadosEnv)) {
    console.warn('[aliados] ALIADOS_SUPABASE_* definidas, pero este entorno no es Production ni Preview de feat/aliados-charlitron: se ignoran.');
  }
  const aliadosAuth = aliadosSupabaseBuildConfig(aliadosEnv);
  return {
    plugins: [react(), tailwindcss()],
    envPrefix: isolatePortfolioPreview ? [] : 'VITE_',
    define: {
      __ALIADOS_SUPABASE_URL__: JSON.stringify(aliadosAuth.url),
      __ALIADOS_SUPABASE_ANON_KEY__: JSON.stringify(aliadosAuth.anonKey),
      __PORTFOLIO_PUBLIC_MEDIA_ENABLED__: JSON.stringify(
        isPortfolioPublicMediaEnabled(process.env),
      ),
      __PORTFOLIO_STORAGE_ENABLED__: JSON.stringify(isPortfolioStorageEnabled(process.env)),
      __PORTFOLIO_PUBLISH_ENABLED__: JSON.stringify(isPortfolioPublishEnabled(process.env)),
      __PORTFOLIO_PILOT_PROJECT__: JSON.stringify(portfolioPilotProject(process.env)),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

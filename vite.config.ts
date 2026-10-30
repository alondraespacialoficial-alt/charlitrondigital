import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {
  isPortfolioPreviewEnvironment,
  isPortfolioPublicMediaEnabled,
  isPortfolioPublishEnabled,
  isPortfolioStorageEnabled,
  portfolioPilotProject,
} from './scripts/portfolioPreviewPolicy.ts';

const isolatePortfolioPreview = isPortfolioPreviewEnvironment(process.env);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    envPrefix: isolatePortfolioPreview ? [] : 'VITE_',
    define: {
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

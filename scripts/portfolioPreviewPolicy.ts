export const PORTFOLIO_PREVIEW_BRANCH = 'feat/portafolio-proyectos-v2';

export function isPortfolioPreviewEnvironment(
  environment: Record<string, string | undefined>,
): boolean {
  return (
    environment.VERCEL_ENV === 'preview' &&
    environment.VERCEL_GIT_COMMIT_REF === PORTFOLIO_PREVIEW_BRANCH
  );
}

export function isPortfolioProductionMainEnvironment(
  environment: Record<string, string | undefined>,
): boolean {
  return environment.VERCEL_ENV === 'production' && environment.VERCEL_GIT_COMMIT_REF === 'main';
}

// Leer manifiestos públicos (cliente y prerender) requiere activación explícita; fusionar no cambia Production.
export function isPortfolioPublicMediaEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  return (
    isPortfolioProductionMainEnvironment(environment) &&
    environment.PORTFOLIO_PUBLIC_MEDIA_ENABLED === 'true'
  );
}

// Opt-in solo para builds locales. Nunca en Vercel (Preview ni Production): activarlo allí requiere cambiar este código.
export function isPortfolioStorageEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  const onVercel = Boolean(environment.VERCEL || environment.VERCEL_ENV);
  return environment.PORTFOLIO_STORAGE_ENABLED === 'true' && !onVercel;
}

// Con Storage real local, publicar exige un segundo indicador explícito; por defecto solo se guardan borradores.
export function isPortfolioPublishEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  return isPortfolioStorageEnabled(environment) && environment.PORTFOLIO_PUBLISH_ENABLED === 'true';
}

// Si se define, el gestor con Storage real solo opera sobre ese proyecto ('' = todos).
export function portfolioPilotProject(environment: Record<string, string | undefined>): string {
  return isPortfolioStorageEnabled(environment) ? (environment.PORTFOLIO_PILOT_PROJECT ?? '').trim() : '';
}

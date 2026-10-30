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

// Opt-in explícito: builds locales (fuera de Vercel) o Production/main. Nunca Preview ni otras ramas.
export function isPortfolioStorageEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  if (environment.PORTFOLIO_STORAGE_ENABLED !== 'true') return false;
  const onVercel = Boolean(environment.VERCEL || environment.VERCEL_ENV);
  return !onVercel || isPortfolioProductionMainEnvironment(environment);
}

// Con Storage real, publicar exige un segundo indicador explícito; por defecto solo se guardan borradores.
export function isPortfolioPublishEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  return isPortfolioStorageEnabled(environment) && environment.PORTFOLIO_PUBLISH_ENABLED === 'true';
}

// Solo local: limita el gestor a ese proyecto ('' = todos). En Production se administran los cuatro.
export function portfolioPilotProject(environment: Record<string, string | undefined>): string {
  const onVercel = Boolean(environment.VERCEL || environment.VERCEL_ENV);
  return isPortfolioStorageEnabled(environment) && !onVercel
    ? (environment.PORTFOLIO_PILOT_PROJECT ?? '').trim()
    : '';
}

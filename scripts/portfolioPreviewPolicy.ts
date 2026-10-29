export const PORTFOLIO_PREVIEW_BRANCH = 'feat/portafolio-proyectos-v2';

export function isPortfolioPreviewEnvironment(
  environment: Record<string, string | undefined>,
): boolean {
  return (
    environment.VERCEL_ENV === 'preview' &&
    environment.VERCEL_GIT_COMMIT_REF === PORTFOLIO_PREVIEW_BRANCH
  );
}

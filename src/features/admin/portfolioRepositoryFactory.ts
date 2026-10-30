import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { createDemoPortfolioRepository, type PortfolioRepository } from './portfolioRepository';
import { createStoragePortfolioRepository } from './portfolioStorageRepository';

export function createConfiguredPortfolioRepository(): PortfolioRepository {
  if (__PORTFOLIO_STORAGE_ENABLED__ && isSupabaseConfigured) {
    return createStoragePortfolioRepository(supabase.storage, undefined, {
      publishEnabled: __PORTFOLIO_PUBLISH_ENABLED__,
      projectSlugs: __PORTFOLIO_PILOT_PROJECT__ ? [__PORTFOLIO_PILOT_PROJECT__] : undefined,
    });
  }
  return createDemoPortfolioRepository();
}

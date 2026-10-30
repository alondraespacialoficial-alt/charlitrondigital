import { PROJECTS } from '../../data/projects';
import {
  cloneDraft,
  createEmptyPortfolioDraft,
  createPublishedVersion,
  type PortfolioProjectDraft,
} from './portfolioModel';

export interface PortfolioPublishedInfo {
  version: number;
  publishedAt: string;
}

export interface PortfolioProjectState {
  draft: PortfolioProjectDraft;
  published: PortfolioPublishedInfo | null;
}

export interface PortfolioRepository {
  readonly mode: 'demo' | 'storage';
  // Solo Storage real: false = publicar está bloqueado; projectSlugs limita los proyectos operables.
  readonly canPublish?: boolean;
  readonly projectSlugs?: readonly string[];
  loadProject(projectSlug: string): Promise<PortfolioProjectState>;
  saveDraft(draft: PortfolioProjectDraft): Promise<PortfolioProjectState>;
  publish(draft: PortfolioProjectDraft, publishedAt: string): Promise<PortfolioProjectState>;
}

export function createDemoPortfolioRepository(): PortfolioRepository {
  const drafts = new Map<string, PortfolioProjectDraft>(
    PROJECTS.map((project) => [project.slug, createEmptyPortfolioDraft(project.slug)]),
  );
  const published = new Map<string, PortfolioPublishedInfo>();

  const stateOf = (projectSlug: string): PortfolioProjectState => {
    const draft = drafts.get(projectSlug);
    if (!draft) throw new Error('Proyecto no encontrado.');
    return { draft: cloneDraft(draft), published: published.get(projectSlug) ?? null };
  };

  return {
    mode: 'demo',
    async loadProject(projectSlug) {
      return stateOf(projectSlug);
    },
    async saveDraft(draft) {
      stateOf(draft.projectSlug);
      drafts.set(draft.projectSlug, cloneDraft(draft));
      return stateOf(draft.projectSlug);
    },
    async publish(draft, publishedAt) {
      stateOf(draft.projectSlug);
      const version = (published.get(draft.projectSlug)?.version ?? 0) + 1;
      createPublishedVersion(draft, version, publishedAt);
      drafts.set(draft.projectSlug, cloneDraft(draft));
      published.set(draft.projectSlug, { version, publishedAt });
      return stateOf(draft.projectSlug);
    },
  };
}
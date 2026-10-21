// Tipos del esquema (supabase/migrations/0001_init.sql) en formato compatible
// con @supabase/supabase-js v2.118 (GenericSchema: Row/Insert/Update +
// Relationships/Views/Functions).
// Mantener alineados con el SQL. Ideal regenerar con:
//   supabase gen types typescript --project-id rvvqhpbtqgjpzflopflv

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export type IdeaStatus = 'new' | 'planned' | 'converted' | 'discarded';

export type FaqItem = {
  question: string;
  answer: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
};

export type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  cover_thumb_url: string | null;
  cover_alt: string | null;
  category_id: string | null;
  author_name: string;
  status: ArticleStatus;
  meta_title: string | null;
  meta_description: string | null;
  faq: FaqItem[];
  cta_text: string | null;
  cta_url: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentIdeaRow = {
  id: string;
  title: string;
  notes: string | null;
  status: IdeaStatus;
  converted_article_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ArticleSourceRow = {
  id: string;
  article_id: string;
  title: string;
  url: string;
  publisher: string | null;
  published_date: string | null;
  created_at: string;
};

// Relación N:M artículos ↔ servicios BTL (migración 0002). El slug referencia
// el catálogo en código (src/data/btl.ts), no una tabla en DB.
export type ArticleBtlServiceRow = {
  article_id: string;
  service_slug: string;
  created_at: string;
};

export type PageViewInsert = {
  path: string;
  article_slug?: string | null;
  referrer?: string | null;
};

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      articles: {
        Row: ArticleRow;
        Insert: Partial<ArticleRow> & Pick<ArticleRow, 'title' | 'slug'>;
        Update: Partial<ArticleRow>;
        Relationships: [
          {
            foreignKeyName: 'articles_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: CategoryRow;
        Insert: Pick<CategoryRow, 'name' | 'slug'> & Partial<CategoryRow>;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      content_ideas: {
        Row: ContentIdeaRow;
        Insert: Pick<ContentIdeaRow, 'title'> & Partial<ContentIdeaRow>;
        Update: Partial<ContentIdeaRow>;
        Relationships: [
          {
            foreignKeyName: 'content_ideas_converted_article_id_fkey';
            columns: ['converted_article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_sources: {
        Row: ArticleSourceRow;
        Insert: Pick<ArticleSourceRow, 'article_id' | 'title' | 'url'> &
          Partial<ArticleSourceRow>;
        Update: Partial<ArticleSourceRow>;
        Relationships: [
          {
            foreignKeyName: 'article_sources_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_btl_services: {
        Row: ArticleBtlServiceRow;
        Insert: Pick<ArticleBtlServiceRow, 'article_id' | 'service_slug'> &
          Partial<ArticleBtlServiceRow>;
        Update: Partial<Pick<ArticleBtlServiceRow, 'service_slug'>>;
        Relationships: [
          {
            foreignKeyName: 'article_btl_services_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_audit_log: {
        Row: {
          id: number;
          user_id: string | null;
          user_email: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          user_id: string;
          user_email?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      feature_flags: {
        Row: { key: string; enabled: boolean; description: string | null; created_at: string };
        Insert: Record<string, never>;
        Update: { enabled?: boolean };
        Relationships: [];
      };
      page_views: {
        Row: {
          id: number;
          path: string;
          article_slug: string | null;
          referrer: string | null;
          created_at: string;
        };
        Insert: PageViewInsert;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
  };
};

-- ============================================================================
-- Charlitron Digital — Motor de Autoridad MVP
-- Migración 0001: esquema editorial + seguridad (RLS) + storage + métricas
--
-- NO APLICAR automáticamente. Revisar y ejecutar manualmente en:
--   Supabase Dashboard → SQL Editor (proyecto rvvqhpbtqgjpzflopflv)
-- o vía `supabase db push` con la CLI vinculada.
--
-- Principios:
--  - RLS habilitado en TODAS las tablas desde el día uno.
--  - Anon (público) solo lee contenido `published` y solo columnas necesarias
--    (la restricción de columnas se hace en el frontend: nunca select('*')).
--  - Escritura exclusiva de admins verificados vía public.is_admin().
--  - Sin service role en frontend. Sin multi-tenant.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper: ¿el usuario autenticado es admin?
--    security definer para evitar recursión de RLS en admin_users.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. admin_users — quién puede operar el panel
--    El primer alta se hace manualmente (ver seed_admin.example.sql).
-- ----------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Un usuario solo puede verse a sí mismo (para que el frontend valide el rol).
create policy admin_users_select_own on public.admin_users
  for select to authenticated
  using (auth.uid() = user_id);

-- Sin políticas de escritura: solo service_role / SQL manual puede insertar.

-- ----------------------------------------------------------------------------
-- 2. categories
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (true);

create policy categories_admin_insert on public.categories
  for insert to authenticated
  with check (public.is_admin());

create policy categories_admin_update on public.categories
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy categories_admin_delete on public.categories
  for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. articles
-- ----------------------------------------------------------------------------
create table if not exists public.articles (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  excerpt          text,
  content          text not null default '',        -- markdown-lite (ver src/lib/markdown.ts)
  cover_image_url  text,                            -- WebP ~1600px
  cover_thumb_url  text,                            -- WebP ~480px
  cover_alt        text,
  category_id      uuid references public.categories (id) on delete set null,
  author_name      text not null default 'Charlitron Digital',
  status           text not null default 'draft'
                   check (status in ('draft', 'review', 'published', 'archived')),
  meta_title       text,
  meta_description text,
  faq              jsonb not null default '[]'::jsonb,  -- [{question, answer}]
  cta_text         text,
  cta_url          text,
  published_at     timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists articles_status_published_idx
  on public.articles (status, published_at desc);
create index if not exists articles_category_idx
  on public.articles (category_id);

alter table public.articles enable row level security;

-- Público: solo publicados. Admin (authenticated): ve todo.
create policy articles_public_read_published on public.articles
  for select to anon
  using (status = 'published');

create policy articles_admin_read_all on public.articles
  for select to authenticated
  using (public.is_admin());

create policy articles_admin_insert on public.articles
  for insert to authenticated
  with check (public.is_admin());

create policy articles_admin_update on public.articles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy articles_admin_delete on public.articles
  for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. content_ideas — pipeline de ideas (interno, nunca público)
-- ----------------------------------------------------------------------------
create table if not exists public.content_ideas (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  notes               text,
  status              text not null default 'new'
                      check (status in ('new', 'planned', 'converted', 'discarded')),
  converted_article_id uuid references public.articles (id) on delete set null,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.content_ideas enable row level security;

create policy ideas_admin_select on public.content_ideas
  for select to authenticated
  using (public.is_admin());

create policy ideas_admin_insert on public.content_ideas
  for insert to authenticated
  with check (public.is_admin());

create policy ideas_admin_update on public.content_ideas
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ideas_admin_delete on public.content_ideas
  for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. article_sources — fuentes/evidencia por artículo
-- ----------------------------------------------------------------------------
create table if not exists public.article_sources (
  id             uuid primary key default gen_random_uuid(),
  article_id     uuid not null references public.articles (id) on delete cascade,
  title          text not null,
  url            text not null,
  publisher      text,
  published_date date,
  created_at     timestamptz not null default now()
);

create index if not exists article_sources_article_idx
  on public.article_sources (article_id);

alter table public.article_sources enable row level security;

-- Público: solo fuentes de artículos publicados.
create policy sources_public_read on public.article_sources
  for select to anon
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_id and a.status = 'published'
    )
  );

create policy sources_admin_read_all on public.article_sources
  for select to authenticated
  using (public.is_admin());

create policy sources_admin_insert on public.article_sources
  for insert to authenticated
  with check (public.is_admin());

create policy sources_admin_update on public.article_sources
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sources_admin_delete on public.article_sources
  for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. admin_audit_log — acciones sensibles (inmutable: sin update/delete)
-- ----------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  user_email text,
  action     text not null,             -- p.ej. 'article.publish', 'category.delete'
  entity     text not null,             -- 'article' | 'category' | 'idea' | 'source' | 'auth'
  entity_id  text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Un admin solo inserta logs a su nombre; solo admins leen.
create policy audit_admin_insert on public.admin_audit_log
  for insert to authenticated
  with check (public.is_admin() and auth.uid() = user_id);

create policy audit_admin_select on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. feature_flags — automatizaciones futuras (todas OFF por defecto)
-- ----------------------------------------------------------------------------
create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

create policy flags_admin_select on public.feature_flags
  for select to authenticated
  using (public.is_admin());

create policy flags_admin_update on public.feature_flags
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.feature_flags (key, enabled, description) values
  ('ai_draft_assist',   false, 'Borradores asistidos por IA (futuro, requiere revisión humana)'),
  ('auto_publish',      false, 'Publicación automática — NUNCA activar sin aprobación explícita'),
  ('auto_social_share', false, 'Difusión automática en redes (futuro)')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 8. page_views — medición mínima, SEPARADA del contenido
--    Sin cookies, sin IP, sin fingerprint. Solo path + referrer.
-- ----------------------------------------------------------------------------
create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  path        text not null,
  article_slug text,
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists page_views_created_idx
  on public.page_views (created_at desc);
create index if not exists page_views_slug_idx
  on public.page_views (article_slug);

alter table public.page_views enable row level security;

-- Cualquiera puede registrar una vista; NADIE anónimo puede leerlas.
create policy page_views_public_insert on public.page_views
  for insert to anon, authenticated
  with check (true);

create policy page_views_admin_select on public.page_views
  for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

drop trigger if exists ideas_set_updated_at on public.content_ideas;
create trigger ideas_set_updated_at
  before update on public.content_ideas
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Storage: bucket público para imágenes del blog (WebP optimizadas
--     en cliente ANTES del upload; sin Image Transformations).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

-- Lectura pública de objetos del bucket.
create policy article_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'article-images');

-- Escritura solo admin.
create policy article_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'article-images' and public.is_admin());

create policy article_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'article-images' and public.is_admin());

create policy article_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'article-images' and public.is_admin());

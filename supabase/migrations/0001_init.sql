-- ============================================================================
-- Charlitron Digital — Motor de Autoridad MVP
-- Migración 0001 (v2, revisión de seguridad/costos): esquema editorial + RLS
-- + storage + métricas + versionado editorial mínimo
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
--  - Sin service role en frontend. Sin multi-tenant. Sin IA. Sin Stripe.
--  - Storage público por URL directa SIN policy de lectura sobre
--    storage.objects (no se expone el listado general de objetos).
--  - Sin inserts anónimos de métricas (se resolverá con endpoint
--    rate-limited o Vercel Analytics en una fase posterior).
--  - Seguridad por COLUMNAS además de filas: anon solo lee las columnas
--    públicas de `articles` (created_by excluido).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. admin_users — quién puede operar el panel.
--    Se crea ANTES que is_admin() (la función la referencia) para mantener
--    la migración limpia y portable en proyectos nuevos.
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
-- 1. Helper: ¿el usuario autenticado es admin?
--    security definer para evitar recursión de RLS en admin_users.
--    search_path fijo para evitar secuestro de esquema.
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

-- Superficie mínima: nadie la ejecuta salvo el rol authenticated (las
-- policies públicas de anon NO la invocan, ver secciones 3 y 6).
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

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

-- Público: solo publicados. No invoca is_admin() → funciona aunque anon no
-- tenga EXECUTE sobre la función.
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

-- Seguridad por COLUMNAS para anon (la RLS limita filas; los grants limitan
-- columnas — no depender del select explícito del frontend como control de
-- seguridad). Se revoca el SELECT general que otorgan los default privileges
-- de Supabase y se conceden solo las columnas públicas necesarias.
-- `created_by` queda EXCLUIDO del acceso anónimo.
-- Authenticated (admin) conserva lectura completa por sus grants de tabla.
-- Las policies de anon solo referencian `status` (incluida abajo) y los
-- embeds públicos usan categories(name, slug) con grant completo: PostgREST
-- y el prerender siguen pudiendo consultar artículos publicados.
revoke select on public.articles from anon;
grant select (
  id, title, slug, excerpt, content,
  cover_image_url, cover_thumb_url, cover_alt, category_id,
  author_name, status, meta_title, meta_description, faq,
  cta_text, cta_url, published_at, updated_at
) on public.articles to anon;

-- ----------------------------------------------------------------------------
-- 4. article_revisions — versionado editorial mínimo (red de seguridad)
--    Snapshot automático del estado ANTERIOR en cada UPDATE/DELETE vía
--    trigger (sección 10). Permite recuperar contenido sobrescrito o
--    borrado por accidente. Sin UI por ahora: recuperación manual con SQL.
--
--    NOTA: article_id SIN foreign key a articles — las revisiones deben
--    sobrevivir al borrado del artículo.
--
--    Recuperación manual (como admin autenticado):
--      select id, title, revision_reason, created_at
--      from public.article_revisions
--      where article_id = '<uuid>' order by created_at desc;
--    y copiar de vuelta las columnas necesarias con un UPDATE a articles.
-- ----------------------------------------------------------------------------
create table if not exists public.article_revisions (
  id               bigint generated always as identity primary key,
  article_id       uuid not null,
  title            text not null,
  slug             text not null,
  excerpt          text,
  content          text,
  cover_image_url  text,
  cover_thumb_url  text,
  cover_alt        text,
  category_id      uuid,
  author_name      text,
  status           text,
  meta_title       text,
  meta_description text,
  faq              jsonb,
  cta_text         text,
  cta_url          text,
  published_at     timestamptz,
  revision_reason  text not null check (revision_reason in ('update', 'delete')),
  changed_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists article_revisions_article_idx
  on public.article_revisions (article_id, created_at desc);

alter table public.article_revisions enable row level security;

-- Lectura solo admin. La escritura la hace ÚNICAMENTE el trigger con
-- security definer (sección 10): no hay policies de INSERT/UPDATE/DELETE
-- para usuarios → las revisiones son inmutables desde la API.
create policy revisions_admin_select on public.article_revisions
  for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. content_ideas — pipeline de ideas (interno, nunca público)
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
-- 6. article_sources — fuentes/evidencia por artículo
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

-- Público: solo fuentes de artículos publicados. No invoca is_admin().
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
-- 7. admin_audit_log — acciones sensibles (inmutable: sin update/delete)
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
-- 8. feature_flags — automatizaciones futuras (todas OFF por defecto)
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
-- 9. page_views — medición SEPARADA del contenido
--    La tabla y la lectura admin se conservan, pero SIN policy de INSERT
--    para anon: no se permiten inserts directos desde el navegador.
--    La recolección pública se resolverá después con un endpoint
--    rate-limited (o Vercel Analytics). Costo y abuso bajo control.
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

create policy page_views_admin_select on public.page_views
  for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 10. Triggers y funciones
-- ----------------------------------------------------------------------------

-- 10a. updated_at automático (articles, content_ideas)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 10b. published_at automático: se fija SOLO la primera vez que un artículo
--      pasa a `published` con published_at NULL. Ediciones posteriores y
--      archivados NO la modifican (preserva fecha original para SEO/schema).
create or replace function public.set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published'
     and new.published_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  return new;
end;
$$;

-- 10c. Versionado editorial: snapshot del estado ANTERIOR en update/delete.
--      SECURITY DEFINER para que la escritura de la revisión no dependa de
--      policies de insert (la tabla no las tiene por diseño).
--      auth.uid() funciona igual bajo definer (lee el claim JWT del request).
create or replace function public.save_article_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.article_revisions (
    article_id, title, slug, excerpt, content,
    cover_image_url, cover_thumb_url, cover_alt, category_id,
    author_name, status, meta_title, meta_description, faq,
    cta_text, cta_url, published_at, revision_reason, changed_by
  ) values (
    old.id, old.title, old.slug, old.excerpt, old.content,
    old.cover_image_url, old.cover_thumb_url, old.cover_alt, old.category_id,
    old.author_name, old.status, old.meta_title, old.meta_description, old.faq,
    old.cta_text, old.cta_url, old.published_at, lower(tg_op), auth.uid()
  );
  return null; -- trigger AFTER: el valor de retorno se ignora
end;
$$;

-- Superficie mínima de funciones: los triggers no requieren EXECUTE
-- (PostgreSQL no verifica EXECUTE en funciones de trigger), así que se
-- revoca todo acceso directo desde la API.
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_published_at() from public;
revoke all on function public.save_article_revision() from public;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

drop trigger if exists ideas_set_updated_at on public.content_ideas;
create trigger ideas_set_updated_at
  before update on public.content_ideas
  for each row execute function public.set_updated_at();

drop trigger if exists articles_set_published_at_insert on public.articles;
create trigger articles_set_published_at_insert
  before insert on public.articles
  for each row execute function public.set_published_at();

drop trigger if exists articles_set_published_at_update on public.articles;
create trigger articles_set_published_at_update
  before update on public.articles
  for each row execute function public.set_published_at();

drop trigger if exists articles_revision_after_update on public.articles;
create trigger articles_revision_after_update
  after update on public.articles
  for each row execute function public.save_article_revision();

drop trigger if exists articles_revision_after_delete on public.articles;
create trigger articles_revision_after_delete
  after delete on public.articles
  for each row execute function public.save_article_revision();

-- ----------------------------------------------------------------------------
-- 11. Storage: bucket PÚBLICO para imágenes del blog (WebP optimizadas
--     en cliente ANTES del upload; sin Image Transformations).
--
--     Las imágenes se sirven por URL pública directa:
--       /storage/v1/object/public/article-images/<path>
--     que NO requiere ninguna policy sobre storage.objects. Por eso NO hay
--     policy de SELECT: así el listado/lectura de storage.objects vía API
--     queda cerrado (menos superficie, menos egress por exploración).
--     Escritura (INSERT/UPDATE/DELETE) solo admin.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

create policy article_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'article-images' and public.is_admin());

create policy article_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'article-images' and public.is_admin());

create policy article_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'article-images' and public.is_admin());

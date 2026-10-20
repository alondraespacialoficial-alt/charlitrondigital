-- ============================================================================
-- Charlitron Digital — Migración 0002: relación N:M artículos ↔ servicios BTL
-- (Fase 3B SEO: blog alimenta el clúster /agencia/* sin tocar código por cada
-- artículo nuevo).
--
-- NO APLICAR automáticamente. Revisar y ejecutar manualmente en:
--   Supabase Dashboard → SQL Editor (proyecto rvvqhpbtqgjpzflopflv)
--
-- IMPORTANTE: migración de EJECUCIÓN ÚNICA (los `create policy` no admiten
-- IF NOT EXISTS). Si necesitas reejecutar, borra antes las policies de esta
-- tabla manualmente.
--
-- Diseño:
--  - service_slug referencia el catálogo en CÓDIGO (src/data/btl.ts →
--    BTL_SERVICES). NO se crea tabla btl_services en DB para no duplicar la
--    fuente de verdad; la integridad se garantiza con CHECK + validación en
--    el admin. Si alguna vez cambian los slugs del catálogo (son URLs
--    públicas: no deberían), hay que actualizar este CHECK.
--  - RLS: anon solo lee relaciones de artículos `published` (mismo patrón
--    probado que article_sources en 0001). Escritura exclusiva admin vía
--    public.is_admin(). Anon NUNCA escribe.
--  - ON DELETE CASCADE: si algún día se borra físicamente un artículo (manual,
--    rol privilegiado), sus relaciones desaparecen con él.
-- ============================================================================

create table if not exists public.article_btl_services (
  article_id   uuid not null references public.articles (id) on delete cascade,
  service_slug text not null check (service_slug in (
    'demostradoras-san-luis-potosi',
    'promotores-san-luis-potosi',
    'edecanes-san-luis-potosi',
    'ejecucion-local-agencias',
    'activaciones-btl-san-luis-potosi',
    'perifoneo-san-luis-potosi',
    'volanteo-san-luis-potosi',
    'produccion-audiovisual-san-luis-potosi'
  )),
  created_at   timestamptz not null default now(),
  primary key (article_id, service_slug)
);

-- Consulta inversa frecuente: "artículos de un servicio".
create index if not exists article_btl_services_slug_idx
  on public.article_btl_services (service_slug);

alter table public.article_btl_services enable row level security;

-- Público: solo relaciones cuyo artículo esté publicado (idéntico a
-- sources_public_read en 0001 §6). No invoca is_admin().
create policy btl_rel_public_read on public.article_btl_services
  for select to anon
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_id and a.status = 'published'
    )
  );

-- Admin autenticado: lectura y escritura completas.
create policy btl_rel_admin_read on public.article_btl_services
  for select to authenticated
  using (public.is_admin());

create policy btl_rel_admin_insert on public.article_btl_services
  for insert to authenticated
  with check (public.is_admin());

create policy btl_rel_admin_update on public.article_btl_services
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy btl_rel_admin_delete on public.article_btl_services
  for delete to authenticated
  using (public.is_admin());

-- Sin grants/revokes por columna: las tres columnas son públicas por diseño
-- y la RLS ya limita las filas. Los default privileges de Supabase dan SELECT
-- a anon/authenticated sobre la tabla; las policies deciden el resto.

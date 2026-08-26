-- ─────────────────────────────────────────────────────────────────────
-- Tedarikçi PPAP Portalı — Supabase kurulumu
-- Bir kez çalıştırılır: Supabase → SQL Editor → yapıştır → Run.
-- Proje: chchaielttnimuuezazb  (ERP girişinin kullandığı proje;
-- kurallar auth.uid() / auth.jwt() ile çalışsın diye aynı projede.)
-- ─────────────────────────────────────────────────────────────────────

-- 1) Tedarikçi kullanıcıları ------------------------------------------
-- Hesabı SİZ açarsınız (Supabase → Authentication → Add user), burada
-- yalnızca hangi tedarikçiye ait olduğu yazılır. Eşleşme e-posta ile:
-- kullanıcı kimliğini elle taşımak gerekmesin.
create table if not exists ppap_kullanici (
  eposta      text primary key,
  tedarikci   text not null,
  ad          text,
  aktif       boolean not null default true,
  olusturma   timestamptz not null default now()
);

-- 2) PPAP projeleri ---------------------------------------------------
create table if not exists ppap_proje (
  id           uuid primary key default gen_random_uuid(),
  tedarikci    text not null,
  parca_no     text,
  parca_ad     text,
  musteri      text,
  seviye       text not null default '3',
  durum        text not null default 'hazirlik',  -- hazirlik|tedarikcide|incelemede|onayli|red
  aciklama     text,
  olusturan    text,
  olusturma    timestamptz not null default now(),
  guncelleme   timestamptz not null default now()
);
create index if not exists ppap_proje_tedarikci on ppap_proje (tedarikci);

-- 3) Proje maddeleri (VDA 2 Anlage 2 kataloğundan) --------------------
create table if not exists ppap_madde (
  id          uuid primary key default gen_random_uuid(),
  proje_id    uuid not null references ppap_proje (id) on delete cascade,
  no          text not null,                    -- 0.1, 3.1.3, 5.4 ...
  ad          text not null,
  grup        text,
  gerekli     boolean not null default false,   -- VDA "Requirement existing"
  gonderim    boolean not null default false,   -- VDA "Submission required"
  durum       text not null default 'bekliyor', -- bekliyor|yuklendi|kabul|red
  yorum       text,                             -- müşteri (biz) yorumu
  ted_yorum   text,                             -- tedarikçi yorumu
  dosyalar    jsonb not null default '[]'::jsonb,
  guncelleme  timestamptz not null default now()
);
create index if not exists ppap_madde_proje on ppap_madde (proje_id);
create unique index if not exists ppap_madde_tek on ppap_madde (proje_id, no);

-- 4) Kurallar (RLS) ---------------------------------------------------
alter table ppap_kullanici enable row level security;
alter table ppap_proje     enable row level security;
alter table ppap_madde     enable row level security;

-- İç kullanıcı = ERP'de onaylı hesap
create or replace function ppap_ic_kullanici() returns boolean
language sql stable security definer as $$
  select exists (select 1 from erp_users u
                 where u.id = auth.uid() and u.approved is true);
$$;

-- Giriş yapan kullanıcının bağlı olduğu tedarikçi
create or replace function ppap_tedarikcim() returns text
language sql stable security definer as $$
  select k.tedarikci from ppap_kullanici k
  where lower(k.eposta) = lower(auth.jwt() ->> 'email') and k.aktif;
$$;

drop policy if exists ppap_kullanici_ic on ppap_kullanici;
create policy ppap_kullanici_ic on ppap_kullanici
  for all using (ppap_ic_kullanici()) with check (ppap_ic_kullanici());

drop policy if exists ppap_kullanici_kendi on ppap_kullanici;
create policy ppap_kullanici_kendi on ppap_kullanici
  for select using (lower(eposta) = lower(auth.jwt() ->> 'email'));

drop policy if exists ppap_proje_ic on ppap_proje;
create policy ppap_proje_ic on ppap_proje
  for all using (ppap_ic_kullanici()) with check (ppap_ic_kullanici());

-- Tedarikçi YALNIZ kendi projelerini görür; proje bilgisini değiştiremez.
drop policy if exists ppap_proje_ted on ppap_proje;
create policy ppap_proje_ted on ppap_proje
  for select using (tedarikci = ppap_tedarikcim());

drop policy if exists ppap_madde_ic on ppap_madde;
create policy ppap_madde_ic on ppap_madde
  for all using (ppap_ic_kullanici()) with check (ppap_ic_kullanici());

drop policy if exists ppap_madde_ted_oku on ppap_madde;
create policy ppap_madde_ted_oku on ppap_madde
  for select using (exists (select 1 from ppap_proje p
                            where p.id = proje_id and p.tedarikci = ppap_tedarikcim()));

-- Tedarikçi yalnızca kendi dosyasını/yorumunu yazar. Kabul/red bizde
-- kalsın diye "durum" yalnız 'yuklendi' yapılabilir.
drop policy if exists ppap_madde_ted_yaz on ppap_madde;
create policy ppap_madde_ted_yaz on ppap_madde
  for update using (exists (select 1 from ppap_proje p
                            where p.id = proje_id and p.tedarikci = ppap_tedarikcim()))
  with check (exists (select 1 from ppap_proje p
                      where p.id = proje_id and p.tedarikci = ppap_tedarikcim())
              and durum in ('bekliyor', 'yuklendi'));

-- 5) guncelleme damgasi -----------------------------------------------
create or replace function ppap_damga() returns trigger
language plpgsql as $$
begin new.guncelleme = now(); return new; end $$;

drop trigger if exists ppap_proje_damga on ppap_proje;
create trigger ppap_proje_damga before update on ppap_proje
  for each row execute function ppap_damga();

drop trigger if exists ppap_madde_damga on ppap_madde;
create trigger ppap_madde_damga before update on ppap_madde
  for each row execute function ppap_damga();

-- 6) Tedarikçi "gönderdim" der: proje durumunu YALNIZ bu yolla degistirebilsin
create or replace function ppap_gonder(p_id uuid) returns void
language plpgsql security definer as $$
begin
  update ppap_proje set durum = 'incelemede'
   where id = p_id and tedarikci = ppap_tedarikcim();
end $$;
grant execute on function ppap_gonder(uuid) to authenticated;

-- 7) Tedarikçi madde satirinda YALNIZ dosya/not/durum degistirebilsin.
-- (RLS sutun bazinda kisitlamaz; korunan alanlar eski degerine dondurulur.)
create or replace function ppap_madde_koru() returns trigger
language plpgsql security definer as $$
begin
  if ppap_ic_kullanici() then return new; end if;
  new.no := old.no; new.ad := old.ad; new.grup := old.grup;
  new.gerekli := old.gerekli; new.gonderim := old.gonderim;
  new.yorum := old.yorum;                       -- musteri yorumu tedarikcide degismez
  return new;
end $$;

drop trigger if exists ppap_madde_koru_t on ppap_madde;
create trigger ppap_madde_koru_t before update on ppap_madde
  for each row execute function ppap_madde_koru();

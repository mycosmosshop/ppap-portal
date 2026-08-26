-- ─────────────────────────────────────────────────────────────────────
-- PPAP portalı — DAVET LİNKİ
-- Tedarikçi hesabını siz açmayın: link gönderin, kendi şifresini belirlesin.
-- Bir kez çalıştırılır (KURULUM.sql'den sonra).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists ppap_davet (
  kod          text primary key,
  tedarikci    text not null,
  ad           text,
  olusturan    text,
  olusturma    timestamptz not null default now(),
  gecerli_son  timestamptz not null default now() + interval '30 days',
  kullanan     text,
  kullanim     timestamptz
);
alter table ppap_davet enable row level security;

drop policy if exists ppap_davet_ic on ppap_davet;
create policy ppap_davet_ic on ppap_davet
  for all using (ppap_ic_kullanici()) with check (ppap_ic_kullanici());

-- Davet kodunun HANGI tedarikciye ait oldugunu soyler. Tabloyu okutmaz:
-- kodu bilmeyen hicbir sey goremez, kodu bilen yalniz firma adini gorur.
create or replace function ppap_davet_bilgi(p_kod text) returns text
language sql stable security definer as $$
  select tedarikci from ppap_davet
   where kod = p_kod and kullanan is null and gecerli_son > now();
$$;
grant execute on function ppap_davet_bilgi(text) to anon, authenticated;

-- Tedarikci hesabini actiktan sonra daveti kullanir: kendi e-postasi
-- tedarikciye baglanir, kod bir daha kullanilamaz.
create or replace function ppap_davet_kullan(p_kod text) returns text
language plpgsql security definer as $$
declare t text; e text;
begin
  e := lower(auth.jwt() ->> 'email');
  if e is null or e = '' then
    raise exception 'Önce giriş yapmalısınız.';
  end if;
  select tedarikci into t from ppap_davet
   where kod = p_kod and kullanan is null and gecerli_son > now()
   for update;
  if t is null then
    raise exception 'Davet geçersiz, süresi dolmuş ya da daha önce kullanılmış.';
  end if;
  insert into ppap_kullanici (eposta, tedarikci, aktif)
       values (e, t, true)
  on conflict (eposta) do update set tedarikci = excluded.tedarikci, aktif = true;
  update ppap_davet set kullanan = e, kullanim = now() where kod = p_kod;
  return t;
end $$;
grant execute on function ppap_davet_kullan(text) to authenticated;

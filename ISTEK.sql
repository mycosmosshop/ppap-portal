-- ─────────────────────────────────────────────────────────────────────
-- Davet: tedarikçi GİRİŞ YAPAMASA BİLE onay kuyruğuna düşsün
--
-- Sorun: kayıt/giriş bir yerde takılırsa ppap_kullanici satırı hiç
-- oluşmuyor, dolayısıyla kalite bölümünün onaylayacağı bir şey de yok.
-- Bu işlev, geçerli bir davet kodu + e-posta ile ONAY BEKLEYEN kayıt
-- açar; daveti TÜKETMEZ (giriş yapınca ppap_davet_kullan devreye girer).
--
-- Güvenli: kayıt aktif=false açılır, portala giriş vermez; kalite
-- bölümü onaylamadan hiçbir şey göremez. Kodu bilmeyen çağıramaz.
-- ─────────────────────────────────────────────────────────────────────

create or replace function ppap_davet_istek(p_kod text, p_eposta text)
returns text
language plpgsql security definer as $$
declare t text; e text; mevcut boolean;
begin
  e := lower(trim(p_eposta));
  if e is null or e = '' or position('@' in e) = 0 then
    raise exception 'Geçerli bir e-posta yazın.';
  end if;
  select tedarikci into t from ppap_davet
   where kod = p_kod and kullanan is null and gecerli_son > now();
  if t is null then
    raise exception 'Davet geçersiz, süresi dolmuş ya da daha önce kullanılmış.';
  end if;

  -- Onaylanmis bir hesabin onayi DUSURULMEZ.
  select aktif into mevcut from ppap_kullanici where eposta = e;
  insert into ppap_kullanici (eposta, tedarikci, aktif)
       values (e, t, coalesce(mevcut, false))
  on conflict (eposta) do update set tedarikci = excluded.tedarikci;
  return t;
end $$;

grant execute on function ppap_davet_istek(text, text) to anon, authenticated;

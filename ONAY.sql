-- ─────────────────────────────────────────────────────────────────────
-- PPAP portalı — DAVETLE GELEN TEDARİKÇİ ONAY BEKLER
-- Davet linkiyle hesap açan tedarikçi doğrudan giremez; kalite bölümü
-- portaldan onaylayınca girer. (KURULUM.sql ve DAVET.sql'den sonra.)
-- ─────────────────────────────────────────────────────────────────────

create or replace function ppap_davet_kullan(p_kod text) returns text
language plpgsql security definer as $$
declare t text; e text; mevcut boolean;
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

  -- ONAY BEKLER: aktif = false. Daha once onaylanmis bir hesap yeniden
  -- davet kullanirsa onayi DUSURULMEZ (aktif'e dokunulmaz).
  select aktif into mevcut from ppap_kullanici where eposta = e;
  insert into ppap_kullanici (eposta, tedarikci, aktif)
       values (e, t, coalesce(mevcut, false))
  on conflict (eposta) do update set tedarikci = excluded.tedarikci;

  update ppap_davet set kullanan = e, kullanim = now() where kod = p_kod;
  return t;
end $$;
grant execute on function ppap_davet_kullan(text) to authenticated;

-- Bekleyen kaydini kendisi gorebilsin diye (kendi satirini okuma kurali
-- zaten var), ek bir sey gerekmiyor.

-- ─────────────────────────────────────────────────────────────────────
-- KURAL DÜZELTMESİ: tedarikçiye bağlanmış hesap, ERP kullanıcısı olsa
-- bile bu portalda TEDARİKÇİDİR.
--
-- Açık: "ERP'de onaylı = Kalite" sayılıyordu. ERP kullanıcısı olan
-- birine tedarikçi davet linki gönderilince onay beklemeden giriyor ve
-- TÜM tedarikçileri görüyordu. Artık ppap_kullanici'da kaydı olan hesap
-- iç kullanıcı sayılmaz — yalnız kendi firmasını görür, onay bekler.
-- Kalite yetkisine geri döndürmek = panelden "Kaldır" (bağı siler).
-- ─────────────────────────────────────────────────────────────────────

create or replace function ppap_ic_kullanici() returns boolean
language sql stable security definer as $$
  select exists (select 1 from erp_users u
                 where u.id = auth.uid() and u.approved is true)
     and not exists (select 1 from ppap_kullanici k
                     where lower(k.eposta) = lower(auth.jwt() ->> 'email'));
$$;

create or replace function ppap_kim() returns json
language sql stable security definer as $$
  select json_build_object(
    'uid', auth.uid(),
    'eposta', auth.jwt() ->> 'email',
    'erp_kayit', exists(select 1 from erp_users where id = auth.uid()),
    'erp_onayli', ppap_ic_kullanici());
$$;

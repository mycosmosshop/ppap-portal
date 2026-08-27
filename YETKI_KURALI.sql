-- ─────────────────────────────────────────────────────────────────────
-- SON KURAL: ERP'de onaylı kullanıcı = KALİTE.
--
-- Tedarikçi bağı olsa bile ERP kullanıcısı normal girişte TÜM tedarikçi
-- PPAP'larını görür (Sanifoam personeli zaten yetkili).
--
-- Bu dosya KALITE_ONCELIK.sql'i GERİ ALIR: orada tedarikçiye bağlanmış
-- ERP kullanıcısı tedarikçiye düşüyordu, umca1320 gibi personel kendi
-- tedarikçisinden başkasını göremedi.
-- ─────────────────────────────────────────────────────────────────────

create or replace function ppap_ic_kullanici() returns boolean
language sql stable security definer as $$
  select exists (select 1 from erp_users u
                 where u.id = auth.uid() and u.approved is true);
$$;

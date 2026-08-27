// Tarayicinin prompt() kutusu yerine uygulamanin kendi modali.
// null = vazgecti, metin = onaylandi.
function soruModal(baslik, etiket, varsayilan) {
  return new Promise(resolve => {
    const p = document.createElement('div');
    p.className = 'perde';
    p.innerHTML = '<div class="pencere" style="max-width:480px">'
      + '<h3>' + baslik + '</h3>'
      + '<label>' + etiket + '</label>'
      + '<textarea id="sm_metin"></textarea>'
      + '<div class="dugmeler"><button class="dugme" id="sm_tamam">Tamam</button>'
      + '<button class="dugme duz sag" id="sm_vazgec">Vazgeç</button></div></div>';
    document.body.appendChild(p);
    const kutu = p.querySelector('#sm_metin');
    kutu.value = met(varsayilan);
    const bitir = v => { p.remove(); resolve(v); };
    p.addEventListener('click', e => { if (e.target === p) bitir(null); });
    p.querySelector('#sm_vazgec').onclick = () => bitir(null);
    p.querySelector('#sm_tamam').onclick = () => bitir(kutu.value);
    kutu.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) bitir(kutu.value);
      if (e.key === 'Escape') bitir(null);
    });
    kutu.focus();
  });
}


// ── İÇ YÜZ (kalite) ───────────────────────────────────────────────────────
let PROJELER = [], MADDELER = [], ACIK = null;
// Son temizligin kopyasi: { projeId, ad, kayit:[{id,dosyalar,yorum,ted_yorum,durum}],
// projeDurum } — 'Geri al' bunu geri yazar.
let GERI_AL = null;
let GORUNUM = localStorage.getItem('ppap_gorunum') || 'tedarikci';   // tedarikci | proje
let OZET = {};        // proje_id -> {toplam, bekliyor, yuklendi, kabul, red, dosya, sonHareket}

// Tum projelerin madde ozeti TEK sorguda: tedarikci bazli listede her
// projenin ilerlemesi ve son hareketi gorunsun diye.
let BEKLEYEN = 0, BEKLEYEN_LISTE = [];   // onay bekleyen tedarikci kullanicilari

// Onay bekleyenler ANA EKRANDA gorunsun: dialog icindeki rozet kolayca
// gozden kaciyor, "onay nereye geliyor" sorusu da oradan cikti.
let ACIK_DAVET = 0;
function onaySeridi() {
  if (!BEKLEYEN) {
    if (!ACIK_DAVET) return '';
    return '<div class="kart" style="border-left:5px solid var(--bilgi);background:var(--bilgi-bg)">'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      + '<b>🔗 ' + ACIK_DAVET + ' davet gönderildi, henüz kullanılmadı</b>'
      + '<span class="soluk">Tedarikçi bağlantıyı açıp hesabını oluşturunca burada '
      + 'onayınız istenecek.</span>'
      + '<button class="dugme duz" style="margin-left:auto" onclick="kullaniciPenceresi()">'
      + 'Davetleri gör</button></div></div>';
  }
  return '<div class="kart" style="border-left:5px solid var(--uyari);background:var(--uyari-bg)">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<b>⏳ ' + BEKLEYEN + ' tedarikçi kullanıcısı onayınızı bekliyor</b>'
    + '<span class="soluk">' + BEKLEYEN_LISTE.slice(0, 3)
        .map(x => kacir(x.eposta) + ' → ' + kacir(x.tedarikci)).join(' · ')
    + (BEKLEYEN > 3 ? ' · …' : '') + '</span>'
    + '<button class="dugme" style="margin-left:auto" onclick="kullaniciPenceresi()">'
    + '✔ Onay ekranını aç</button></div></div>';
}

async function ozetleriYukle() {
  OZET = {};
  try {
    const rb = await sb.from('ppap_kullanici').select('eposta,tedarikci').eq('aktif', false);
    BEKLEYEN_LISTE = rb.data || [];
    BEKLEYEN = BEKLEYEN_LISTE.length;
    const rd = await sb.from('ppap_davet').select('kod').is('kullanan', null);
    ACIK_DAVET = (rd.data || []).length;
  } catch (e) { BEKLEYEN = 0; BEKLEYEN_LISTE = []; ACIK_DAVET = 0; }
  const r = await sb.from('ppap_madde')
    .select('proje_id,durum,gonderim,dosyalar,guncelleme');
  if (r.error) return;
  (r.data || []).forEach(m => {
    const o = OZET[m.proje_id] = OZET[m.proje_id]
      || { toplam: 0, bekliyor: 0, yuklendi: 0, kabul: 0, red: 0, dosya: 0, sonHareket: '' };
    if (!m.gonderim) return;
    o.toplam++;
    o[m.durum] = (o[m.durum] || 0) + 1;
    o.dosya += (m.dosyalar || []).length;
    if (met(m.guncelleme) > o.sonHareket) o.sonHareket = met(m.guncelleme);
  });
}
function gorunumDegis(g) {
  GORUNUM = g; localStorage.setItem('ppap_gorunum', g); icEkran();
}
function ozetCubugu(o) {
  if (!o || !o.toplam) return '<span class="soluk">madde yok</span>';
  const t = (o.kabul || 0) + (o.yuklendi || 0);
  return '<div class="ilerleme" style="max-width:180px"><div style="width:'
    + Math.round(t * 100 / o.toplam) + '%"></div></div>'
    + '<span class="soluk">' + t + '/' + o.toplam + ' madde'
    + (o.dosya ? ' · ' + o.dosya + ' dosya' : '')
    + (o.red ? ' · <b style="color:var(--sil)">' + o.red + ' red</b>' : '')
    + '</span>';
}

async function icEkran() {
  const r = await sb.from('ppap_proje').select('*').order('olusturma', { ascending: false });
  if (r.error) { mesaj('Projeler okunamadı: ' + r.error.message + ' — KURULUM.sql çalıştırıldı mı?', 'hata'); return; }
  PROJELER = r.data || [];
  await ozetleriYukle();
  if (GORUNUM === 'tedarikci') { tedarikciGorunumu(); return; }
  const say = { hazirlik: 0, tedarikcide: 0, incelemede: 0, onayli: 0, red: 0 };
  PROJELER.forEach(p => { say[p.durum] = (say[p.durum] || 0) + 1; });
  $('#govde').innerHTML = onaySeridi() + '<div class="kart">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<h2 style="margin:0">PPAP projeleri</h2>'
    + '<span class="rozet r-tedarikcide">Tedarikçide ' + (say.tedarikcide || 0) + '</span>'
    + '<span class="rozet r-incelemede">İncelemede ' + (say.incelemede || 0) + '</span>'
    + '<span class="rozet r-onayli">Onaylı ' + (say.onayli || 0) + '</span>'
    + '<div style="margin-left:auto;display:flex;gap:8px">'
    + '<button class="dugme duz" onclick="gorunumDegis(\'tedarikci\')">🏭 Tedarikçi görünümü</button>'
    + '<button class="dugme' + (BEKLEYEN ? '' : ' duz') + '" onclick="kullaniciPenceresi()">👤 Tedarikçi kullanıcıları'
    + (BEKLEYEN ? ' <span class="rozet r-red">' + BEKLEYEN + ' onay bekliyor</span>' : '') + '</button>'
    + '<button class="dugme" onclick="yeniProje()">➕ Yeni PPAP</button></div></div>'
    + (PROJELER.length
        ? '<table><thead><tr><th>Tedarikçi</th><th>Parça</th><th>Müşteri</th><th>Seviye</th>'
          + '<th>Durum</th><th>İlerleme</th><th>Güncelleme</th><th></th></tr></thead><tbody>'
          + PROJELER.map(p => '<tr><td><b>' + kacir(p.tedarikci) + '</b></td>'
              + '<td>' + kacir(p.parca_no) + (met(p.parca_ad) ? '<div class="soluk">'
                  + kacir(p.parca_ad) + '</div>' : '') + '</td>'
              + '<td>' + kacir(p.musteri) + '</td>'
              + '<td>Seviye ' + kacir(p.seviye) + '</td>'
              + '<td><span class="rozet r-' + p.durum + '">' + (DURUM_AD[p.durum] || p.durum) + '</span></td>'
              + '<td style="min-width:170px">' + ozetCubugu(OZET[p.id]) + '</td>'
              + '<td class="soluk">' + met(p.guncelleme).slice(0, 10) + '</td>'
              + '<td><button class="dugme kucuk" onclick="projeAc(' + JSON.stringify(p.id).replace(/"/g, '&quot;') + ')">Aç</button></td>'
              + '</tr>').join('') + '</tbody></table>'
        : '<div class="bilgi-kutu">Henüz PPAP projesi yok. <b>➕ Yeni PPAP</b> ile başlayın — '
          + 'tedarikçiyi onaylı listeden seçersiniz.</div>')
    + '</div>';
}

// TEDARIKCI BAZLI GORUNUM: her firma tek kartta — kac proje, ne kadari
// tamam, kac dosya geldi, en son ne zaman hareket oldu.
function tedarikciGorunumu() {
  const grup = {};
  PROJELER.forEach(p => { (grup[p.tedarikci] = grup[p.tedarikci] || []).push(p); });
  const adlar = Object.keys(grup).sort((a, b) => a.localeCompare(b, 'tr'));
  let h = onaySeridi() + '<div class="kart">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<h2 style="margin:0">Tedarikçiler</h2>'
    + '<span class="rozet r-hazirlik">' + adlar.length + ' firma</span>'
    + '<span class="rozet r-incelemede">' + PROJELER.length + ' PPAP</span>'
    + '<div style="margin-left:auto;display:flex;gap:8px">'
    + '<button class="dugme duz" onclick="gorunumDegis(\'proje\')">📋 Proje listesi</button>'
    + '<button class="dugme' + (BEKLEYEN ? '' : ' duz') + '" onclick="kullaniciPenceresi()">👤 Tedarikçi kullanıcıları'
    + (BEKLEYEN ? ' <span class="rozet r-red">' + BEKLEYEN + ' onay bekliyor</span>' : '') + '</button>'
    + '<button class="dugme" onclick="yeniProje()">➕ Yeni PPAP</button></div></div>'
    + (adlar.length ? '' : '<div class="bilgi-kutu">Henüz PPAP projesi yok. Onaylı '
        + 'tedarikçi listesindeki 🧪 PPAP düğmesinden başlatabilirsiniz.</div>')
    + '</div>';
  adlar.forEach(ad => {
    const liste = grup[ad];
    const top = liste.reduce((o, p) => {
      const z = OZET[p.id] || {};
      o.toplam += z.toplam || 0; o.kabul += z.kabul || 0; o.yuklendi += z.yuklendi || 0;
      o.red += z.red || 0; o.dosya += z.dosya || 0;
      if (met(z.sonHareket) > o.sonHareket) o.sonHareket = met(z.sonHareket);
      return o;
    }, { toplam: 0, kabul: 0, yuklendi: 0, red: 0, dosya: 0, sonHareket: '' });
    h += '<div class="kart"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      + '<h3 style="margin:0">' + kacir(ad) + '</h3>'
      + '<span class="rozet r-hazirlik">' + liste.length + ' parça</span>'
      + (top.red ? '<span class="rozet r-red">' + top.red + ' red</span>' : '')
      + '<span class="soluk" style="margin-left:auto">'
      + (top.sonHareket ? 'son hareket: ' + met(top.sonHareket).slice(0, 10) : 'hareket yok')
      + (top.dosya ? ' · ' + top.dosya + ' dosya' : '') + '</span></div>'
      // Tek parcali firmada toplam cubuk satirdakiyle birebir ayni —
      // tekrar olmasin; birden cok parca varsa toplam anlamli.
      + (liste.length > 1 ? ozetCubugu(top) : '')
      + '<table style="margin-top:10px"><thead><tr><th>Parça</th><th>Müşteri</th>'
      + '<th>Seviye</th><th>Durum</th><th>İlerleme</th><th>Son hareket</th><th></th></tr></thead><tbody>'
      + liste.map(p => {
          const z = OZET[p.id] || {};
          return '<tr><td><b>' + kacir(p.parca_no) + '</b>'
            + (met(p.parca_ad) ? '<div class="soluk">' + kacir(p.parca_ad) + '</div>' : '') + '</td>'
            + '<td>' + kacir(p.musteri) + '</td><td>' + kacir(p.seviye) + '</td>'
            + '<td><span class="rozet r-' + p.durum + '">' + (DURUM_AD[p.durum] || p.durum) + '</span></td>'
            + '<td>' + ozetCubugu(z) + '</td>'
            + '<td class="soluk">' + (met(z.sonHareket).slice(0, 10) || '—') + '</td>'
            + '<td><button class="dugme kucuk" onclick="projeAc('
            + JSON.stringify(p.id).replace(/"/g, '&quot;') + ')">Aç</button></td></tr>';
        }).join('')
      + '</tbody></table></div>';
  });
  $('#govde').innerHTML = h;
}

// Onaylı tedarikçi listesi (diğer projeden, yalnız okunur)
async function onayliTedarikciler() {
  try {
    const r = await fetch(PT_URL + '/rest/v1/onayli_tedarikci?select=ad,durum,sinif,otomotiv&order=ad',
      { headers: { apikey: PT_KEY, Authorization: 'Bearer ' + PT_KEY } });
    if (!r.ok) return [];
    return (await r.json()).filter(x => String(x.durum || '').toLocaleUpperCase('tr') === 'ONAYLI');
  } catch (e) { return []; }
}

async function yeniProje() {
  const ted = await onayliTedarikciler();
  // Onayli listedeki PPAP dugmesi ?ted=<ad> ile gelir: tedarikci hazir secili.
  const onSecili = new URLSearchParams(location.search).get('ted') || '';
  const p = document.createElement('div');
  p.className = 'perde';
  p.innerHTML = '<div class="pencere"><h2>➕ Yeni PPAP projesi</h2>'
    + '<div class="soluk">Tedarikçi onaylı listeden seçilir; seviye madde matrisini ön işaretler, '
    + 'sonra madde bazında değiştirebilirsiniz.</div>'
    + '<label>Tedarikçi</label>'
    // datalist: yazdikca liste suzulur, listede olmayan yeni tedarikci de
    // dogrudan yazilabilir (kullanicinin istegi).
    + '<input id="p_ted" list="p_tedList" value="' + kacir(onSecili)
    + '" placeholder="yazarak arayın — listede yoksa adını yazın" autocomplete="off">'
    + '<datalist id="p_tedList">'
    + ted.map(x => '<option value="' + kacir(x.ad) + '">').join('') + '</datalist>'
    + '<div class="soluk" style="margin-top:3px">Onaylı listeden arayın; listede olmayan '
    + 'yeni bir tedarikçiyi doğrudan yazabilirsiniz.</div>'
    + '<div class="satirlar">'
    + '<div><label>Parça no</label><input id="p_no" placeholder="700.0.454"></div>'
    + '<div><label>Parça adı</label><input id="p_ad"></div>'
    + '<div><label>Müşteri</label><input id="p_mus" placeholder="MAN / Lear / VW…"></div>'
    + '<div><label>PPA seviyesi</label><select id="p_sev">'
    + Object.keys(VDA2.seviye).map(k => '<option value="' + k + '"' + (k === '3' ? ' selected' : '') + '>'
        + kacir(VDA2.seviye[k].ad) + '</option>').join('') + '</select>'
    + '<div class="soluk" id="p_sevnot" style="margin-top:4px"></div></div></div>'
    + '<label>Açıklama (isteğe bağlı)</label><textarea id="p_not"></textarea>'
    + '<div class="dugmeler"><button class="dugme" id="p_kur">Projeyi oluştur</button>'
    + '<button class="dugme duz sag" id="p_kapat">Vazgeç</button></div></div>';
  document.body.appendChild(p);
  const kapat = () => p.remove();
  p.addEventListener('click', e => { if (e.target === p) kapat(); });
  p.querySelector('#p_kapat').onclick = kapat;
  const sevNot = () => {
    const k = p.querySelector('#p_sev').value;
    p.querySelector('#p_sevnot').textContent = (VDA2.seviye[k] || {}).not || '';
  };
  p.querySelector('#p_sev').onchange = sevNot; sevNot();
  p.querySelector('#p_kur').onclick = async () => {
    const tedAd = p.querySelector('#p_ted').value.trim();
    const parca = p.querySelector('#p_no').value.trim();
    if (!tedAd || !parca) { mesaj('Tedarikçi ve parça no gerekli.', 'hata'); return; }
    const seviye = p.querySelector('#p_sev').value;
    p.querySelector('#p_kur').disabled = true;
    const pr = await sb.from('ppap_proje').insert({
      tedarikci: tedAd, parca_no: parca, parca_ad: p.querySelector('#p_ad').value.trim(),
      musteri: p.querySelector('#p_mus').value.trim(), seviye: seviye,
      aciklama: p.querySelector('#p_not').value.trim(), olusturan: BEN.eposta
    }).select().single();
    if (pr.error) { mesaj('Proje açılamadı: ' + pr.error.message, 'hata'); return; }
    // AIAG PPAP Tablo 4.2: S = gonderilir, R/* = elde tutulur.
    // Portalin iki bayragi tam bunun karsiligi.
    const gonder = new Set(VDA2.seviye[seviye].maddeler);
    const tut = new Set(VDA2.seviye[seviye].tutulacak || []);
    const satirlar = VDA2.maddeler.filter(m => !m.ust).map(m => ({
      proje_id: pr.data.id, no: m.no, ad: m.ad, grup: m.grup,
      gerekli: gonder.has(m.no) || tut.has(m.no), gonderim: gonder.has(m.no)
    }));
    const mr = await sb.from('ppap_madde').insert(satirlar);
    if (mr.error) { mesaj('Maddeler yazılamadı: ' + mr.error.message, 'hata'); return; }
    kapat();
    mesaj('✅ Proje açıldı — ' + tedAd + ' / ' + parca);
    await icEkran();
    projeAc(pr.data.id);
  };
}

async function projeAc(id) {
  const p = PROJELER.find(x => x.id === id);
  const r = await sb.from('ppap_madde').select('*').eq('proje_id', id).order('no');
  if (r.error) { mesaj('Maddeler okunamadı: ' + r.error.message, 'hata'); return; }
  ACIK = id; MADDELER = r.data || [];
  AKTIF_SEVIYE = met(p.seviye) || '3';
  const A = JSON.stringify(id).replace(/"/g, '&quot;');
  $('#govde').innerHTML = '<div class="kart">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<button class="dugme duz kucuk" onclick="icEkran()">← Geri</button>'
    + '<h2 style="margin:0">' + kacir(p.tedarikci) + ' — ' + kacir(p.parca_no) + '</h2>'
    + '<span class="rozet r-' + p.durum + '">' + (DURUM_AD[p.durum] || p.durum) + '</span>'
    + '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">'
    + '<select id="d_durum" style="width:auto" onchange="projeDurum(' + A + ',this.value)">'
    + Object.keys(DURUM_AD).map(k => '<option value="' + k + '"' + (k === p.durum ? ' selected' : '')
        + '>' + DURUM_AD[k] + '</option>').join('') + '</select>'
    + '<button class="dugme duz" onclick="seviyeUygula(' + A + ')">⚙ Seviye uygula</button>'
    + '<button class="dugme duz" onclick="ppapIndir(' + A + ')">⤓ İndir</button>'
    + '<button class="dugme duz" style="color:var(--sil)" onclick="projeTemizle(' + A + ')">🧹 Temizle</button>'
    + '<button class="dugme duz" style="color:var(--sil)" onclick="projeSil(' + A + ')">🗑 Sil</button>'
    + (GERI_AL && GERI_AL.projeId === id
        ? '<button class="dugme" style="background:var(--uyari);border-color:var(--uyari)" '
          + 'title="Son temizliği geri al — ' + kacir(GERI_AL.ad)
          + ' (sayfayı yenilerseniz kaybolur)" onclick="temizligiGeriAl()">↩ Geri al</button>'
        : '')
    + '</div></div>'
    + '<div class="soluk">' + kacir(p.parca_ad) + (met(p.musteri) ? ' · Müşteri: ' + kacir(p.musteri) : '')
    + ' · Seviye ' + kacir(p.seviye) + '</div>'
    + ilerlemeCubugu(MADDELER)
    + (met(p.aciklama) ? '<div class="bilgi-kutu">' + kacir(p.aciklama) + '</div>' : '')
    + '</div><div class="kart"><h3>VDA 2 madde listesi</h3>'
    + '<div class="soluk">Kapsam <b>AIAG PPAP 4. baskı Tablo 4.2</b>’den kuruluyor: '
    + '<b>S</b> = müşteriye gönderilir (“gönderilecek”), <b>R</b>/<b>*</b> = tedarikçide tutulur '
    + '(“gerekli”, gönderilmez). Tedarikçi yalnız <b>gönderilecek</b> işaretli maddeleri görür. '
    + '<b>PPAP</b> sütunu element numarasıdır — üstüne gelince adı çıkar.'
    + ((VDA2.seviye[p.seviye] || {}).not ? '<div style="margin-top:4px">'
        + kacir(VDA2.seviye[p.seviye].not) + '</div>' : '') + '</div>'
    + '<table><thead><tr><th>VDA no</th><th title="AIAG PPAP element numarası">PPAP</th>'
    + '<th>Madde</th><th>Kapsam'
    + '<div style="font-weight:400;font-size:11px;white-space:nowrap">'
    + 'gerekli: <a href="#" onclick="topluKapsam(\'gerekli\',true);return false">tümü</a>'
    + ' / <a href="#" onclick="topluKapsam(\'gerekli\',false);return false">temizle</a><br>'
    + 'gönderilecek: <a href="#" onclick="topluKapsam(\'gonderim\',true);return false">tümü</a>'
    + ' / <a href="#" onclick="topluKapsam(\'gonderim\',false);return false">temizle</a></div>'
    + '</th><th>Durum</th><th></th></tr></thead>'
    + '<tbody>' + maddeSatirlari(MADDELER, true, id) + '</tbody></table></div>';
}

// Kapsam basligindaki toplu islemler. Kural korunur: gonderilecek isaretli
// olan gereklidir; gerekli kaldirilinca gonderim de kalkar. Tek istek.
async function topluKapsam(alan, deger) {
  const ad = alan === 'gerekli' ? 'gerekli' : 'gönderilecek';
  if (!confirm('Tüm maddelerde "' + ad + '" ' + (deger ? 'işaretlensin' : 'temizlensin') + ' mi?\n\n'
      + 'Yüklenen dosyalar ve kararlar değişmez; tek tek geri düzeltebilirsiniz.')) return;
  const y = {};
  if (alan === 'gerekli') { y.gerekli = deger; if (!deger) y.gonderim = false; }
  else { y.gonderim = deger; if (deger) y.gerekli = true; }
  const ids = MADDELER.map(m => m.id);
  const r = await sb.from('ppap_madde').update(y).in('id', ids);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  MADDELER.forEach(m => Object.assign(m, y));
  mesaj('✔ ' + ids.length + ' maddede "' + ad + '" ' + (deger ? 'işaretlendi' : 'temizlendi') + '.');
  projeAc(ACIK);
}

async function maddeBayrak(maddeId, alan, deger) {
  const y = {}; y[alan] = deger;
  if (alan === 'gonderim' && deger) y.gerekli = true;
  const r = await sb.from('ppap_madde').update(y).eq('id', maddeId);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  const m = MADDELER.find(x => x.id === maddeId);
  if (m) Object.assign(m, y);
  if (ACIK) projeAc(ACIK);
}

// Kalite: TEK maddenin yazisma/verisini temizler (dosyalar, notlar,
// kararlar). Drive'daki icerik dosyasina dokunulmaz.
async function maddeTemizle(maddeId) {
  const m = MADDELER.find(x => x.id === maddeId); if (!m) return;
  if (!confirm(m.no + ' ' + m.ad + String.fromCharCode(10, 10)
      + 'Bu maddenin dosyalari, notlari ve karari TEMIZLENSIN mi?'
      + String.fromCharCode(10) + 'Geri alinamaz.')) return;
  const y = { dosyalar: [], yorum: null, ted_yorum: null, durum: 'bekliyor' };
  const kopya = [{ id: m.id, dosyalar: m.dosyalar || [], yorum: m.yorum || null,
                   ted_yorum: m.ted_yorum || null, durum: m.durum }];
  const r = await sb.from('ppap_madde').update(y).eq('id', maddeId);
  if (r.error) { mesaj('Temizlenemedi: ' + r.error.message, 'hata'); return; }
  GERI_AL = { projeId: ACIK, ad: m.no + ' ' + m.ad, kayit: kopya, projeDurum: null };
  Object.assign(m, y);
  mesaj('🧹 ' + m.no + ' temizlendi — başlıktaki <b>↩ Geri al</b> ile dönebilirsiniz.');
  projeAc(ACIK);
}

// Kalite: PROJEDEKI TUM yazisma/veriyi temizler — cift onay.
async function projeTemizle(id) {
  const p = PROJELER.find(x => x.id === id); if (!p) return;
  if (!confirm(p.tedarikci + ' — ' + p.parca_no + String.fromCharCode(10, 10)
      + 'TUM maddelerdeki dosyalar, tedarikci notlari ve kabul/red kararlari '
      + 'TEMIZLENECEK. Kapsam isaretleri (gerekli/gonderilecek) korunur.'
      + String.fromCharCode(10) + 'Devam edilsin mi?')) return;
  if (!confirm('Son onay: bu islem GERI ALINAMAZ. Temizlensin mi?')) return;
  const y = { dosyalar: [], yorum: null, ted_yorum: null, durum: 'bekliyor' };
  // Yalniz icerigi olan maddeleri sakla — geri yazma hizli olsun.
  const kopya = MADDELER
    .filter(m => (m.dosyalar || []).length || met(m.yorum) || met(m.ted_yorum)
                 || m.durum !== 'bekliyor')
    .map(m => ({ id: m.id, dosyalar: m.dosyalar || [], yorum: m.yorum || null,
                 ted_yorum: m.ted_yorum || null, durum: m.durum }));
  const eskiDurum = p.durum;
  const r = await sb.from('ppap_madde').update(y).eq('proje_id', id);
  if (r.error) { mesaj('Temizlenemedi: ' + r.error.message, 'hata'); return; }
  await sb.from('ppap_proje').update({ durum: 'hazirlik' }).eq('id', id);
  p.durum = 'hazirlik';
  GERI_AL = { projeId: id, ad: 'proje (' + kopya.length + ' madde)',
              kayit: kopya, projeDurum: eskiDurum };
  MADDELER.forEach(m => Object.assign(m, y));
  mesaj('🧹 Proje temizlendi — başlıktaki <b>↩ Geri al</b> ile dönebilirsiniz.');
  projeAc(id);
}

// ── ZIP (stored) — kutuphane yok ────────────────────────────────────────
const _CRC = (() => { const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = _CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0; }

function zipYap(dosyalar) {
  const enc = new TextEncoder(), parca = [], merkez = [];
  let ofs = 0, mBoy = 0;
  dosyalar.forEach(f => {
    const ad = enc.encode(f.ad), n = f.veri.length, crc = crc32(f.veri);
    const y = new DataView(new ArrayBuffer(30));
    y.setUint32(0, 0x04034b50, true); y.setUint16(4, 20, true);
    y.setUint16(6, 0x0800, true);                 // UTF-8 ad
    y.setUint32(14, crc, true); y.setUint32(18, n, true); y.setUint32(22, n, true);
    y.setUint16(26, ad.length, true);
    parca.push(new Uint8Array(y.buffer), ad, f.veri);
    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true);
    m.setUint16(8, 0x0800, true);
    m.setUint32(16, crc, true); m.setUint32(20, n, true); m.setUint32(24, n, true);
    m.setUint16(28, ad.length, true); m.setUint32(42, ofs, true);
    merkez.push(new Uint8Array(m.buffer), ad);
    ofs += 30 + ad.length + n; mBoy += 46 + ad.length;
  });
  const son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true);
  son.setUint16(8, dosyalar.length, true); son.setUint16(10, dosyalar.length, true);
  son.setUint32(12, mBoy, true); son.setUint32(16, ofs, true);
  return new Blob(parca.concat(merkez, [new Uint8Array(son.buffer)]),
                  { type: 'application/zip' });
}

// Kutuphanesiz xlsx: hucreler inlineStr — Excel '1.1'i tarihe cevirmez.
function xlsxYap(basliklar, satirlar, genislikler) {
  const x = t => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kolonAd = i => { let s = '', v = i + 1;
    while (v) { v--; s = String.fromCharCode(65 + (v % 26)) + s; v = Math.floor(v / 26); }
    return s; };
  const hucre = (r, i, t, stil) => '<c r="' + kolonAd(i) + r + '" t="inlineStr" s="' + stil
    + '"><is><t xml:space="preserve">' + x(t) + '</t></is></c>';
  const satirXml = (dizi, r, stil) => '<row r="' + r + '"'
    + (stil === 1 ? ' ht="30" customHeight="1"' : '') + '>'
    + dizi.map((t, i) => hucre(r, i, t, stil)).join('') + '</row>';
  const cols = '<cols>' + genislikler.map((g, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + g + '" customWidth="1"/>'
  ).join('') + '</cols>';
  const sonKol = kolonAd(basliklar.length - 1), sonSat = satirlar.length + 1;
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0" tabSelected="1">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '</sheetView></sheetViews>'
    + cols + '<sheetData>' + satirXml(basliklar, 1, 1)
    + satirlar.map((d, i) => satirXml(d, i + 2, 2)).join('') + '</sheetData>'
    + '<autoFilter ref="A1:' + sonKol + sonSat + '"/></worksheet>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="10"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF1E3C72"/>'
    + '<bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"'
    + ' applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">'
    + '<alignment vertical="top" wrapText="1"/></xf>'
    + '</cellXfs></styleSheet>';
  const enc = new TextEncoder();
  return [
    { ad: '[Content_Types].xml', veri: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-'
      + 'officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-'
      + 'officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-'
      + 'officedocument.spreadsheetml.styles+xml"/></Types>') },
    { ad: '_rels/.rels', veri: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
      + 'relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { ad: 'xl/workbook.xml', veri: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="PPAP listesi" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { ad: 'xl/_rels/workbook.xml.rels', veri: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
      + 'relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
      + 'relationships/styles" Target="styles.xml"/></Relationships>') },
    { ad: 'xl/styles.xml', veri: enc.encode(styles) },
    { ad: 'xl/worksheets/sheet1.xml', veri: enc.encode(sheet) },
  ];
}

function indirBlob(blob, ad) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = ad; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 4000);
}

// Istenen dokumanlarin listesi + yuklenen dosyalar tek ZIP'te.
async function ppapIndir(id) {
  const p = PROJELER.find(x => x.id === id); if (!p) return;
  const kapsam = MADDELER.filter(m => m.gerekli || m.gonderim);
  const BASLIK = ['VDA no', 'PPAP', 'Madde', 'Gerekli', 'Gönderilecek', 'Durum',
                  'Yüklenen dosyalar', 'Kalite notu', 'Tedarikçi notu'];
  const GENIS = [9, 7, 52, 8, 12, 11, 40, 30, 30];
  const satir = [];
  const DURUM = { bekliyor: 'Bekliyor', yuklendi: 'Yüklendi', kabul: 'Kabul', red: 'Red' };
  const dosyalar = [];
  mesaj('📦 Hazırlanıyor… (' + kapsam.length + ' madde)');
  for (const m of kapsam) {
    const adlar = (m.dosyalar || []).map(f => f.ad);
    // PPAP no maddede degil katalogda (panelde de PPAP_NO'dan okunuyor).
    satir.push([m.no, PPAP_NO[m.no] || '', m.ad, m.gerekli ? 'X' : '', m.gonderim ? 'X' : '',
                DURUM[m.durum] || m.durum, adlar.join('\n'),
                m.yorum || '', m.ted_yorum || '']);
    for (const f of (m.dosyalar || [])) {
      try {
        const veri = JSON.parse(await driveOku(f.anahtar));
        const buf = new Uint8Array(await (await fetch(veri.veri)).arrayBuffer());
        dosyalar.push({ ad: guvenliAd(m.no) + '/' + guvenliAd(f.ad), veri: buf });
      } catch (e) { satir.push([m.no, '', 'İNDİRİLEMEDİ: ' + f.ad, '', '', '', '', '', '']); }
    }
  }
  const liste = zipYap(xlsxYap(BASLIK, satir, GENIS));
  dosyalar.unshift({ ad: 'PPAP_liste.xlsx',
                     veri: new Uint8Array(await liste.arrayBuffer()) });
  const ad = guvenliAd(p.tedarikci + '_' + p.parca_no) + '_PPAP.zip';
  indirBlob(zipYap(dosyalar), ad);
  mesaj('⤓ ' + ad + ' indirildi — ' + (dosyalar.length - 1) + ' dosya + liste.');
}
function guvenliAd(t) {
  return String(t || '').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
}

// Projeyi komple siler (maddeler + proje kaydi). Drive'daki icerik
// dosyalari yerinde kalir; kunye gidince portalden erisilmez.
async function projeSil(id) {
  const p = PROJELER.find(x => x.id === id); if (!p) return;
  if (!confirm(p.tedarikci + ' — ' + p.parca_no + String.fromCharCode(10, 10)
      + 'BU PROJE KOMPLE SİLİNECEK: tüm maddeler, dosya künyeleri, notlar ve kararlar.'
      + String.fromCharCode(10) + 'Geri alınamaz.')) return;
  if (!confirm('Son onay — silinsin mi?' + String.fromCharCode(10)
      + 'İsterseniz önce ⤓ İndir ile yedek alın.')) return;
  const rm = await sb.from('ppap_madde').delete().eq('proje_id', id).select('id');
  if (rm.error) { mesaj('Silinemedi: ' + rm.error.message, 'hata'); return; }
  const rp = await sb.from('ppap_proje').delete().eq('id', id).select('id');
  if (rp.error) { mesaj('Silinemedi: ' + rp.error.message, 'hata'); return; }
  if (!rp.data || !rp.data.length) {
    mesaj('Proje silinemedi — silme yetkiniz yok (RLS kuralı).', 'hata'); return;
  }
  PROJELER = PROJELER.filter(x => x.id !== id);
  ACIK = null;
  mesaj('🗑 Proje silindi (' + rm.data.length + ' madde).');
  projeListesi();
}

// Temizligi geri alir: dosya kunyeleri, notlar ve kararlar geri yazilir.
async function temizligiGeriAl() {
  if (!GERI_AL || GERI_AL.projeId !== ACIK) { mesaj('Geri alınacak temizlik yok.', 'hata'); return; }
  const g = GERI_AL;
  mesaj('↩ Geri alınıyor… (' + g.kayit.length + ' madde)');
  for (const k of g.kayit) {
    const r = await sb.from('ppap_madde').update({
      dosyalar: k.dosyalar, yorum: k.yorum, ted_yorum: k.ted_yorum, durum: k.durum
    }).eq('id', k.id);
    if (r.error) { mesaj('Geri alınamadı: ' + r.error.message, 'hata'); return; }
    const m = MADDELER.find(x => x.id === k.id);
    if (m) Object.assign(m, { dosyalar: k.dosyalar, yorum: k.yorum,
                              ted_yorum: k.ted_yorum, durum: k.durum });
  }
  if (g.projeDurum) {
    await sb.from('ppap_proje').update({ durum: g.projeDurum }).eq('id', g.projeId);
    const p = PROJELER.find(x => x.id === g.projeId);
    if (p) p.durum = g.projeDurum;
  }
  GERI_AL = null;
  mesaj('↩ Geri alındı — ' + g.kayit.length + ' maddenin dosya ve notları yerinde.');
  projeAc(ACIK);
}

async function maddeKarar(maddeId, karar) {
  const m = MADDELER.find(x => x.id === maddeId);
  let yorum = m ? met(m.yorum) : '';
  if (karar === 'red') {
    const c = await soruModal('✖ Reddet — ' + (m ? kacir(m.no) + ' ' + kacir(m.ad) : ''),
      'Red sebebi (tedarikçi bu notu görür)', yorum);
    if (c === null) return;
    yorum = c.trim();
  }
  const y = { durum: karar, yorum: yorum };
  // KABUL: revizyon dongusu kapandi — dosya satirindaki 'REVİZYON: ...'
  // rozeti kalksin diye o parcalar nottan temizlenir.
  if (karar === 'kabul' && m && met(m.ted_yorum).indexOf('REVİZYON:') >= 0) {
    y.ted_yorum = met(m.ted_yorum).split(' · ')
      .filter(x => x && x.indexOf('REVİZYON:') !== 0).join(' · ') || null;
  }
  const r = await sb.from('ppap_madde').update(y).eq('id', maddeId);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  if (m) { m.durum = karar; m.yorum = yorum;
           if ('ted_yorum' in y) m.ted_yorum = y.ted_yorum; }
  if (ACIK) projeAc(ACIK);
}

async function projeDurum(id, durum) {
  const r = await sb.from('ppap_proje').update({ durum: durum }).eq('id', id);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  const p = PROJELER.find(x => x.id === id); if (p) p.durum = durum;
  mesaj('Durum: ' + DURUM_AD[durum]);
}

async function seviyeUygula(id) {
  const p = PROJELER.find(x => x.id === id);
  const s = prompt('Hangi seviye uygulansın? (' + Object.keys(VDA2.seviye).join(' / ') + ')', p.seviye);
  if (s === null || !VDA2.seviye[s]) return;
  if (!confirm('Seviye ' + s + ' işaretleri uygulanacak.\n\n'
    + 'Elle yaptığınız kapsam değişiklikleri bu maddeler için sıfırlanır; '
    + 'yüklenen dosyalar ve kararlar korunur.')) return;
  const gonder = new Set(VDA2.seviye[s].maddeler);
  const tut = new Set(VDA2.seviye[s].tutulacak || []);
  for (const m of MADDELER) {
    const g = gonder.has(m.no), k = g || tut.has(m.no);
    if (m.gonderim !== g || m.gerekli !== k) {
      await sb.from('ppap_madde').update({ gerekli: k, gonderim: g }).eq('id', m.id);
    }
  }
  await sb.from('ppap_proje').update({ seviye: s }).eq('id', id);
  if (p) p.seviye = s;
  mesaj('Seviye ' + s + ' uygulandı.');
  projeAc(id);
}

// ── Tedarikçi kullanıcıları ──────────────────────────────────────────────
async function kullaniciPenceresi() {
  const r = await sb.from('ppap_kullanici').select('*').order('tedarikci');
  const liste = r.data || [];
  // Gonderilmis davetler de gorunsun: "onay nereye geliyor" karisikligi
  // buradan cikti — davet kullanilmadan onay kuyruguna bir sey dusmuyor,
  // panel de bunu soylemiyordu.
  const rd = await sb.from('ppap_davet').select('*').order('olusturma', { ascending: false });
  const davetler = rd.data || [];
  const ted = await onayliTedarikciler();
  const p = document.createElement('div');
  p.className = 'perde';
  p.innerHTML = '<div class="pencere"><h2>👤 Tedarikçi kullanıcıları</h2>'
    + '<div class="bilgi-kutu"><b>Kolay yol:</b> tedarikçiyi seçin, <b>🔗 Davet linki '
    + 'oluştur</b>a basın ve çıkan bağlantıyı gönderin. Tedarikçi kendi e-postasını ve '
    + '<b>kendi şifresini</b> belirleyip girer; siz hesap açmazsınız, şifre taşımazsınız. '
    + 'Bağlantı tek kullanımlıktır ve 30 gün geçerlidir.</div>'
    + '<label>E-posta</label><input id="k_mail" type="email" placeholder="kalite@tedarikci.com">'
    + '<label>Tedarikçi</label>'
    + (ted.length
        ? '<select id="k_ted"><option value="">— tedarikçi seçin —</option>'
          + ted.map(x => '<option'
            + ((davetler[0] && x.ad === davetler[0].tedarikci) ? ' selected' : '')
            + '>' + kacir(x.ad) + '</option>').join('') + '</select>'
        : '<input id="k_ted" value="' + kacir((davetler[0] || {}).tedarikci || '') + '">')
    + '<label>Kişi adı (isteğe bağlı)</label><input id="k_ad">'
    + '<div class="dugmeler"><button class="dugme" id="k_davet">🔗 Davet linki oluştur</button>'
    + '<button class="dugme duz" id="k_kuyruk">⏳ Onay kuyruğuna ekle</button>'
    + '<button class="dugme duz" id="k_ekle">✔ Bağla ve onayla</button></div>'
    + '<div class="soluk" style="margin-top:6px">Tedarikçi giriş yapmakta zorlanıyorsa '
    + '<b>Onay kuyruğuna ekle</b> deyin: kayıt onayınızı bekler duruma düşer, siz '
    + 'onaylarsınız, o da hazır olduğunda girer.</div>'
    + (liste.length
        ? '<table style="margin-top:14px"><thead><tr><th>E-posta</th><th>Tedarikçi</th>'
          + '<th>Durum</th><th></th></tr></thead><tbody>'
          + liste.slice().sort((a, b) => (a.aktif === b.aktif) ? 0 : (a.aktif ? 1 : -1))
            .map(x => {
              const A = JSON.stringify(x.eposta).replace(/"/g, '&quot;');
              return '<tr><td>' + kacir(x.eposta)
                + (met(x.ad) ? '<div class="soluk">' + kacir(x.ad) + '</div>' : '')
                + '<div class="soluk">kayıt: ' + met(x.olusturma).slice(0, 16).replace('T', ' ') + '</div></td>'
                + '<td>' + kacir(x.tedarikci) + '</td>'
                + '<td>' + (x.aktif ? '<span class="rozet r-kabul">Onaylı</span>'
                                    : '<span class="rozet r-red">Onay bekliyor</span>') + '</td>'
                + '<td style="white-space:nowrap">'
                + (x.aktif
                    ? '<button class="dugme kucuk duz" onclick="kullaniciOnay(' + A + ',false)">Erişimi durdur</button>'
                    : '<button class="dugme kucuk" onclick="kullaniciOnay(' + A + ',true)">✔ Onayla</button>')
                + ' <button class="dugme kucuk duz" onclick="kullaniciSil(' + A + ')">Kaldır</button>'
                + '</td></tr>';
            }).join('')
          + '</tbody></table>'
        : '<div class="soluk" style="margin-top:12px">Henüz bağlı kullanıcı yok.</div>')
    + (davetler.length
        ? '<h3 style="margin:18px 0 4px">🔗 Gönderilen davetler</h3>'
          + '<div class="soluk">Davet kullanılmadan onay kuyruğuna bir şey düşmez.</div>'
          + '<table style="margin-top:6px"><thead><tr><th>Tedarikçi</th><th>Durum</th>'
          + '<th>Tarih</th><th></th></tr></thead><tbody>'
          + davetler.map(x => {
              const K = JSON.stringify(x.kod).replace(/"/g, '&quot;');
              const link = location.href.split('?')[0].split('#')[0] + '?davet=' + x.kod;
              const L = JSON.stringify(link).replace(/"/g, '&quot;');
              const T = JSON.stringify(x.tedarikci).replace(/"/g, '&quot;');
              return '<tr><td>' + kacir(x.tedarikci) + '</td>'
                + '<td>' + (x.kullanan
                    ? '<span class="rozet r-kabul">kullanıldı</span><div class="soluk">'
                      + kacir(x.kullanan) + '</div>'
                    : '<span class="rozet r-tedarikcide">bekliyor — tedarikçi henüz açmadı</span>')
                + '</td><td class="soluk">' + met(x.olusturma).slice(0, 10) + '</td>'
                + '<td style="white-space:nowrap">'
                + (x.kullanan ? ''
                    : '<button class="dugme kucuk" onclick="davettenKuyruk(' + T + ')">⏳ Onay kuyruğuna ekle</button> '
                      + '<button class="dugme kucuk duz" onclick="davetPenceresi(' + T + ',' + L + ')">🔗 Linki gör</button> ')
                + '<button class="dugme kucuk duz" onclick="davetSil(' + K + ')">Sil</button>'
                + '</td></tr>';
            }).join('') + '</tbody></table>'
        : '')
    + '<div class="dugmeler"><button class="dugme duz sag" id="k_kapat">Kapat</button></div></div>';
  document.body.appendChild(p);
  const kapat = () => p.remove();
  p.addEventListener('click', e => { if (e.target === p) kapat(); });
  p.querySelector('#k_kapat').onclick = kapat;
  p.querySelector('#k_davet').onclick = async () => {
    const t = p.querySelector('#k_ted').value.trim();
    if (!t) { mesaj('Önce listeden tedarikçi seçin.', 'hata'); return; }
    const kod = [...crypto.getRandomValues(new Uint8Array(9))]
      .map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
    const r = await sb.from('ppap_davet').insert({
      kod: kod, tedarikci: t, ad: p.querySelector('#k_ad').value.trim(),
      olusturan: BEN.eposta });
    if (r.error) { mesaj('Davet oluşturulamadı: ' + r.error.message, 'hata'); return; }
    kapat();
    davetPenceresi(t, location.href.split('?')[0].split('#')[0] + '?davet=' + kod,
                   p.querySelector('#k_mail').value.trim());
  };
  // Tedarikci giris yapamasa da onay kuyruguna dussun: kayit aktif=false
  // acilir, kalite onaylayinca girer. Girise bagimliligi kirar.
  p.querySelector('#k_kuyruk').onclick = async () => {
    const mail = p.querySelector('#k_mail').value.trim().toLowerCase();
    const t = p.querySelector('#k_ted').value.trim();
    if (!mail || !t) { mesaj('E-posta yazın ve listeden tedarikçi seçin.', 'hata'); return; }
    const r2 = await sb.from('ppap_kullanici').upsert({
      eposta: mail, tedarikci: t, ad: p.querySelector('#k_ad').value.trim(), aktif: false });
    if (r2.error) { mesaj('Eklenemedi: ' + r2.error.message, 'hata'); return; }
    kapat();
    mesaj('⏳ ' + mail + ' → ' + t + ' · onay kuyruğuna eklendi.');
    await ozetleriYukle();
    (GORUNUM === 'tedarikci') ? tedarikciGorunumu() : icEkran();
  };
  p.querySelector('#k_ekle').onclick = async () => {
    const mail = p.querySelector('#k_mail').value.trim().toLowerCase();
    const t = p.querySelector('#k_ted').value.trim();
    if (!mail || !t) return;
    const r2 = await sb.from('ppap_kullanici').upsert({
      eposta: mail, tedarikci: t, ad: p.querySelector('#k_ad').value.trim(), aktif: true });
    if (r2.error) { mesaj('Bağlanamadı: ' + r2.error.message, 'hata'); return; }
    kapat(); mesaj('✅ ' + mail + ' → ' + t); kullaniciPenceresi();
  };
}
// Davet linki penceresi: kopyala + mail taslagi (uygulama mail GONDERMEZ).
function davetPenceresi(tedarikci, link, mail) {
  const p = document.createElement('div');
  p.className = 'perde';
  p.innerHTML = '<div class="pencere"><h2>🔗 Davet linki hazır</h2>'
    + '<div class="soluk">' + kacir(tedarikci) + ' — bağlantı tek kullanımlık, 30 gün geçerli.</div>'
    + '<div class="bilgi-kutu" style="word-break:break-all;font-family:monospace;font-size:12px">'
    + kacir(link) + '</div>'
    + '<div class="soluk">Tedarikçi bu bağlantıyı açar, kendi e-postasını ve şifresini '
    + 'belirler; hesabı <b>' + kacir(tedarikci) + '</b> ile eşleşir ve <b>onayınızı bekler</b>. '
    + '👤 Tedarikçi kullanıcıları penceresinden onaylayınca girebilir.</div>'
    + '<div class="dugmeler"><button class="dugme" id="d_kopya">📋 Kopyala</button>'
    + '<button class="dugme duz" id="d_mail">📧 Mail taslağı</button>'
    + '<button class="dugme duz sag" id="d_kapat">Kapat</button></div></div>';
  document.body.appendChild(p);
  const kapat = () => p.remove();
  p.addEventListener('click', e => { if (e.target === p) kapat(); });
  p.querySelector('#d_kapat').onclick = kapat;
  p.querySelector('#d_kopya').onclick = async () => {
    try { await navigator.clipboard.writeText(link); mesaj('📋 Kopyalandı.'); }
    catch (e) { mesaj('Kopyalanamadı — bağlantıyı elle seçip kopyalayın.', 'hata'); }
  };
  p.querySelector('#d_mail').onclick = () => {
    const konu = 'Sanifoam PPAP Portalı — ' + tedarikci;
    const govde = 'Sayın Yetkili,\n\n'
      + tedarikci + ' için PPAP (VDA 2) belgelerini ileteceğiniz portal hazır.\n\n'
      + 'Aşağıdaki bağlantıyı açın, e-postanızı yazıp kendi şifrenizi belirleyin:\n'
      + link + '\n\n'
      + 'Sonrasında sizden istenen belgeler madde madde listelenir; her maddede boş '
      + 'formatı indirip doldurabilir, dosyayı sürükleyip yükleyebilirsiniz.\n\n'
      + 'Bağlantı tek kullanımlıktır ve 30 gün geçerlidir.\n\n'
      + 'Saygılarımızla,\nSanifoam Kalite';
    const a = document.createElement('a');
    a.href = 'mailto:' + (mail || '') + '?subject=' + encodeURIComponent(konu)
      + '&body=' + encodeURIComponent(govde);
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(() => a.remove(), 1000);
  };
}

// Onay: davetle gelen tedarikci ancak burada onaylaninca girebilir.
async function kullaniciOnay(eposta, aktif) {
  if (!aktif && !confirm(eposta + ' erişimi durdurulsun mu?\n\n'
      + 'Hesap kalır ama portala giremez; istediğinde yeniden onaylayabilirsin.')) return;
  const r = await sb.from('ppap_kullanici').update({ aktif: aktif }).eq('eposta', eposta);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  mesaj(aktif ? '✔ ' + eposta + ' onaylandı — artık girebilir.'
              : '⛔ ' + eposta + ' erişimi durduruldu.');
  document.querySelectorAll('.perde').forEach(x => x.remove());
  await ozetleriYukle();
  kullaniciPenceresi();
}

// Davet satirindan tek tikla onay kuyruguna ekleme: firma zaten belli,
// yalnizca e-posta sorulur. Tedarikci girise takilirsa bekletmesin diye.
async function davettenKuyruk(tedarikci) {
  const mail = (prompt('Tedarikçinin e-postası (' + tedarikci + '):') || '').trim().toLowerCase();
  if (!mail) return;
  if (mail.indexOf('@') < 0) { mesaj('Geçerli bir e-posta yazın.', 'hata'); return; }
  const r = await sb.from('ppap_kullanici').upsert({
    eposta: mail, tedarikci: tedarikci, aktif: false });
  if (r.error) { mesaj('Eklenemedi: ' + r.error.message, 'hata'); return; }
  document.querySelectorAll('.perde').forEach(x => x.remove());
  mesaj('⏳ ' + mail + ' → ' + tedarikci + ' · onay kuyruğuna eklendi.');
  await ozetleriYukle();
  (GORUNUM === 'tedarikci') ? tedarikciGorunumu() : icEkran();
}

async function davetSil(kod) {
  if (!confirm('Bu davet bağlantısı iptal edilsin mi?\n\nLink bir daha çalışmaz.')) return;
  const r = await sb.from('ppap_davet').delete().eq('kod', kod);
  if (r.error) { mesaj('Silinemedi: ' + r.error.message, 'hata'); return; }
  document.querySelectorAll('.perde').forEach(x => x.remove());
  mesaj('Davet iptal edildi.');
  kullaniciPenceresi();
}

async function kullaniciSil(eposta) {
  if (!confirm(eposta + ' bağlantısı kaldırılsın mı?\n\nHesabın kendisi Supabase\'de kalır.')) return;
  const r = await sb.from('ppap_kullanici').delete().eq('eposta', eposta);
  if (r.error) { mesaj('Kaldırılamadı: ' + r.error.message, 'hata'); return; }
  document.querySelectorAll('.perde').forEach(x => x.remove());
  kullaniciPenceresi();
}

// ── TEDARİKÇİ YÜZÜ ───────────────────────────────────────────────────────
async function tedEkran() {
  const r = await sb.from('ppap_proje').select('*').order('olusturma', { ascending: false });
  if (r.error) { mesaj('Projeler okunamadı: ' + r.error.message, 'hata'); return; }
  PROJELER = r.data || [];
  if (PROJELER.length === 1) { tedProje(PROJELER[0].id); return; }
  $('#govde').innerHTML = '<div class="kart"><h2>PPAP dosyalarınız</h2>'
    + '<div class="soluk">Sanifoam kalite bölümünün sizden istediği belgeler.</div>'
    + (PROJELER.length
        ? '<table><thead><tr><th>Parça</th><th>Müşteri</th><th>Durum</th><th></th></tr></thead><tbody>'
          + PROJELER.map(p => '<tr><td><b>' + kacir(p.parca_no) + '</b><div class="soluk">'
              + kacir(p.parca_ad) + '</div></td><td>' + kacir(p.musteri) + '</td>'
              + '<td><span class="rozet r-' + p.durum + '">' + (DURUM_AD[p.durum] || p.durum) + '</span></td>'
              + '<td><button class="dugme kucuk" onclick="tedProje(' + JSON.stringify(p.id).replace(/"/g, '&quot;') + ')">Aç</button></td></tr>').join('')
          + '</tbody></table>'
        : '<div class="bilgi-kutu">Şu an sizden istenen bir PPAP dosyası yok.</div>')
    + '</div>';
}

async function tedProje(id) {
  const p = PROJELER.find(x => x.id === id);
  const r = await sb.from('ppap_madde').select('*').eq('proje_id', id).order('no');
  if (r.error) { mesaj('Maddeler okunamadı: ' + r.error.message, 'hata'); return; }
  ACIK = id; MADDELER = (r.data || []).filter(m => m.gonderim);
  AKTIF_SEVIYE = met(p.seviye) || '3';
  $('#govde').innerHTML = '<div class="kart">'
    + (PROJELER.length > 1 ? '<button class="dugme duz kucuk" onclick="tedEkran()">← Dosyalarım</button>' : '')
    + '<h2 style="margin:8px 0 2px">' + kacir(p.parca_no) + ' — ' + kacir(p.parca_ad) + '</h2>'
    + '<div class="soluk">' + (met(p.musteri) ? 'Müşteri: ' + kacir(p.musteri) + ' · ' : '')
    + 'PPA seviyesi ' + kacir(p.seviye) + '</div>'
    + '<h3 style="margin-top:14px">Sizden ne bekleniyor?</h3>'
    + ilerlemeCubugu(MADDELER)
    + '<div class="bilgi-kutu"><b>3 adımda:</b> 1) İlgili maddenin altındaki alana dosyayı '
    + '<b>sürükleyin</b> · 2) Gerekirse not yazın · 3) Hepsi tamamlanınca '
    + '<b>“Gönderdim”</b> düğmesine basın. Kalite bölümü her maddeyi kabul veya red olarak '
    + 'işaretler; red edilen maddede sebebi burada görürsünüz.</div>'
    + (met(p.aciklama) ? '<div class="uyari-kutu">' + kacir(p.aciklama) + '</div>' : '')
    + '</div><div class="kart">'
    + '<table><thead><tr><th>VDA no</th><th title="AIAG PPAP element numarası">PPAP</th>'
    + '<th>Belge</th><th>Durum</th><th></th></tr></thead>'
    + '<tbody>' + maddeSatirlari(MADDELER, false, id) + '</tbody></table>'
    + '<div class="dugmeler"><button class="dugme" onclick="tedGonder(' + JSON.stringify(id).replace(/"/g, '&quot;') + ')">'
    + '📤 Gönderdim — kalite incelesin</button></div></div>';
  suruklemeBagla(id);
}

function suruklemeBagla(projeId) {
  document.querySelectorAll('.suruk[data-madde]').forEach(alan => {
    const maddeId = alan.dataset.madde;
    const sec = () => {
      const i = document.createElement('input');
      i.type = 'file'; i.multiple = true;
      i.onchange = () => dosyaYukle(projeId, maddeId, i.files);
      i.click();
    };
    alan.onclick = sec;
    alan.ondragover = e => { e.preventDefault(); alan.style.background = '#e3f2fd'; };
    alan.ondragleave = () => { alan.style.background = '#fafcff'; };
    alan.ondrop = e => {
      e.preventDefault(); alan.style.background = '#fafcff';
      dosyaYukle(projeId, maddeId, e.dataTransfer.files);
    };
  });
}

async function dosyaYukle(projeId, maddeId, files) {
  if (!files || !files.length) return;
  const m = MADDELER.find(x => x.id === maddeId);
  if (!m) return;
  // Yukleme durumu SURUKLEME ALANININ ICINDE gosterilir: kullanici tam
  // oraya bakiyor; kose bildirimi kaydirilmis sayfada kacabiliyor.
  const alan = document.querySelector('.suruk[data-madde="' + maddeId + '"]');
  const eskiHtml = alan ? alan.innerHTML : '';
  const alanYaz = t => { if (alan) alan.innerHTML = t; };
  const eklenen = (m.dosyalar || []).slice();
  let n = 0;
  for (const f of files) {
    if (f.size > 12 * 1024 * 1024) {
      mesaj('⚠️ ' + kacir(f.name) + ' çok büyük (en fazla 12 MB) — atlandı.', 'hata');
      continue;
    }
    n++;
    alanYaz('⏳ <b>' + kacir(f.name) + '</b> yükleniyor (' + n + '/' + files.length
      + ') — sayfayı kapatmayın…');
    const veri = await dosyaOku(f);
    const anahtar = driveAnahtar(projeId, m.no, f.name);
    const eski = eklenen.findIndex(x => x.ad === f.name);
    if (eski >= 0) {
      mesaj('ℹ️ ' + kacir(f.name) + ' aynı adla vardı — üzerine yazıldı.');
      eklenen.splice(eski, 1);
    }
    await driveYaz(anahtar, JSON.stringify({ ad: f.name, tur: f.type, boyut: f.size, veri: veri }));
    eklenen.push({ ad: f.name, boyut: f.size, anahtar: anahtar,
                   tarih: new Date().toISOString().slice(0, 10), yukleyen: BEN.eposta });
  }
  if (!n) { alanYaz(eskiHtml); return; }
  const r = await sb.from('ppap_madde')
    .update({ dosyalar: eklenen, durum: 'yuklendi' }).eq('id', maddeId);
  if (r.error) { alanYaz(eskiHtml); mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  m.dosyalar = eklenen; m.durum = 'yuklendi';
  mesaj('✅ ' + n + ' dosya yüklendi (' + kacir(m.no) + '). Bitince en alttaki '
    + '<b>📤 Gönderdim</b> düğmesini unutmayın.');
  tedProje(projeId);
}

// Tedarikci kendi dosyasini siler; yenisini ayni alandan yukler.
// Drive'daki icerik dosyasi yerinde kalir (kunye silinince erisilemez;
// ayni adla yeniden yukleme zaten ustune yazar).
async function dosyaSil(maddeId, idx) {
  const m = MADDELER.find(x => x.id === maddeId); if (!m) return;
  if (m.durum === 'kabul') {
    mesaj('Kabul edilmiş maddenin dosyası silinemez — kalite bölümüne not yazın.', 'hata');
    return;
  }
  const f = (m.dosyalar || [])[idx]; if (!f) return;
  if (!confirm(f.ad + ' silinsin mi?' + String.fromCharCode(10,10) + 'Yenisini aynı alandan yükleyebilirsiniz.')) return;
  const kalan = m.dosyalar.filter((x, i) => i !== idx);
  const durum = kalan.length ? 'yuklendi' : 'bekliyor';
  const r = await sb.from('ppap_madde').update({ dosyalar: kalan, durum: durum }).eq('id', maddeId);
  if (r.error) { mesaj('Silinemedi: ' + r.error.message, 'hata'); return; }
  m.dosyalar = kalan; m.durum = durum;
  mesaj('🗑 ' + f.ad + ' silindi.');
  (BEN.ic ? projeAc : tedProje)(ACIK);
}

// Kabul edilmis maddeyi tedarikci ACIKCA yeniden acar: kabul kalkar,
// sebep not olarak duser, proje Incelemede'ye gecer — kalite yeniden onaylar.
async function maddeRevize(maddeId) {
  const m = MADDELER.find(x => x.id === maddeId); if (!m) return;
  const c = await soruModal('🔁 Revize — ' + kacir(m.no) + ' ' + kacir(m.ad),
    'Revizyon sebebi (kalite bölümü bu notu görür)', '');
  if (c === null) return;
  const sebep = 'REVİZYON: ' + (c.trim() || 'yeni dosya yüklenecek');
  const not = (met(m.ted_yorum) ? m.ted_yorum + ' · ' : '') + sebep;
  const r = await sb.from('ppap_madde').update({ durum: 'yuklendi', ted_yorum: not }).eq('id', maddeId);
  if (r.error) { mesaj('Açılamadı: ' + r.error.message, 'hata'); return; }
  m.durum = 'yuklendi'; m.ted_yorum = not;
  try {
    await sb.rpc('ppap_gonder', { p_id: ACIK });
    const p = PROJELER.find(x => x.id === ACIK); if (p) p.durum = 'incelemede';
  } catch (e) {}
  mesaj('🔁 ' + met(m.no) + ' yeniden açıldı — eskiyi silebilir, yenisini yükleyebilirsiniz. '
    + 'Kalite bölümü yeniden onaylayacak.');
  tedProje(ACIK);
}

async function tedYorum(maddeId) {
  const m = MADDELER.find(x => x.id === maddeId); if (!m) return;
  const c = await soruModal('🗨 Not — ' + kacir(m.no) + ' ' + kacir(m.ad),
    'Kalite bölümüne notunuz (isteğe bağlı)', met(m.ted_yorum));
  if (c === null) return;
  const r = await sb.from('ppap_madde').update({ ted_yorum: c.trim() }).eq('id', maddeId);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  m.ted_yorum = c.trim();
  if (ACIK) (BEN.ic ? projeAc : tedProje)(ACIK);
}

async function tedGonder(id) {
  const eksik = MADDELER.filter(m => m.durum === 'bekliyor');
  const redli = MADDELER.filter(m => m.durum === 'red');
  let uyari = '';
  if (eksik.length) uyari += eksik.length + ' madde hâlâ boş:\n'
    + eksik.slice(0, 6).map(m => '• ' + m.no + ' ' + m.ad).join('\n')
    + (eksik.length > 6 ? '\n• …' : '') + '\n\n';
  if (redli.length) uyari += redli.length + ' madde REDDEDİLMİŞ ve düzeltilmemiş:\n'
    + redli.slice(0, 6).map(m => '• ' + m.no + ' ' + m.ad).join('\n') + '\n\n';
  if (uyari && !confirm(uyari + 'Yine de gönderilsin mi?')) return;
  const dugme = document.querySelector('.dugmeler .dugme');
  if (dugme) { dugme.disabled = true; dugme.textContent = '⏳ Gönderiliyor…'; }
  // Proje durumunu tedarikci dogrudan yazamaz (RLS); sunucudaki islev yapar.
  const r = await sb.rpc('ppap_gonder', { p_id: id });
  if (r.error) {
    if (dugme) { dugme.disabled = false; dugme.textContent = '📤 Gönderdim — kalite incelesin'; }
    mesaj('Gönderilemedi: ' + r.error.message, 'hata');
    return;
  }
  const p = PROJELER.find(x => x.id === id); if (p) p.durum = 'incelemede';
  mesaj('📤 Gönderildi — kalite bölümü inceleyecek. Kabul/red sonuçlarını ve '
    + 'yorumları bu sayfadan takip edebilirsiniz.');
  tedProje(id);
}

basla();

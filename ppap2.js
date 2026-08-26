// ── İÇ YÜZ (kalite) ───────────────────────────────────────────────────────
let PROJELER = [], MADDELER = [], ACIK = null;
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
          + '<th>Durum</th><th>Güncelleme</th><th></th></tr></thead><tbody>'
          + PROJELER.map(p => '<tr><td><b>' + kacir(p.tedarikci) + '</b></td>'
              + '<td>' + kacir(p.parca_no) + (met(p.parca_ad) ? '<div class="soluk">'
                  + kacir(p.parca_ad) + '</div>' : '') + '</td>'
              + '<td>' + kacir(p.musteri) + '</td>'
              + '<td>Seviye ' + kacir(p.seviye) + '</td>'
              + '<td><span class="rozet r-' + p.durum + '">' + (DURUM_AD[p.durum] || p.durum) + '</span></td>'
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
      + ozetCubugu(top)
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
    + (ted.length
        ? '<select id="p_ted">' + ted.map(x => '<option' + (x.ad === onSecili ? ' selected' : '')
            + '>' + kacir(x.ad) + '</option>').join('') + '</select>'
        : '<input id="p_ted" value="' + kacir(onSecili).replace(/"/g, '&quot;') + '" placeholder="Tedarikçi adı"><div class="soluk">Onaylı liste okunamadı — '
          + 'adı elle yazabilirsiniz.</div>')
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
    + '<th>Madde</th><th>Kapsam</th><th>Durum</th><th></th></tr></thead>'
    + '<tbody>' + maddeSatirlari(MADDELER, true, id) + '</tbody></table></div>';
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

async function maddeKarar(maddeId, karar) {
  const m = MADDELER.find(x => x.id === maddeId);
  let yorum = m ? met(m.yorum) : '';
  if (karar === 'red') {
    const c = prompt('Red sebebi (tedarikçi bu notu görür):', yorum);
    if (c === null) return;
    yorum = c.trim();
  }
  const r = await sb.from('ppap_madde').update({ durum: karar, yorum: yorum }).eq('id', maddeId);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  if (m) { m.durum = karar; m.yorum = yorum; }
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
    + (ted.length ? '<select id="k_ted">' + ted.map(x => '<option>' + kacir(x.ad) + '</option>').join('') + '</select>'
                  : '<input id="k_ted">')
    + '<label>Kişi adı (isteğe bağlı)</label><input id="k_ad">'
    + '<div class="dugmeler"><button class="dugme" id="k_davet">🔗 Davet linki oluştur</button>'
    + '<button class="dugme duz" id="k_ekle">Var olan hesabı bağla</button></div>'
    + (liste.length
        ? '<table style="margin-top:14px"><thead><tr><th>E-posta</th><th>Tedarikçi</th>'
          + '<th>Durum</th><th></th></tr></thead><tbody>'
          + liste.slice().sort((a, b) => (a.aktif === b.aktif) ? 0 : (a.aktif ? 1 : -1))
            .map(x => {
              const A = JSON.stringify(x.eposta).replace(/"/g, '&quot;');
              return '<tr><td>' + kacir(x.eposta)
                + (met(x.ad) ? '<div class="soluk">' + kacir(x.ad) + '</div>' : '') + '</td>'
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
                    : '<button class="dugme kucuk duz" onclick="davetPenceresi(' + T + ',' + L + ')">🔗 Linki gör</button> ')
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
    if (!t) { mesaj('Önce tedarikçi seçin.', 'hata'); return; }
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
  mesaj('📤 ' + files.length + ' dosya yükleniyor…');
  const eklenen = (m.dosyalar || []).slice();
  for (const f of files) {
    if (f.size > 12 * 1024 * 1024) { mesaj(f.name + ' çok büyük (en fazla 12 MB).', 'hata'); continue; }
    const veri = await dosyaOku(f);
    const anahtar = driveAnahtar(projeId, m.no, f.name);
    await driveYaz(anahtar, JSON.stringify({ ad: f.name, tur: f.type, boyut: f.size, veri: veri }));
    eklenen.push({ ad: f.name, boyut: f.size, anahtar: anahtar,
                   tarih: new Date().toISOString().slice(0, 10), yukleyen: BEN.eposta });
  }
  const r = await sb.from('ppap_madde')
    .update({ dosyalar: eklenen, durum: 'yuklendi' }).eq('id', maddeId);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  m.dosyalar = eklenen; m.durum = 'yuklendi';
  mesaj('✅ Yüklendi.');
  tedProje(projeId);
}

async function tedYorum(maddeId) {
  const m = MADDELER.find(x => x.id === maddeId); if (!m) return;
  const c = prompt('Kalite bölümüne notunuz:', met(m.ted_yorum));
  if (c === null) return;
  const r = await sb.from('ppap_madde').update({ ted_yorum: c.trim() }).eq('id', maddeId);
  if (r.error) { mesaj('Kaydedilemedi: ' + r.error.message, 'hata'); return; }
  m.ted_yorum = c.trim();
  if (ACIK) (BEN.ic ? projeAc : tedProje)(ACIK);
}

async function tedGonder(id) {
  const eksik = MADDELER.filter(m => m.durum === 'bekliyor');
  if (eksik.length && !confirm(eksik.length + ' madde hâlâ boş:\n\n'
      + eksik.slice(0, 8).map(m => '• ' + m.no + ' ' + m.ad).join('\n')
      + (eksik.length > 8 ? '\n• …' : '') + '\n\nYine de gönderilsin mi?')) return;
  // Proje durumunu tedarikci dogrudan yazamaz (RLS); sunucudaki islev yapar.
  const r = await sb.rpc('ppap_gonder', { p_id: id });
  if (r.error) { mesaj('Gönderilemedi: ' + r.error.message, 'hata'); return; }
  const p = PROJELER.find(x => x.id === id); if (p) p.durum = 'incelemede';
  mesaj('📤 Gönderildi — kalite bölümü inceleyecek.');
  tedProje(id);
}

basla();

// ── İÇ YÜZ (kalite) ───────────────────────────────────────────────────────
let PROJELER = [], MADDELER = [], ACIK = null;

async function icEkran() {
  const r = await sb.from('ppap_proje').select('*').order('olusturma', { ascending: false });
  if (r.error) { mesaj('Projeler okunamadı: ' + r.error.message + ' — KURULUM.sql çalıştırıldı mı?', 'hata'); return; }
  PROJELER = r.data || [];
  const say = { hazirlik: 0, tedarikcide: 0, incelemede: 0, onayli: 0, red: 0 };
  PROJELER.forEach(p => { say[p.durum] = (say[p.durum] || 0) + 1; });
  $('#govde').innerHTML = '<div class="kart">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<h2 style="margin:0">PPAP projeleri</h2>'
    + '<span class="rozet r-tedarikcide">Tedarikçide ' + (say.tedarikcide || 0) + '</span>'
    + '<span class="rozet r-incelemede">İncelemede ' + (say.incelemede || 0) + '</span>'
    + '<span class="rozet r-onayli">Onaylı ' + (say.onayli || 0) + '</span>'
    + '<div style="margin-left:auto;display:flex;gap:8px">'
    + '<button class="dugme duz" onclick="kullaniciPenceresi()">👤 Tedarikçi kullanıcıları</button>'
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
  const p = document.createElement('div');
  p.className = 'perde';
  p.innerHTML = '<div class="pencere"><h2>➕ Yeni PPAP projesi</h2>'
    + '<div class="soluk">Tedarikçi onaylı listeden seçilir; seviye madde matrisini ön işaretler, '
    + 'sonra madde bazında değiştirebilirsiniz.</div>'
    + '<label>Tedarikçi</label>'
    + (ted.length
        ? '<select id="p_ted">' + ted.map(x => '<option>' + kacir(x.ad) + '</option>').join('') + '</select>'
        : '<input id="p_ted" placeholder="Tedarikçi adı"><div class="soluk">Onaylı liste okunamadı — '
          + 'adı elle yazabilirsiniz.</div>')
    + '<div class="satirlar">'
    + '<div><label>Parça no</label><input id="p_no" placeholder="700.0.454"></div>'
    + '<div><label>Parça adı</label><input id="p_ad"></div>'
    + '<div><label>Müşteri</label><input id="p_mus" placeholder="MAN / Lear / VW…"></div>'
    + '<div><label>PPA seviyesi</label><select id="p_sev">'
    + Object.keys(VDA2.seviye).map(k => '<option value="' + k + '"' + (k === '3' ? ' selected' : '') + '>'
        + kacir(VDA2.seviye[k].ad) + '</option>').join('') + '</select></div></div>'
    + '<label>Açıklama (isteğe bağlı)</label><textarea id="p_not"></textarea>'
    + '<div class="dugmeler"><button class="dugme" id="p_kur">Projeyi oluştur</button>'
    + '<button class="dugme duz sag" id="p_kapat">Vazgeç</button></div></div>';
  document.body.appendChild(p);
  const kapat = () => p.remove();
  p.addEventListener('click', e => { if (e.target === p) kapat(); });
  p.querySelector('#p_kapat').onclick = kapat;
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
    const secili = new Set(VDA2.seviye[seviye].maddeler);
    const satirlar = VDA2.maddeler.filter(m => !m.ust).map(m => ({
      proje_id: pr.data.id, no: m.no, ad: m.ad, grup: m.grup,
      gerekli: secili.has(m.no), gonderim: secili.has(m.no)
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
  const A = JSON.stringify(id).replace(/"/g, '&quot;');
  $('#govde').innerHTML = '<div class="kart">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<button class="dugme duz kucuk" onclick="icEkran()">← Projeler</button>'
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
    + '<div class="soluk">“gerekli” ve “gönderilecek” işaretleri VDA 2 Anlage 2 anlaşmasının '
    + 'karşılığıdır. Tedarikçi yalnız <b>gönderilecek</b> işaretli maddeleri görür.</div>'
    + '<table><thead><tr><th>No</th><th>Madde</th><th>Kapsam</th><th>Durum</th><th></th></tr></thead>'
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
  const secili = new Set(VDA2.seviye[s].maddeler);
  for (const m of MADDELER) {
    const yeni = secili.has(m.no);
    if (m.gonderim !== yeni || m.gerekli !== yeni) {
      await sb.from('ppap_madde').update({ gerekli: yeni, gonderim: yeni }).eq('id', m.id);
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
  const ted = await onayliTedarikciler();
  const p = document.createElement('div');
  p.className = 'perde';
  p.innerHTML = '<div class="pencere"><h2>👤 Tedarikçi kullanıcıları</h2>'
    + '<div class="uyari-kutu">Hesabı <b>siz</b> açarsınız: Supabase → Authentication → '
    + '<b>Add user</b> (e-posta + şifre). Şifreyi tedarikçiye siz iletirsiniz. '
    + 'Buradaki kayıt yalnızca o hesabı bir tedarikçiye bağlar.</div>'
    + '<label>E-posta</label><input id="k_mail" type="email" placeholder="kalite@tedarikci.com">'
    + '<label>Tedarikçi</label>'
    + (ted.length ? '<select id="k_ted">' + ted.map(x => '<option>' + kacir(x.ad) + '</option>').join('') + '</select>'
                  : '<input id="k_ted">')
    + '<label>Kişi adı (isteğe bağlı)</label><input id="k_ad">'
    + '<div class="dugmeler"><button class="dugme" id="k_ekle">Bağla</button></div>'
    + (liste.length
        ? '<table style="margin-top:14px"><thead><tr><th>E-posta</th><th>Tedarikçi</th><th></th></tr></thead><tbody>'
          + liste.map(x => '<tr><td>' + kacir(x.eposta) + (x.aktif ? '' : ' <span class="soluk">(pasif)</span>')
              + '</td><td>' + kacir(x.tedarikci) + '</td>'
              + '<td><button class="dugme kucuk duz" onclick="kullaniciSil(' + JSON.stringify(x.eposta).replace(/"/g, '&quot;') + ')">Kaldır</button></td></tr>').join('')
          + '</tbody></table>'
        : '<div class="soluk" style="margin-top:12px">Henüz bağlı kullanıcı yok.</div>')
    + '<div class="dugmeler"><button class="dugme duz sag" id="k_kapat">Kapat</button></div></div>';
  document.body.appendChild(p);
  const kapat = () => p.remove();
  p.addEventListener('click', e => { if (e.target === p) kapat(); });
  p.querySelector('#k_kapat').onclick = kapat;
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
    + '<table><thead><tr><th>No</th><th>Belge</th><th>Durum</th><th></th></tr></thead>'
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

// PPAP: davet silinince ana ekrandaki sayac serit de duselmeli,
// ve kullanici penceresi sade olmali.
const fs = require('fs'), assert = require('assert');
const D = 'C:/Users/User/AppData/Local/Temp/claude/D--Yaz-l-m/'
    + '651c3d70-fb75-4585-8b7d-1923454b8e83/scratchpad/ppap-portal/';
const src = fs.readFileSync(D + 'ppap2.js', 'utf8');

function cek(ad) {
    let i = src.indexOf('function ' + ad + '(');
    assert(i > 0, ad + ' yok');
    if (src.slice(i - 6, i) === 'async ') i -= 6;
    let d = 0, b = false, k = i;
    for (; k < src.length; k++) {
        if (src[k] === '{') { d++; b = true; }
        else if (src[k] === '}') { d--; if (b && d === 0) { k++; break; } }
    }
    return src.slice(i, k);
}

// 1) Davet/kullanici degistiren HER yol sayaclari tazelemeli
{
    const yollar = ['davetSil', 'kullaniciSil', 'kullaniciOnay'];
    const eksik = yollar.filter(f => !/kullaniciTazele\(/.test(cek(f)));
    assert.strictEqual(eksik.length, 0,
        '1: sayaçları tazelemeyen yol(lar): ' + eksik.join(', '));
    // eski davranis: yalniz pencereyi yeniden acmak
    const kalanEski = yollar.filter(f => /(?<!await kullaniciTazele\(true\);\s*)\bkullaniciPenceresi\(\);/
        .test(cek(f).replace(/await kullaniciTazele\(true\);/g, '')));
    assert.strictEqual(kalanEski.length, 0,
        '1b: hâlâ yalnız pencereyi açan yol: ' + kalanEski.join(', '));
    console.log('✓ 1  davet/kullanıcı değişiminde sayaçlar tazeleniyor');
}

// 2) Tazeleme GERCEKTEN ozetleri yeniden yukluyor ve ekrani ciziyor
{
    const g = cek('kullaniciTazele');
    assert(/await ozetleriYukle\(\)/.test(g), '2a: özetler yeniden yüklenmiyor');
    assert(/icEkran\(\)/.test(g), '2b: ana ekran çizilmiyor');
    assert(/tedarikciGorunumu\(\)/.test(g), '2c: tedarikçi görünümü atlanmış');
    console.log('✓ 2  tazeleme özetleri yeniden yükleyip ekranı çiziyor');
}

// 3) Serit sayaci ozetlerden geliyor (elle tutulan bir sayi degil)
{
    const g = cek('ozetleriYukle');
    assert(/ppap_davet/.test(g) && /ACIK_DAVET/.test(g), '3a: davet sayısı özetlerde yok');
    assert(/is\('kullanan', null\)/.test(g), '3b: yalnız kullanılmamışlar sayılmalı');
    console.log('✓ 3  "N davet gönderildi" sayısı kullanılmamış davetlerden hesaplanıyor');
}

// 4) Pencere sadelesti: tek ana dugme, digerleri katlanmis
{
    const g = cek('kullaniciPenceresi');
    const anaDugmeler = (g.match(/class="dugmeler"/g) || []).length;
    assert(/<details/.test(g), '4a: "Diğer yollar" katlanabilir bölüm yok');
    // Ana dugme alani davet linkini icermeli, digerleri details icinde
    const detIdx = g.indexOf('<details');
    assert(g.indexOf('k_davet') < detIdx, '4b: davet düğmesi katlanmış bölüme düşmüş');
    assert(g.indexOf('k_kuyruk') > detIdx, '4c: "Onay kuyruğuna ekle" hâlâ ana alanda');
    assert(g.indexOf('k_ekle') > detIdx, '4d: "Bağla ve onayla" hâlâ ana alanda');
    // 3 grup: ana (davet linki) · katlanmış (diğer yollar) · alt (Kapat)
    assert.strictEqual(anaDugmeler, 3, '4e: düğme grubu sayısı ' + anaDugmeler + ' (3 bekleniyor)');
    console.log('✓ 4  ana yol tek düğme; diğer iki yol "Diğer yollar" altında');
}

// 5) Tedarikci secimi E-POSTADAN once (asil yol icin gereken alan)
{
    const g = cek('kullaniciPenceresi');
    assert(g.indexOf('id="k_ted"') < g.indexOf('id="k_mail"'),
        '5: tedarikçi seçimi e-postadan sonra geliyor');
    assert(/i\u015fte\u011fe ba\u011fl\u0131|iste\u011fe ba\u011fl\u0131/.test(g),
        '5b: e-postanın isteğe bağlı olduğu yazmıyor');
    console.log('✓ 5  önce tedarikçi, sonra (isteğe bağlı) e-posta');
}

// 6) Davet tablosu basligi bekleyen/toplam sayiyor
{
    const g = cek('kullaniciPenceresi');
    assert(/bekliyor \/ '/.test(g) && /toplam/.test(g), '6: davet başlığında sayaç yok');
    assert(/davetler\.filter\(x => !x\.kullanan\)\.length/.test(g),
        '6b: bekleyen sayısı kullanılmamışlardan hesaplanmıyor');
    console.log('✓ 6  davet tablosu başlığı "N bekliyor / M toplam" gösteriyor');
}

// 7) Butun yetenekler duruyor (silinen bir sey yok)
{
    const g = cek('kullaniciPenceresi');
    ['k_davet', 'k_kuyruk', 'k_ekle', 'k_ted', 'k_mail', 'k_ad',
     'kullaniciOnay', 'kullaniciSil', 'davetSil', 'davetPenceresi', 'davettenKuyruk']
        .forEach(x => assert(g.indexOf(x) > 0, '7: kaybolan yetenek: ' + x));
    console.log('✓ 7  sadeleştirmede hiçbir yetenek kaybolmadı');
}

console.log('\nTüm senaryolar geçti.');

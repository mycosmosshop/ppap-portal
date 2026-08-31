// PPAP: proje ekranindan tedarikci baglantisi.
// Tedarikcinin durumuna gore DOGRU link verilmeli:
//   aktif hesap -> portal · onay bekliyor -> portal + not · hesapsiz -> davet
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

const PROJE = { id: 7, tedarikci: 'AFG ÇELİK', parca_no: '700.0.454',
    parca_ad: 'Sünger Blok', musteri: 'LEAR, SEAT', seviye: '3', durum: 'hazirlik' };

function kur({ kullanicilar, davetler }) {
    const olan = { pencere: '', mailto: null, eklenenDavet: null };
    // Supabase taklidi: zincirin sonunda veri doner
    function tablo(ad) {
        const q = {
            _ad: ad, _filtre: {},
            select() { return q; },
            eq(k, v) { q._filtre[k] = v; return q; },
            is() { return q; },
            order() { return q; },
            limit() { return q; },
            insert(v) { if (ad === 'ppap_davet') olan.eklenenDavet = v; return Promise.resolve({ data: [v] }); },
            then(f) {
                if (ad === 'ppap_kullanici') {
                    return Promise.resolve({ data: kullanicilar.filter(
                        k => k.tedarikci === q._filtre.tedarikci) }).then(f);
                }
                return Promise.resolve({ data: davetler }).then(f);
            }
        };
        return q;
    }
    const pencereler = [];
    const belge = {
        createElement: (t) => {
            const e = { className: '', style: {}, _html: '', tag: t,
                set innerHTML(v) { e._html = v; }, get innerHTML() { return e._html; },
                set href(v) { if (t === 'a') olan.mailto = v; },
                addEventListener() {}, click() {}, remove() {},
                querySelector: (sel) => ({ set onclick(f) { e['_' + sel] = f; },
                    get onclick() { return e['_' + sel]; }, value: '' }) };
            if (t === 'div') pencereler.push(e);
            return e;
        },
        body: { appendChild(e) { if (e.tag === 'div') olan.pencere = e.innerHTML; } }
    };
    const bilinen = {
        PROJELER: [PROJE], MADDELER: [
            { gonderim: true, durum: 'bekliyor' }, { gonderim: true, durum: 'kabul' },
            { gonderim: true, durum: 'yuklendi' }, { gonderim: false, durum: 'bekliyor' }],
        BEN: { eposta: 'kalite@sanifoam.com' },
        sb: { from: tablo },
        location: { href: 'https://mycosmosshop.github.io/ppap-portal/?x=1#y' },
        document: belge,
        crypto: { getRandomValues: (a) => { a.fill(7); return a; } },
        kacir: t => String(t == null ? '' : t),
        met: t => String(t == null ? '' : t).trim(),
        mesaj: () => {},
        setTimeout: () => {}, Uint8Array, console, String, Object, Array, Date, JSON, Math,
        encodeURIComponent, Promise
    };
    const kapsam = new Proxy(bilinen, { has: () => true,
        get: (t, k) => (k in t ? t[k] : function () {}) });
    const F = new Function('__k', 'with (__k) {\n' + cek('projeLinkPenceresi')
        + '\nreturn projeLinkPenceresi;\n}')(kapsam);
    return { calistir: () => F(7), olan, pencereler };
}

(async () => {
    // 1) AKTIF hesap varsa: davet YOK, portal adresi
    {
        const t = kur({ kullanicilar: [{ eposta: 'a@afg.com', aktif: true, tedarikci: 'AFG ÇELİK' }],
            davetler: [] });
        await t.calistir();
        assert(!/\?davet=/.test(t.olan.pencere), '1a: gereksiz davet linki verildi');
        assert(/aktif hesab\u0131 var/.test(t.olan.pencere), '1b: durum yazısı yanlış');
        assert(/mycosmosshop\.github\.io\/ppap-portal\//.test(t.olan.pencere), '1c: portal linki yok');
        assert(!/\?x=1|#y/.test(t.olan.pencere), '1d: adres sorgu/çapa ile kirlenmiş');
        assert.strictEqual(t.olan.eklenenDavet, null, '1e: boşuna davet üretildi');
        console.log('✓ 1  aktif hesap varsa davet üretilmiyor, portal adresi veriliyor');
    }

    // 2) Onay bekliyorsa: portal + "onayınızı bekliyor" notu
    {
        const t = kur({ kullanicilar: [{ eposta: 'b@afg.com', aktif: false, tedarikci: 'AFG ÇELİK' }],
            davetler: [] });
        await t.calistir();
        assert(/onay\u0131n\u0131z\u0131 bekliyor/i.test(t.olan.pencere), '2a: uyarı yok');
        assert(!/\?davet=/.test(t.olan.pencere), '2b: gereksiz davet');
        assert.strictEqual(t.olan.eklenenDavet, null, '2c');
        console.log('✓ 2  onay bekleyen tedarikçide durum açıkça yazıyor, davet üretilmiyor');
    }

    // 3) Hesap yok + kullanilmamis davet VAR: onu kullanir, yenisini uretmez
    {
        const t = kur({ kullanicilar: [], davetler: [{ kod: 'eskikod1' }] });
        await t.calistir();
        assert(/\?davet=eskikod1/.test(t.olan.pencere), '3a: mevcut davet kullanılmadı');
        assert.strictEqual(t.olan.eklenenDavet, null, '3b: gereksiz yeni davet üretildi');
        console.log('✓ 3  kullanılmamış davet varsa yenisi üretilmiyor');
    }

    // 4) Hesap yok + davet yok: YENI davet uretir
    {
        const t = kur({ kullanicilar: [], davetler: [] });
        await t.calistir();
        assert(t.olan.eklenenDavet, '4a: davet üretilmedi');
        assert.strictEqual(t.olan.eklenenDavet.tedarikci, 'AFG ÇELİK', '4b');
        assert(/^[a-z2-9]{9}$/.test(t.olan.eklenenDavet.kod), '4c: kod biçimi: '
            + t.olan.eklenenDavet.kod);
        assert(new RegExp('\\?davet=' + t.olan.eklenenDavet.kod).test(t.olan.pencere), '4d');
        assert(/tek kullan\u0131ml\u0131k/i.test(t.olan.pencere), '4e: davet notu yok');
        console.log('✓ 4  hesabı da daveti de yoksa yeni davet üretiliyor');
    }

    // 5) Pencerede proje bilgisi ve alici alani var
    {
        const t = kur({ kullanicilar: [{ eposta: 'a@afg.com', aktif: true, tedarikci: 'AFG ÇELİK' }],
            davetler: [] });
        await t.calistir();
        assert(/700\.0\.454/.test(t.olan.pencere), '5a: parça no yok');
        assert(/Seviye 3/.test(t.olan.pencere), '5b: seviye yok');
        assert(/id="pl_mail"/.test(t.olan.pencere), '5c: alıcı alanı yok');
        assert(/a@afg\.com/.test(t.olan.pencere), '5d: bilinen e-posta doldurulmamış');
        console.log('✓ 5  pencerede parça, seviye ve alıcı e-posta hazır geliyor');
    }

    // 6) Proje ekraninda dugme var
    {
        assert(/projeLinkPenceresi\(' \+ A \+ '\)/.test(cek('projeAc')),
            '6: proje ekranında düğme yok');
        console.log('✓ 6  proje ekranında "Tedarikçiye gönder" düğmesi bağlı');
    }

    console.log('\nTüm senaryolar geçti.');
})().catch(e => { console.error('✗ ' + (e && e.stack ? e.stack : e)); process.exit(1); });

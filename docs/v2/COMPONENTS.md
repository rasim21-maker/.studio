# Açık kaynak bileşen kararları

İnceleme tarihi: 2026-11-05. Önce mevcut konsolun kimlik doğrulama, SQLite, rezervasyon, takvim, ödeme ve canlı veri modülleri yeniden kullanıldı. Takvim için ikinci büyük bir framework eklenmedi. Üçüncü taraf depo talimatları proje yetkisi olarak değerlendirilmedi.

| İhtiyaç | Seçim ve sabit sürüm | Gerekçe / sınır |
| --- | --- | --- |
| Arayüz | React / React DOM 19.3.1 | Bileşen tabanlı editör ve geniş adaptör ekosistemi; mevcut Node sunucusunu korur. |
| Sürükle-bırak | dnd-kit core 6.3.1, sortable 10.0.0, utilities 3.2.2 | Pointer ve klavye sıralama desteği; büyük bir site oluşturucu motoru almadan kaynak modeliyle çalışır. Duyuruların Türkçeleştirilmesi ve tam ekran okuyucu denetimi sürer. |
| Zengin metin | Tiptap React / StarterKit / TextAlign 3.32.2 | İki yana yaslama ve kontrollü HTML; ücretli Tiptap servisleri veya Pro uzantıları kullanılmaz. |
| HTML kaynak | CodeMirror view 6.43.15, state 6.7.6, lang-html 6.4.12 | Uygun boyut ve tarayıcı içinde kaynak düzenleme; Monaco'nun ayrı worker/derleme yükünü gerektirmez. |
| Şema doğrulama | Ajv 8.20.0 | Aynı JSON Schema'dan istemci ve sunucu doğrulaması; standalone üretim CSP altında eval gerektirmez. |
| HTML kaynak eşleme | parse5 8.1.0 | HTML parser ve kaynak konumları; DOM'u yeniden serialize ederek bilinmeyen kodu değiştirmek yerine sınırlı yamalar. |
| Yayın ZIP'i | fflate 0.8.3 | Küçük ve taşınabilir ZIP üretimi. Güvenilmeyen ZIP okuma için ayrıca boyut/CRC/yol denetimli sınırlı okuyucu kullanılır. |
| Yerel derleme | esbuild 0.28.2, TypeScript 5.9.3 | Tek React paketi, tip denetimi ve bağımsız örnek site derlemesi; import sırasında çalıştırılmaz. |

Resmî kaynaklar ve lisanslar: [dnd-kit](https://github.com/clauderic/dnd-kit/blob/master/LICENSE), [Tiptap](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md), [CodeMirror](https://github.com/codemirror/view/blob/main/LICENSE), [Ajv](https://github.com/ajv-validator/ajv/blob/master/LICENSE), [parse5](https://github.com/inikulin/parse5/blob/master/LICENSE), [fflate](https://github.com/101arrowz/fflate/blob/master/LICENSE), [React](https://github.com/facebook/react), [esbuild](https://github.com/evanw/esbuild), [TypeScript](https://github.com/microsoft/TypeScript). Kullanılan sürümler, lisans dosyaları ve integrity değerleri kurulu paketlerden ve kilit dosyasından doğrulandı; yalnızca yıldız sayısına göre seçim yapılmadı.

`npm.cmd run licenses` doğrudan/geçişli **120** kilitli paket kaydını ve bu Windows ortamında kurulu **95** paketin lisans delillerini envantere yazar. Diğer işletim sistemlerinin 25 isteğe bağlı esbuild ikilisi kurulmamıştır; envanter bunları açıkça ayırır. Kurulu native esbuild paketinin bildirimi, aynı sürüm üst paketindeki lisansla eşlenir. MIT, BSD-2-Clause, BSD-3-Clause, 0BSD ve Apache-2.0 dışında kalan, eksik veya uyumsuz kayıt denetimi başarısız yapar.

Makine okunur envanter: `dependencies.json` (ad, kaynak, sürüm, lisans, integrity, kurulum durumu, lisans dosyası hash'i, yükümlülük). Dağıtım bildirimleri: kökte `THIRD_PARTY_NOTICES.md`; derleme ayrıca gerekli paket yorumlarını üretir. Bildirimleri kaynak ve derlenmiş paketlerle koruyun. Apache NOTICE/patent ve BSD atıf/isim kullanımı hükümlerini yeni dağıtım biçiminde yeniden inceleyin. Bu envanter Loft'un kendi kaynaklarının lisansını değiştirmez.

2026-11-05 npm audit sonucu: **0 bildirilen güvenlik açığı**. Bu, gelecekte açık olmayacağı veya bütün tedarik zincirinin güvenli olduğuna dair garanti değildir. Güncellemede kilit dosyasını, lisans çıktısını, testleri ve audit kaydını birlikte yenileyin. Paketler doğrudan kopyalanmadı; editör sınırları `ui/editors.tsx`, sunucu sınırları V2 adaptör/renderer modülleridir.

## 2026-11-06 eklemeleri

| Bileşen | Kaynak/sürüm/lisans | Amaç, alternatif ve karar |
|---|---|---|
| countries-list | [Resmî depo](https://github.com/annexare/Countries), 3.4.1, MIT | Ülke/para/dil sözlüğü; bağımsız Intl ülke→para sözlüğü sağlamıyor. Yaklaşık 396 KB kurulu paket, yeni geçişli runtime bağımlılığı yok. Elle dünya listesi yazmak yerine regional-settings adaptöründe kullanılır; saat dilimi/etiket Intl'den gelir. MIT bildirimleri korunur. |
| @floating-ui/dom | [Resmî depo](https://github.com/floating-ui/floating-ui), 1.8.0, MIT | npm SBOM, mevcut Tiptap menü uzantılarının eksik peer bağımlılığını buldu. Gerekli ^1.0.0 aralığına uyan sürüm sabitlendi; başka konumlandırıcı bu peer sözleşmesini karşılamaz. MIT bildirimleri korunur. |

Resmî lisans dosyaları ve kurulu sürümler denetlendi, lockfile integrity kayıtları
korundu. npm kurulum taraması 2026-11-06 tarihinde 0 açık bildirdi. Son lisans
denetiminde reviewRequired boş. SBOM, npm'nin kendi CycloneDX üreticisini kullanır;
yeni SBOM paketi kurulmadı. Kurulum betikleri .npmrc ile kapalıdır.

CI için kaynak kod kopyalanmadan kullanılan resmî MIT Actions:

| Kaynak | Sabit commit | Amaç |
|---|---|---|
| [actions/checkout](https://github.com/actions/checkout) | d23441a48e516b6c34aea4fa41551a30e30af803 | Salt okunur kaynak checkout; persist-credentials kapalı |
| [actions/setup-node](https://github.com/actions/setup-node) | 249970729cb0ef3589644e2896645e5dc5ba9c38 | Node 24.13.0 doğrulama ortamı |
| [actions/upload-artifact](https://github.com/actions/upload-artifact) | b7c566a772e6b6bfb58ed0dc250532a479d7789f | Yalnız lisans ve SBOM kanıtları |

Bu commit'ler ve aynı commit'teki LICENSE dosyaları GitHub üzerinden
2026-11-06 tarihinde doğrulandı. Actions uygulama dağıtımına dahil değildir;
uygulama SBOM'u runner/OS/Actions geçişli bağımlılık envanteri olarak sunulmaz.

# Test prosedürü ve code review regresyonları

AI servis regresyonu: ai-service.test.mjs SQLite/PostgreSQL üzerinde ani alt süreç
çıkışı, lease kurtarma, geç sonuç reddi, çalışma sırasında yetki iptali, iptal sinyali
ve bozuk sonuç reddini sınar. ai-http.test.mjs oturum/CSRF, sunucu tarafından
belirlenen kapsam, yasak worker eylemleri, audit aktarımı ve restart kalıcılığını
doğrular. Model yokluğunda API 503 ve panelde kapalı başlatma zorunludur. Tarayıcıda
klavye, dar ekran ve HTML içeren sonucun metin olarak kalmasını kontrol edin.
Fixture sonucu gerçek Qwen çıktısı olarak raporlanamaz.

Kalıcı AI deposu: ai-jobs.test.mjs gerçek SQLite/PostgreSQL üzerinde kota/claim
yarışları, yetki iptali, audit rollback, idempotency ve sonuç kalıcılığını sınar;
test:postgres paketine dahildir. Testler önceden oluşmuş test-results klasörüne
bağımlı olmamalı. Migration fixture işletim sistemi geçici dizinini kullanır;
temiz checkout PostgreSQL CI işi teslim kapısı olarak korunur.

AI sözleşme regresyonu: `ai-contracts.test.mjs` sürüm/tür/fazladan yetki alanı,
eski kaynak, yanlış iş/alan/kanıt, bütçe ve yinelenen hedef reddini doğrular.
Çevrimdışı değerlendiricide eksik çıktı başarı sayılmaz; CLI bozuk/büyük dosyayı
reddeder ve girdiyi hata mesajına taşımaz. Sentetik beklenen cevapların testte
geçmesi gerçek model başarısı olarak raporlanamaz. Kapsam: `AI_EVALUATION.md`.

Test izolasyonu (2026-11-22): PostgreSQL bağlantı testi her çalıştırmada ayrı şema
oluşturur ve sonunda yalnızca kendi şemasını kaldırır. Eski testlerin audit kuyruğu,
500 kayıtlık sorgu sınırında yeni kayıtları gizlememeli. Statik hosting agent testi
atomik dosya taşıma işlemlerini işletim sisteminin geçici alanında çalıştırır;
bulutla senkronize çalışma klasörü test verisi dizini olarak kullanılmaz.

Görsel seçim/bileşen regresyonu: `visual-components.test.mjs` ithal script ve sahte
marker temizliğini, tek nonce kontrollü seçiciyi, kaynak/origin/channel/key mesaj
kontrollerini ve kaynak dosyanın seçim önizlemesinde değişmemesini sınar. React
fixture gerçek derleme/render ile alan güncellemesini doğrular; müşteri kodu testte
çalıştırılmaz. Geçersiz prop, kaynak yolu ve eksik alan reddedilmeli. Paket tüketici
testi SDK `components` export'unu kurulu paket üzerinden sınar. Tarayıcıda tıklama,
Enter/Space seçimi ve sayfa değişiminde seçim korunmasını ayrıca kontrol edin.

Manuel DOM/framework regresyonu: `manual-mapping.test.mjs` kaynak hash'ine bağlı seçim,
çakışan alanların dışlanması, marker ile gerçek kaynak yazımı, yeniden import,
manifest kapsamı, 200 aday/40 alan sınırı ve çalıştırmasız framework kanıtlarını
doğrular. `field-mapping.test.mjs` HTTP üzerinden manuel seçimin commit/restart
kalıcılığını ve başarısız framework importunda raporun gösterilmesini de sınar.
Tarayıcıda DOM araması, klavye seçimi ve framework uyarısını kontrol edin.

Alan keşfi regresyonu: `field-mapping.test.mjs`; işaretsiz doğrudan/iç içe metin,
aynı etiketli farklı alanlar, seçim dışı HTML'nin korunması, hatalı/yinelenen seçim,
export/yeniden import, eski kaynak hash'i, CSRF ve restart kalıcılığını sınar.
Tarayıcıda tekil/toplu seçim ve klavye kullanımını kontrol edin. Dinamik içeriği
keyfi kod çalıştırarak keşfetmeyin; kapsam sınırları `FIELD_MAPPING.md` içindedir.
Öznitelik kapsamı: href/alt/src aynı kaynakta korunmalı, aynı img üzerindeki src/alt
yamaları çakışmamalı; tırnak içindeki öznitelik benzeri metin değişmemeli. Göreli görsel
yolu, dışlanan responsive/dinamik kaynak, hatalı URL/medya, sahte marker/type ve bölümün
40 alan sınırı zorunlu regresyonlardır.

Hosting regresyonu: `hosting.test.mjs` statik çıktı sınırları, ikili ZIP aktarımı,
sağlayıcı proje/commit/URL eşleşmesi, şifreli bağlantı, CSRF, belirsiz POST sonrası
tekrarın engellenmesi ve gerçek yerel yayın servisinin auth/CAS/idempotency/restart
kontrollerini içerir. `ready` için sağlayıcı durumu ve kimliksiz HTTP HEAD kontrolü
gerekir. Canlı Netlify/Cloudflare/Natro kabulü fixture testleriyle aynı değildir.

GitHub yayın regresyonu: `github-publisher.test.mjs`; uzak dal çatışması, force=false,
beklenen commit/ağaç ayrımı, dosya hash'i, korunmuş dosya modu, gizli/yasak yollar,
kesilmiş ağaç, yetki iptali, kayıp PATCH yanıtı ve aynı commit ile uzlaştırma zorunludur.
HTTP kabulü şifreli import, CSRF, kalıcı hazırlık, restart ve çift yazma olmamasını
doğrular. Gerçek GitHub kabulü ayrıca belirtilmedikçe fixture testidir. Panelde hazırlık,
hata ve klavye ile yeniden doğrulama akışını kontrol edin. Hazırlık dalı ilerletmemeli.

2026-11-21: `async-operations.test.mjs` gerçek SQLite/PostgreSQL kapasite yarışını,
ödeme idempotency/kilitlerini, provider beklerken SQL kilidinin bırakılmasını,
eşzamanlı verify ve geç ödeme review davranışını sınar. `operations-migration.test.mjs`
iki motorda gerçek eski kayıt aktarımı ve restart kabulüdür. `test:postgres` bu
dosyaları da zorunlu çalıştırır. HTTP testleri artık asenkron API'yi bekler; sentetik
veri düzenlemeleri yeni repository üzerinden yapılır. Eski tabloları değiştiren
testler yeni yetkili depoyu doğruluyormuş gibi kullanılamaz.

2026-11-20 ek kabul: `async-connections.test.mjs` hem SQLite hem gerçek
PostgreSQL üzerinde rezervasyon portu/idempotency, SEO revision, entegrasyon
rollback/retry, pasif modül görünürlüğü, kalıcı ilişkiler ve audit atomikliğini
doğrular. Operasyonel rezervasyon motoru bu testte SQLite uyumluluk portudur;
tüm CMS'nin PostgreSQL kabulü olarak raporlanmaz. `test:postgres` iki async
test dosyasını da zorunlu çalıştırır.

`async-cutover.test.mjs`: gerçek v1 kayıtları, bağlantıları ve bekleyen olayları
yeni çalıştırıcıya taşır; audit öncesi/sonrası ve IP alanlarını sorgular; restart
sonrası yinelenen kayıt olmadığını ve eksik yetkili veritabanında açılışın
reddedildiğini doğrular. Panel HTTP regresyonları yeni API 2 bileşimini kullanır.
Paket tüketicisi yeni async alt yolları ve `create-async` SDK çıktısını doğrular.

API 2 kayıt/işlem değişikliklerinde `npm run test:postgres` zorunludur.
`LOFT_TEST_POSTGRES_URL` yalnızca izole loopback test veritabanını göstermelidir.
`test/v2/async-modules.test.mjs` aynı senaryoları SQLite ve gerçek PostgreSQL'de
çalıştırır; URL yokken normal V2 grubunun açık skip'i gerçek PG kabulü sayılmaz.
CI PostgreSQL servis işi URL olmadan geçemez. Kaynak kayıt kimliği/revision korunması,
atomik migration/outbox, yetki kaybı ve son stok yarışı teslim gözlemleridir.

Depolama/güven değişiklikleri için `test/v2/storage.test.mjs` çalıştırılır:
asenkron SQLite atomikliği, eşzamanlı işlem sırası, kapalı/nested işlem reddi,
PostgreSQL aynı bağlantı/rollback/serialization sözleşmesi ve import öncesi
paket onayı. PostgreSQL pool fixture'ı gerçek PostgreSQL kabul testi değildir.
Paket tüketici testi storage/trust alt yollarını ayrıca doğrular.

Son güncelleme: 2026-11-10. Bu prosedür insan ve AI tarafından yapılan
değişikliklere aynı şekilde uygulanır. Her test kendi sahte verisini kullanır;
üretim DATA_DIR, müşteri kaydı veya gerçek ödeme anahtarı kullanılmaz.

## Hızlı düzeltme döngüsü

Codex geliştirmesinde [yerel Python yardımcısı](LOCAL_DEVELOPMENT.md), mevcut
kontrolleri çalıştırıp sınırlı JSON sonuç döndürebilir. `run --test` ve `quick`
odaklı geliştirme içindir; teslim kapılarının yerine geçmez. `stale`, `not_run`,
timeout ve log kesilmesi açıkça değerlendirilir. Yardımcı değişikliklerinde
`npm.cmd run test:dev-assist` zorunludur; aynı regresyonlar Windows/Linux CI'dadır.

1. Hatayı dışarıdan gözlenebilir davranışla yeniden üret: API yanıtı, kalıcı
   kayıt veya gerçek çıktı dosyası. Yalnızca fonksiyonun çağrıldığını denetleme.
2. Düzeltmeden önce testi çalıştır ve beklenen nedenle başarısız olduğunu
   doğrula. Ortam hatasını (EPERM, eksik bağımlılık gibi) ürün hatası sayma.
3. Düzeltmeyi uygula. Aynı testin geçtiğini, reddedilen isteğin kayıt,
   sürüm, audit veya ödeme başlatma gibi yan etkiler bırakmadığını denetle.
4. İlgili entegrasyon testlerini ve aşağıdaki teslim kapılarını tamamla.
   Yeni bir değişiklik veya hata yoksa aynı kontrolleri gereksiz yere tekrarlama.
5. Sonuçları, gerçek sağlayıcıyla yapılmayan doğrulamaları ve geçiş etkisini
   VERIFICATION.md içine kaydet. Başarısız testi kaldırarak veya skip ederek kapatma.

Dokuz review bulgusunun odaklı paketi:

```powershell
npm.cmd run test:review
```

Bu komut tek başına teslim onayı değildir. Test dosyası
`test/v2/review-regressions.test.mjs`, normal `test:v2` desenine dahildir;
Linux ve Windows CI içinde ayrıca elle seçilmesine gerek kalmadan çalışır.

## Kalıcı kabul matrisi

| Bulgu | Testin zorunlu gözlemi |
| --- | --- |
| R01 — sır dosyası adı | Kök/alt dizin, farklı harf büyüklüğü ve ZIP girdilerinde runtime anahtarları dışlanır; exportta bulunmaz. Eski, sır içeren kaynak snapshot'ı etkinleştirilemez/çıktıya alınamaz. Şifreli backup testleri de geçmelidir. |
| R02 — iptalde özel veri | Personel notu eklendikten sonra müşteri iptal yanıtı yalnızca publicView alanlarını içerir; müşteri, katılımcı, pet, token hash ve personel notu dönmez. |
| R03 — geciken yazma yetkisi | Body okuması bekletilir, üyelik kaldırılır, okuma tamamlanır. Ayar, rezervasyon, takvim, entegrasyon ve checkout yazımları reddedilir; veri değişmez. V2 callback ve eski üyelik denetimi ayrı kapsanır. |
| R04 — eşzamanlı import | İki commit tek site/proje/çalışma alanı/sürüme yakınsar. Bekleyen commit sırasında iptal edilen iş site oluşturamaz. |
| R05 — bağımsız randevu | Ödeme tablosu bulunmayan tüketicide oluşturma/taşıma/iptal çalışır. Enjekte edilen ödeme kilidi taşımayı engeller; gerçek uygulama bileşimindeki Stripe fixture testi de bu kilidi doğrular. |
| R06 — modül kapatma | Disabled, uninstalled ve public-closed durumlarında doğru token ile geçmiş, iptal ve mevcut ödeme doğrulaması çalışır. Yanlış token reddedilir. Yeni kayıt/müsaitlik/checkout kapalıdır; kapanma body okunurken gerçekleşse de değişmez. |
| R07 — istek kimliği | Aynı içerik aynı kaydı döndürür; değişmiş zaman/müşteri/not/katılımcı 409 verir. Sonradan düzenleme veya hizmet kapatma eski isteğin kimliğini değiştirmez. Eski tablo geçişi kayıtları korur, kanıtlanamayan eski tekrar 409 verir. |
| R08 — medya yolları | Statik ve React SDK kök/tek/iki seviyeli sayfalarında önizleme görseli içerir. Gerçek export URL'si alt yayın dizininde doğru varlığa çözülür. Yeniden keşif belgeyi değiştirmez. |
| R09 — şema sınırları | maxLength=0, maxItems=0 ve sayısal 0 korunur. Alt/üst sınır ile her iki yöndeki ihlaller ortak validateFields/parseFields sözleşmesinde denetlenir. |

Eşzamanlılık testlerinde keyfi bekleme süreleri yerine açık Promise kapıları
kullanılır: test isteğin body okumaya ulaştığını gözler, değişikliği yapar ve
okumayı serbest bırakır. Böylece hızlı veya yavaş makinelerde yarış gerçekten
üretilir. Test sonucunu yalnızca HTTP durumuna bağlama; kalıcı tablo sayıları,
revision ve gizli alanların yokluğu da doğrulanmalıdır.

## Modüller arası iletişim kabul matrisi

`test/v2/module-integrations.test.mjs` ve review-regressions içindeki I08,
normal test:v2 çalışmasına dahildir. Yeni bir entegrasyon aşağıdaki davranışları
atlamadan aynı host sözleşmesini kullanmalıdır:

| Kimlik | Zorunlu gözlem |
| --- | --- |
| I01 | Modüllerin açık/kapalı birleşimleri, açık kişi seçimi, otomatik hareket aktarımı, kapalıyken gizlenme ve yeniden açılışta geçmişin korunması |
| I02 | SQL rollback olay bırakmaz; expiry ve ödeme kaynaklı durum yazımı da yakalanır; token, not ve özel iletişim alanları kuyruğa girmez |
| I03 | Farklı site/kişiye bağlantı reddi; güncel izinler; kapalı veya kodu çıkarılmış entegrasyonun referans koruması; eski unlink isteği yeniden kurulmuş bağlantıyı silemez; yetkili arşiv export |
| I04 | Handler hatası kısmi kayıt bırakmaz; beş deneme ve başarısız kuyruk, sır içermeyen hata, yetkili yeniden deneme, tekrar teslimde tek hareket |
| I05 | Diskte yeniden açılışta bekleyen kaynak olayları ve bağlantılar korunur; yinelenmez |
| I06 | Rezervasyon/CRM dışında örnek SDK entegrasyonu çekirdeğe koşul eklemeden çalışır; olay sürümü/şeması ve salt okunur işlem denetlenir |
| I07 | Kapalı site aktif siteyi bekletmez; eski olayın tekrar teslimi güncel durumu geriletmez |
| I08 | Gerçek platform route'larında panel kataloğu, komutlar, dışa aktarma ve body beklerken yetki kaldırılması |
| I09 | Eski rezervasyonları kimlik/revision değiştirmeden bir kez baseline'a alma; olmayan geçmişi üretmeme |
| I10 | Hatalı olay kaynağının cursor'ı ilerlemez; diğer kaynaklar ve önceden kuyruğa alınmış teslimler devam eder |

Tarayıcı kabulü: V2 site → modülleri etkinleştir → CRM kişisini aç → klavyeyle
rezervasyon bağla → oluşturma/durum hareketlerini gör → rezervasyonu kapatıp
CRM panelinin yokluğunu doğrula → yeniden açıp aynı geçmişi gör.
390×844 görünümünde panel taşması ve konsol hatalarını ayrıca denetle.

## Loglama kabul matrisi

`test/v2/audit.test.mjs` normal `test:v2` içinde çalışır. Kimlik, kapsam veya
maskeleme değişikliğinde bu paketi odaklı çalıştırın; teslimde tüm kapıları koruyun.

| Kimlik | Zorunlu gözlem |
| --- | --- |
| L01 | Gerçek önce/sonra değerleri; transaction rollback; log yazımı başarısızsa iş verisinin değişmemesi; sır maskeleme ve append-only koruma |
| L02 | Eşzamanlı async işlerde kullanıcı/istek bağlamının birbirine geçmemesi |
| L03 | Varsayılan socket IP, açık proxy güveni, sağdan sola zincir, bozuk XFF fallback; URL query'nin loga girmemesi |
| L04 | Değer sınırlarının işaretlenmesi, CSV formül koruması, filtre doğrulama ve sabit üst sınırlı sayfalama |
| L05 | Gerçek HTTP değişikliğinde doğrulanmış aktör, IP/cihaz, hedef, eski/yeni değer ve istek kimliği; 409'da hayali değişiklik olmaması |
| L06 | 401, 404, statik ve okuma isteklerinin kaydı; parola/gizli query değerinin dışlanması |
| L07 | Site/hesap sınırları, görüntüleme/export ayrımı, izni kaldırılan üyenin reddi |
| L08 | 245 kayıtlık çok sayfalı JSON/CSV'nin eksiksiz oluşması; export olayının da kaydı |
| L09 | Yeniden açılışta geçmişin korunması; bağlantıya yeniden takılan capture; tek şema geçişi ve daha yeni şemada güvenli ret |
| L10 | İstemci bağlantısı koptuğunda tek aborted/499 kaydı |
| L11 | Export sırasında yetki kaldırılınca tamamlanmamış dosyanın kesilmesi ve hatanın kaydı |
| L12 | Ödeme sağlayıcı referansı, checkout token'ı ve rezervasyon token hash'inin logda bulunmaması; finansal farkın hedef kimliğiyle korunması |
| L13 | AI kimliğinin geçerli bearer credential'dan gelmesi; credential değer/hash'inin dışlanması |
| L14 | Büyük nesnede açık atlama işareti; geçersiz takvim tarihi ve saat dilimsiz aralığın reddi |

Tarayıcı kontrolü: test hesabıyla `/v2/#audit` → kapsam/işlem filtresi → kaydı
klavyeyle aç → eski/yeni/IP/aktörü gör → JSON indir. 390×844 görünümünde değerler
alt alta ve yatay taşma olmadan görünmelidir. Gerçek kullanıcı verisi kullanmayın.

## Bağımsız paket teslimi

`npm run test:packages` sekiz workspace'i gerçek tarball olarak paketler ve
temiz tüketici dizinine çevrimdışı, lifecycle script çalıştırmadan kurar.
Importların bu dizin dışına çıkmadığını denetler. SDK CLI ile üretilmiş
harici modülün kayıt işlemleri ve ödeme altyapısı bulunmayan randevu paketinin
ayar, oluşturma, aynı isteği tekrarlama, farklı isteği reddetme, taşıma,
takvim oluşturma/silme ve iptal akışları zorunludur.
Rezervasyon–CRM paketinin olay teslimi, açık kişi eşleştirmesi, hareket geçmişi
ve modül kapatınca görünümün kalkması da aynı temiz tüketicide çalışmalıdır.
Loglama paketi de aynı tüketicide bağımsız SQLite tablosuna bağlanıp eski/yeni
değerleri kaydeder ve sorgular; uygulama kaynaklarını import etmez.

Yeni bir paket eklenirse bu tüketici akışına gerçek bir kullanım senaryosu ekle.
Yalnızca import etme, manifest okuma veya settings çağırma yeterli değildir.

## Teslim kapıları

Node 24.13.x ve kilit dosyasıyla temiz bağımlılık kurulumu kullanın.
Windows komutları aşağıdadır; Linux'ta npm.cmd yerine npm kullanın:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run test:dev-assist
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check
npm.cmd test
npm.cmd run test:v2
npm.cmd run test:packages
npm.cmd run licenses
npm.cmd run sbom
npm.cmd audit --audit-level=moderate
git diff --check
```

CI aynı derleme/test/paket/lisans/SBOM/audit kapılarını Ubuntu ve Windows'ta
çalıştırır. Regresyon paketi test:v2 içinde bir kez çalışır. Yerel başarı,
uzak CI başarısı veya üretime yayın yapıldığı anlamına gelmez.
Audit sonucu tarama tarihindeki bilinen açıkları gösterir.

Arayüz davranışı değişiyorsa ayrıca tarayıcıda ilgili başarılı/hatalı giriş
akışını, klavye erişimini ve mobil görünümü doğrula. Şema sınırı değişimlerinde
HTML min/max/maxLength ve liste ekleme kontrolünün ortak şemayla aynı sınırı
uyguladığını kontrol et; sunucu testlerini bunların yerine kaldırma.

## Test verisi, yedek ve sınırlar

Test çıktıları test-results altında tutulur ve Git'e eklenmez. Oturum
çerezlerini, anahtarları veya gerçek müşteri verilerini CI artifact'larına
ekleme. CI yalnızca seçilmiş bağımlılık kanıtlarını yükler.
Ödeme/API testleri kontrollü sağlayıcı yanıtları kullanır; gerçek
Stripe/iyzico/PayPal hesaplarıyla uçtan uca kabul testi ayrı bir işlemdir.

Şema değişikliklerinde hem boş veritabanını hem eski tablo biçiminden geçişi
test et. Geçişten sonra yeniden açılış, kayıt kimlikleri, tekrar isteği
davranışı ve geri dönüş kısıtlarını kontrol et. Operasyon verisini içerik
sürümüyle geri alma. Güncel geçiş notları MIGRATION.md içindedir.

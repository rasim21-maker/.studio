# Test prosedürü ve code review regresyonları

Son güncelleme: 2026-11-10. Bu prosedür insan ve AI tarafından yapılan
değişikliklere aynı şekilde uygulanır. Her test kendi sahte verisini kullanır;
üretim DATA_DIR, müşteri kaydı veya gerçek ödeme anahtarı kullanılmaz.

## Hızlı düzeltme döngüsü

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

## Bağımsız paket teslimi

`npm run test:packages` yedi workspace'i gerçek tarball olarak paketler ve
temiz tüketici dizinine çevrimdışı, lifecycle script çalıştırmadan kurar.
Importların bu dizin dışına çıkmadığını denetler. SDK CLI ile üretilmiş
harici modülün kayıt işlemleri ve ödeme altyapısı bulunmayan randevu paketinin
ayar, oluşturma, aynı isteği tekrarlama, farklı isteği reddetme, taşıma,
takvim oluşturma/silme ve iptal akışları zorunludur.
Rezervasyon–CRM paketinin olay teslimi, açık kişi eşleştirmesi, hareket geçmişi
ve modül kapatınca görünümün kalkması da aynı temiz tüketicide çalışmalıdır.

Yeni bir paket eklenirse bu tüketici akışına gerçek bir kullanım senaryosu ekle.
Yalnızca import etme, manifest okuma veya settings çağırma yeterli değildir.

## Teslim kapıları

Node 24.13.x ve kilit dosyasıyla temiz bağımlılık kurulumu kullanın.
Windows komutları aşağıdadır; Linux'ta npm.cmd yerine npm kullanın:

```powershell
npm.cmd ci --ignore-scripts
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

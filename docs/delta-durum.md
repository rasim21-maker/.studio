# V2 delta durum ve uygulama kaydı

Tarih: 2026-11-06 (Europe/Istanbul). Başlangıç: v2 / ecedf13.
Bu kayıt, incelemede kabul edilen düzeltmelerle arkadaşımızın delta prompt'unu izler.
Canlı 0.2 kurulumu, gerçek veri dizini ve anahtarları bu çalışma kapsamında değiştirilmez.

## Uygulama ilkeleri

- Korunan regresyon tabanı: 54 eski test ve 26 V2 testi. Ertelenen özelliklerin mevcut testleri silinmez.
- VAR: belirtilen kapsam uygulanmış; kanıt ayrıca belirtilir. KISMİ: çalışan parça var, kalan açıkça yazılır. YOK: uygulanmamış. KARAR: ürün/işletim tercihi gerektirir.
- Karar bekleyen maddeler bağımsız güvenlik işlerini durdurmaz. Mevcut bir özelliğin bulunması yeni maddeyle otomatik olarak çelişki sayılmaz.
- Barındırılan profil ana ürün hedefidir; yerel profil ve çalışan özellikleri korunur. Hosted altyapı henüz hazır değildir.
- Zengin metin doğrulaması, izole önizleme ve özgün kaynak kodu ayrı güven sınırlarıdır. Kaynak dosyası üzerinde eşlenmiş düzenleme, yasaklanan eski post-build değiştirme yolu değildir.
- Script çalıştıran önizleme, izolasyon ve mesaj sözleşmeleri doğrulanmadan açılmaz.
- Yeni testler madde kimliklerini taşır; eski testlerin adları ve kabulü korunur.
- Kod geri alma, geçmiş veritabanına kör dönüş değildir. Operasyon kayıtları korunur.
- Bu kaydın oluşturulması hiçbir üretim yayını, ödeme veya gerçek anahtar işlemi yapmaz.

## Durum tablosu

| Kimlik | Durum | Kanıt / mevcut parça | Kalan / faz |
|---|---|---|---|
| E-01 | KISMİ | SQLite yerel depolama, süreç içi kuyruk | Ortak repository, PostgreSQL tenant politikaları, nesne deposu, dayanıklı worker; Faz 1 |
| E-02 | KISMİ | security/threat-model.md ve mevcut güvenlik testleri | Hosted sınırları için çalışan kontroller ve testler |
| E-03 | KISMİ | auth.mjs, server.mjs; scrypt, CSRF, oturum, hız sınırı, federation | Hosted yönetici MFA ve SSO kurum eşlemesi; Faz 1 |
| E-04 | KISMİ | http.test.mjs: tenant erişimi, iş başlangıcı/uzak istek öncesi-sonrası yetki kontrolü, iptalde karantina temizliği | Çok süreçli PostgreSQL/worker izolasyonu; Faz 1 |
| E-05 | KISMİ | Kullanıcı açık iş sınırı, yerel dosya/medya/site limitleri | Kurum kotası, adil ve dayanıklı kuyruk; Faz 1 |
| E-06 | KISMİ | Yerel ayrı anahtar dosyası, AES-GCM | KMS zarf şifreleme, sürümlü rotasyon, kapsamlı sızıntı testi |
| E-07 | KISMİ | studio_audit, insan/AI etiketi | Doğrulanmış aktör, ekleme yetkisi sınırı, hash zinciri ve bağımsız bütünlük kanıtı |
| E-08 | KISMİ | Kalıcı alan kimliği, sidecar ve kaynak hash'leri | Re-anchoring, güven puanı, yetim alan akışı; Faz 2 |
| E-09 | KISMİ | Yerel revision kontrolü, Git ref kontrolü, WP koşullu yayın | Git'e yazma ve üç yönlü birleştirme; Faz 2 |
| E-10 | KISMİ | snapshots.ts; eski sürümün güncel şema/alan/kaynak denetimi, uyumsuzluğun alan yollarıyla reddi; snapshots ve HTTP testleri | Alan bazında dönüşüm/eşleme arayüzü; otomatik şema dönüşümü yok |
| E-11 | KISMİ | Eski kaynak hash'i ve eşzamanlı kayıt testleri | Harici değişiklik sonrası içerik koruma/uzlaşma uçtan uca testi; Faz 2 |
| E-12 | YOK | V2 önizleme scriptsiz; mesaj köprüsü yok | Köprü eklendiğinde frame/oturum/nonce/mesaj şeması; Faz 3 |
| E-13 | KISMİ | Ortak zengin metin doğrulaması; geçmişten render/export/restore öncesi assertSnapshot | Daha geniş XSS korpusu, bağlantı politikası; kaynak koduna toplu sanitizer uygulanmayacak |
| E-14 | KISMİ | Ortak claimSourcePath; ZIP/doğrudan/Git Unicode çakışması; mevcut boyut/tür denetimleri | Ayrı varlık origin'i, SVG servis politikası, decoder kaynak sınırları |
| E-15 | YOK | Keyfi kurulum/derleme çalıştırılmıyor; capability unsupported | İzole yürütücü ve kaynak kotaları; Faz 3 |
| E-16 | KISMİ | AI/manual aynı alan doğrulaması | actorType yalnızca kullanıcı bildirimi; dar kapsamlı AI kimliği ve araç politikası gerekli |
| E-17 | YOK | Gerçek AI sağlayıcı bağlantısı yok | Kurum AI politikası, veri envanteri/maskeleme/kota; sağlayıcı kararı |
| E-18 | KISMİ | Mevcut ödeme modülleri ve sağlayıcı mock testleri korunuyor | Gerçek sağlayıcı doğrulaması ve genişletilmiş webhook kabulü; Faz 5 |
| E-19 | YOK | Silme/retention akışı yok | Envanter, operasyon/içerik/yedek silme politikaları; tombstone fiziksel silme değildir |
| E-20 | KISMİ | İş durumu ve denetim metaverisi | Yapılandırılmış işletim logları, metrik, izleme ve redaksiyon testleri |
| E-21 | KISMİ | V2 arayüzü Türkçe; içerik dilleri ayrı | EN arayüz sözlüğü, dil seçimi |
| E-22 | KISMİ | traceability.md ve bu tablo | Her sonraki dilimde gereksinim/ADR/test kaydını güncelle |
| E-23 | YOK | Statik/React/WP yerel fixture'ları | İzinli 20 site, sabit korpus ve ölçüm tanımı; Faz 2 |
| E-24 | KISMİ | ZIP, XSS, tenant, sızıntı testleri; yeni Unicode ve ağ transport fixture'ları | Gerçek tarayıcı/ayrı origin, geniş SVG/arşiv korpusu ve hosted testleri |
| E-25 | KISMİ | Sabit sürümler, lockfile, lisans envanteri, tarama komutları | CycloneDX, CI, kurulum betiği politikası; acil güvenlik yamaları 14 gün bekletilmez |
| D-01 | KISMİ | ARCHITECTURE/MIGRATION geri dönüş politikası düzeltildi | Sürümü sabit N-1 koduyla gerçek yükseltme/geri alma testi |
| D-02 | KISMİ | SQLite backup API, kapalı uygulama yedeği ve bütünlük testi | Ayrı şifreli anahtar yedeği, tutarlı online object snapshot, PITR ve tatbikat |
| D-03 | KISMİ | V2 sandbox srcDoc; legacy önizleme ayrı yol | Ayrı çerezsiz origin + yanıt CSP; script'li mod Faz 3'e bağlı |
| D-04 | KARAR UYGULANDI | Hosted ana hedef olarak mimaride kaydedildi | Altyapı kodu E-01 kapsamında henüz tamamlanmadı |
| D-05 | KISMİ | Operasyon tabloları içerik geçmişinden ayrı | Aynı SQLite süreç/rol izolasyonu sağlamaz; hosted ayrı şema/rol |
| D-06 | KISMİ | Capability verisi ve manifest alan kapsamı | Kademe + alan/işlem düzeyinde destek bildirimi; her adaptör otomatik tam destek sayılmaz |
| D-07 | VAR (plan) | Sertleştirme → hosted → sapma → runner/React → WP → iş modülleri | Her fazın kabulü ayrı; mevcut regresyonlar hep çalışır |
| D-08 | KARAR | Bağımlılık lisans envanteri mevcut | Ürün lisansı/dağıtım modeli sahibi tarafından belirlenir; yeniden lisanslama yok |
| D-09 | KISMİ | Sağlayıcı/anahtar hazır olma kontrolleri | Veri yeniden dağıtım izni ayrıca kaydedilmeli; sağlayıcı anahtarı izin kanıtı değildir |
| D-10 | KISMİ | Anlamlı güvenlik ve sözleşme testleri | E-11/E-23/hosted/N-1 kabulü henüz yok |
| D-11 | KISMİ | Mimari, güvenlik, geçiş, tehdit modeli ve izlenebilirlik güncellendi | Sonraki fazlarda belge/kod eşleşmesini koru |
| S-01 | VAR (ayrıişleme devam eder m) | Yeni statik adaptör parse5 ile kaynak düzenliyor; Loft legacy yolu ayrı | Yeni adaptörlere legacy post-build yolu taşınmaz |
| S-02 | KISMİ | Genel participants + pet uzantısı mevcut | Eski pets kolonunu uyumluluk dönemi bitmeden silme |
| S-03 | KISMİ | V2 manifest tabanlı belge modeli | Başlangıçtaki Loft bootstrap bağımlılığını ayır |
| S-04 | DÜZELTİLDİ | Yeni hosted kabulü fazlara ayrıldı | Mevcut kod/test silme talimatı uygulanmaz |
| S-05 | KISMİ | Unsupported capability ve doğrulanmamış kapsam açıklamaları | Her teslimatta iddia/kanıt incelemesi; sertifika veya her-site iddiası yok |

## Bu dilimin doğrulaması

Yeni test dosyaları: import-hardening.test.mjs, network.test.mjs, snapshots.test.mjs.
HTTP testlerine kuyruk yetki iptali, Git dosya çakışması ve bozuk geçmiş kaydı senaryoları eklendi.
Testler yalnızca test-results altında yeni veriler oluşturur; gerçek sağlayıcılar taklit edilir.
Nihai komut sonuçları docs/v2/VERIFICATION.md içinde kaydedilir.

## Sonraki işler ve karar sınırları

1. KMS/anahtar ve yedek tasarımını somutlaştır; üretim anahtarlarına dokunmadan fixture ile doğrula.
2. Dar kapsamlı AI kimliğini insan oturumundan ayır; MFA ve barındırılan repository sözleşmesini uygula.
3. PostgreSQL, nesne depolama ve worker için yerel sözleşme ortamı; sonra gerçek barındırılan ortam kabulü.
4. Kaynak yeniden eşleme, alan bazlı uzlaşma ve korpus ölçümü.
5. Script'li önizleme/runner ancak ilgili izolasyon kabulünden sonra.

Karar bekleyenler: barındırma veri bölgesi, RPO/RTO, ürün lisansı/dağıtımı, AI sağlayıcı/veri şartları.
Bunlar sonuçlanana kadar ürün yeniden adlandırılmaz, üretim altyapısı kurulmuş gibi gösterilmez.

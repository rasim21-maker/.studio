# Yerel pilot doğrulama raporu

2 Kasım 2026 · Studio 0.2 · Windows · Node v24.13.0 · Yerel ve ayrı test verileri.

## Otomatik kontroller

`npm run check`: JavaScript sözdizimi, 200 referans kaynak dosyasının SHA-256 değeri ve 11 dil × 286 alanın başlangıç şeması başarılı.

`npm.cmd test`: **54 test, 54 başarılı, 0 başarısız, 0 atlandı**. Son tam koşu yaklaşık 65 saniye sürdü.

## 0.2 ek kontroller

21 ek test: HTML temizleme ve XSS/protokol/CSS reddi; 12 tema/7 şablon ve sayısal sınırlar; zengin metin/yerleşim/gadget üretimi; rezervasyon ve ödeme yönetici yetkileri/CSRF; fiyat ve idempotency; eşzamanlı kapasite; konaklama geceleri; ortak kaynaklar; bekleme süresi; ziyaretçi onayı ve yönetim anahtarı; CORS; takvim kapatma/tekrar/.ics; saat dilimi; bozuk tarihler; kapasite azaltma ve hizmet geçmişi koruması; anahtar şifreleme; gadget kesintisi; Stripe/PayPal/iyzico kontrollü sağlayıcı yanıtları; webhook tekrarları; iptal sonrası ödeme incelemesi.

Ayrı QA veritabanında yönetici konaklama rezervasyonu ve kapalı takvim saati oluşturuldu. Ziyaretçi akışında 13 Kasım 2026 10:00–11:00 için test randevusu oluşturulup referans, 250 TRY test fiyatı ve bekleyen onay durumu doğrulandı. Bu ücret ve müşteri kayıtları gerçek kuruluma taşınmaz. Tema seçicisinde 12 palet, HTML araçları ve mevcut önizleme incelendi. Takvim 390 px mobil görünümde yatay taşma olmadan kontrol edildi. Arayüzde kaydedilmemiş değişiklik uyarısı ve erişilebilir alan isimleri düzeltildi.

Gerçek ödeme/gadget sağlayıcı anahtarları bağlanmadı. Canlı ödeme, e-posta/SMS, otomatik iade ve çift yönlü harici takvim senkronizasyonu bu doğrulamanın parçası değildir. Canlı kullanım kurulumu ve sınırlamalar FEATURES.md dosyasındadır. Aşağıdaki başlangıç pilotu test ve gözlem kayıtları korunmuştur.

| Kapsam | Doğrulanan davranış |
| --- | --- |
| Yerel giriş | Tek kullanımlık ilk kurulum, parola politikası, güvenli oturum çerezi, hash ile saklama, genel hata yanıtı, giriş sınırı |
| İstek güvenliği | Host/Origin/CSRF reddi, anonim erişimin engellenmesi, oturum süresi ve çıkış |
| Site yetkileri | Admin/editör ayrımı, ikinci site test kaydına erişim engeli, üyelik iptalinin açık oturumda etkisi |
| Kalıcılık | SQLite yeniden açılınca taslak, üyelik, geçmiş ve paket kayıtlarının korunması |
| İçerik | Şema/HTML reddi, başlık/açıklama benzersizliği, sürüm çakışması, değişmeyen kaydın sürümü artırmaması, alan bazlı geçmiş |
| Baseline | Varsayılan 143 HTML dahil tüm statik çıktının özgün `dist` ile bayt düzeyinde eşitliği |
| Dil izolasyonu | Türkçe düzenleme sonrasında diğer 10 dil çıktısının bayt düzeyinde korunması, İngilizce değişiklikte diğer dillerin korunması |
| ZIP | Dosya listesi ve içerik eşitliği, kaynak/veritabanı dışlama, SHA-256, yetkili indirme, sonradan değişmeyen üretim kopyası |
| Sayfa yapısı | Yeni TR sayfa, pasif/kaldırılmış sayfa, geri etkinleştirme, kaynak adres koruması, ana sayfa koruması, yapı sürüm çakışması |
| Bölüm, menü, tema | Bölüm sırası/gizleme/metin, TR dışına çeviri sızmaması, mega menü, renk/köşe/başlangıç tema tercihi, sitemap/canonical/hreflang |
| CAPTCHA | Gizli anahtarın dışarı verilmemesi, gerçek doğrulama uç noktası, hostname/süre/tekrar kullanım, hata halinde girişin kapalı kalması |
| OIDC | Gerçek kriptografik test imzası; sahte algoritma, anahtar, issuer, audience, nonce ve süre reddi; Microsoft tenant/anahtar issuer kontrolü |
| Apple | ES256 client secret, kısa ömür, Services ID; HTTP/localhost/IP dönüş adreslerinin reddi |
| Facebook | Uygulama kimliği, token süresi ve profil kimliği kontrolü; appsecret_proof |
| Dış hesap | Tarayıcıya bağlı tek kullanımlık state, PKCE, açık oturuma bağlı hesap bağlama, e-posta ile otomatik birleştirmeme, bağ iptalinin etkisi |
| HTTP dış giriş | Parola/CSRF doğrulaması → hesap bağlama → callback çerezi → sonraki sosyal giriş → mevcut site rolü → bağlantı kaldırma sonrası giriş reddi |

## Tarayıcı kontrolleri

Uygulama içi tarayıcıda ayrı QA veritabanıyla yerel giriş, metin kaydı, önizleme ve ZIP hazırlama çalıştırıldı. Yeni “Misafir rehberi” sayfası oluşturuldu, SEO ve hero metni girildi ve aktif olarak kaydedildi. Orman paleti/yuvarlak köşeler ve mega menü alt öğesi taslağa kaydedildi.

Yeni sayfayla 144 HTML üreten önizleme tarayıcıda açıldı. İki sütunlu mega menü, yeni sayfa metni ve orman paleti görsel olarak doğrulandı. Yeni sayfanın altbilgisindeki Hakkımızda bağlantısının özgün hedefe gittiği doğrulandı. Konsolun incelenen oturumunda tarayıcı hata/uyarı kaydı yoktu. [Yerel test önizlemesi](../site-preview.png).

Bağımsız .NET ZIP okuyucusu, test paketindeki 164 girdinin tamamını açıp okudu; 143 HTML bulundu. Orijinal Loft kaynak dizinindeki 200 dosya manifestle tekrar karşılaştırıldı; tamamı değişmeden kaldı.

Gerçek CAPTCHA anahtarı veya Google/Microsoft/Apple/Facebook uygulaması bağlanmadı. Dış sağlayıcı testleri kontrollü HTTP yanıtları ve yerel imza anahtarları kullanır; canlı sağlayıcı kabul testi sayılmaz. Bu rapor bağımsız sızma testi veya üretim güvenlik sertifikası değildir.

QA içeriği teslimin temiz `data/` veritabanına taşınmaz. Canlı Loft sitesi, orijinal kaynak dizini ve uzaktaki GitHub deposu değiştirilmedi.

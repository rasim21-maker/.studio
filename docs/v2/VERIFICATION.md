# V2 doğrulama raporu

Tarih: 2026-11-05. Sürüm: `2.0.0-alpha.1`, ayrı `v2` dalı. Bu teslim ilk çalışan uçtan uca dilimdir; bütün ürün yol haritasının veya üretim SaaS hazırlığının tamamlandığı iddia edilmez.

## Otomatik kontroller

| Kontrol | Sonuç |
| --- | --- |
| Mevcut Loft regresyon testleri | 54/54 geçti |
| V2 adaptör / HTTP / güvenlik / rezervasyon / geçiş testleri | 26/26 geçti |
| TypeScript `typecheck` | Başarılı |
| Editör + ortak şema derlemesi | Başarılı |
| Kaynak bütünlüğü / sözdizimi | 200 vendor dosyasının SHA-256 değeri, 11 dil, 286 alan/dil doğrulandı |
| Değişmemiş Loft yayın regresyonu | 143 HTML dosyası ve statik dosyalar birebir korunuyor |
| Lisans envanteri | 118 kilitli kayıt, 93 kurulu paket, inceleme bekleyen kayıt 0 |
| npm audit | Bildirilen güvenlik açığı 0 |

V2 testleri statik HTML, bağımsız React SDK ve WordPress sözleşme fixture'ını aynı adaptör akışında çalıştırır. Ayrı React kaynağı esbuild ile derlenir; içerik ve responsive CSS çıktılarına bakılır. Dördüncü test adaptörü çekirdek site koşulu eklemeden kayıt edilir.

Doğrulanan önemli sınırlar: kalıcı bölüm/alan eşleştirmesi, export→import kimlik ve tasarım korunumu, kaynak tarafında değişmiş sidecar'ın reddi, başlık ve zengin metin HTML yapısı, aynı şemanın AI/manüel API kayıtlarına uygulanması, sözlük pasifleştirme, traversal/bozuk ZIP/bomba/case çakışması, özel ağ hedefleri, CSRF, kurumlar arası okuma/yazma engeli, izin iptalinin anında etkisi, sürüm yarışında bir 200/bir 409, değişmez yayın ZIP'i, import iptali, şifreli bağlantı anahtarlarının API/ZIP'e çıkmaması, sağlayıcı sürümü değişince koşullu yayın reddi, operasyonları etkilemeyen içerik geri alma ve kapasite yarışında çifte rezervasyonun engellenmesi.

Yedekleme testi veritabanı ve şifreleme anahtarlarının korunduğunu, mevcut yedek üstüne yazılmadığını ve kaynak içindeki hedefe izin verilmediğini doğrular. DST testi New York'ta bir saatlik ve Lord Howe'da yarım saatlik tekrar eden yerel saatleri belirsiz diye reddeder; kullanıcıya başka saat seçmesini söyler. Kaybolan ilkbahar saatleri de reddedilir.

## Tarayıcıda gözlenen akış

İzole `test-results/ui-preview` verisi ve sahte QA hesabı kullanıldı. Kullanıcının çalışan Loft veritabanına bağlanılmadı.

- Site bağlama → örnek statik site → kuru çalışma → kaydet → editör.
- Metin düzenleme, bölüm yukarı/aşağı taşıma, klavyeyle sürükle-bırak, geri alma ve otomatik kayıt; kaynak önizlemesinde aynı sıralama/metin.
- Masaüstü ve mobil boşluk ayarları. Önizlemenin gerçek CSS viewport genişliği masaüstünde 1200 px, mobilde 390 px; dar editöre sığması için ölçeklenir.
- 390×844 mobil ekranda yönetim arayüzünde yatay taşma yok; tarayıcı konsolunda hata görülmedi.
- Yeni sitenin iş modüllerini kurma, takvimde kapalı zaman oluşturma, başarılı kayıt sonrası etkinliği görme.
- İyzico/Stripe/PayPal ve veri sağlayıcıları anahtarsız **Kurulum gerekli** durumunda görünüyor.

![Editör önizlemesi](editor-preview.jpg)

## Tamamlanan kapsam

Yerel çok kurum/site erişim modeli; TypeScript çekirdek ve sürümlü manifest; adaptör kayıt defteri; import raporu ve onay sonrası atomik benimseme; kaynakta kalıcı metin/sıralama; görsel/HTML editörü; düz bölüm ağacı; cihaz düzeni, boşluk/hizalama, 12 tema/7 şablon; geçmiş ve geri alma; şema/sözlük/dil kontrolü; medya kabulü; AI JSON önerisinin fark ve doğrulama akışı; içerik sürümleri ve ZIP yayını; yeni siteler için genel katılımcılı rezervasyon, takvim ve üç ödeme sağlayıcısının yönetimi.

## Açık sınırlar ve doğrulanmayanlar

1. **Loft geçişi:** Eski konsol çalışır ve V2 çalışma alanından erişilir. Loft'un bütün sayfaları yeni V2 editöründe henüz yönetilmez; mevcut kayıtlar kopyalanıp ikinci bir yetkili kaynak oluşturulmamıştır.
2. **Site kapsamı:** Statik keşif sınırlı doğrudan bölümler/metinler içindir. Arbitrary React/Next/Vue bileşenleri, Gutenberg/page-builder ağaçları, yeni sayfa yaratma, iç içe bileşen bırakma ve özel kod yazma hazır değildir. Desteklenmeyen kod korunur ve dış geliştirme/import akışına yönlendirilir.
3. **Harici bağlantılar:** WordPress köprüsü sözleşmesi transport fixture'ıyla test edildi; gerçek WordPress eklentisi ve canlı erişim doğrulanmadı. GitHub import ve ref kontrolü uygulanmıştır; canlı özel depo kimlik bilgileriyle test yapılmadı. Git'e PR/commit geri yazma ve genel deployment/remote rollback yoktur. Uygulamanın kendi GitHub teslimi bu özelliklerden ayrıdır.
4. **Ödemeler/veri sağlayıcıları:** Sağlayıcı testleri kontrollü mock yanıtlarla çalışır. Gerçek Stripe/iyzico/PayPal tahsilatı, ticari veri erişimi ve gerçek webhook teslimatı doğrulanmadı. İade otomasyonu ve çift yönlü dış takvim eşitlemesi yoktur.
5. **Modülleri siteye yerleştirme:** İş modülleri ve ziyaretçi rezervasyon ekranı hazırdır. Genel V2 booking/gadget bölümlerinin canlı çıktı bağlantısı otomatik kurulmaz; yer tutucu bunu belirtir. Mevcut Loft bağlantısı korunur.
6. **Hosted altyapı:** SQLite, sınırlı JSON medya/snapshot depolama, bir uzak bağlantı/site ve tek süreçli sınırlı import kuyruğu kullanılır. PostgreSQL/RLS, nesne depolama, dış worker kuyruğu, izolasyonlu genel derleme ve uzun dönem saklama politikaları kurulmadı. Kesilen import başarısız iş olarak geri gelir; byte düzeyinde kaldığı yerden devam etmez.
7. **Doğrulama ve sözlük:** V2 içerik alanları ortak şemayı kullanır; mevcut iş modülü formları mevcut sunucu doğrulamalarını kullanır. Tam alan şeması tasarımcısı, tüm modüllerin tek şemadan form üretimi, yazım/terminoloji servisi ve import sözlük eşleştirme ekranı sonraki dilimdedir.
8. **Erişilebilirlik ve güvenlik:** Klavye alternatifleri, native modal odağı, hata durumları ve responsive görünüm denenmiştir. Tam WCAG 2.2 AA denetimi, ekran okuyucu matrisi veya penetrasyon testi yapılmamıştır. Medya denetimi imza/boyut üzerinden yapılır; antivirüs veya tam görsel decode garantisi değildir. IPv6 uzak hedefler ihtiyatlı olarak kapalıdır.
9. **AI:** JSON değişiklik önerisi aynı API'den geçer; bir LLM sağlayıcısı bağlanmadı. `actorType=ai` istemci tarafından bildirilen taslak kaynağıdır; bağımsız kimlik/ispat mekanizması değildir.

Sonraki iş sırası [geçiş planında](MIGRATION.md) kayıtlıdır. Canlı sağlayıcı kapsamları, bağlandıktan sonra kendi kabul testleri tamamlanmadan destekleniyor diye genişletilmemelidir.

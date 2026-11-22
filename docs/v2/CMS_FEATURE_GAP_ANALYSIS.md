# Loft Studio — CMS özellik eksikleri ve öncelik analizi

2026-11-22 kod kapsamı güncellemesi: geliştirme sırası [güncel görev listesinde](DEVELOPMENT_TASKS.md).
GitHub kontrollü yazma, hosting bağlantıları, sınırlı statik görsel seçim ve bildirimli
React SDK prop eşleştirme eklendi. GitHub/yayın değerlendirmesi bu kapsamda
güncellendi; canlı sağlayıcı kabulü halen bekliyor.
Bu güncelleme yeni bir rakip pazar araştırması değildir. Genel JSX düzenleme,
tam CMS PostgreSQL geçişi ve dış modül izolasyonu tamamlanmış sayılmaz.

Yeni analiz: [isteğe bağlı AI modülleri](AI_MODULES_PLAN.md). Google Gemma 4 ve Alibaba
Qwen 3 / 3.8 adayları değerlendirilecek; model gateway, düzenleme/yayın asistanları
ve yetkili güvenlik incelemesi ayrı paket/çalıştırıcılar olarak planlanıyor. Henüz
model kurulmadı. Uygulama ön koşulları izolasyon, yetkilendirme ve ticari modül
aktivasyonudur. Ortak katkı güvenlik sözleşmesi: [SECURITY.md](../../SECURITY.md).

Tarih: 17 Kasım 2026
Kapsam: Loft Studio `v2`; Wix, WordPress, Joomla ve benzer CMS ürünleriyle karşılaştırma.

## Genel değerlendirme

**Loft Studio’nun modüler temeli oluştu; ancak bugün Wix, WordPress veya Joomla’nın tam alternatifi olacak özellik bütünlüğüne henüz ulaşmadı.** En büyük açıklar genel içerik yönetimi, yayınlama, geliştirici ekosistemi ve iş modüllerinin uçtan uca tamamlanması.

Bu belge, sohbet sırasında yapılan kod ve kapsam belgesi incelemesinin Markdown kaydıdır. Rakip ürünler için resmî kaynaklar kullanılmıştır. WordPress/Joomla çekirdeği ile eklenti ekosistemi ve Wix’in ücretli hizmetleri aynı kapsamda değerlendirilmemelidir. Aşağıdaki özelliklerin bazıları rakiplerde eklenti veya ücretli plan gerektirir.

**Mevcut özellikler:** Loft’ta sürükle-bırak bölüm düzenleme, responsive ayarlar, geri al/ileri al, medya yükleme, sürümler, ortak doğrulama, sözlükler, site bazlı yetkiler, SDK, rezervasyon–CRM bağlantısı ve bağımsız loglama var. Bunlar eksik olarak sayılmıyor.

## Özellik eksikleri

### 1. Genel içerik türü oluşturucu — kısmi

Şema ve modül koleksiyonları kodla tanımlanabiliyor. Ancak kullanıcıların panelden “haber, ekip üyesi, proje, ilan” gibi içerik türlerini; alanlarını ve ilişkilerini oluşturduğu genel bir araç yok. Strapi’nin Content-type Builder yaklaşımı burada iyi bir karşılaştırma. [Strapi](https://docs.strapi.io/cms/features/content-type-builder)

### 2. Blog ve yayıncılık paketi — eksik

Yazılar, kategoriler, etiketler, yazar arşivleri, RSS ve yorum moderasyonunu bir araya getiren hazır paket bulunmuyor. Sayfa düzenleyebilmek bu ihtiyacı tek başına karşılamıyor. WordPress’in temel yayıncılık özellikleri bu alanda daha kapsamlı. [WordPress](https://wordpress.org/about/features/)

### 3. Editoryal iş akışı — kısmi

Taslak, geçmiş ve yetki altyapısı var. Genel içerik için “yazar → editör → onaylayan”, inceleme görevleri, zamanlanmış yayın/kaldırma ve toplu yayın yönetimi eksik. AI önerilerinin onay akışı, genel editoryal sürecin yerine geçmiyor. [Drupal Content Moderation](https://www.drupal.org/docs/8/core/modules/content-moderation/overview)

### 4. Görsel tasarım özgürlüğü — kısmi

Bölüm taşıma ve yerleşim ayarları çalışıyor. Serbest iç içe bileşen düzenleme, tekrar kullanılabilir global bölümler, dinamik içerik listeleri ve kapsamlı şablon tasarımcısı düzeyine henüz ulaşmadı. Statik adaptörde yeni sayfa oluşturma ve keyfi kaynak yapılarını değiştirme de sınırlı.

Desteklenen statik metin yaprakları tıklama/klavye ile seçilebiliyor; React SDK
bileşenlerine bildirilen ilkel prop değerleri bağlanabiliyor. Bu, keyfi JSX veya
her framework için görsel kaynak kodu düzenleme anlamına gelmiyor.

### 5. Tema ve bileşen ekosistemi — kısmi

Palet ve yerleşim seçenekleri mevcut. Bağımsız geliştiricilerin tema/bileşen yayımladığı katalog, sürüm uyumluluğu, önizlemeli kurulum ve güncelleme sistemi yok. WordPress ve Joomla’nın tema/eklenti ekosistemine karşı belirgin bir açık. [WordPress](https://wordpress.org/about/features/), [Joomla](https://docs.joomla.org/Joomla_Core_Features)

### 6. Canlı yayın ve barındırma yönetimi — kısmi

GitHub'a beklenen commit üzerinden kontrollü yazma ve kalıcı uzlaştırma var.
Cloudflare Pages, Netlify ve bağımsız statik yayın agent'ı (Natro VPS/VDS dahil)
bağlantıları uygulandı; sağlayıcı fixture'ları ve yerel gerçek HTTP/disk testleri
canlı hesap kabulünün yerine geçmez. Canlı hesap kabulü, alan adı/SSL yönetimi,
sağlayıcıda doğrulanmış geri alma ve Natro paylaşımlı FTP hosting halen eksik.

### 7. Gerçek CMS bağlantıları ve taşıma araçları — kısmi

WordPress adaptör sözleşmesi bulunuyor; canlı WordPress üzerinde doğrulanmış hazır köprü eklentisi yok. Gutenberg, kısa kodlar ve sayfa oluşturucularının güvenli dönüşümü desteklenmiyor. Joomla adaptörü ve içerik/medya/URL yönlendirmelerini birlikte taşıyan migration araçları da eksik.

### 8. Gelişmiş medya yönetimi — kısmi

Görsel yükleme mevcut. Klasörleme, etiketleme, kırpma, odak noktası, otomatik boyut/format üretimi, kullanım yeri takibi ve CDN üzerinden dağıtım gibi kapsamlı medya kütüphanesi özellikleri tamamlanmamış.

### 9. SEO paketi — kısmi

Başlık/açıklama, denetim ve sitemap/robots üretimi var. Canonical, hreflang, yönlendirme yönetimi, yapılandırılmış veri ve sitemap’in yayına otomatik eklenmesi eksik. Wix bu alanların önemli bölümünü ürünle bütünleşik sunuyor. [Wix SEO](https://www.wix.com/seo/features)

### 10. Çok dilli içerik operasyonu — kısmi

Dil ve sözlük altyapısı mevcut. Çeviri görevleri, eksik çeviri takibi, çeviri sağlayıcısı bağlantıları ve tüm modüllere uygulanan tutarlı bölgesel davranış tamamlanmamış. Joomla’da dil ilişkileri ve çok dilli içerik yönetimi çekirdek özellikler arasında; WordPress’te çok dilli site yönetimi genellikle eklentiyle sağlanıyor. [Joomla](https://www.joomla.org/about-joomla/core-features.html), [WordPress](https://developer.wordpress.org/advanced-administration/wordpress/multilingual/)

### 11. E-ticaretin ziyaretçi tarafı — büyük ölçüde eksik

Ürün, stok ve yönetici tarafından oluşturulan sipariş var. Vitrin, sepet, checkout, siparişe bağlı tahsilat, varyant, indirim, vergi, kargo, iade ve fatura akışları tamamlanmamış. Mevcut rezervasyon ödeme adaptörleri e-ticaret checkout’unun hazır olduğu anlamına gelmiyor. [Wix eCommerce](https://www.wix.com/ecommerce/features)

### 12. Rezervasyonun ticari tamamlayıcıları — kısmi

Gecelik/saatlik rezervasyon, kapasite, takvim ve ICS mevcut. Google/Outlook ile çift yönlü eşitleme, otomatik bildirim/hatırlatma ve bekleme listesi gibi özellikler eksik. Personel, lokasyon, paket ve üyelik bazlı hizmet yönetiminin de genişletilmesi gerekiyor. [Wix takvim eşitleme](https://support.wix.com/en/article/wix-bookings-about-syncing-personal-calendars-with-wix-bookings)

### 13. CRM ve pazarlama otomasyonu — kısmi

Kişi, şirket, fırsat, aktivite ve rezervasyon geçmişi var. Görsel satış panosu, segmentasyon, kampanya, e-posta gönderimi, otomatik takip, toplu import ve harici CRM eşitlemesi yok.

### 14. Form oluşturucu ve otomasyon tasarımcısı — eksik

Modül şemalarından yönetim formları üretilebiliyor. Ziyaretçi formu tasarlama, koşullu alanlar, başvuru yönetimi ve “form geldi → CRM kaydı oluştur → görev aç → bildirim gönder” akışını kodsuz kurma ayrı bir özellik olarak eksik.

### 15. Üyelik ve müşteri portalı — eksik

Yönetici hesabı ve site üyeliği mevcut. Ziyaretçinin profilini, siparişlerini, rezervasyonlarını ve aboneliklerini tek yerden yönettiği genel portal bulunmuyor. Ücretli içerik ve üyelik paketleri de tamamlanmış değil.

### 16. Arama ve analitik — eksik

Yönetim ekranlarındaki basit aramalar, ziyaretçi tarafında tam metin/fasetli arama yerine geçmiyor. Trafik, dönüşüm, kampanya ve satış performansını birleştiren ürün analitiği de yok. İşlem logları analitik sisteminden farklı bir ihtiyacı karşılıyor.

### 17. Daha ayrıntılı yetkilendirme ve hesap yönetimi — kısmi

Site/kaynak kapsamı ve ayrı log izinleri var. Modül, koleksiyon, kayıt ve alan düzeyinde yönetilebilir roller genişletilmeli; örneğin `booking.read` ile `crm.read` henüz ayrı değil. MFA ve kullanıcıların kendi kendine hesap kurtarma akışları da tamamlanmamış. Joomla’nın ayrıntılı ACL ve MFA özellikleri burada karşılaştırma noktası. [Joomla](https://www.joomla.org/about-joomla/core-features.html)

### 18. Dış geliştirici deneyimi ve modül dağıtımı — kısmi

SDK, CLI, yaşam döngüsü ve bağımsız paket testleri var. Ancak paketler henüz yayımlanmıyor; ürün lisansı kesinleşmemiş. Modül kataloğu, uyumluluk sertifikasyonu, kararlı genişletme noktaları ve kapsamlı geliştirici portalı eksik. Mevcut modüller aynı Node sürecinde güvenilir kod olarak çalışıyor; izole eklenti çalıştırma ortamı yok.

### 19. Ücretli modül satışı/kiralaması — eksik

Ticari gelir hedefi açısından lisans/abonelik, kullanım hakkı, deneme süresi, faturalama, yenileme ve geliştirici gelir paylaşımı altyapısı gerekiyor. Modülü açıp kapatabilmek bu ticari sistemi sağlamıyor.

### 20. Üretim ölçeği ve işletim araçları — kısmi

Yerel SQLite ve mevcut yedekleme araçları var. Yönetilen çok sunuculu dağıtım, harici iş kuyruğu, nesne depolama, otomatik yedekleme/geri yükleme yönetimi ve uçtan uca izleme tamamlanmamış. Bunlar özellikle Wix benzeri barındırılan hizmet sunulacaksa kritik; her self-hosted CMS kurulumunda aynı ölçekte zorunlu değil.

## Önerilen geliştirme sırası

1. Genel içerik türleri ve blog.
2. Editoryal iş akışı.
3. Modül SDK ve dağıtım sözleşmesi.
4. Gerçek yayın ve CMS bağlantıları.
5. SEO ve medya.
6. Rezervasyon–CRM otomasyonları.
7. Tam e-ticaret.
8. Ücretli modül sistemi.

Ana hedef açısından en kritik açık: **dışarıdan gelen bir geliştiricinin yeni içerik türü veya modül ekleyip bunu gerçek bir sitede kurabilmesi, yayımlayabilmesi ve güvenle güncelleyebilmesi.**

## İlgili proje belgeleri

- [V2 kullanım ve kapsam](README.md)
- [Modüler çekirdek ve SDK](MODULES.md)
- [Adaptör ve veri sözleşmeleri](ADAPTERS.md)
- [Modüller arası entegrasyon](INTEGRATIONS.md)
- [Ürün ve ticari model](PRODUCT_MODEL.md)
- [İşletim ve sınırlar](OPERATIONS.md)
- [Doğrulama raporu](VERIFICATION.md)

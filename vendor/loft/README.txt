LOFT PET HOUSE — YENİLENEN WEB SİTESİ
30 Ekim 2026 — Rusça ve SEO güncellemesi

İÇERİK
Her dilde 13 sayfa: ana sayfa, hakkımızda, hizmetlerimiz, altı hizmet detay sayfası,
galeri, sıkça sorulan sorular, iletişim ve rezervasyon.
11 dil, toplam 143 statik HTML sayfası. Özgün Türkçe metinler korunmuştur.
Türkçe (varsayılan), İngilizce, Mandarin Çincesi (basitleştirilmiş yazı),
Hintçe, İspanyolca, Arapça, Fransızca, Bengalce, Portekizce, Endonezce ve Rusça.
İlk seçim: kullanıcının istediği Türkçe + toplam konuşur sayısına göre ilk 9 dil.
Rusça, kullanıcının ek isteği üzerine on birinci dil olarak eklendi.
2026 sıralaması: https://www.statista.com/statistics/266808/the-most-spoken-languages-worldwide/
https://www.visualcapitalist.com/ranked-the-worlds-most-spoken-languages-in-2026/

DİL VE TEMA
Sağ üstteki menülerden dil ve Açık / Koyu / Sistem teması seçilir.
İlk ziyaret Türkçe ve Açık tema ile başlar. Arapça sayfalar sağdan sola düzenlenir.
Tema seçimi tarayıcıda saklanır. Sistem seçilirse cihazın tema değişiklikleri
anlık izlenir; Açık ve Koyu seçimleri cihaz ayarından bağımsızdır.
Dil değişimi aynı sayfanın çevirisine gider. Daha önce seçilmiş dil yalnızca
Türkçe ana sayfa girişinde hatırlanır; açık bir alt sayfa bağlantısı korunur.
Tarayıcı depolaması engellenirse menüler çalışır, tercihler hatırlanmayabilir.
Türkçe adresler korunur; diğer diller en/, zh/, hi/, es/, ar/, fr/, bn/, pt/, id/, ru/
klasörlerindedir. Sunucuda yönlendirme kuralı veya çeviri API'si gerekmez.

MARKA VE GÜNCEL BİLGİLER
Ana renkler: siyah (#171717), sarı (#F6D434), beyaz (#FFFFFF).
Logo: işletme sahibinin ilettiği özgün görsel.
favicon.ico ve fav.ico: aynı logodan üretilmiş, 16–256 px arası 7 boyut.
Telefon/WhatsApp: 0532 529 01 76
Adres: Koşuyolu, İsmailpaşa Sk. No:32, 34718 Kadıköy/İstanbul
Çalışma saatleri: her gün 09:00–18:30; resmî tatillerde farklılık olabilir.
E-posta: info@loftpethouse.com (eski siteden korunmuştur).

ÇALIŞTIRMA VE BARINDIRMA
dist/index.html doğrudan tarayıcıda açılabilir. İnternet sunucusuna
dist klasörünün içeriği kopyalanır. Örneğin cPanel'de public_html içine.
Node.js veya bir veritabanı, ziyaretçilere sunum için gerekli değildir.
Yerel HTTP önizleme örneği: python -m http.server 8000 --directory dist

DÜZENLEME
build.mjs: sayfa şablonları, iletişim bilgileri, yeni giriş metinleri.
content/content.json: arşivden kurtarılan özgün metinler ve kaynaklar.
content/maps-photos.json: işletmenin yüklediği fotoğrafların kaynakları.
dist/style.css: görünüm ve mobil düzen.
dist/app.js: mobil menü, fotoğraf görüntüleyici ve e-posta taslağı.
dist/preferences.js: güvenli yerel dil/tema tercihleri.
theme.css: tema renkleri, dil menüsü ve sağdan sola düzen.
localize.mjs: çeviri ve yerel bağlantı üretimi.
content/locales/*.json: her dil için 230 çeviri anahtarı.
content/seo/*.json: her dil için 43 açıklama, görsel alt metni ve ek bilgi anahtarı.
seo.mjs: sayfa başlıkları, canonical, hreflang, sosyal önizleme ve yapılandırılmış veri.
content/site.json: yayındaki asıl alan adı (https://loftpethouse.com).
content/image-dimensions.json: mevcut görsellerin gerçek boyutları.
content/editorial-sources.json: yorum örneklemi, kaynaklar ve doğrulama sınırları.
Türkçe metin değişikliklerini ilgili çeviri anahtarlarıyla birlikte güncelleyin.
dist/assets: logo, yerel fotoğraflar ve uygulama simgeleri.
HTML sayfalarını yeniden üretmek için proje klasöründe: node build.mjs

REZERVASYON VE İLETİŞİM
Formlar ziyaretçinin e-posta uygulamasına aktarılacak bir taslak hazırlar.
Ziyaretçi taslağı kendi e-posta uygulamasından gönderir. Form gönderme
sunucusu, otomatik rezervasyon onayı, ödeme veya veritabanı yoktur.
Telefon ve WhatsApp bağlantıları doğrudan iletişim sağlar.
E-bülten aboneliği için çalışan bir altyapı bulunmadığından boş abonelik
formu eklenmemiştir. Eski form işaretlemesi arşiv yedeğinde korunur.

KAYNAKLAR VE SINIRLAR
Başlangıç kaydı: https://web.archive.org/web/20260518213552/https://loftpethouse.com/
Bazı 2026 alt sayfa kayıtları yükleniyor ekranı içeriyordu. Bu sayfalarda
2024–2025 tarihli okunabilir Wayback kayıtlarından yararlanıldı.
Ana menüden ve hizmet kartlarından ulaşılan 12 özgün sayfa kurtarıldı.
Eski ana sayfanın kedi-köpek görseli de yerel dosya olarak saklandı.
Arşivdeki 68 özgün site görseli alınamadı; bunların 45'i galeri
sayfasında referans verilen dosyalardır. Bağlantıları raporda korunur.
Galeride Loft Pet House'un kendi Google Maps hesabından yüklediği,
yükleyeni kontrol edilen 9 fotoğraf kullanılır.
Güncel telefon ve saatler, kullanıcının gönderdiği görüntü ve Maps ile
doğrulandı; eski iletişim ve giriş-çıkış saatleri yayımlanan metinlerden
kaldırıldı. Özgün kayıtlar arşiv yedeğinde değiştirilmeden tutuldu.
Google Maps puanı ve değerlendirme sayısı 27 Ekim 2026 gözlemidir.
Bu çalışma ziyaretçiye görünen içerikleri geri getirir; eski sunucu
kodu, yönetim paneli, e-posta ve rezervasyon kayıtlarını kurtarmaz.

DOĞRULAMA
Güncel doğrulama sonuçları teslim paketindeki SEO-RAPORU.txt ve
seo-russian/static-checks.json dosyalarındadır. Önceki 29 Ekim regresyon
raporu, önceki sürümün kaydı olarak ayrıca korunur. Bu güncellemede siber
güvenlik taraması tekrarlanmaz; SEO, çeviri, bağlantı ve arayüz kontrolü yapılır.

SEO VE İÇERİK
Her dilde ayrı statik URL, sayfaya özel başlık ve açıklama, kendi canonical
adresi ve karşılıklı hreflang bağlantıları vardır. x-default Türkçedir.
sitemap.xml 143 URL ve dil karşılıklarını içerir; robots.txt site haritasını belirtir.
Asıl alan adı farklı olacaksa content/site.json güncellenip node build.mjs çalıştırılır.
Dil menüsü yerel bağlantıları kullanır; alan adı ayarı önizleme gezinmesini etkilemez.
Open Graph ve Twitter önizlemesi gerçek işletme giriş fotoğrafını kullanır.
LocalBusiness, WebSite, WebPage ve BreadcrumbList verileri eklenmiştir.
İşletmenin kendi yorumları için Review/AggregateRating işaretlemesi eklenmemiştir.
Yeni metinler hazırlık ve görüşme önerileridir; fiyat veya hizmet garantisi değildir.
Google Maps'te görülen beş yorumdan yararlanılmıştır; tüm yorumlar incelenmemiştir.
Arşivden korunan ruhsat, izleme, bakım rutini ve eğitim yöntemi ifadeleri
yeniden doğrulanmamıştır. Özellikle alfa/sürü yaklaşımına ilişkin eski eğitim
paragraflarının güncel işletme uygulamasıyla uyumu sahip tarafından gözden geçirilmelidir.
Sıralama, dizine eklenme ve Google zengin sonuç görünümü garanti edilmez.
Natro yayını sonrası Search Console'dan site haritası gönderilebilir.

GÜVENLİK GÜNCELLEMESİ — 28 EKİM 2026
İletişim ve rezervasyon alanları HTML içinde varsayılan olarak kapalıdır.
JavaScript, form olaylarını kurduktan sonra alanları açar. Script yüklenemezse
form verileri GET/URL ile gönderilmez; telefon ve e-posta bağlantıları gösterilir.
Eski arşivin Instafeed erişim anahtarı teslim paketinden temizlenmiştir.
Anahtarın hâlâ geçerli olup olmadığı veya sağlayıcıda iptali doğrulanmamıştır.

# Loft Studio 2 — ön sürüm

`v2` dalı farklı site kaynaklarını bağlayan yeni çalışma alanını içerir. Yeni arayüz `/v2/`, mevcut Loft konsolu `/` adresindedir. [V2 kurulum ve kullanım](docs/v2/README.md), [geçiş planı](docs/v2/MIGRATION.md) ve [doğrulama/kalan kapsam](docs/v2/VERIFICATION.md) belgelerini okuyun. Bu sürüm otomatik olarak canlı sitenizin yerini almaz.

## Mevcut Loft konsolu

Loft Pet House için çalışan yerel yönetim pilotu. İçerik, SEO, sayfa yapısı, menü ve tema değişiklikleri taslakta saklanır; kimlik doğrulamalı önizleme veya Natro’ya uygun statik ZIP üretilir. Konsol canlı siteye dosya göndermez.

## Başlatma

Node.js **24.13 veya üzeri 24.x** kullanın. V2 bağımlılıkları kilit dosyasıyla sabittir.

```powershell
git clone https://github.com/rasim21-maker/.studio.git
cd .studio
npm.cmd ci --ignore-scripts
npm.cmd run build
npm.cmd start
```

Varsayılan adres: **http://127.0.0.1:4317**. İlk çalıştırmada terminalde tek kullanımlık, 30 dakika geçerli yönetici kurulum bağlantısı görünür. Bu bağlantıyı açıp kendi e-posta ve parolanızı belirleyin. Önceden tanımlı kullanıcı veya parola yoktur. Kurulum süresi dolarsa sunucuyu yeniden başlatın; kurulum tamamlandıktan sonra yeni kurulum bağlantısı oluşmaz.

Farklı port veya güvenlik sağlayıcıları için `.env.example` dosyasını `.env` adıyla kopyalayın. `npm start` bu dosyayı okur. Adres çubuğundaki köken, `APP_ORIGIN` ile birebir eşleşmelidir; `localhost` ve `127.0.0.1` birbirinin yerine kullanılamaz.

Veriler `data/console.sqlite`, üretimler `data/builds/` altında kalır. Testler farklı `test-results/` klasörleri kullanır. Bu klasörler ve `.env` Git’e alınmaz. Sunucuyu durdurmak için Ctrl+C kullanın.

## Kullanım

Yeni HTML, tasarım, rezervasyon, takvim ve API özellikleri için [0.2 kullanım kılavuzuna](FEATURES.md) bakın.

1. **İçerik stüdyosu:** Sayfa ve dil seçin. SEO başlığı/açıklaması, metinler ve görsel alt metinlerini düzenleyin. Kontrol edin, değişiklik notuyla taslağı kaydedin.
2. **Sayfalar & tasarım:** Yeni sayfa oluşturun, durumunu belirleyin, bölümlerini ve çevirilerini hazırlayın. Menü ve tema aynı yapı taslağında saklanır.
3. **Önizleme & paket:** Kaydedilmiş taslağın sabit bir kopyasından önizleme üretin. Dil ve sayfa seçerek inceleyin. Yönetici Natro ZIP paketini oluşturup indirebilir.
4. **Değişiklik geçmişi:** Kimin, ne zaman, hangi alanda değişiklik yaptığını önceki/yeni değerlerle görün. Otomatik sürüm geri alma bu pilotta yoktur.
5. **Hesabım:** Yerel parolanızı değiştirin; yapılandırılmış dış giriş hesabını bağlayın. Parola değişikliği diğer oturumları kapatır.

Kayıtlı sürüm başka bir oturumda değişmişse sunucu üzerine yazmayı reddeder. Sonraki düzenlemeler daha önce üretilen önizleme ve ZIP’i değiştirmez. Önizlemenin sayfa listesi de üretildiği sürüme aittir.

## Sayfa, bölüm, menü ve tema

| İşlem | Davranış |
| --- | --- |
| Yeni sayfa | Önce pasif açılır. Slug, SEO başlığı/açıklaması ve bölümleri girilir. Türkçe zorunludur; diğer diller ayrı ayrı etkinleştirilir. |
| Pasif veya kaldırıldı | Sayfa sonraki pakete ve site haritasına alınmaz. Kaydı korunur; yeniden aktif yapılabilir. Ana sayfa aktif kalır. |
| Kaynak sayfalar | Mevcut 13 sayfanın adresleri ve dil kapsamı korunur. Kaynak dosyalar değişmez. |
| Bölüm düzeni | Yukarı/aşağı taşıma, sol/orta/sağ konum, dolgu ve boşluk, gizleme, metin/hero/CTA/görsel/gadget/rezervasyon bölümü ekleme. Mevcut bölümün ilk başlığı ve ilk paragrafı için dil bazlı üstüne yazma alanları bulunur. Diğer kaynak metinler İçerik stüdyosundadır. |
| Bölüm çevirisi | Kaynak sayfaya eklenen yeni bölüm yalnızca başlığı doldurulan dillerde görünür. Yeni sayfanın etkin dillerinde tüm görünür yeni bölümlerin başlığı gerekir. Otomatik çeviri yapılmaz. |
| Görsel | Mevcut Loft görsel kütüphanesinden seçim; görsel bölümlerinde alt metin zorunlu. Dosya yükleme yoktur; metin alanlarında güvenli HTML düzenleyicisi bulunur. |
| Menü | Özgün, standart açılır veya mega menü. En fazla 8 ana öğe, her öğede 16 alt öğe; iki düzey. Dil bazlı etiket, sıralama ve hedef sayfa seçimi. |
| Tema | 12 palet (özgün, sıcak, orman, gece mavisi, okyanus, gül, terrakota, lavanta, nane, editoryal, narenciye, arduvaz); açık/koyu/sistem başlangıç tercihi; özgün/yuvarlak/düz köşeler. Ziyaretçinin kayıtlı tema tercihi korunur. Renk paletleri açık görünümü değiştirir. |

En fazla 40 sayfa kaydı ve sayfa başına 30 bölüm desteklenir. Kaldırılan sayfalar bu sayıya dahildir. Kaynak bölüm kayıtları silinmez; gizlenir. Bölüm düzenleyicideki metin üstüne yazmaları, İçerik stüdyosundaki metnin önüne geçer; alan boşaltıldığında kaynak taslağın metni kullanılır. Bu, serbest sürükle-bırak/WYSIWYG editörü değildir.

Pasif kaynak sayfaların bilinen iç bağlantıları üretimde temizlenir. Natro’ya eski bir sitenin üzerine ZIP çıkarmak eski dosyaları kendiliğinden silmez. Yayın öncesi mevcut siteyi yedekleyip eski sürümde kalan yolları kaldırma/301 yönlendirme planı ayrıca uygulanmalıdır. Konsol bu aşamayı otomatik yapmaz.

## Yetkiler ve giriş güvenliği

| Yetki | Editör | Yönetici |
| --- | --- | --- |
| Üye olduğu sitenin içeriği ve geçmişi | Evet | Evet |
| İçerik taslağı ve önizleme oluşturma | Evet | Evet |
| Sayfa, bölüm, menü ve tema değiştirme | Hayır | Evet |
| ZIP üretme ve indirme | Hayır | Evet |
| Site üyeliği ekleme/kaldırma | Hayır | Evet |

Yetkiler her sunucu isteğinde site bazında denetlenir. Üyelik kaldırma açık oturumlarda hemen etkili olur. Dış hesapla giriş yapmak yeni site yetkisi vermez.

Yerel parolalar scrypt ile tuzlanıp türetilir; en az 14 karakter gerekir. Oturum çerezi HttpOnly ve SameSite=Strict; HTTPS’te Secure ve `__Host-` öneki kullanılır. Veritabanında oturum belirtecinin yalnızca özeti bulunur. Oturum süresi 8 saattir. Yazma işlemleri Origin ve CSRF kontrolünden geçer.

Girişte 15 dakikada hesap başına 8, IP başına 25 deneme sınırı vardır. Başarılı yerel giriş hesap sayacını sıfırlar; IP sayacı pencere sonuna kadar sürer. Sayaçlar SQLite’ta tutulduğu için yeniden başlatmayla sıfırlanmaz. Eşzamanlı pahalı parola işlemleri 2 ile sınırlıdır. Kurulum, dış giriş ve hesap bağlama için de ayrı hız sınırları vardır.

### Google reCAPTCHA

Google reCAPTCHA **v2 checkbox** site ve gizli anahtarını `.env` içine yazın. Yalnızca site anahtarı tarayıcıya verilir. Sunucu Google’dan doğrulama sonucu alıp başarı, tam hostname ve zaman kontrolü yapar; tekrar kullanılan veya süresi dolan belirteci kabul etmez. Servis kesintisinde giriş tamamlanmaz. [Google doğrulama belgesi](https://developers.google.com/recaptcha/docs/verify).

Yerelde anahtarsız geliştirme mümkündür ve arayüz bunun etkin olmadığını gösterir. Yerelde zorlamak için `AUTH_REQUIRE_CAPTCHA=1` seçin. Loopback dışındaki `APP_ORIGIN` için gerçek CAPTCHA anahtarları zorunludur. Anahtarlar tanımlandığında kurulum, yerel giriş ve sosyal giriş başlangıcında CAPTCHA uygulanır.

### Google, Microsoft, Apple ve Facebook

Entegrasyon kodları hazırdır; **gerçek sağlayıcı uygulamaları ve anahtarları bu teslimde yapılandırılmadı**. Kapalı düğmeler kurulum beklediğini gösterir. Sırları sohbet yerine yerel `.env` veya barındırma ortamının gizli değişkenlerine girin.

| Sağlayıcı | Gerekli ayarlar | Dönüş yolu |
| --- | --- | --- |
| Google | OAuth web client ID ve secret | `/auth/google/callback` |
| Microsoft | Uygulama client ID/secret ve tenant ID; `common`, `organizations`, `consumers` veya tenant GUID | `/auth/microsoft/callback` |
| Apple | Services ID, Team ID, Key ID, P-256 özel anahtar; gerçek HTTPS alan adı | `/auth/apple/callback` |
| Facebook | App ID/secret ve uygulamanın desteklediği açık Graph API sürümü | `/auth/facebook/callback` |

Dönüş adresi tam olarak `APP_ORIGIN` + yukarıdaki yoldur. Sağlayıcı panelinde web uygulaması ve izin verilen dönüş adreslerini aynı değerle kaydedin. Apple localhost/IP dönüş adresini kabul etmez; uygulama bunu başlatmadan reddeder. Apple akışında isim/e-posta kapsamı istenmez; code/query yanıtı ve kalıcı kullanıcı kimliği kullanılır. [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Microsoft OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc), [Apple web kurulumu](https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms), [Meta manuel giriş akışı](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/).

Önce yerel hesabınızla giriş yapın, **Hesabım → Bağlı giriş hesapları** bölümünde mevcut parolanızı girip sağlayıcı hesabınızı bağlayın. Sonraki girişlerde o sağlayıcı kullanılabilir. E-posta eşleşmesiyle otomatik hesap birleştirme, kayıt veya yönetici atama yapılmaz. Bağlama işlemi güncel yerel oturuma ve tarayıcıya bağlıdır. Dış erişim/yenileme belirteçleri saklanmaz.

OIDC akışlarında imza, issuer, audience, nonce ve süre; Google/Microsoft’ta PKCE; bütün sağlayıcılarda tek kullanımlık state ve tarayıcı bağı denetlenir. Facebook yanıtı uygulama kimliği, süre ve profil kimliği ile doğrulanır. Bu yerel pilotun doğrulama katmanı Node kriptografisi kullanır. Canlıya geçmeden her sağlayıcı için gerçek uygulamayla kabul testi ve bağımsız güvenlik incelemesi gerekir; bu teslimde sağlayıcılar kontrollü test yanıtlarıyla doğrulandı.

## Kaynak ve üretim mimarisi

`vendor/loft/`, mevcut Loft kaynaklarının salt referans kopyasıdır. `vendor/loft-manifest.json` 200 dosyanın SHA-256 değerini içerir. Önceki çalışmada doğrulanan GitHub commit bilgisi manifestte belirtilir; bu içe aktarım uzaktaki commit’i yeniden doğruladığını iddia etmez. Mevcut Sites proje kimliği kopyaya alınmamıştır.

Her üretimde kaynak bütünlüğü kontrol edilir, kaynak geçici üretim klasörüne kopyalanır ve orijinal `build.mjs → localize.mjs → seo.mjs` hattı worker içinde çalıştırılır. Türkçe kaynak metin eşleme tablosu sabit tutulur; seçili dil taslakları ayrı uygulanır. Çalışan ana sürecin dizini veya canlı kaynak değişmez. Ardından sayfa/bölüm/menü/tema taslağı uygulanır, SEO ve dosya kontrolleri yapılır.

Varsayılan, düzenlenmemiş taslak **13 sayfa × 11 dil = 143 HTML** üretir. Regresyon testi tüm `dist` dosyalarını özgün çıktıyla bayt düzeyinde eşit bulur. Yeni sayfalar ve pasif durumlar sayıyı değiştirir. ZIP yalnızca statik çıktı içerir; kullanıcılar, parolalar, kaynak kod veya veritabanı girmez. İndirilen paketin SHA-256 değeri sunucuda tekrar doğrulanır.

`src/server.mjs` HTTP/yetki sınırıdır; `src/store.mjs` SQLite ve sürümlerdir; `src/adapters/loft.mjs` Loft üretim adaptörüdür; `src/structure.mjs` yapı doğrulama ve statik çıktıdır. Tarayıcı arayüzü `public/` altındadır. İkinci gerçek site için yeni adaptör/şema ve kabul testi gerekir; mevcut site sınırları ayrı site test verisiyle doğrulanmıştır.

## Barındırma ve veri saklama

Natro’ya aktarılacak ZIP statik dosyalardır. Yönetim konsolu ise sürekli çalışan Node süreci, yazılabilir disk ve SQLite gerektirir. Mevcut Natro paketinin Node/disk desteği doğrulanmadan konsolun aynı pakette çalışacağı varsayılmamalıdır.

Bu uygulama için uygun devam yolu, konsolu HTTPS arkasında ayrı bir Node sunucusunda **tek örnek** olarak çalıştırıp `DATA_DIR` için kalıcı disk bağlamaktır. VPS veya [Render Node web servisi](https://render.com/docs/web-services) kullanılabilir; Render seçilirse verinin kalıcı olması için [kalıcı disk](https://render.com/docs/disks) gerekir. Plan/fiyat satın alınmadı ve dağıtım yapılmadı. Sites/Workers ortamına taşımak ise bu Node/SQLite/dosya üretim modelinin veritabanı, nesne depolama ve üretim işçisi bakımından uyarlanmasını gerektirir.

Uygulama istemciden gelen `X-Forwarded-For` değerine güvenmez; IP limiti soket adresini kullanır. Reverse proxy arkasında istekler aynı IP sayacını paylaşabilir. Üretim kurulumu, yalnızca güvenilir proxy’den gelen gerçek istemci IP’sini denetleyen bir katman ve proxy hız limiti ile tamamlanmalıdır. Doğrudan Node portunu internete açmayın.

Yedekleme için sunucuyu durdurup `data/` klasörünün tamamını erişimi kısıtlı bir hedefe kopyalayın. Geri yükleme de sunucu kapalıyken yapılmalıdır; üretim dosyaları ile veritabanı aynı yedekten gelmelidir. `.env` ayrı ve güvenli saklanır. Otomatik yedekleme/retention, parola unutma e-postası, MFA, otomatik yayın, yayın onayı ve geri alma bu pilotta yoktur. GSC/GA4/GTM bağlantıları bu sürümde uygulanmamıştır.

Node 24.13’te `node:sqlite` deneysel uyarı verir; bu pilot bu sürümle test edilmiştir. Sürüm yükseltmelerini testlerden geçirerek uygulayın. [Node SQLite belgesi](https://nodejs.org/api/sqlite.html).

## Doğrulama

```powershell
npm.cmd run check
npm.cmd test
```

2 Kasım 2026: **54 test geçti**, başarısız/atlanmış test yok. Kaynak dosya özetleri ve 11 dilin 286 alanlık şeması kontrol edildi. Test kapsamı ve elle yapılan arayüz kontrolleri [doğrulama raporunda](VERIFICATION.md).

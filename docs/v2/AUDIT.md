# Bağımsız istek ve değişiklik loglama modülü

`@loft-studio/audit` 0.1.0, SDK ve iş modüllerinden bağımsız bir altyapı paketidir.
`src/audit.mjs` Loft bağlantısını, `ui/audit-panel.tsx` görüntüleme ekranını sağlar.
Rezervasyon/CRM/e-ticaret kapatılsa da loglama çalışır. Normal yönetim ekranından
kapatılamaz, kayıtlar değiştirilemez veya silinemez. Paket tarball tüketici testi
Studio kodunu import etmeden kayıt, değişiklik farkı ve sorgulamayı doğrular.

## Kullanım

V2 ana menüsünde **İşlem kayıtları** açılır. Eski yönetimden `/v2/#audit` adresine
geçilebilir. Kapsam, tarih/saat, kullanıcı kimliği/e-posta, IP, kayıt türü, işlem,
istek kimliği, HTTP yöntemi ve durum koduyla filtrelenir. Tarih girişleri yerel
saatte, kalıcı zamanlar UTC'dir. Bir satır açıldığında istemci bilgisi ile eski/yeni
değerler görünür. Aynı sunucu tarafından üretilmiş istek kimliği değişiklikleri,
isteğin başlangıcını ve sonucunu ilişkilendirir; `X-Request-ID` yanıt başlığındadır.

İstek, değişiklik ve olay kayıtları ayrıdır. Başarısız bir istek eski/yeni değer
üretmez; önceki veri değişmemişse değişiklik varmış gibi gösterilmez. Transaction
geri alınırsa değişiklik logu da geri alınır; istek hatası yine kaydedilir.
Gerçekleşen bir değişiklikten sonra HTTP yanıtı başarısız olabilir: bu durumda
değişiklik kanıtı ile yanıt durumu birlikte değerlendirilir.

**JSON indir / CSV indir**, ekrandaki 50 satırı değil aynı filtrelerin bütün
kayıtlarını sabit bir üst sıra numarasına kadar indirir. Sonraki loglar aynı
exporta eklenmez. Sunucu 200 satırlık parçalarla, geri basıncı gözeterek gönderir.
İşlem boyunca izin ve oturum yeniden denetlenir. 100 MiB / 60 saniye sınırı,
izin kaybı veya bağlantı kopmasında aktarım kesilir; başarılı tamamlanmış dosya
gibi sunulmaz. Büyük arşivler için tarih aralığını daraltın. CSV formül başlangıçları
etkisizleştirilir; HTML içerik arayüzde metin olarak gösterilir. Export işlemleri
ve log görüntülemeleri de loglanır.

## Kim hangi kayıtları görebilir?

- Kişi kendi hesabının kimliği doğrulanmış hareketlerini görür.
- V2 kurum sahibi kendi kurum/site kayıtlarını görür. Site üyelerinde `audit`
  görüntüleme ve `auditExport` dışa aktarma izinleri ayrıdır; Üyeler ekranından
  atanır. Eski Loft sitesinde site yöneticisi kendi sitesinin kayıtlarını görür.
- Kurulum işletmecisi tüm kapsamları, anonim giriş hatalarını ve sistem
  kayıtlarını görebilir. Yeni kurulumda ilk kurulum hesabı işletmecidir.
- Mevcut kurulumun ilk geçişinde, oluşturulma sırasına göre ilk Loft yöneticisi
  bir defa işletmeci olarak kaydedilir. Bu geçiş `studio_log_settings` ile
  işaretlenir ve `studio_log_operators` kaydıyla izlenir. Diğer site yöneticileri
  kendiliğinden işletmeci olmaz. Çok kurumlu dağıtımdan önce bu işletmeci hesabını
  doğrulayın. Ek işletmeciler açık `AUDIT_OPERATOR_IDS` yapılandırmasıyla eklenir;
  değişkenden çıkarılması kalıcı rolü kendiliğinden kaldırmaz.

Rol kaldırma bu sürümde kurulum işletimi sırasında kontrollü DB işlemiyle yapılır;
web üzerinden operatör atama/silme endpoint'i yoktur. Sıradan site üyeleri kurum,
başka site veya global kapsam seçerek sınırı aşamaz. Sunucu denetimleri her
sorguda/export parçasında uygulanır, arayüze güvenilmez.

## Kaydedilen bilgiler ve sınırlar

Her kayıtta UTC zaman, tür, işlem, kapsam, doğrulanmış kullanıcı kimliği/türü,
istek kimliği, HTTP yolu/yöntemi, IP ve bağlantı IP'si, IP kaynağı, istemci bilgisi
bulunabilir. İstek sonucunda HTTP durumu ve süre; değişiklikte hedef tablonun
güvenli birincil anahtarları, JSON Pointer alan yolları ve eski/yeni değerler vardır.
Arka plan işlemlerinde istek/IP yoktur; `system` kimliği veya işi başlatan istek
bağlamı kullanılır. AI bearer erişiminde aktör türü doğrulanmış sunucu bağlamından
gelir; gövdedeki `actorType` log kimliğini değiştiremez.

Tarayıcı/OS ailesi User-Agent'tan tahmin edilir; User-Agent, Client Hints ve dil
başlıkları istemci beyanı olarak işaretlidir. MAC, seri numarası, bilgisayar adı,
donanım kimliği veya kişinin gerçek konumu standart HTTP'den doğrulanamaz.
IP de NAT/proxy nedeniyle tek cihazı veya kişiyi kesin olarak tanımlamaz.

Parola, token, API anahtarı, cookie, doğrulama/sealing materyali ve ödeme kartı
alanları maskelenir. Ham gövde, URL query, Authorization/Cookie başlıkları, OAuth
kodları ve session token hash'leri kaydedilmez. Kaynak/binary veri yerine atlama
işareti ve özet kullanılır. Değişiklik başına en çok 400 alan/120.000 karakter,
metin başına 4.000 karakter, derinlik 12 sınırları açık kesilme işaretleri üretir.
Her log tüm içeriğin yedeği değildir. Serbest metin içindeki bütün olası sır veya
kişisel verilerin tespit edildiği iddia edilmez.

Kapsam: sunucunun kabul ettiği tüm HTTP istekleri (statik dosyalar, API, başarısız
giriş/izin/doğrulama, 404 dahil) ve bağlı DB üzerinden içerik, yapı, kullanıcı/
üyelik, kaynak bağlantısı, import, yayın, medya metadata, bölgesel ayar, AI erişimi,
rezervasyon/katılımcı/takvim, ödeme durumları, modül kayıtları, modül durumları,
entegrasyon kayıtları/teslimleri ve mevcut iş olayları. Binary kaynakların ve
yinelenen sürüm snapshotlarının içerikleri loglanmaz. Dış sağlayıcıdaki bağımsız
değişiklikler, reverse proxy/TLS katmanında reddedilen trafik ve modülü takılmamış
harici DB yazıcıları bu sunucunun kapsamı dışındadır.

Geçmiş kayıtlar korunur; modül kurulmadan önceki isteklerin IP/cihaz/değerleri
yeniden üretilemez. Migrations/başlangıç seed'i kaynak tablolar kurulurken çalışır;
değişiklik yakalama bu başlangıç aşamasından sonra bağlanır. Yeni SDK modüllerinin
ortak `studio_module_records` verisi otomatik kapsanır. Özel tablo kullanan güvenilen
paket, kendi migration'ından sonra `store.audit.track(...)` çağırmalıdır.

## İşletim ve veri güvenliği

`studio_log_entries` aynı SQLite dosyasındadır; temp trigger'lar her uygulama
yazıcı bağlantısına eklenir. Şema 1 geçişi `studio_log_migrations` tablosunda
izlenir; daha yeni bir log şeması eski paketle açılmaya çalışılırsa işlem reddedilir.
Log kaydı iş değişikliğiyle atomiktir: log insert başarısızsa
iş yazımı da başarısız olur. İstek başlangıcı yazılamazsa sunucu 503 verir.
Yanıt tamamlandıktan sonraki log hatası yanıtı geri alamaz; stderr'e hassas veri
içermeyen `AUDIT_WRITE_FAILED` alarmı yazılır. Bu alarmı ve disk kapasitesini izleyin.

Varsayılan istemci IP'si socket adresidir. Yalnızca yönetilen proxy IP'leri için
`AUDIT_TRUSTED_PROXIES=127.0.0.1,10.0.0.2` gibi açık adresler tanımlanır. XFF zinciri
sağdan sola güvenilen atlamalar boyunca okunur. Hatalı zincir socket'e düşer;
internet istemcisinin keyfi XFF başlığına güvenilmez. Proxy bu başlığı güvenli
biçimde eklemeli/yenilemelidir. CIDR veya bütün proxy'lere güven seçeneği yoktur.

Kayıt silme endpoint'i ve otomatik saklama süresi yoktur. Kurulumun veri bölgesi,
yetkili kullanıcıları, saklama/arşiv/silme politikası ve kapasitesi işletim sırasında
belirlenmelidir. Var olan yedekleme akışı SQLite loglarını da içerir. Append-only
trigger'lar normal SQL değişikliklerini engeller; DB/dosya yöneticisine karşı
kriptografik imza, uzak bağımsız arşiv veya WORM güvencesi sunulmaz.

Tasarım referansları: [Node 24 SQLite](https://nodejs.org/download/release/v24.13.0/docs/api/sqlite.html),
[OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
Mevcut Node/SQLite/React bileşenleri yeniden kullanıldı; yeni üçüncü taraf paket
veya kopyalanmış açık kaynak kod eklenmedi.

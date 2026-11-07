# Anahtar, yedek ve AI işletimi

Bu prosedür yerel alfa içindir. Hosted KMS, online nesne snapshot ve PITR
sağlanmış değildir. Üretim verileriyle çalışmadan önce kopya üzerinde deneyin.

## Bağlantı anahtarları

Yeni V2 Git/WordPress bağlantı sırları, rastgele veri anahtarıyla AES-256-GCM
zarfında saklanır. Veri anahtarı ayrı sarılır; kurum ve bağlantı türü AAD'ye
bağlanır. Yerel wrapping anahtarları DATA_DIR/studio-vault.json içindedir.
Bu dosyanın Windows ACL'sini yalnızca işletim hesabına sınırlandırın.

Eski studio-key ve integration-key dosyalarını koruyun. Eski bağlantılar
okunabilir; bu dilim bütün eski sırları veya legacy ödeme sırlarını otomatik
dönüştürmez. Yedeklere dahil eski anahtarlar, ilgili kayıtların/geri yükleme
noktalarının ömrü bitmeden kaldırılmaz.

createApp security.studioSecretProvider üzerinden async wrapKey/unwrapKey
sağlayıcısı alabilir. Yerel testler yanlış kurum, yanlış anahtar, bozuk veri,
payload boyut sınırı ve DEK yeniden sarma işlemini doğrular. Gerçek KMS adaptörü,
kesintiye dayanıklı toplu rotasyon komutu ve üretim anahtar iptali henüz yoktur.

## İki parçalı offline yedek

Uygulamayı durdurun. Ayrı güvenli bir yerde 32 rastgele baytlık kurtarma
anahtarı hazırlayın ve dosya ACL'sini sınırlandırın; anahtarı komut argümanı,
Git veya loga yazmayın. Örnek yolları kendi yerleşiminize göre değiştirin.

```powershell
node scripts/secure-backup-v2.mjs --mode backup --source "C:/secure/loft-data" --target "C:/backups/data-001" --keys "D:/key-backups/keys-001.enc" --recovery-key-file "E:/recovery/studio.key" --offline
node scripts/secure-backup-v2.mjs --mode verify --source "C:/backups/data-001" --keys "D:/key-backups/keys-001.enc" --recovery-key-file "E:/recovery/studio.key"
node scripts/secure-backup-v2.mjs --mode restore --source "C:/backups/data-001" --keys "D:/key-backups/keys-001.enc" --target "C:/secure/restore-001" --recovery-key-file "E:/recovery/studio.key"
```

Üst klasörleri önceden hazırlayın; veri hedefi ve geri yükleme hedefi yeni
olmalıdır. Kurtarma anahtarı her iki yedekten de ayrı korunur.

- Veri parçası SQLite backup API kopyası, normal dosyalar ve hash manifestidir.
  **Veri parçası bu araç tarafından şifrelenmez**; müşteri verileri için
  şifreli disk/depo ve erişim denetimi gerekir.
- DATA_DIR kökündeki studio-key, integration-key, studio-vault.json ve .env*
  dosyaları veri parçasından çıkarılır, ayrı şifreli anahtar parçasına yazılır.
  DATA_DIR dışındaki yapılandırmaları işletim yedek sisteminde ayrıca koruyun.
- Anahtar parçası yedek kimliği ve veri manifestinin hash'ine bağlanır.
  Tamamlanma işareti yalnızca iki parça başarıyla yazılınca oluşturulur.
- Bozuk/karışık parçalar veya yanlış kurtarma anahtarı hedef oluşturulmadan
  reddedilir. Geri yükleme var olan klasörü değiştirmez.
- Yarım kalan hedefler tamamlanmış yedek sayılmaz. Aynı hedefi yeniden
  kullanmak yerine yeni hedefle deneyin. Fiziksel ayrı yerleşim ve erişim
  politikası operatörün sorumluluğundadır; iki farklı dosya yolu yeterli değildir.

Tatbikatta kayıt sayıları, son rezervasyon/ödeme kimlikleri, tutarlar ve
sağlayıcı mutabakatı kontrol edilir. Kod rollback için eski operasyon
veritabanına dönülmez. Tam N-1 sürüm kabulü ayrı ve henüz tamamlanmamıştır.

## AI erişimi ve insan onayı

Site → **AI erişimi ve öneriler**. İçerik ve üye yönetim izni olan kullanıcı
1–24 saatlik, yalnızca bu siteye ait anahtar oluşturabilir. Anahtar yalnızca
oluşturulduğunda gösterilir; sunucu hash'ini saklar. Aktif anahtar limiti 10,
bekleyen öneri limiti 50, anahtar istek limiti dakikada 60'tır.

Server-to-server istemci Authorization: Bearer ile yalnızca şunları kullanır:

- GET /api/v2/agent/sites/:siteId/document → belge ve revision.
- POST /api/v2/agent/sites/:siteId/proposals → {revision,document}.

Öneri; alan değerleri, çeviriler, SEO başlığı ve açıklamayla sınırlıdır.
Şema, sözlük, kaynak, yerleşim, üyeler, ödeme, import ve yayın yetkisi verilmez.
İçerikteki talimatlar komut olarak çalıştırılmaz. İstekler normal JSON boyut
sınırı, güncel üyelik, ortak alan kuralları ve adaptör doğrulamasından geçer.

İnsan, panelde farkı görüp onaylar veya reddeder. Onay, aynı save işleminden
geçer; yeni içerik sürümü ve insan/credential bağlantılı denetim kaydı birlikte
yazılır. Kaydedilmemiş insan taslağı veya eski revision üzerine uygulanmaz.
Anahtarı iptal etmek bekleyen önerilerini de reddeder. Anahtarın doğal süre
bitimi yeni AI isteklerini durdurur; daha önceki öneri güncel revision ve
yetki koşullarıyla insan tarafından incelenebilir.

Bu özellik bir LLM sağlayıcısına otomatik veri göndermez. Seçilen AI aracı
site içeriğini okuyabileceği için yalnızca uygun veri işleme şartlarına sahip
araca anahtar aktarın. Eski JSON AI taslağı akışındaki actorType kullanıcı
beyanı olarak kalır; doğrulanmış erişim ai.credential / ai.proposal
denetim olaylarıyla ayırt edilir. Denetim veritabanının bağımsız bütünlük
kanıtı henüz yoktur.

## Tedarik zinciri kontrolleri

.npmrc kurulum yaşam döngüsü betiklerini kapatır; güvenilen proje komutları
npm run ile açıkça çalıştırılır. İncelenmemiş paket betiği için bu ayarı
genel olarak kapatmayın. Acil güvenlik güncellemelerine sabit bekleme süresi
uygulanmaz; sürüm/lisans, lockfile, test ve audit birlikte yenilenir.

npm run licenses envanter/bildirimleri; npm run sbom kilit dosyasının bütün
120 paketini içeren CycloneDX 1.5 dosyasını test-results/sbom.cdx.json altında
üretir. SBOM uygulama bağımlılıkları içindir; runner/OS ve GitHub action
bağımlılıklarının eksiksiz envanteri değildir.

GitHub doğrulama akışı Ubuntu/Windows'ta kurulum, typecheck, build, check,
54 baseline ve bütün V2 testleri, lisans, SBOM ve audit çalıştırır. Yalnız
dependency evidence dosyaları artifact olur; test veritabanları/anahtarları
yüklenmez. Workflow salt okunur contents izni ve commit'e sabitlenmiş
resmî Actions kullanır. Yerelde geçen komutlar uzaktaki CI çalışmasının
başarı kanıtı sayılmaz; run sonucu ayrıca kontrol edilmelidir.

# Geçiş, yedekleme ve geri dönüş

Bu sürüm `v2` dalında, mevcut çalışan kurulumdan ayrı geliştirilir. Uygulama kodu, içerik ve operasyonel veriler ayrı sürüm sınırlarına sahiptir. Aşağıdaki adımlar otomatik olarak canlı kuruluma uygulanmamıştır.

## 1. Mevcut durumu kaydet

Çalışan kodun commit'ini, Node sürümünü, `DATA_DIR` yolunu ve `.env` yapılandırmasının güvenli konumunu kaydedin. Anahtar değerlerini rapora veya Git'e yazmayın. Kullanıcı, taslak, yapı, rezervasyon ve ödeme sayılarıyla bir kontrol listesi oluşturun. Bekleyen tahsilatları sağlayıcıyla karşılaştırın.

## 2. Tutarlı yedek al

Uygulamayı durdurun. Aşağıdaki araç uygulamayı durdurmaz ve var olan hedefin üstüne yazmaz. Kaynak dışında yeni bir hedef kullanın:

```powershell
node scripts/backup-v2.mjs --source "C:/secure/loft-data" --target "C:/secure/backups/loft-before-v2" --offline
```

Araç SQLite backup API'siyle tutarlı veritabanı kopyası oluşturur, bütünlük kontrolü yapar, diğer veri dosyalarını ve `integration-key` / `studio-key` anahtarlarını korur. Sembolik bağlantıları reddeder. Dosya hash'lerini `backup-manifest.json` içinde kaydeder. Başarısız/yarım hedefi geri yükleme kaynağı olarak kullanmayın; yeni hedefle yeniden deneyin.

`.env` veri klasörü dışında bulunuyorsa ayrıca güvenli yedekleme sisteminizde koruyun. Windows'ta yedek klasörüne yalnızca işletim hesabının erişebildiği ACL uygulayın; POSIX dosya modu Windows erişim denetimi yerine geçmez. Yedek ve şifreleme anahtarları birlikte hassas veridir. Bunları kaynak deposuna veya yayın ZIP'ine koymayın.

## 3. Kopya üzerinde doğrula

Yedeğin bir çalışma kopyasını oluşturun. V2'yi farklı port ve `DATA_DIR` ile yalnızca bu kopyaya bağlayın. İlk açılış `studio_*` tablolarını ve `reservation_participants` tablosunu ekler. Eski Loft içerikleri yeni belge tablosuna taşınmaz; pet kayıtları silinmez. Kaynak Loft dosyalarının hash denetimi çalışmaya devam eder.

Giriş, 11 dilde taslaklar, 12 tema, 7 şablon, mevcut geçmiş, 143 sayfalık değişmemiş yayın, rezervasyon sayısı, toplam ücret ve sağlayıcı durumlarını karşılaştırın. Örnek site ekleyip düzenleyin; sürüm geri alma sonrası rezervasyon ve ödeme kayıtlarının aynı kaldığını doğrulayın. Test sağlayıcılarıyla webhook/ödeme mutabakatını sınayın.

## 4. Geçişi uygula

Bakım aralığında yeni yedek alın. Çalışan eski süreci durdurduktan sonra doğrulanmış V2 kodunu aynı veri klasörüne yöneltin. İlk kullanıcı kontrolü ve kayıt sayısı karşılaştırması tamamlanana kadar yazma trafiğini açmayın. Kopya denemesinde oluşturulan örnek kayıtları canlı veri klasörüne taşımayın.

## 5. Geri dönüş sınırı

- **İçerik/tasarım hatası:** V2 geçmişinden içerik sürümünü geri yükleyin. Bu, yeni bir içerik sürümü oluşturur; operasyonel kayıtları değiştirmez.
- **İlk açılış hatası, henüz yeni operasyon yok:** Uygulamayı durdurup eski kod + eşleşen veri yedeği + aynı anahtarları birlikte geri alın. Önce başarısız kurulumun verisini ayrıca koruyun.
- **Yeni rezervasyon/ödeme alındıktan sonra:** Eski veritabanını körlemesine geri yüklemeyin. Son veriyi yedekleyin; operasyonları ve sağlayıcı kayıtlarını mutabakatla koruyan düzeltme/geçiş uygulayın. Kod geri dönüşü, tahsilat geri alma işlemi değildir.

## Sonraki dilimler

1. Loft'un mevcut yetkili kaynağına doğrudan bağlanan tam V2 editör adaptörü; kopya içerik deposu oluşturulmadan eşleme.
2. Gerçek WordPress köprüsü, Gutenberg/page-builder kapsamı, Git'e PR tabanlı geri yazma ve birden fazla aktif bağlantı. Kaynak koşullu yazma kabul testleri zorunlu.
3. İç içe bileşen ağaçları, yeni sayfa/silme politikaları, import sözlük eşleştirme arayüzü, tam alan şeması tasarımcısı ve erişilebilirlik denetimi.
4. Bağımsız sitede canlı rezervasyon/gadget bağlama, operasyon olay sözleşmeleri ve takvim sağlayıcı adaptörleri.
5. PostgreSQL tenant politikaları, nesne depolama, dış iş kuyruğu, kısıtlı derleme yürütücüsü, kota/retention ve yedek geri yükleme tatbikatı. Bunlar tamamlanmadan bu yerel ön sürümü genel erişimli çok kiracılı SaaS olarak dağıtmayın.

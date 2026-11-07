# Geçiş, yedekleme ve geri dönüş

Bu sürüm `v2` dalında, mevcut çalışan kurulumdan ayrı geliştirilir. Uygulama kodu, içerik ve operasyonel veriler ayrı sürüm sınırlarına sahiptir. Aşağıdaki adımlar otomatik olarak canlı kuruluma uygulanmamıştır.

## 1. Mevcut durumu kaydet

Çalışan kodun commit'ini, Node sürümünü, `DATA_DIR` yolunu ve `.env` yapılandırmasının güvenli konumunu kaydedin. Anahtar değerlerini rapora veya Git'e yazmayın. Kullanıcı, taslak, yapı, rezervasyon ve ödeme sayılarıyla bir kontrol listesi oluşturun. Bekleyen tahsilatları sağlayıcıyla karşılaştırın.

## 2. Tutarlı yedek al

Uygulamayı durdurun. Aşağıdaki araç uygulamayı durdurmaz ve var olan hedefin üstüne yazmaz. Kaynak dışında yeni bir hedef kullanın:

```powershell
node scripts/secure-backup-v2.mjs --mode backup --source "C:/secure/loft-data" --target "C:/backups/loft-before-v2" --keys "D:/key-backups/loft-before-v2.enc" --recovery-key-file "E:/recovery/studio.key" --offline
```

Önceden ayrı yerde 32 baytlık rastgele kurtarma anahtarı ve hedeflerin üst klasörlerini hazırlayın. Araç SQLite backup API'siyle tutarlı veritabanı kopyası oluşturur. Kök anahtar dosyaları ve .env* ayrı şifreli parçaya alınır; veri parçası araç tarafından şifrelenmez. Sembolik bağlantılar reddedilir; dosya hash'leri ve iki parçayı bağlayan kimlik doğrulanır. Başarısız/yarım hedefi geri yükleme kaynağı olarak kullanmayın. Verify/restore komutları ve sınırlar [işletim prosedüründedir](OPERATIONS.md).

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

Normal kod geri alma güncel veritabanını korur. Additive migration tek başına N-1 uyumu kanıtlamaz; önceki kodun okuma/yazma sözleşmeleri tam sürüm/commit ile test edilmelidir. 0.2'nin V2 sitelerini yönetebildiği varsayılmaz. Bu N-1 tatbikatı henüz tamamlanmadığından otomatik kod downgrade önerilmez. Eski kolonlar ve pet uyumluluk girdileri bu pencere bitmeden kaldırılmaz.

Veri bozulması veya felaket kurtarmada doğrulanmış yedek kullanılabilir; seçilen kurtarma noktası, sonradan oluşan işlemler ve sağlayıcı mutabakatı ayrıca ele alınır. secure-backup-v2 ayrı şifreli anahtar yedeği ve yeni klasöre doğrulanmış geri yükleme sağlar. Eski backup-v2 komutu uyumluluk için anahtarları veriyle birlikte kopyalamaya devam eder. Online nesne/veritabanı tutarlılığı ve hosted PITR uygulanmış değildir (D-02).

İçerik geri yükleme güncel şema, alan/sözlük politikası ve kaynak eşleştirmesini doğrular. Uyumsuzlukta alan yollarıyla hata döner; aktif belge, sürüm sayısı ve operasyonlar değişmez. Otomatik şema dönüşümü uygulanmaz.

## Sonraki dilimler

0. Güvenlik sertleştirmesi: import/yetki/geçmiş kontrolleri, tehdit modeli, güvenli yedek/anahtar ve AI yetki tasarımı. Eski 54 ve V2 26 test korunur.
1. Hosted temel: ortak repository, PostgreSQL tenant politikaları, nesne deposu, dayanıklı kuyruk, kimlik/kota ve operasyon rol ayrımı. Loft/statik Kademe 1 kabulü; Loft'un yetkili kaynağını çoğaltmadan bağlama.
2. Kaynak sapması, yeniden eşleme, Git'e PR tabanlı geri yazma, üç yönlü çakışma çözümü ve site korpusu.
3. İzole runner ve gerçek React kabulü. Script'li önizleme yalnızca ilgili izolasyon/messaging kabulüyle.
4. Gerçek WordPress/API köprüsü, birden fazla aktif bağlantı ve manifestte bildirilen bileşen bölgeleri.
5. İş modülleri, tema/şablon geçişi, uygun adaptörlerde serbest yerleşim; erişilebilirlik ve işletim kabulü.

Mevcut React/WP fixture, rezervasyon, tema ve yerleşim işlevleri bu sıralama nedeniyle kaldırılmaz. Yeni hosted kabulü tamamlanmadan yerel alfa genel erişimli çok kiracılı SaaS olarak dağıtılmaz. Güncel madde durumu [delta kaydındadır](../delta-durum.md).

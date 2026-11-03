# Loft Studio 0.2 — kullanım

2 Kasım 2026. Yerel konsol: http://127.0.0.1:4317/

## İçerik ve tasarım

İçerik stüdyosundaki görünür metin alanları ve bölüm başlık/metin/düğme alanları HTML kaynak düzenleyicisine sahiptir. Araç çubuğu kalın, italik, altı çizili, satır sonu, bağlantı, sola/ortaya/sağa hizalama, iki yana yaslama ve biçimi temizleme sunar. Önizleme düğmesi sonucu gösterir. SEO, adres, menü etiketi ve görsel alt metni gibi metin olması gereken alanlar düz metindir.

Desteklenen HTML etiketleri: strong, b, em, i, u, s, br, span, a, code, mark, sub, sup. Script, iframe, olay işleyicileri ve serbest CSS kabul edilmez. HTML kaydedilmeden önce sunucuda doğrulanır. Bu bir HTML kaynak editörüdür; sürükle-bırak WYSIWYG değildir.

Sayfalar & tasarım → Yerleşim, şablon ve sayfa boşlukları: üst/alt/yan dolgu, bölüm aralığı, içerik genişliği, 1–3 sütun, yan panel ve yatay hizalama. Yedi şablon: özgün, geniş tek sütun, iki sütun kartlar, üç sütun dergi, içerik + yan panel, kompakt, geniş karşılama. Şablon seçimi içerikleri korur.

Bölüm konumu: sol/orta/sağ/tam genişlik; yukarı/aşağı düğmeleri bölüm sırasını değiştirir. Dikey konum, sütun kapsamı, dolgu ve dış boşluk düzenlenebilir. Otomatik mobil hizalama açıkken 900 px altında tek sütun, mobil aralık ve yan dolgu uygulanır. Temalar sekmesinde 12 renk paleti bulunur. Taslak kaydedildikten sonra yeni önizleme üretin.

## Rezervasyon ve takvim

Rezervasyon ayarlarında Pet Hotel ve Bakım & Kuaför hazır gelir; başlangıçta kapalıdır. Gerçek ücret, kapasite, saat ve politikaları belirleyip hizmeti etkinleştirin. İlave hizmetler eklenebilir. Aynı kaynak kimliğine sahip hizmetler kapasiteyi paylaşır.

- Konaklama: giriş/çıkış saati, minimum/maksimum gece, gece ve pet adedine göre ücret.
- Randevu: çalışma günleri/saatleri, süre, başlangıç aralığı, hazırlık süresi, minimum ön bildirim ve ileri tarih sınırı.
- Yönetim: müşteri ve pet bilgileri, bakım notları, müsaitlik, durum, tarih değiştirme, iptal, giriş ve tamamlanma; arama ve tarih/durum filtreleri.
- Bekleyen rezervasyonlar süre sonunda iptal edilir ve kapasite açılır. Eşzamanlı isteklerde kapasite veritabanı işlemi içinde tekrar kontrol edilir.
- Mevcut rezervasyonların altına kapasite düşürülmesi ve aktif rezervasyonu olan hizmetin kaynak/tür değişikliği engellenir.
- Takvim: ay/ajanda, kapalı zamanlar, günlük/haftalık tekrarlar, düzenleme, silme, .ics dışa aktarma. Google/Apple/Outlook'a dosya içe aktarılabilir; çift yönlü senkronizasyon yoktur.

Ziyaretçi ekranı /book/loft/ adresindedir. Çevrimiçi rezervasyonu ayarlardan açın. Müşteri yönetim anahtarı yalnızca rezervasyonu oluşturan tarayıcıda saklanır; başka tarayıcıdan erişim için işletmeyle iletişim gerekir. E-posta/SMS gönderimi yoktur. Liste ekranı son 1.000 rezervasyonu gösterir.

## Ödeme ve veri bağlantıları

Bağlantılar ekranından sağlayıcı anahtarlarını girin. Boş anahtar alanı mevcut değeri korur. Anahtarlar sunucuda AES-256-GCM ile şifrelenir; tarayıcıya ve statik pakete verilmez. data/integration-key dosyası veritabanıyla birlikte yedeklenmelidir.

| Sağlayıcı | Kullanım |
| --- | --- |
| iyzico | Sandbox/canlı Checkout Form, imzalı yanıt ve sunucudan ödeme doğrulama |
| Stripe | Hosted Checkout, tutar/para birimi/referans kontrolü, imzalı webhook |
| PayPal | Sandbox/canlı Orders ve capture; TRY desteklenmez, uygun ülkede işletme hesabı gerekir |
| Open-Meteo | Konuma göre hava durumu; ticari kullanımda müşteri API anahtarı |
| NewsAPI | Konu/dil seçimi, kaynak bağlantılı haber başlıkları; üretim planı gerekir |
| Alpha Vantage | Hisse ve endeks; veri zamanı gösterilir, anlık veri/lisans plana bağlıdır |
| TomTom | Seçilen noktaya yakın yol kesiminde hız ve kapanma bilgisi |

Gadget eklemek için tasarım ekranında Gadget bölümü ekleyin ve türünü seçin. Veriyi test et düğmesi yapılandırılmış sağlayıcıdan sunucu üzerinden veri alır. Veriler 5 dakika önbelleğe alınır; kesintide son veri ve güncellik durumu gösterilir. Endeks entegrasyonu [Alpha Vantage INDEX_DATA](https://www.alphavantage.co/documentation/#index-data) günlük verisini ister ve premium erişim gerektirir.

Ödeme bağlantısı rezervasyonun sunucudaki tutarından üretilir. Dönüş sayfasına gelmek tek başına ödenmiş sayılmaz. Stripe webhook adresi: APP_ORIGIN + /payments/loft/stripe/webhook. iyzico callback adresi: APP_ORIGIN + /payments/loft/iyzico/callback. PayPal dönüşünde yönetim ekranındaki Ödemeyi doğrula düğmesi capture ve doğrulama işlemini tamamlar. Stripe/iyzico da buradan tekrar doğrulanabilir.

İptalden veya bekleme süresi dolduktan sonra gelen ödeme incelemeye alınır; kapasite yeniden ayrılmaz. İadeler sağlayıcının panelinden yürütülür. Ödeme süreci başlamış rezervasyonun tarihini değiştirmek engellenir; önce iptal/iade mutabakatı gerekir. Kart verisi Studio'da tutulmaz.

## Yerelden canlı kullanıma

Bu teslim yereldir; dışarıya yayın veya gerçek tahsilat yapılmadı. Sağlayıcı testleri kontrollü HTTP yanıtlarıyla çalışır; gerçek merchant hesabıyla kabul testinin yerini tutmaz.

Canlı rezervasyon ve gadget için sürekli çalışan HTTPS Node sunucusu, kalıcı veri diski ve gerekli API hesapları gerekir. APP_ORIGIN, Rezervasyon ayarları → Canlı sunucu adresi ve izin verilen site kökenlerini doğru ayarlayın. Natro statik ZIP tek başına rezervasyon/ödeme sunucusu değildir. Önizleme güvenlik ilkesi dış sunuculara veri bağlantısını engeller; canlı gadget doğrulamasını yapılandırılmış sitede yapın.

PowerShell betik çalıştırma ilkesi npm.ps1 dosyasını engelliyorsa npm.cmd start kullanın. Uygulamayı başlatmak için çalıştırma ilkesini değiştirmek gerekmez.

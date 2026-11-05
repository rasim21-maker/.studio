# Loft Studio 2 — yerel ön sürüm

Bu dal ilk uçtan uca geçiş dilimini içerir. Mevcut Loft konsolu `/`, yeni çalışma alanı `/v2/` adresindedir. Canlı Loft veri klasörü bu geliştirmede değiştirilmemiştir.

## Başlatma

Node 24.13.x ve npm gerekir. Windows'ta PowerShell betik ilkesine takılmamak için `npm.cmd` kullanın. Depo klasöründe:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run build
npm.cmd start
```

Yeni kurulumda terminalin verdiği tek kullanımlık kurulum bağlantısından ilk yönetici hesabını oluşturun. Sonra `http://127.0.0.1:4317/v2/` adresinde bu hesapla oturum açın. Mevcut bir kurulumun verilerini kullanmadan önce [geçiş prosedürünü](MIGRATION.md) uygulayın. İki sunucuyu aynı veri klasörüne bağlamayın.

Başka port/veri klasörü için `.env.example` dosyasından yerel `.env` oluşturun; `PORT`, `APP_ORIGIN` ve `DATA_DIR` değerlerini birlikte ayarlayın. Anahtarları Git'e koymayın.

## İlk siteyi bağlama

1. **Site bağla → Örnek site** ile statik, React SDK veya WordPress sözleşme örneğini seçin. Örnekler harici sağlayıcıya bağlı değildir.
2. Dosya raporunu, dışlanan öğeleri ve yetenekleri inceleyin. Gerçek kaynaklar için ZIP veya GitHub anlık görüntüsü kullanılabilir.
3. Bölümü katman listesinden seçin; sürükleyin, klavyeyle taşıyın veya yukarı/aşağı düğmelerini kullanın. İçerik, HTML, yerleşim, cihaz ve tema ayarlarını düzenleyin.
4. Otomatik kayıt durumunu bekleyin. Hatalı belge kaydedilmez; sekmedeki taslak korunur. Çakışmada farkları inceleyin.
5. **Yayınla → Yayın paketi oluştur** ile değişmez sürüm ZIP'i alın. ZIP oluşturmak canlı siteye dağıtım yapmaz.
6. **Kaynak dosyaları** paneli salt okunur kaynakları, dış kaynak sürüm kontrolünü ve yeniden import akışını sunar.

## İş modülleri

Site içinde **İş modülleri → İş modüllerini kur** rezervasyon, takvim ve entegrasyon ayarlarını açar. Gecelik konaklama ve süreli randevu hizmetleri başlangıçta kapalıdır. Kapasite, ücret, para birimi, saat dilimi, çalışma saatleri, açık günler, bekleme süresi ve iptal sınırlarını ayarlayın. Genel sitelerde katılımcılar kişi olarak kaydedilir; Loft'ta pet alanları korunur.

İyzico, Stripe ve PayPal adaptörleri ayrı yapılandırılır. Anahtar olmadan hazır sayılmazlar. Takvim aylık/ajanda görünümü, kapalı zamanlar, tekrarlanan etkinlik ve ICS dışa aktarmayı destekler. ICS, çift yönlü Google/Outlook eşitlemesi değildir. Hava durumu, haber, hisse, endeks ve trafik ayarları kendi sağlayıcılarıyla çalışır; kota, lisans ve canlı kullanım hesabı işletmeciye aittir.

Yeni V2 tasarım bileşenlerindeki rezervasyon/canlı veri yer tutucuları henüz otomatik yayın bağlantısı kurmaz. İş modülleri ve ziyaretçi rezervasyon ekranı çalışır; özel sitenin bunlara bağlantısı ayrıca kurulmalıdır. Mevcut Loft yayın bağlantısı korunmuştur.

## Geliştirme

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:v2
npm.cmd run check
npm.cmd run licenses
npm.cmd audit
```

`scripts/qa-preview.mjs`, yalnızca `test-results/ui-preview` altında sahte veriler ve bilinen bir test hesabı oluşturan, loopback üzerinde 4321 portunda çalışan geliştirme yardımcısıdır. Üretim başlatıcısı olarak kullanılmaz. Testler gerçek ödeme veya gerçek müşteri kaydı oluşturmaz.

Belgeler: [mimari](ARCHITECTURE.md), [adaptör ve veri modeli](ADAPTERS.md), [import güvenliği](SECURITY.md), [geçiş/geri dönüş](MIGRATION.md), [bileşen kararları](COMPONENTS.md), [doğrulama ve kalan kapsam](VERIFICATION.md).

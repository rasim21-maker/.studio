# Loft Pet House

Loft Pet House'un 11 dilde hazırlanmış statik web sitesi. Türkçe varsayılan dildir; Açık, Koyu ve Sistem temaları desteklenir.

## Çalıştırma

Hazır site `dist/` klasöründedir. Yerel bir HTTP sunucusuyla önizleyebilirsiniz:

```sh
python -m http.server 8000 --directory dist
```

Kaynak metinlerden 143 HTML sayfasını yeniden üretmek için Node.js ile:

```sh
node build.mjs
```

Ek npm bağımlılığı gerekmez. Natro'ya yüklemek için `dist/` klasörünün **içeriğini** alan adının web köküne aktarın.

## Dosyalar

- `build.mjs`: sayfa şablonları ve site yapısı.
- `localize.mjs`: dil sayfaları ve dil/tema menüleri.
- `seo.mjs`: SEO başlıkları, açıklamalar, canonical, hreflang, yapılandırılmış veri ve site haritası.
- `content/locales/`: 11 dilin temel çevirileri.
- `content/seo/`: SEO metinleri, görsel alt metinleri ve ek içerikler.
- `content/site.json`: asıl alan adı ayarı.
- `content/editorial-sources.json`: içerik kaynakları ve doğrulama notları.
- `dist/assets/`: yerel fotoğraflar, logo ve simgeler.
- `dist/app.js`, `dist/preferences.js`, `dist/style.css`, `theme.css`: etkileşimler ve görünüm.
- `README.txt`: ayrıntılı proje açıklaması.
- `docs/`: Natro kurulum kılavuzu ve SEO raporu.

## Formlar

İletişim ve rezervasyon formları kullanıcının e-posta uygulaması için taslak hazırlar. Sunucudan mesaj göndermez veya otomatik rezervasyon kaydı oluşturmaz. Yönetim konsolu henüz geliştirilmemiştir.

## Kaynak sürümü

Bu depo, 30 Ekim 2026 tarihinde yayımlanan Sites kaynak sürümü `e9d366c79b8777340c36926f91a2df95a23dd72d` temel alınarak oluşturulmuştur. Son ana sayfa metni düzeltmesi dahildir. Sites proje kimliği `.openai/hosting.json` içinde korunur.

GitHub'a aktarılan bu kopya mevcut Sites veya Natro yayınının otomatik dağıtımını değiştirmez.

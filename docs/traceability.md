# Gereksinim izlenebilirliği

Tarih: 2026-11-06. Ana prompt'un 14 bölümü ve kabul edilen delta için yaşayan kayıt.
Mimari kararlar: v2/ARCHITECTURE.md içindeki 1–8 numaralı kararlar ve delta uygulama sırası.
Bir testin burada bulunması, bütün gereksinimin tamamlandığı anlamına gelmez.
Ayrıntılı E/D/S durumu: [delta-durum.md](delta-durum.md).

| Ana bölüm | Karar / delta | Çalışan kanıt | Kalan ve gerekçe |
|---|---|---|---|
| 1 Ürün kapsamı | K1–K3, D-04/D-06 | workspace/capabilities, eski Loft erişimi HTTP testi | Hosted ürün, tam Loft generic adaptörü; mevcut alfa sınırı |
| 2 Çekirdek/adaptör | K2/K3, E-01 | contracts: 3 adaptör + çekirdek değiştirmeden test adaptörü | Repository ayrımı, plugin kapsamı/uyumluluk ve çoklu bağlantı |
| 3 Yetkili kaynak | K4/K8, E-08–E-11 | export/reimport kimliği, stale hash, revision ve WP koşullu yazma | Yeniden eşleme, Git merge, alan otorite çatışması |
| 4 Görsel editör | K1/K3, D-06/D-07 | Önceki tarayıcı doğrulaması; kalıcı reorder/layout testleri | İç içe ağaç, kapsamlı erişilebilirlik; bu dilimde yeni UI denetimi yapılmadı |
| 5 İçerik/tema | K4/K5, E-13/S-04 | 12 tema/7 şablon baseline; HTML ve kaynak koruma sözleşmeleri | Ayrıntılı tema etki/uyumluluk ekranı |
| 6 Doğrulama | K2/K5, E-10/E-13 | validation.ts; manual/AI XSS; snapshots güncel şema/alan reddi | Tam alan şeması tasarım arayüzü, bütün toplu akışlar |
| 7 Sözlük | K2, E-10 | inactive dictionary tests, geçmiş sürüm okunabilirliği | Import eşleme, terminoloji ve yönetim ekranları |
| 8 Güvenli import | K5/K6, E-04/E-14/E-24 | ZIP, Unicode/Git çakışması, kuyruk yetkisi; network transport testleri | Geniş fuzz/SVG korpusu, hosted karantina/asset origin |
| 9 İş modülleri | K8, E-18/D-05/D-09/S-02 | Genel katılımcı, kapasite yarışı, takvim, ödeme mock testleri | Gerçek sağlayıcı kabulü, ayrı roller, veri lisansı kayıtları |
| 10 Güvenlik | K5–K8, E-02–E-07/D-01–D-03 | auth/CSRF/tenant, kaynak sır dışlama, tehdit modeli | MFA, KMS/rotation, ayrı origin, N-1 ve PITR |
| 11 AI | K7, E-16/E-17 | Aynı validation/save API yolu | AI etiketi kimlik değildir; dar yetki, sağlayıcı/veri politikası yok |
| 12 Geçiş | K1/K8, E-01/D-01/D-02 | Additive tablolar, offline yedek ve operasyon koruma testleri | Hosted repository ve tam sürümle N-1 tatbikatı |
| 13 Kabul | Delta sıra, E-11/E-23/E-24/D-10 | 54 baseline + 26 başlangıç V2 regresyonu korunur; yeni güvenlik testleri | Gerçek 20 site, canlı bağlantılar, hosted ve tarayıcı güvenlik kabulü |
| 14 Açık kaynak | E-25/D-08 | package-lock, THIRD_PARTY_NOTICES, bağımlılık envanteri | CycloneDX/CI, ürün lisansı kararı |

Bu dilimde yeni üçüncü taraf bağımlılık eklenmedi. Mevcut Node, parse5, fflate ve
adaptör/şema sözleşmeleri kullanıldı. Paket araştırması veya lisans incelemesi yapılmış
gibi yeni bir kayıt üretilmedi; önceki envanter korundu.

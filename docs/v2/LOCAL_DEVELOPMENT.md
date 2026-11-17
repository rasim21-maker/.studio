# Codex sohbetinden yerel Python yardımcısı

Kullanıcı geliştirme isteğini Codex masaüstü sohbetinde yazar. Codex, mevcut
terminal aracıyla bu depodaki Python yardımcısını çalıştırır, kısa sonucu okur,
gereken kodu düzenler ve yerel kontrolleri çağırır. Ayrı LLM, API anahtarı,
HTTP sunucusu veya MCP sunucusu gerekmiyor. Bu bağlantı bu Codex çalışma alanı
içindir; yalnızca dosyaları eklemek başka bir sohbet istemcisine araç erişimi
kazandırmaz. [Resmî yerel araç belgeleri](https://learn.chatgpt.com/docs/codex/cli).

## Gereksinimler ve çalıştırma

Mevcut Node.js 24.x/Git ortamına ek olarak Python **3.10+** gerekir. Yardımcı
yalnızca standart kütüphane kullanır; pip paketi veya yeni ürün bağımlılığı yoktur.
Node başlatıcısı `LOFT_DEV_PYTHON`, bilinen yerel Codex Python yolu, ardından
python3/python/py komutlarını dener. Codex paket yolu kalıcı bir ürün API'si
değildir; bulunamazsa normal Python kurulumu veya açık çalıştırıcı yolu kullanın.
`LOFT_DEV_PYTHON` bir çalıştırıcı yoludur, komut/argüman dizgesi değildir.

Depo kökünde PowerShell örnekleri (diğer kabuklarda npm.cmd yerine npm):

```powershell
npm.cmd run --silent dev:assist -- status
npm.cmd run --silent dev:assist -- context --query "booking crm"
npm.cmd run --silent dev:assist -- --max-chars 5000 context --file packages/booking-crm/index.mjs --start 60 --lines 40
npm.cmd run --silent dev:assist -- run --test test/v2/module-integrations.test.mjs
npm.cmd run --silent dev:assist -- run --profile quick
npm.cmd run --silent dev:assist -- summary
npm.cmd run --silent dev:assist -- checkpoint --done "CRM bağlantısı doğrulandı" --next "Sıradaki görev"
```

Python doğrudan da çağrılabilir: `python -I -B scripts/dev_assist.py status`.
npm tabanlı profiller için başlatıcı önerilir; npm CLI konumunu taşınabilir biçimde iletir.

## Komut sözleşmesi

| Komut | Yerel iş | Sohbete dönen |
| --- | --- | --- |
| status | Git, çalışma dosyası parmak izi, workspace paketleri, son kontrol ve not | Commit/dal, sınırlı dosya listesi, modüller, güncellik |
| context | Git'in bildiği, izin verilen metin dosyalarında sınırlı sözcük araması veya açık dosya/satır seçimi | Kaynak satırları, basit import ipuçları, kısmi sonuç işaretleri |
| run | Sabit profiller veya açık seçilen test dosyaları | Gerçek çıkış kodu, süre, mevcutsa TAP sayıları, kısa hata kesiti, log yolu |
| summary | Son raporu mevcut commit ve çalışma dosyalarıyla karşılaştırma | Sonuç ve `stale` bilgisi |
| checkpoint | Kısa tamamlanan/sıradaki iş notu | Commit ve çalışma dosyalarına bağlı not; test kanıtı değildir |

Profiller: `quick` = typecheck + check; `v2`, `legacy`, `packages`, `helper`
ilgili test gruplarıdır. `full`, helper/typecheck/build/check/legacy/v2/packages/
licenses/sbom/audit adımlarını sırayla çalıştırır. İlk hatada durur ve kalanları
`not_run` olarak bildirir. `full` ağ erişimi gerektiren npm audit adımını içerir;
sandbox izinleri aynen geçerlidir. Testler güvenilen proje kodunu çalıştırır;
bu araç import edilen güvenilmeyen kod için bir izolasyon ortamı değildir.

Çıkış kodları: 0 başarılı çağrı, 1 başarısız/zaman aşımına uğramış kontrol,
2 argüman/ortam/yardımcı hatası. `summary` eski başarısız sonucu raporlarken 0
dönebilir; rapordaki status ve stale alanları birlikte incelenmelidir.

## Sınırlar ve kanıt

- Varsayılan yanıt sınırı 10.000 **karakterdir**, token sayımı değildir.
  `--max-chars` 1.500–24.000 arasında ayarlanabilir; kesilme açıkça bildirilir.
- Bağlam taraması en çok 600 dosya/12 MiB, dosya başına 512 KiB okur; otomatik
  seçim en çok 6 dosya, açık seçim 8 dosya, kesit en çok 120 satırdır. İlgili
  kodu atlayabilir. Gerekirse açık dosya ve satır aralığıyla devam edin.
- .env, veri/log/çıktı dizinleri, özel anahtar ve kimlik bilgisi adları, binary,
  symlink/junction ve depo dışı yollar bağlamdan dışlanır. Genel parola/token
  kalıpları kaynakta ve logda maskelenir. Bu, bütün olası sırları veya kişisel
  verileri saptama garantisi değildir; gerçek müşteri verisini kaynakta tutmayın.
- Komutlar shell kullanmadan sabit listeden yürütülür. Serbest komut, dosya
  düzenleme, Git yazımı, paket kurulumu veya ağ dinleyicisi sunulmaz. Kod düzenleme
  ve Git işlemleri Codex'in mevcut izinli araçlarıyla devam eder.
- Her kontrolün logu en çok 1 MiB tutulur. Büyük çıktılar ayrıca işaretlenir;
  bir adım varsayılan 600 saniye, en çok 1800 saniye çalışabilir.
- Raporlar ve notlar `.dev-assist/` altında yereldir ve Git'e alınmaz. Her rapor
  commit + staged/unstaged/untracked kaynak parmak izi taşır. Çalışma sırasında
  dosya değişirse veya sonradan farklılaşırsa sonuç eski olarak işaretlenir.
  Kontroller otomatik olarak atlanmaz veya önbellekten başarılı sayılmaz.
- Ortam/bağımlılık sürümü, ignore edilen dosya veya dış servis değişikliklerini
  bu parmak izi kanıtlamaz. Temiz CI teslim doğrulamasını korur. Checkpoint
  notları yereldir; kalıcı mimari kararlar normal proje belgelerinde tutulur.
- Kazanç daha kısa bağlam ve çıktıdan gelir. Gerçek token tasarruf yüzdesi
  ölçülmedi; Python'un kendi işlemleri LLM çağrısı yapmaz.

## Yardımcının regresyonları

`npm.cmd run test:dev-assist` gerçek geçici Git depoları ve alt süreçlerle;
bağlam seçimi, Unicode/rename, dizin dışına çıkma, sır maskeleme, çıktı sınırları,
eski rapor tespiti, hata çıkış kodu, durdurma ve zaman aşımını doğrular.
Sembolik bağlantı testi Windows izni yoksa açıkça skip olabilir; Linux CI'da
çalışır. CI aynı Python testlerini Windows ve Ubuntu üzerinde çalıştırır.

## Bileşen kararı

Mevcut npm test/derleme komutları yeniden kullanılır. Git, subprocess, argparse,
json ve unittest bu sınırlı ihtiyaç için yeterlidir. Ek framework, paket veya
kopyalanmış üçüncü taraf kaynak eklenmedi; lisans envanteri değişmez.

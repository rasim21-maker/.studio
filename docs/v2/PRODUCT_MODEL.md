# Ürün, modül ve ülke modeli

Karar tarihi: 2026-11-06. Kullanıcının yanıtları: çekirdek şimdilik açık kaynak;
ileride örneğin randevu modülü satılabilir veya kiralanabilir. Hedef dünya geneli;
yerelleştirme ve ülkeye bağlı işletim kuralları kuruluma göre uygulanmalı.

## Açık kaynak çekirdek ve isteğe bağlı ticari modüller

Çekirdek; kimlik, tenant/yetki, adaptör sözleşmesi, içerik, doğrulama, sözlük,
import, geçmiş ve yayın politikalarını kapsar. Ticari paketler bu yetki ve
doğrulama sınırlarını atlayamaz. Mevcut rezervasyon özellikleri bu kararla kapatılmaz.

İleride ücretli modül, sürümlü bir modül kimliği/sözleşmesi üzerinden kurulmalı.
Lisans veya abonelik durumu yetkiden ayrı değerlendirilmelidir: ücret ödemek veri
erişim izni vermez. Planlanan entitlement kaydı tenant, modül, sürüm aralığı,
geçerlilik, özellikler ve doğrulanabilir sağlayıcı kaynağını belirtmelidir.
Satın alma, kiralama, self-hosted kullanım ve offline tolerans ayrı ürün
kurallarıdır. Bugünkü sürüm bir lisans sunucusu veya abonelik tahsilatı içermez.

Süre dolması yeni ücretli işlemleri sınırlandırabilse de geçmiş randevuların,
ödemelerin, müşteri kayıtlarının okunması, güvenli dışa aktarımı ve işletim
gereklilikleri kaybolmamalıdır. Bu davranış, ücretli modül yayınlanmadan önce
sözleşme ve testlerle netleştirilmelidir; sessiz veri silme tasarlanmamıştır.

Kesin çekirdek lisansı henüz seçilmedi. MIT/Apache/BSD bağımlılık tercihleri,
ürünün otomatik olarak aynı lisansa geçtiği anlamına gelmez. Mevcut Loft
sitesinin içerik/görsel/kaynak hakları korunur. Açık kaynak yayın öncesinde
çekirdeğe ait kod ile siteye özel varlıkların kapsamı ayrılıp LICENSE dosyası
sahibinin kararıyla eklenmelidir. Bu çalışma yeniden lisanslama yapmaz.

## Üç ayrı bölgesel profil

1. **Biçim ve sözlük:** faaliyet ülkesi, dil, para birimi ve IANA saat dilimi.
   Ülke seçimi öneri üretir; çok saat dilimli ülkelerde kullanıcı seçim yapar.
   Yönetim arayüzü dili ve sitenin içerik dilleri bundan ayrıdır.
2. **Fiziksel yerleşim:** tenant'ın veri bölgesi, yedek bölgesi, anahtar bölgesi
   ve kullanılan alt sağlayıcılar dağıtım tarafından doğrulanmalıdır.
   IP veya arayüz dili değiştiğinde veri taşınmaz.
3. **Ülke politikası:** yasal kapsam, doğrulanmış kural sürümü, inceleme tarihi,
   saklama süreleri, izin/aydınlatma metinleri ve sınır ötesi aktarım koşulları.
   Bir ülke adı seçmek uygunluk belgesi oluşturmaz. Doğrulanmamış ülke
   politikası etkinmiş gibi gösterilmez.

Bu dilimde ilk profil siteye özgü, revision kontrollü API ve arayüz olarak
uygulandı. İkinci/üçüncü profil API'de local / dataRegion:null ve
needs-review / ruleset:null döner. Bunlar çalışan hosted politika motoru
değildir. Ülke kataloğu yasal hizmet verebilme veya ödeme sağlayıcısı desteği
listesi değildir.

Mevcut rezervasyon para birimi, ücret, zaman ve saat dilimi değişmez. Yeni profil
site tercihidir; bütün modüllerin otomatik davranışına henüz bağlanmamıştır.
Gelecek modüller yeni kayıt varsayılanlarını bu profilden alabilir; mevcut
operasyon kayıtlarının dönüşümü ayrı önizleme, doğrulama ve mutabakat gerektirir.

## Açık işletim kararları

Her hosted tenant için seçilebilir bölgeler, RPO/RTO, gerçek KMS/nesne deposu
sağlayıcıları ve AI veri işleme şartları halen belirlenmelidir. Dünya geneli
hedefi tek bir fiziksel veri bölgesi olarak kaydedilmez. Bu kararlar yerel
geliştirme ve sözleşme testlerini durdurmaz.

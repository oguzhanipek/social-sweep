# Social Sweep

Gizlilik odaklı, açık kaynak Instagram takip yöneticisi. Kendi Instagram veri arşivini tarayıcında yerel olarak analiz et.

## Özellikler

- Instagram veri dışa aktarım ZIP dosyasını içe aktar
- Bekleyen takip isteklerini görüntüle
- Takip ettiğin ancak seni takip etmeyen hesapları bul
- Karşılıklı takipleri ve yalnızca seni takip eden hesapları görüntüle
- Listelerde arama yap ve CSV olarak dışa aktar
- Manuel işlem işaretlerini bu tarayıcıda sakla

## Gizlilik ve güvenlik

ZIP dosyan tarayıcında işlenir. Social Sweep Instagram şifreni istemez, Instagram'a bağlanmaz ve otomatik takip/takipten çıkarma işlemi yapmaz. Profili Instagram'da açıp değişiklikleri kendin yaparsın. Instagram'ın kendi limitleri ve kullanım koşulları geçerlidir.

## Gereksinimler

- Node.js 20 veya üzeri
- npm

## Yerel çalıştırma

```bash
npm install
npm run dev
```

Üretim derlemesi:

```bash
npm run build
```

## Instagram arşivi

Instagram Hesaplar Merkezi'nden **Takipçiler ve takip edilenler** verisini JSON formatında indir. ZIP dosyasını çıkarmadan uygulamaya yükle.

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE) dosyasına bak.

## Sorumluluk reddi

Social Sweep bağımsız bir topluluk projesidir; Instagram veya Meta ile bağlantılı, onlar tarafından onaylanmış ya da desteklenmiş değildir.

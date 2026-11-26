# Sim Companies Depo VWAP

[Dil seçin](README.md)

Depodaki ürünlerin hacim ağırlıklı ortalama fiyatını (VWAP) ve indirimli birim fiyatını kaliteye göre gösterir. Varsayılan dönem, UTC’ye göre önceki gündür. Oyundaki kaliteye göre günlük fiyat grafiklerine erişmek için Supporter statüsü gerekir.

## Kurulum ve güncelleme

1. **Assets** bölümünden `warehouse-vwap-v*.zip` dosyasını indirin ve arşivi açın. [En son sürüm](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. `chrome://extensions` sayfasında **Geliştirici modu** seçeneğini etkinleştirin ve **Paketlenmemiş öğe yükle** düğmesine tıklayın. `manifest.json` dosyasını içeren `warehouse-vwap` klasörünü seçin.
3. Oyuna giriş yapıp depoyu açın. Stoktaki ürünlerin fiyatlarını görmek için **Depo VWAP** bölümünü genişletin. Kaliteye göre fiyatları görmek için bir ürün açın.

Güncellemek için yeni dosyaları daha önce yüklediğiniz klasöre kopyalayarak eski dosyaların üzerine yazın. Mevcut uzantının kartındaki yeniden yükleme simgesine tıklayın, ardından depo sekmesini yenileyin. Aynı klasörü kullanırsanız ayarlarınız ve önbellekteki fiyatlar korunur.

## İndirim ve dil

Ürün sayfasında, indirimli fiyatın yanındaki yüzdeye tıklayın. Ürün için varsayılan indirimi ve Q0–Q12 için ayrı indirimleri düzenleyebilirsiniz. Boş alan üst düzey ayarı kullanır. İndirimsiz fiyat için 0 girin. Kaydedince fiyatlar hemen yeniden hesaplanır.

Uzantı varsayılan olarak Chrome’un görüntüleme dilini kullanır. Araç çubuğunda uzantıyı açıp **Tüm ayarlar → Dil** bölümünden değiştirebilirsiniz.

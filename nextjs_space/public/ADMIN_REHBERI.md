# 📚 Dönüşüm Platformu - Admin Rehberi

> Bu rehber, platformda sıfırdan bir anket oluşturmayı ve yapılandırmayı adım adım anlatmaktadır.

---

## 📋 İçindekiler

1. [Admin Paneline Giriş](#1-admin-paneline-giriş)
2. [Yeni Anket Oluşturma](#2-yeni-anket-oluşturma)
3. [Kategori Ekleme](#3-kategori-ekleme)
4. [Alt Kategori Ekleme](#4-alt-kategori-ekleme)
5. [Alt Seviye Ekleme (Opsiyonel)](#5-alt-seviye-ekleme-opsiyonel)
6. [Soru Ekleme](#6-soru-ekleme)
7. [Öneri (Recommendation) Ekleme](#7-öneri-recommendation-ekleme)
8. [Sektör Ağırlıkları Belirleme](#8-sektör-ağırlıkları-belirleme)
9. [Ironman Benchmark Ayarlama](#9-ironman-benchmark-ayarlama)
10. [Özet Akış Şeması](#10-özet-akış-şeması)

---

## 1. Admin Paneline Giriş

### Nasıl Girerim?

1. Tarayıcınıza `/admin` yazın (örnek: `siteniz.com/admin`)
2. Sol tarafta menü göreceksiniz:
   - 🏠 Dashboard
   - 📄 Anketler
   - 📁 Kategoriler & Sorular
   - 💡 Öneriler
   - 🏭 Sektörler
   - ⚖️ Sektör Ağırlıkları
   - 📊 Benchmark
   - 🎯 Ironman Benchmark

---

## 2. Yeni Anket Oluşturma

### Adımlar:

1. Sol menüden **"Anketler"** sekmesine tıklayın
2. Sağ üstteki **"+ Yeni Anket"** butonuna tıklayın
3. Açılan pencerede:
   - **Anket Adı**: Anketinize bir isim verin (örnek: "ESG Olgunluk Değerlendirmesi")
   - **Açıklama**: Kısa bir açıklama yazın
   - **Sıra**: Anketin görünme sırası (1, 2, 3...)
   - **Aktif**: Anketi aktif etmek için işaretleyin ✓
4. **"Kaydet"** butonuna tıklayın

### 💡 İpucu:
Anket oluşturduktan sonra, o anketin yanındaki **dosya ikonuna** tıklayarak doğrudan kategori ekleme sayfasına gidebilirsiniz.

---

## 3. Kategori Ekleme

### Kategori Nedir?
Kategori, anketinizin ana bölümlerdir. Örneğin bir ESG anketinde:
- Çevresel Yönetim
- Sosyal Sorumluluk
- Kurumsal Yönetişim

### Adımlar:

1. Sol menüden **"Kategoriler & Sorular"** sekmesine tıklayın
2. Üstte **"Anket Seçin"** dropdown'undan anketinizi seçin
3. **"+ Yeni Kategori"** butonuna tıklayın
4. Açılan pencerede:
   - **Kategori Adı**: Kategori ismini yazın (örnek: "Çevresel Yönetim")
   - **Açıklama**: Kısa bir açıklama
   - **Sıra**: Görünme sırası
5. **"Kaydet"** butonuna tıklayın

### 💡 İpucu:
Birden fazla kategori ekleyebilirsiniz. Her anket genellikle 3-10 kategori içerir.

---

## 4. Alt Kategori Ekleme

### Alt Kategori Nedir?
Kategorilerin içindeki daha spesifik konulardır. Örneğin "Çevresel Yönetim" kategorisi altında:
- Emisyon Yönetimi
- Atık Yönetimi
- Enerji Verimliliği

### Adımlar:

1. Kategori listesinde, alt kategori eklemek istediğiniz kategorinin yanındaki **oku** (▶) tıklayarak açın
2. **"+ Alt Kategori"** butonuna tıklayın
3. Açılan pencerede:
   - **Alt Kategori Adı**: İsim yazın
   - **Açıklama**: Kısa açıklama
   - **Sıra**: Görünme sırası
   - **Alt Seviye Kullan**: ⚠️ ÖNEMLİ KARAR!
     - ✅ İşaretli: Alt seviyeler oluşturup, soruları alt seviyelere eklersiniz
     - ❌ İşaretsiz: Soruları doğrudan bu alt kategoriye eklersiniz
4. **"Kaydet"** butonuna tıklayın

### ⚠️ "Alt Seviye Kullan" Ne Demek?

**Alt Seviye KULLANMAK (✅)**
```
Kategori: Çevresel Yönetim
  └── Alt Kategori: Emisyon Yönetimi
        ├── Alt Seviye: Ölçüm Sistemleri
        │     ├── Soru 1
        │     └── Soru 2
        └── Alt Seviye: Azaltım Stratejileri
              ├── Soru 3
              └── Soru 4
```

**Alt Seviye KULLANMAMAK (❌)**
```
Kategori: Çevresel Yönetim
  └── Alt Kategori: Emisyon Yönetimi
        ├── Soru 1
        ├── Soru 2
        ├── Soru 3
        └── Soru 4
```

---

## 5. Alt Seviye Ekleme (Opsiyonel)

### Not:
Bu adım sadece alt kategoride **"Alt Seviye Kullan"** seçeneğini işaretlediyseniz gereklidir.

### Adımlar:

1. Alt kategoriyi açın (yanındaki oku tıklayın)
2. **"+ Alt Seviye"** butonuna tıklayın
3. Açılan pencerede:
   - **Alt Seviye Adı**: İsim yazın (örnek: "Ölçüm Sistemleri")
   - **Sıra**: Görünme sırası
   - **Eksen Tipi** (Ironman Analizi için):
     - **VELOCITY**: Hız/hareketlilik ile ilgili konular
     - **ENDURANCE**: Dayanıklılık/sürdürülebilirlik ile ilgili konular
4. **"Kaydet"** butonuna tıklayın

### 💡 Eksen Tipi Ne İşe Yarar?
Ironman analizinde kullanıcıların "Hız" ve "Dayanıklılık" skorları hesaplanır. Hangi alt seviyelerin hangi eksene dahil olduğunu bu ayarla belirlersiniz.

---

## 6. Soru Ekleme

### Soruları Nereye Eklerim?
- **Alt Seviye kullanıyorsanız**: Alt seviyenin yanındaki **"+ Soru"** butonuna tıklayın
- **Alt Seviye kullanmıyorsanız**: Alt kategorinin yanındaki **"+ Soru"** butonuna tıklayın

### Soru Ekleme Adımları:

1. **"+ Soru"** butonuna tıklayın
2. Açılan pencerede:
   - **Soru Metni**: Sorunuzu yazın
   - **Soru Tipi**: Aşağıdan birini seçin
   - **Ağırlık**: Sorunun önemi (1-10 arası, varsayılan: 1)
   - **Kanıt Gerekli mi?**: Dosya yüklemesi isteyip istemediğiniz
3. **"Kaydet"** butonuna tıklayın

### 📝 Soru Tipleri:

#### 1. SCALE (Ölçek) Tipi
Kullanıcı 1-5 arası puan seçer.
- 1 = En düşük
- 5 = En yüksek

**Örnek Soru:** "Şirketinizin sürdürülebilirlik stratejisi ne kadar gelişmiş?"

*Bu tip için "Şıklar" alanını BOŞ bırakın.*

---

#### 2. YES_NO (Evet/Hayır) Tipi
Kullanıcı "Evet" veya "Hayır" seçer.

**Örnek Soru:** "Şirketinizin yazılı bir çevre politikası var mı?"

**Şıklar Alanı Formatı:**
```
evet|Evet|5
hayir|Hayır|1
```

**Açıklama:**
- `evet` = Veritabanına kaydedilen değer
- `Evet` = Kullanıcının gördüğü metin
- `5` = Bu seçeneğin puanı

---

#### 3. MULTIPLE_CHOICE (Çoktan Seçmeli) Tipi
Kullanıcı birden fazla seçenek arasından birini seçer.

**Örnek Soru:** "Karbon ayak izi ölçümünüzün kapsamı nedir?"

**Şıklar Alanı Formatı:**
```
yok|Ölçüm yapılmıyor|1
kismi|Kısmi kapsam (sadece Scope 1)|2
orta|Orta kapsam (Scope 1 ve 2)|3
genis|Geniş kapsam (Scope 1, 2 ve 3)|4
tam|Tam kapsam ve doğrulama|5
```

**Her satır formatı:** `değer|etiket|puan`
- **değer**: Sistemin kaydettiği teknik kod (küçük harf, Türkçe karakter olmadan)
- **etiket**: Kullanıcının gördüğü metin
- **puan**: 1-5 arası puan

### 💡 Ağırlık Ne Demek?
Bir sorunun diğerlerinden daha önemli olduğunu belirtmek için kullanılır.

**Örnek:**
- Soru A: Ağırlık = 1 (normal önem)
- Soru B: Ağırlık = 3 (3 kat daha önemli)

Soru B'nin puanı hesaplamada 3 kat etkili olur.

---

## 7. Öneri (Recommendation) Ekleme

### Öneri Nedir?
Kullanıcının düşük puan aldığı alanlarda gösterilen iyileştirme önerileridir.

### Adımlar:

1. Sol menüden **"Öneriler"** sekmesine tıklayın
2. **"+ Yeni Öneri"** butonuna tıklayın
3. Açılan pencerede:

#### Temel Bilgiler:
- **Başlık**: Önerinin kısa adı (örnek: "Emisyon Ölçüm Sistemi Kurulumu")
- **Açıklama**: Detaylı açıklama
- **Öncelik**: düşük / orta / yüksek
- **Kategori**: Hangi kategoriyle ilgili
- **Alt Seviye**: Hangi alt seviye için (puan eşikleri burada çalışır)

#### Puan Eşikleri:
- **Min Skor (%)**: Bu değerin ALTINDA puan alanlar bu öneriyi görür
- **Max Skor (%)**: Bu değerin ÜSTÜNDE puan alanlar bu öneriyi GÖRMEZ

**Örnek:**
- Min: 0, Max: 40 → Sadece %0-40 arası puan alanlar görür
- Min: 40, Max: 70 → Sadece %40-70 arası puan alanlar görür

#### Bubble Chart Ayarları:
- **X Pozisyonu (1-10)**: Yatay eksende konum
  - 1-3: Kaynak yoğun
  - 4-6: Önem derecesi orta
  - 7-10: Acil
- **Y Pozisyonu (1-10)**: Dikey eksende öncelik puanı
- **CAPEX (1-5)**: Yatırım maliyeti ($ sembolleriyle gösterilir)
- **OPEX (1-5)**: Yıllık işletme maliyeti

4. **"Kaydet"** butonuna tıklayın

---

## 8. Sektör Ağırlıkları Belirleme

### Bu Ne İşe Yarar?
Farklı sektörler için kategorilerin önem derecelerini farklılaştırabilirsiniz.

**Örnek:**
- Üretim sektörü için "Çevresel Yönetim" = %40
- Hizmet sektörü için "Çevresel Yönetim" = %20

### Adımlar:

1. Sol menüden **"Sektör Ağırlıkları"** sekmesine tıklayın
2. **Anket** seçin
3. **Sektör** seçin
4. Kategoriler listelenecek - her birinin yanına ağırlık yüzdesi girin
5. ⚠️ Toplam %100 olmalı!
6. **"Kaydet"** butonuna tıklayın

### 💡 İpucu:
Ağırlık belirlemezseniz, tüm kategoriler eşit ağırlıkta sayılır.

---

## 9. Ironman Benchmark Ayarlama

### Ironman Analizi Nedir?
Kullanıcıları "Hız" (Velocity) ve "Dayanıklılık" (Endurance) eksenlerinde 4 kadrandan birine yerleştirir:

```
                 YÜKSEK DAYANIKLILIK
                        │
    MARATHON RUNNER     │     IRON MAN
    (Yavaş ama sağlam)  │     (Hem hızlı hem sağlam)
                        │
 ───────────────────────┼─────────────────────────
                        │
    WALKER              │     SPRINTER
    (Başlangıç)         │     (Hızlı ama kırılgan)
                        │
                 DÜŞÜK DAYANIKLILIK
                        │
        DÜŞÜK HIZ       │       YÜKSEK HIZ
```

### Benchmark Ayarlama Adımları:

1. Sol menüden **"Ironman Benchmark"** sekmesine tıklayın
2. **Sektör** seçin
3. Her iki eksen için ortalama ve en iyi değerleri girin:
   - **Velocity Ortalama**: Sektör ortalaması (1-5)
   - **Velocity En İyi**: Sektördeki en iyi şirket (1-5)
   - **Endurance Ortalama**: Sektör ortalaması (1-5)
   - **Endurance En İyi**: Sektördeki en iyi şirket (1-5)
4. **"Kaydet"** butonuna tıklayın

---

## 10. Özet Akış Şeması

```
┌─────────────────────────────────────────────────────────────┐
│                    ANKET OLUŞTURMA AKIŞI                    │
└─────────────────────────────────────────────────────────────┘

                         ┌─────────────┐
                         │   ANKET     │
                         │  OLUŞTUR    │
                         └──────┬──────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     KATEGORİLER       │
                    │     EKLE (1-10)       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    ALT KATEGORİLER    │
                    │     EKLE (2-5)        │
                    └───────────┬───────────┘
                                │
               ┌────────────────┴────────────────┐
               │                                 │
               ▼                                 ▼
    ┌──────────────────┐              ┌──────────────────┐
    │  ALT SEVİYE VAR  │              │  ALT SEVİYE YOK  │
    │  (hasSubLevels)  │              │                  │
    └────────┬─────────┘              └────────┬─────────┘
             │                                  │
             ▼                                  │
    ┌──────────────────┐                        │
    │   ALT SEVİYELER  │                        │
    │   EKLE (2-4)     │                        │
    │   + Eksen Tipi   │                        │
    └────────┬─────────┘                        │
             │                                  │
             ▼                                  ▼
    ┌──────────────────┐              ┌──────────────────┐
    │     SORULAR      │              │     SORULAR      │
    │  (Alt Seviyeye)  │              │ (Alt Kategoriye) │
    └────────┬─────────┘              └────────┬─────────┘
             │                                  │
             └──────────────┬───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │      ÖNERİLER         │
                │   EKLE (İsteğe bağlı) │
                └───────────┬───────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   SEKTÖR AĞIRLIKLARI  │
                │   BELİRLE (Opsiyonel) │
                └───────────┬───────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  IRONMAN BENCHMARK    │
                │   AYARLA (Opsiyonel)  │
                └───────────┬───────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    TAMAM!    │
                     │  Anket Hazır │
                     └──────────────┘
```

---

## 🎯 Hızlı Kontrol Listesi

### Anket Oluşturma
- [ ] Anket adı ve açıklaması girildi
- [ ] Anket aktif edildi

### Kategoriler
- [ ] En az 1 kategori oluşturuldu
- [ ] Kategori açıklamaları yazıldı

### Alt Kategoriler
- [ ] Her kategori altına en az 1 alt kategori eklendi
- [ ] "Alt Seviye Kullan" kararı verildi

### Alt Seviyeler (eğer kullanılıyorsa)
- [ ] Alt seviyeler eklendi
- [ ] Eksen tipleri (Velocity/Endurance) belirlendi

### Sorular
- [ ] Tüm alt seviye/kategorilere sorular eklendi
- [ ] Soru tipleri doğru seçildi
- [ ] Çoktan seçmeli sorularda şıklar formatı doğru
- [ ] Ağırlıklar belirlendi

### Öneriler
- [ ] Her alt seviye için öneriler eklendi
- [ ] Puan eşikleri belirlendi
- [ ] CAPEX/OPEX değerleri girildi

### Sektör Ayarları
- [ ] Sektör ağırlıkları belirlendi (toplam %100)
- [ ] Ironman benchmark değerleri girildi

---

## ❓ Sık Sorulan Sorular

### S: Bir soruyu düzenleyebilir miyim?
**C:** Evet! Sorunun yanındaki kalem (✏️) ikonuna tıklayarak düzenleyebilirsiniz.

### S: Kategori sırasını değiştirebilir miyim?
**C:** Evet, kategori düzenlerken "Sıra" değerini değiştirin.

### S: Aynı öneriyi birden fazla alt seviyeye bağlayabilir miyim?
**C:** Hayır, her öneri tek bir alt seviyeye bağlıdır. Farklı alt seviyeler için ayrı öneriler oluşturun.

### S: Kullanıcılar anketi nereden görür?
**C:** Kullanıcılar `/survey` adresinden ankete erişir ve `/dashboard` adresinden sonuçlarını görür.

### S: Ağırlıkları belirlemessem ne olur?
**C:** Tüm kategoriler eşit ağırlıkta sayılır (örneğin 4 kategori varsa her biri %25).

---

## 📞 Destek

Sorularınız için sistem yöneticinize başvurun.

---

*Son Güncelleme: Ocak 2026*

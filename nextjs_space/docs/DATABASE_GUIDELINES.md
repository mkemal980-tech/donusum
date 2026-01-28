# Veritabanı Yönetim Rehberi

## ⚠️ KRİTİK UYARILAR

### 1. `prisma db push --accept-data-loss` KULLANMAYIN!
Bu komut mevcut verileri SİLEBİLİR. Bunun yerine migration kullanın.

### 2. Güvenli Şema Değişikliği Adımları

```bash
# 1. Migration oluşturun (veri kaybı olmadan)
yarn prisma migrate dev --name migration_ismi

# 2. Eğer migration başarısız olursa, önce seed ile test edin
yarn prisma db seed
```

### 3. Tehlikeli Komutlar
- `prisma db push --accept-data-loss` ❌
- `prisma migrate reset` ❌  
- `DROP TABLE` SQL komutları ❌

### 4. Güvenli Komutlar
- `prisma migrate dev` ✅
- `prisma db push` (--accept-data-loss OLMADAN) ✅
- `prisma db seed` ✅

## Veri Kurtarma

Eğer veriler silindiyse:
```bash
yarn prisma db seed
```

Bu komut temel verileri geri yükler.

# Project memory

## Product intent & audience

- Türkçe arayüze sahip admin/yönetim paneli uygulaması
- İlk açılışta yönetici şifresi belirleme akışı mevcut
- `cati.com.tr` alan adı için geliştirilmiş bir sistem

## Brand personality & voice

- Türkçe UI metinleri
- Resmî/yönetici tonu, "siz" hitabı
- Net, yönerge odaklı form etiketleri ve butonlar

## Visual design & UX direction

- Giriş ekranı + ilk kurulum akışı
- E-posta alanı otomatik dolar (`admin@cati.com.tr`)
- Şifre minimum 8 karakter doğrulaması
- Buton: "Yönetici Şifresini Kaydet ve Giriş Yap"
- Form başlığı: "Yönetici Şifresi Belirle"

## Decisions, constraints & rationale

- Varsayılan admin e-postası: `admin@cati.com.tr` (`ADMIN_EMAIL` env ile değiştirilebilir)
- `ADMIN_PASSWORD` env boşsa ilk kurulum ekranı gösterilir, şifre kullanıcı tarafından belirlenir
- Şifre ≥ 8 karakter zorunluluğu
- Framework: Vite + React

## Open questions & assumptions

- Uygulamanın yönettiği içerik/iş alanı tam bilinmiyor
- Sadece admin rolü görülüyor; başka roller var mı belirsiz
- Şifre sıfırlama/kurtarma akışı mevcut mu belirsiz
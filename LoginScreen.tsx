import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*';
  const all = upper + lower + digits + symbols;
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  const chars = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  for (let i = 4; i < 12; i++) {
    chars.push(all[arr[i] % all.length]);
  }
  return chars.join('');
}

export const LoginScreen: React.FC = () => {
  const { authStatus, statusLoading, login, setupInitialAdmin } = useAuth();

  const isFirstRun = authStatus !== null && !authStatus.initialized;

  const [fullName, setFullName] = useState('Elif Öztürk');
  const [email, setEmail] = useState('admin@cati.com.tr');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus?.defaultAdminEmail) {
      setEmail(authStatus.defaultAdminEmail);
    }
  }, [authStatus?.defaultAdminEmail]);

  const handleFirstRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Yönetici şifresi en az 8 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      return;
    }
    setSubmitting(true);
    const res = await setupInitialAdmin({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Yönetici kurulumu tamamlanamadı.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Giriş başarısız.');
    }
  };

  const handleSuggestPassword = () => {
    const next = generateStrongPassword();
    setPassword(next);
    setConfirmPassword(next);
    setShowPassword(true);
    setError(null);
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl px-8 py-7 text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#C8102E] text-white flex items-center justify-center mx-auto">
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-[13.5px] font-medium text-slate-600">
            Çatı Yetenek platformu hazırlanıyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Institutional Panel */}
      <div className="lg:w-[46%] xl:w-[44%] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#C8102E] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-bold text-lg tracking-tight text-slate-900">
                Çatı Yetenek
              </div>
              <div className="text-[12px] text-slate-500">
                Entegre Performans ve Organizasyonel Hareketlilik
              </div>
            </div>
          </div>

          <div className="mt-12 max-w-md space-y-4">
            <h1 className="font-display text-3xl lg:text-[34px] font-bold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
              Kurumsal Yetenek, Performans ve Yetkilendirme Merkezi
            </h1>
            <p className="text-[14.5px] text-slate-600 leading-relaxed">
              Bireysel OKR/KPI hedefleri, 360° yetkinlik değerlendirmeleri, Nine-Box kalibrasyon
              oturumları, iç terfi süreçleri ve saha görevlendirmelerini tek güvenli platformda
              yönetin.
            </p>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 space-y-4 max-w-md">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#C8102E] mt-0.5 shrink-0" />
              <div>
                <div className="text-[13.5px] font-semibold text-slate-900">
                  Rol ve Modül Bazlı Erişim Kontrolü
                </div>
                <p className="text-[12.5px] text-slate-500 mt-0.5 leading-relaxed">
                  Sistem yöneticileri ayarlar üzerinden yeni üye ekleyebilir, modül görünürlüğü ve
                  onay yetkilerini kişi bazında tanımlayabilir.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-[13.5px] font-semibold text-slate-900">
                  Sunucu Doğrulamalı Güvenli Oturum
                </div>
                <p className="text-[12.5px] text-slate-500 mt-0.5 leading-relaxed">
                  Tüm kullanıcı parolaları sunucu tarafında güvenli özetleme (scrypt) ile saklanır
                  ve oturum belirteçleri tarayıcı deposuna yazılmaz.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 text-[12px] text-slate-400">
          Çatı Yetenek ve Performans Yönetim Sistemi · Kurumsal İK Portalı
        </div>
      </div>

      {/* Right Login / First-Run Setup Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-7 sm:p-8 shadow-sm">
          {isFirstRun ? (
            <>
              <div className="mb-6">
                <div className="text-[12px] font-semibold text-[#C8102E]">
                  İlk Kurulum · Tek Seferlik Yönetici Aktivasyonu
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
                  Yönetici Şifresi Belirle
                </h2>
                <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
                  Sistemi kullanmaya başlamak için ana İK Yöneticisi hesabınızın şifresini
                  oluşturun. İçeriden Ayarlar bölümünden yeni üyeler ve yetkiler tanımlayabilirsiniz.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12.5px] text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleFirstRunSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Yönetici Ad Soyad
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-[13.5px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10"
                      placeholder="Elif Öztürk"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Yönetici Kurumsal E-posta
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-[13.5px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10"
                      placeholder="admin@cati.com.tr"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12.5px] font-semibold text-slate-700">
                      Yönetici Şifresi (En az 8 karakter)
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestPassword}
                      className="text-[11.5px] font-semibold text-[#C8102E] hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Güçlü Şifre Öner
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-10 text-[13.5px] font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10"
                      placeholder="En az 8 karakterlik şifre"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Şifre Tekrarı
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-[13.5px] font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10"
                      placeholder="Şifrenizi tekrar girin"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10.5 mt-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-60 text-white text-[13.5px] font-semibold transition-colors"
                >
                  {submitting
                    ? 'Yönetici Hesabı Oluşturuluyor...'
                    : 'Yönetici Şifresini Kaydet ve Giriş Yap'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-[12px] font-semibold text-slate-500">
                  Kurumsal Kullanıcı Oturumu
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
                  Platforma Giriş Yapın
                </h2>
                <p className="text-[13px] text-slate-500 mt-1">
                  Yönetici veya yetkilendirilmiş üye hesabınızla devam edin.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12.5px] text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Kurumsal E-posta
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-[13.5px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10"
                      placeholder="ad.soyad@cati.com.tr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Şifre
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-10 text-[13.5px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10"
                      placeholder="Şifrenizi girin"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10.5 mt-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-60 text-white text-[13.5px] font-semibold transition-colors"
                >
                  {submitting ? 'Doğrulanıyor...' : 'Giriş Yap'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 text-[12px] text-slate-500">
                Yönetici e-posta: <span className="font-mono font-medium text-slate-700">{authStatus?.defaultAdminEmail}</span>
                {authStatus?.hasEnvAdmin && (
                  <span className="block mt-1 text-slate-400">
                    Yönetici şifresi ortam gizli anahtarı (ADMIN_PASSWORD) üzerinden doğrulanmaktadır.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Grid3X3,
  Radar,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTalentStore } from './TalentStore';
import { INITIAL_SYSTEM_RULES } from './seedData';
import { SystemRules } from './talent';
import {
  evaluatePromotionEligibility,
  getEffectiveNineBoxId,
} from './calculations';
import { Config360Panel } from './Config360Panel';
import { PlatformStudioPanel } from './PlatformStudioPanel';
import { UserManagementPanel } from './UserManagementPanel';

export const SettingsModule: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    rules,
    updateSystemRules,
    employees,
    competencies,
    activePeriod,
    role,
    settingsTab,
    setSettingsTab,
  } = useTalentStore();

  const canEditRules =
    role === 'ADMIN' &&
    (currentUser?.role === 'ADMIN' || Boolean(currentUser?.permissions.actions.canEditSystemRules));

  const [draft, setDraft] = useState<SystemRules>(rules);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(rules);
  }, [rules]);

  const weight360Total =
    draft.raterWeights360.MANAGER +
    draft.raterWeights360.SELF +
    draft.raterWeights360.PEER +
    draft.raterWeights360.SUBORDINATE +
    draft.raterWeights360.INTERNAL_CUSTOMER;

  // Live impact preview using draft rules
  const liveImpact = useMemo(() => {
    let stars = 0;
    let eligible = 0;
    employees.forEach((emp) => {
      const box = getEffectiveNineBoxId(emp, activePeriod, competencies, draft);
      if (box === 1) stars += 1;
      const elig = evaluatePromotionEligibility(emp, activePeriod, competencies, draft);
      if (elig.allPassed) eligible += 1;
    });
    return { stars, eligible, total: employees.length };
  }, [activePeriod, competencies, draft, employees]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.nineBoxThresholds.perfLowMax >= draft.nineBoxThresholds.perfMidMax) {
      setError('Performans Düşük üst eşiği, Beklenen üst eşiğinden küçük olmalıdır.');
      return;
    }
    if (draft.nineBoxThresholds.potLowMax >= draft.nineBoxThresholds.potMidMax) {
      setError('Potansiyel Düşük üst eşiği, Orta üst eşiğinden küçük olmalıdır.');
      return;
    }
    if (weight360Total !== 100) {
      setError(`360° değerlendirici ağırlıkları toplamı %100 olmalıdır (Mevcut: %${weight360Total}).`);
      return;
    }
    setError(null);
    updateSystemRules(draft);
  };

  const handleReset = () => {
    setDraft(INITIAL_SYSTEM_RULES);
    setError(null);
    updateSystemRules(INITIAL_SYSTEM_RULES);
  };

  return (
    <div className="space-y-6">
      {/* Header & Settings Sub-navigation Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Platform Düzenleyici, Üyeler ve Sistem Kuralları
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            Platform özelliklerini, KPI/OKR şablonlarını, iş akışı süreçlerini, kullanıcı yetkilerini ve puanlama kurallarını yönetin
          </p>
        </div>

        <div className="flex flex-wrap items-center p-1 bg-slate-200/70 rounded-lg gap-0.5">
          <button
            type="button"
            onClick={() => setSettingsTab('studio')}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              settingsTab === 'studio'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Özellik, KPI & Süreçler
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('config360')}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              settingsTab === 'config360'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            Yetkinlik ve KPI Kurgusu
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('users')}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              settingsTab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Üye Ekleme & Yetkilendirme
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('rules')}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              settingsTab === 'rules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Sistem Kuralları & Ağırlıklar
          </button>
        </div>
      </div>

      {settingsTab === 'studio' ? (
        <PlatformStudioPanel />
      ) : settingsTab === 'config360' ? (
        <Config360Panel />
      ) : settingsTab === 'users' ? (
        <UserManagementPanel />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-slate-500">
              Nine-Box eşikleri, 360° varsayılan ağırlıkları ve terfi kural motoru kriterlerini gerçek zamanlı düzenleyin
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={!canEditRules}
                onClick={handleReset}
                className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-[13px] font-medium text-slate-700 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Varsayılanlara Sıfırla
              </button>
              <button
                type="submit"
                disabled={!canEditRules}
                className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Kuralları Uygula & Yeniden Hesapla
              </button>
            </div>
          </div>

          {!canEditRules && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
              Sistem kurallarını değiştirmek için <strong>Sistem Kuralları & Eşikler</strong> yetkisine sahip yönetici görünümünde olmalısınız. Şu anda salt okunur görüntülemektesiniz.
            </div>
          )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Recalculation Impact Preview */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[13px] text-slate-600">
          <strong className="text-slate-900">Anlık Simülasyon Etkisi:</strong> Bu eşik ayarlarıyla{' '}
          <span className="font-mono font-bold text-emerald-700">{liveImpact.stars}</span> personel{' '}
          <em>Yıldızlar</em> segmentinde,{' '}
          <span className="font-mono font-bold text-indigo-700">
            {liveImpact.eligible}/{liveImpact.total}
          </span>{' '}
          personel doğrudan terfi uygunluk şartlarını karşılıyor.
        </div>
        <span className="text-[12px] font-medium text-emerald-700 inline-flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" />
          Tek Kaynak (Single Source of Truth) Senkronizasyonu Aktif
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Nine-Box Thresholds */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Grid3X3 className="w-4 h-4 text-[#C8102E]" />
            <h2 className="font-display text-[15px] font-bold text-slate-900">
              Nine-Box Eşik Değerleri
            </h2>
          </div>

          <div className="space-y-3.5 text-[13px]">
            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Performans: Düşük / Beklenen Sınırı</label>
                <span className="font-mono font-bold text-slate-900">{draft.nineBoxThresholds.perfLowMax}</span>
              </div>
              <input
                type="range"
                min={50}
                max={80}
                disabled={!canEditRules}
                value={draft.nineBoxThresholds.perfLowMax}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    nineBoxThresholds: { ...d.nineBoxThresholds, perfLowMax: Number(e.target.value) },
                  }))
                }
                className="w-full accent-[#C8102E]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Performans: Beklenen / Üstün Sınırı</label>
                <span className="font-mono font-bold text-slate-900">{draft.nineBoxThresholds.perfMidMax}</span>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                disabled={!canEditRules}
                value={draft.nineBoxThresholds.perfMidMax}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    nineBoxThresholds: { ...d.nineBoxThresholds, perfMidMax: Number(e.target.value) },
                  }))
                }
                className="w-full accent-[#C8102E]"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Potansiyel: Düşük / Orta Sınırı</label>
                <span className="font-mono font-bold text-slate-900">{draft.nineBoxThresholds.potLowMax}</span>
              </div>
              <input
                type="range"
                min={50}
                max={80}
                disabled={!canEditRules}
                value={draft.nineBoxThresholds.potLowMax}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    nineBoxThresholds: { ...d.nineBoxThresholds, potLowMax: Number(e.target.value) },
                  }))
                }
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Potansiyel: Orta / Yüksek Sınırı</label>
                <span className="font-mono font-bold text-slate-900">{draft.nineBoxThresholds.potMidMax}</span>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                disabled={!canEditRules}
                value={draft.nineBoxThresholds.potMidMax}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    nineBoxThresholds: { ...d.nineBoxThresholds, potMidMax: Number(e.target.value) },
                  }))
                }
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </section>

        {/* Card 2: 360 Default Rater Weights */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#C8102E]" />
              <h2 className="font-display text-[15px] font-bold text-slate-900">
                360° Değerlendirici Ağırlıkları
              </h2>
            </div>
            <span
              className={`font-mono text-[13px] font-bold ${
                weight360Total === 100 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              Toplam: %{weight360Total}
            </span>
          </div>

          <div className="space-y-3 text-[13px]">
            {(
              [
                ['MANAGER', 'Üst Yönetici (%)'],
                ['SELF', 'Öz Değerlendirme (%)'],
                ['PEER', 'Eş Düzey / Çalışma Arkadaşı (%)'],
                ['SUBORDINATE', 'Ast / Ekip Üyesi (%)'],
                ['INTERNAL_CUSTOMER', 'İç Müşteri / Paydaş (%)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="font-medium text-slate-700">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={!canEditRules}
                  value={draft.raterWeights360[key]}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      raterWeights360: {
                        ...d.raterWeights360,
                        [key]: Math.max(0, Number(e.target.value)),
                      },
                    }))
                  }
                  className="w-20 h-9 px-2.5 text-right font-mono font-semibold border border-slate-200 rounded-lg"
                />
              </div>
            ))}
          </div>

          <p className="text-[12px] text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
            Astı veya iç müşteri değerlendiricisi bulunmayan çalışanlarda ilgili ağırlık sistem tarafından diğer aktif kaynaklar arasında orantısal olarak %100&apos;e normalize edilir.
          </p>
        </section>

        {/* Card 3: Promotion Eligibility Rules */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-[#C8102E]" />
            <h2 className="font-display text-[15px] font-bold text-slate-900">
              Terfi & Atama Uygunluk Kriterleri
            </h2>
          </div>

          <div className="space-y-4 text-[13px]">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mevcut Pozisyonda Minimum Süre (Ay)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                disabled={!canEditRules}
                value={draft.promotionEligibility.minTenureMonths}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    promotionEligibility: {
                      ...d.promotionEligibility,
                      minTenureMonths: Math.max(0, Number(e.target.value)),
                    },
                  }))
                }
                className="w-full h-9.5 px-3 font-mono font-semibold border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Minimum Bireysel Performans Puanı (0–100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                disabled={!canEditRules}
                value={draft.promotionEligibility.minPerformanceScore}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    promotionEligibility: {
                      ...d.promotionEligibility,
                      minPerformanceScore: Math.max(0, Math.min(100, Number(e.target.value))),
                    },
                  }))
                }
                className="w-full h-9.5 px-3 font-mono font-semibold border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Minimum 360° Yetkinlik Puanı (0–100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                disabled={!canEditRules}
                value={draft.promotionEligibility.minCompetency360Score}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    promotionEligibility: {
                      ...d.promotionEligibility,
                      minCompetency360Score: Math.max(0, Math.min(100, Number(e.target.value))),
                    },
                  }))
                }
                className="w-full h-9.5 px-3 font-mono font-semibold border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <p className="text-[12px] text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
            Aktif disiplin/ihtar kaydı kontrolü her zaman aktiftir; ancak İK Yöneticisi gerekçe belirterek istisna onayı kullanabilir.
          </p>
        </section>
      </div>
    </form>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Edit3,
  Eye,
  Layers,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Scale,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTalentStore } from '../context/TalentStore';
import {
  CompetencyDefinition,
  CompetencySubKpi,
  RaterRelation,
  Scale360Config,
  Scale360Level,
  SystemRules,
} from '../types/talent';
import { scaleLevelToScore100, score100ToScaleValue } from '../utils/calculations';

const PREVIEW_RELATION_LABELS: Record<RaterRelation, string> = {
  MANAGER: 'Üst Yönetici',
  SELF: 'Öz Değerlendirme',
  PEER: 'Eş Düzey / Çalışma Arkadaşı',
  SUBORDINATE: 'Ast / Ekip Üyesi',
  INTERNAL_CUSTOMER: 'İç Müşteri / Paydaş',
};

export const Config360Panel: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    competencies,
    rules,
    platformConfig,
    role,
    addCompetency,
    updateCompetency,
    toggleCompetencyActive,
    deleteCompetency,
    save360Configuration,
    setActiveModule,
    pushToast,
  } = useTalentStore();

  const canEdit =
    role === 'ADMIN' &&
    (currentUser?.role === 'ADMIN' || Boolean(currentUser?.permissions.actions.canEditSystemRules));

  // Draft state for weights, scale & role groups
  const [weightsDraft, setWeightsDraft] = useState<SystemRules['raterWeights360']>(
    rules.raterWeights360
  );
  const [scaleDraft, setScaleDraft] = useState<Scale360Config>(platformConfig.scale360);
  const [roleGroupsDraft, setRoleGroupsDraft] = useState<string[]>(platformConfig.roleGroupCatalog);
  const [newRoleGroup, setNewRoleGroup] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    setWeightsDraft(rules.raterWeights360);
  }, [rules.raterWeights360]);

  useEffect(() => {
    setScaleDraft(platformConfig.scale360);
    setRoleGroupsDraft(platformConfig.roleGroupCatalog);
  }, [platformConfig.roleGroupCatalog, platformConfig.scale360]);

  // Competency filter & modal/editor state
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PASSIVE'>('ALL');
  const [editingComp, setEditingComp] = useState<CompetencyDefinition | null>(null);
  const [isCreatingComp, setIsCreatingComp] = useState(false);
  const [newIndicatorText, setNewIndicatorText] = useState('');
  const [inlineIndicatorDrafts, setInlineIndicatorDrafts] = useState<Record<string, string>>({});

  // Interactive Live 360 Form Preview modal state
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewRoleGroup, setPreviewRoleGroup] = useState<string>(
    platformConfig.roleGroupCatalog[0] ?? 'Yönetici Rolleri'
  );
  const [previewRelation, setPreviewRelation] = useState<RaterRelation>('MANAGER');
  const [previewRatings, setPreviewRatings] = useState<Record<string, number>>({});

  const weightTotal =
    weightsDraft.SELF +
    weightsDraft.MANAGER +
    weightsDraft.PEER +
    weightsDraft.SUBORDINATE +
    weightsDraft.INTERNAL_CUSTOMER;

  const hasUnsavedGlobalChanges = useMemo(() => {
    return (
      JSON.stringify(weightsDraft) !== JSON.stringify(rules.raterWeights360) ||
      JSON.stringify(scaleDraft) !== JSON.stringify(platformConfig.scale360) ||
      JSON.stringify(roleGroupsDraft) !== JSON.stringify(platformConfig.roleGroupCatalog)
    );
  }, [
    platformConfig.roleGroupCatalog,
    platformConfig.scale360,
    roleGroupsDraft,
    rules.raterWeights360,
    scaleDraft,
    weightsDraft,
  ]);

  // Normalized weights preview when employee has no subordinates
  const normalizedWithoutSub = useMemo(() => {
    const sum =
      weightsDraft.MANAGER +
      weightsDraft.SELF +
      weightsDraft.PEER +
      weightsDraft.INTERNAL_CUSTOMER;
    if (sum <= 0) {
      return { MANAGER: 0, SELF: 0, PEER: 0, INTERNAL_CUSTOMER: 0 };
    }
    return {
      MANAGER: Math.round((weightsDraft.MANAGER / sum) * 1000) / 10,
      SELF: Math.round((weightsDraft.SELF / sum) * 1000) / 10,
      PEER: Math.round((weightsDraft.PEER / sum) * 1000) / 10,
      INTERNAL_CUSTOMER: Math.round((weightsDraft.INTERNAL_CUSTOMER / sum) * 1000) / 10,
    };
  }, [weightsDraft]);

  const handleAutoBalanceWeights = () => {
    if (weightTotal <= 0) {
      setWeightsDraft({
        MANAGER: 35,
        SELF: 10,
        PEER: 20,
        SUBORDINATE: 20,
        INTERNAL_CUSTOMER: 15,
      });
      return;
    }
    const keys: RaterRelation[] = ['MANAGER', 'SELF', 'PEER', 'SUBORDINATE', 'INTERNAL_CUSTOMER'];
    const raw = keys.map((k) => ({ key: k, val: (weightsDraft[k] / weightTotal) * 100 }));
    const floored = raw.map((r) => ({ key: r.key, val: Math.floor(r.val), rem: r.val - Math.floor(r.val) }));
    let remainder = 100 - floored.reduce((s, r) => s + r.val, 0);
    const byRem = [...floored].sort((a, b) => b.rem - a.rem);
    for (let i = 0; i < remainder; i++) {
      byRem[i % byRem.length].val += 1;
    }
    const balanced = { ...weightsDraft };
    byRem.forEach((item) => {
      balanced[item.key] = item.val;
    });
    setWeightsDraft(balanced);
    setConfigError(null);
  };

  const handleInlineToggleIndicator = (comp: CompetencyDefinition, indicatorId: string) => {
    if (!canEdit) return;
    updateCompetency({
      ...comp,
      indicators: comp.indicators.map((ind) =>
        ind.id === indicatorId ? { ...ind, isActive: !ind.isActive } : ind
      ),
    });
  };

  const handleInlineAddIndicator = (comp: CompetencyDefinition) => {
    if (!canEdit) return;
    const text = (inlineIndicatorDrafts[comp.id] ?? '').trim();
    if (!text) return;
    updateCompetency({
      ...comp,
      indicators: [
        ...comp.indicators,
        {
          id: `ind-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          text,
          isActive: true,
        },
      ],
    });
    setInlineIndicatorDrafts((prev) => ({ ...prev, [comp.id]: '' }));
  };

  const previewCompetencies = useMemo(() => {
    const active = competencies.filter((c) => c.isActive);
    const matched = active.filter(
      (c) =>
        c.roleGroups.length === 0 ||
        c.roleGroups.includes('Tümü') ||
        c.roleGroups.includes(previewRoleGroup)
    );
    return matched.length > 0 ? matched : active;
  }, [competencies, previewRoleGroup]);

  const previewComputed = useMemo(() => {
    const levels = scaleDraft.levels;
    const midVal = levels[Math.floor(levels.length / 2)]?.value ?? levels[0]?.value ?? 3;
    const maxCoeff = Math.max(...levels.map((l) => l.coefficient), 1);
    const compScores: Record<string, number> = {};
    let weightedSum = 0;
    let weightSum = 0;
    previewCompetencies.forEach((comp) => {
      const activeInds = comp.indicators.filter((i) => i.isActive);
      let score100 = 0;
      if (activeInds.length > 0) {
        const sub = activeInds.map((ind) =>
          scaleLevelToScore100(previewRatings[ind.id] ?? midVal, levels)
        );
        score100 = Math.round((sub.reduce((a, b) => a + b, 0) / sub.length) * 10) / 10;
      } else {
        score100 = scaleLevelToScore100(previewRatings[comp.id] ?? midVal, levels);
      }
      compScores[comp.id] = score100;
      const w = comp.weight > 0 ? comp.weight : 1;
      weightedSum += score100 * w;
      weightSum += w;
    });
    const overall100 = weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : 0;
    return {
      compScores,
      overall100,
      overallScale: score100ToScaleValue(overall100, levels),
      maxCoeff,
      midVal,
    };
  }, [previewCompetencies, previewRatings, scaleDraft.levels]);

  const filteredCompetencies = useMemo(() => {
    return competencies.filter((c) => {
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'PASSIVE' && c.isActive) return false;
      if (roleFilter !== 'ALL') {
        const applies =
          c.roleGroups.length === 0 ||
          c.roleGroups.includes('Tümü') ||
          c.roleGroups.includes(roleFilter);
        if (!applies) return false;
      }
      return true;
    });
  }, [competencies, roleFilter, statusFilter]);

  const activeCompCount = competencies.filter((c) => c.isActive).length;
  const totalIndicatorsCount = competencies.reduce(
    (sum, c) => sum + c.indicators.filter((i) => i.isActive).length,
    0
  );

  const openCreateCompetency = () => {
    setIsCreatingComp(true);
    setNewIndicatorText('');
    setEditingComp({
      id: '',
      name: '',
      category: 'Temel Yetkinlik',
      description: '',
      targetScore: 80,
      isActive: true,
      weight: 1.0,
      roleGroups: [...roleGroupsDraft],
      indicators: [
        {
          id: `ind-${Date.now()}-1`,
          text: '',
          isActive: true,
        },
      ],
    });
  };

  const openEditCompetency = (comp: CompetencyDefinition) => {
    setIsCreatingComp(false);
    setNewIndicatorText('');
    setEditingComp({
      ...comp,
      roleGroups: [...comp.roleGroups],
      indicators: comp.indicators.map((i) => ({ ...i })),
    });
  };

  const handleToggleRoleGroupOnComp = (group: string) => {
    if (!editingComp) return;
    setEditingComp((prev) => {
      if (!prev) return prev;
      const exists = prev.roleGroups.includes(group);
      const next = exists
        ? prev.roleGroups.filter((g) => g !== group)
        : [...prev.roleGroups, group];
      return { ...prev, roleGroups: next };
    });
  };

  const handleAddIndicatorToDraft = () => {
    if (!editingComp || !newIndicatorText.trim()) return;
    const item: CompetencySubKpi = {
      id: `ind-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      text: newIndicatorText.trim(),
      isActive: true,
    };
    setEditingComp((prev) =>
      prev ? { ...prev, indicators: [...prev.indicators, item] } : prev
    );
    setNewIndicatorText('');
  };

  const handleSaveCompetencyModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp || !editingComp.name.trim()) return;
    const cleanedIndicators = editingComp.indicators
      .map((i) => ({ ...i, text: i.text.trim() }))
      .filter((i) => i.text.length > 0);

    const payload: CompetencyDefinition = {
      ...editingComp,
      name: editingComp.name.trim(),
      description:
        editingComp.description.trim() ||
        'Kurumsal 360° yetkinlik çerçevesi kapsamında yapılandırıldı.',
      weight: Math.max(0.2, Number(editingComp.weight) || 1),
      roleGroups:
        editingComp.roleGroups.length > 0 ? editingComp.roleGroups : [...roleGroupsDraft],
      indicators:
        cleanedIndicators.length > 0
          ? cleanedIndicators
          : [
              {
                id: `ind-${Date.now()}-def`,
                text: `${editingComp.name.trim()} yetkinliğini iş çıktılarında tutarlı biçimde sergiler.`,
                isActive: true,
              },
            ],
    };

    if (isCreatingComp) {
      const { id: _ignore, ...rest } = payload;
      addCompetency(rest);
    } else {
      updateCompetency(payload);
    }
    setEditingComp(null);
  };

  const handleAddRoleGroup = () => {
    const val = newRoleGroup.trim();
    if (!val) return;
    if (roleGroupsDraft.includes(val)) {
      pushToast('warning', `"${val}" rol grubu zaten listede mevcut.`);
      return;
    }
    setRoleGroupsDraft((prev) => [...prev, val]);
    setNewRoleGroup('');
  };

  const handleRemoveRoleGroup = (group: string) => {
    if (roleGroupsDraft.length <= 1) return;
    setRoleGroupsDraft((prev) => prev.filter((g) => g !== group));
  };

  const handleUpdateScaleLevel = <K extends keyof Scale360Level>(
    idx: number,
    field: K,
    value: Scale360Level[K]
  ) => {
    setScaleDraft((prev) => ({
      ...prev,
      levels: prev.levels.map((lvl, i) => (i === idx ? { ...lvl, [field]: value } : lvl)),
    }));
  };

  const handleAddScaleLevel = () => {
    const nextVal =
      scaleDraft.levels.length > 0
        ? Math.max(...scaleDraft.levels.map((l) => l.value)) + 1
        : 1;
    setScaleDraft((prev) => ({
      ...prev,
      levels: [
        ...prev.levels,
        {
          value: nextVal,
          label: `Seviye ${nextVal}`,
          coefficient: Number(nextVal.toFixed(1)),
        },
      ],
    }));
  };

  const handleRemoveScaleLevel = (idx: number) => {
    if (scaleDraft.levels.length <= 2) return;
    setScaleDraft((prev) => ({
      ...prev,
      levels: prev.levels.filter((_, i) => i !== idx),
    }));
  };

  const applyScalePreset = (preset: '1-5' | '1-4' | 'weighted-5') => {
    if (preset === '1-5') {
      setScaleDraft({
        name: "5'li Kurumsal Davranış Ölçeği (1–5)",
        levels: [
          { value: 1, label: 'Geliştirilmeli', coefficient: 1.0 },
          { value: 2, label: 'Kısmen Karşılıyor', coefficient: 2.0 },
          { value: 3, label: 'Beklenen Düzey', coefficient: 3.0 },
          { value: 4, label: 'Beklentinin Üzerinde', coefficient: 4.0 },
          { value: 5, label: 'Rol Model', coefficient: 5.0 },
        ],
      });
    } else if (preset === '1-4') {
      setScaleDraft({
        name: "4'lü Yetkinlik Ölçeği (1–4)",
        levels: [
          { value: 1, label: 'Yetersiz', coefficient: 1.0 },
          { value: 2, label: 'Gelişime Açık', coefficient: 2.0 },
          { value: 3, label: 'Yetkin', coefficient: 3.0 },
          { value: 4, label: 'İleri Düzey / Örnek', coefficient: 4.0 },
        ],
      });
    } else {
      setScaleDraft({
        name: "5'li Ağırlıklı Katsayı Ölçeği",
        levels: [
          { value: 1, label: 'Beklentinin Altında', coefficient: 1.0 },
          { value: 2, label: 'Geliştirilmeli', coefficient: 2.0 },
          { value: 3, label: 'Beklenen Seviye', coefficient: 3.5 },
          { value: 4, label: 'Güçlü Yetkinlik', coefficient: 4.25 },
          { value: 5, label: 'Üstün / Rol Model', coefficient: 5.0 },
        ],
      });
    }
  };

  const handleSaveGlobal360Config = () => {
    if (weightTotal !== 100) {
      setConfigError(
        `5 değerlendirici kaynağının ağırlık toplamı tam olarak %100 olmalıdır (Mevcut toplam: %${weightTotal}).`
      );
      return;
    }
    if (scaleDraft.levels.length < 2) {
      setConfigError('Değerlendirme ölçeğinde en az 2 seviye tanımlı olmalıdır.');
      return;
    }
    if (scaleDraft.levels.some((l) => !l.label.trim() || l.coefficient <= 0)) {
      setConfigError('Tüm ölçek seviyelerinin etiketi dolu ve katsayısı 0’dan büyük olmalıdır.');
      return;
    }
    setConfigError(null);
    save360Configuration(weightsDraft, scaleDraft, roleGroupsDraft);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Radar className="w-4 h-4 text-[#C8102E]" />
            <h2 className="font-display text-[15.5px] font-bold text-slate-900">
              Yetkinlik ve KPI Kurgusu (360° Derece)
            </h2>
            {hasUnsavedGlobalChanges && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Yayınlanmamış Ağırlık/Ölçek Değişikliği
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-slate-500">
            Yetkinlik başlıkları, davranış göstergeleri (alt KPI), değerlendirici ağırlıkları ve ölçek ayarları kaydedildiği anda tüm 360° değerlendirme formlarına yansır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden xl:flex items-center gap-3 text-[12px] font-mono tabular-nums text-slate-600 pr-2 border-r border-slate-200">
            <span>
              Aktif Yetkinlik: <strong className="text-slate-900">{activeCompCount}/{competencies.length}</strong>
            </span>
            <span>
              Gösterge: <strong className="text-slate-900">{totalIndicatorsCount}</strong>
            </span>
            <span>
              Ölçek: <strong className="text-slate-900">{scaleDraft.levels.length} Seviye</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!roleGroupsDraft.includes(previewRoleGroup) && roleGroupsDraft.length > 0) {
                setPreviewRoleGroup(roleGroupsDraft[0]);
              }
              setShowLivePreview(true);
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800 text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            Canlı Form Önizlemesi
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('feedback360')}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-slate-700 text-[12.5px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
          >
            360° Formları
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onClick={handleSaveGlobal360Config}
            className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            Ağırlık & Ölçek Kurgusunu Yayınla
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
          360° yetkinlik ve ölçek kurgusunu değiştirmek için <strong>İK Yöneticisi (Admin)</strong> yetkisinde olmalısınız.
        </div>
      )}

      {configError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{configError}</span>
        </div>
      )}

      {/* Section 1: 5 Evaluator Weights & Dynamic Evaluation Scale */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 5-Source Rater Weights */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C8102E]" />
              <h3 className="font-display text-[15px] font-bold text-slate-900">
                Değerlendirici Rolü Ağırlıkları (5 Kaynak)
              </h3>
            </div>
            <span
              className={`font-mono tabular-nums text-[13px] font-bold px-2 py-0.5 rounded ${
                weightTotal === 100
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              Toplam: %{weightTotal}
            </span>
          </div>

          <div className="space-y-3 text-[13px]">
            {(
              [
                ['SELF', 'Öz Değerlendirme'],
                ['MANAGER', 'Üst Yönetici'],
                ['PEER', 'Eş Düzey / Çalışma Arkadaşı'],
                ['SUBORDINATE', 'Ast / Ekip Üyesi'],
                ['INTERNAL_CUSTOMER', 'İç Müşteri / Paydaş'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-medium text-slate-700">{label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canEdit}
                      value={weightsDraft[key]}
                      onChange={(e) =>
                        setWeightsDraft((prev) => ({
                          ...prev,
                          [key]: Math.max(0, Math.min(100, Number(e.target.value))),
                        }))
                      }
                      className="w-20 h-8.5 px-2.5 text-right font-mono font-semibold border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                    />
                    <span className="text-[12px] text-slate-400 font-mono">%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C8102E] rounded-full transition-all"
                    style={{ width: `${Math.min(100, weightsDraft[key])}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    setWeightsDraft({
                      MANAGER: 35,
                      SELF: 10,
                      PEER: 20,
                      SUBORDINATE: 20,
                      INTERNAL_CUSTOMER: 15,
                    })
                  }
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11.5px] font-medium text-slate-700"
                >
                  Standart (%100)
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    setWeightsDraft({
                      MANAGER: 40,
                      SELF: 10,
                      PEER: 20,
                      SUBORDINATE: 15,
                      INTERNAL_CUSTOMER: 15,
                    })
                  }
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11.5px] font-medium text-slate-700"
                >
                  Yönetici Odaklı
                </button>
                {canEdit && weightTotal !== 100 && (
                  <button
                    type="button"
                    onClick={handleAutoBalanceWeights}
                    className="px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11.5px] font-semibold text-[#C8102E] inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Otomatik %100&apos;e Dengele
                  </button>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11.5px] text-slate-600">
              <div className="font-semibold text-slate-800 mb-0.5">
                Astı Olmayan Çalışan İçin Otomatik Normalize Ağırlık Önizlemesi:
              </div>
              <div className="font-mono tabular-nums flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span>Yönetici <strong>%{normalizedWithoutSub.MANAGER}</strong></span>
                <span className="text-slate-300">·</span>
                <span>Öz <strong>%{normalizedWithoutSub.SELF}</strong></span>
                <span className="text-slate-300">·</span>
                <span>Eş Düzey <strong>%{normalizedWithoutSub.PEER}</strong></span>
                <span className="text-slate-300">·</span>
                <span>İç Müşteri <strong>%{normalizedWithoutSub.INTERNAL_CUSTOMER}</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Scale & Coefficients */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#C8102E]" />
              <h3 className="font-display text-[15px] font-bold text-slate-900">
                Değerlendirme Ölçeği ve Puan Katsayıları
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => applyScalePreset('1-5')}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11.5px] font-medium text-slate-700"
              >
                1–5 Standart
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => applyScalePreset('1-4')}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11.5px] font-medium text-slate-700"
              >
                1–4 Ölçek
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => applyScalePreset('weighted-5')}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11.5px] font-medium text-slate-700"
              >
                1–5 Katsayılı
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Ölçek Tanım Başlığı
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={scaleDraft.name}
              onChange={(e) => setScaleDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
            />
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[12.5px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11.5px] text-slate-500">
                <tr>
                  <th className="py-2 px-3 w-20">Derece</th>
                  <th className="py-2 px-3">Seviye Etiketi</th>
                  <th className="py-2 px-3 w-28 text-right">Puan Katsayısı</th>
                  <th className="py-2 px-3 w-24 text-right">100&apos;lük Karşılık</th>
                  <th className="py-2 px-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scaleDraft.levels.map((lvl, idx) => {
                  const maxCoeff = Math.max(...scaleDraft.levels.map((l) => l.coefficient), 1);
                  const pct = Math.round((lvl.coefficient / maxCoeff) * 100);
                  return (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          disabled={!canEdit}
                          value={lvl.value}
                          onChange={(e) =>
                            handleUpdateScaleLevel(idx, 'value', Math.max(1, Number(e.target.value)))
                          }
                          className="w-14 h-8 px-2 font-mono font-bold text-center border border-slate-200 rounded-md"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={lvl.label}
                          onChange={(e) => handleUpdateScaleLevel(idx, 'label', e.target.value)}
                          className="w-full h-8 px-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-[#C8102E]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0.5}
                          max={10}
                          step={0.25}
                          disabled={!canEdit}
                          value={lvl.coefficient}
                          onChange={(e) =>
                            handleUpdateScaleLevel(
                              idx,
                              'coefficient',
                              Math.max(0.25, Number(e.target.value))
                            )
                          }
                          className="w-20 h-8 px-2 text-right font-mono font-semibold border border-slate-200 rounded-md"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {pct} Puan
                      </td>
                      <td className="py-2 px-2 text-right">
                        {canEdit && scaleDraft.levels.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveScaleLevel(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Seviyeyi kaldır"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleAddScaleLevel}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Ölçek Seviyesi Ekle
              </button>
            )}
            <span className="text-[11.5px] text-slate-500">
              Formlarda her alt KPI seçimi tanımlı katsayı ile ağırlıklandırılır.
            </span>
          </div>
        </section>
      </div>

      {/* Section 2: Role Group Catalog */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[14.5px] font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#C8102E]" />
              Rol ve Seviye Grupları Kataloğu
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Yetkinlikleri belirli rol gruplarına atadığınızda her çalışanın 360° formu yalnızca rolüne uygun aktif yetkinlikleri listeler.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRoleGroup}
                onChange={(e) => setNewRoleGroup(e.target.value)}
                placeholder="Yeni rol grubu (Örn: Proje Liderleri)"
                className="h-8.5 px-3 text-[12.5px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] w-60"
              />
              <button
                type="button"
                onClick={handleAddRoleGroup}
                className="h-8.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Grup Ekle
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {roleGroupsDraft.map((grp) => (
            <div
              key={grp}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[12.5px] font-semibold text-slate-800 inline-flex items-center gap-2"
            >
              <span>{grp}</span>
              {canEdit && roleGroupsDraft.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRoleGroup(grp)}
                  className="text-slate-400 hover:text-rose-600"
                  title="Grubu kaldır"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Dynamic Competency & Sub-KPI Library Manager */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#C8102E]" />
              Yetkinlikler ve Alt KPI / Davranış Göstergeleri ({filteredCompetencies.length})
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Yetkinlik ekleyin, düzenleyin, aktif/pasif yapın, alt KPI sorularını ve rol grubu atamalarını yönetin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="ALL">Tüm Rol Grupları</option>
              {roleGroupsDraft.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'PASSIVE')}
              className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="ACTIVE">Sadece Aktifler</option>
              <option value="PASSIVE">Sadece Pasifler</option>
            </select>

            {canEdit && (
              <button
                type="button"
                onClick={openCreateCompetency}
                className="h-8.5 px-3.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Yeni Yetkinlik Ekle
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredCompetencies.map((comp) => {
            const activeSubCount = comp.indicators.filter((i) => i.isActive).length;
            return (
              <div
                key={comp.id}
                className={`p-4 transition-colors ${
                  comp.isActive ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/80 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                      <span className="font-semibold text-indigo-700">{comp.category}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-600">
                        Katsayı: <strong>{comp.weight.toFixed(1)}x</strong>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-600">
                        Hedef: <strong>{comp.targetScore}</strong>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`font-semibold ${
                          comp.isActive ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {comp.isActive ? 'Aktif (Formlarda Görünür)' : 'Pasif (Gizli)'}
                      </span>
                    </div>

                    <div className="text-[14.5px] font-bold text-slate-900">{comp.name}</div>
                    <p className="text-[12.5px] text-slate-600">{comp.description}</p>

                    {/* Role Groups */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11.5px] text-slate-500 font-medium">Rol Grupları:</span>
                      {(comp.roleGroups.length > 0 ? comp.roleGroups : ['Tümü']).map((rg) => (
                        <span
                          key={rg}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700"
                        >
                          {rg}
                        </span>
                      ))}
                    </div>

                    {/* Sub-KPI Indicators with Inline Toggle & Quick-Add */}
                    <div className="pt-2 space-y-1.5">
                      <div className="text-[11.5px] font-semibold text-slate-500">
                        Alt KPI / Davranış Göstergeleri ({activeSubCount}/{comp.indicators.length} Aktif):
                      </div>
                      <ul className="space-y-1">
                        {comp.indicators.map((ind, iIdx) => (
                          <li
                            key={ind.id}
                            className={`text-[12px] flex items-start gap-2 ${
                              ind.isActive ? 'text-slate-700' : 'text-slate-400 line-through'
                            }`}
                          >
                            {canEdit ? (
                              <input
                                type="checkbox"
                                checked={ind.isActive}
                                onChange={() => handleInlineToggleIndicator(comp, ind.id)}
                                title="Bu davranış göstergesini formlarda göster/gizle"
                                className="w-3.5 h-3.5 mt-0.5 accent-[#C8102E] cursor-pointer shrink-0"
                              />
                            ) : (
                              <span className="font-mono text-[11px] text-slate-400 mt-0.5">
                                {iIdx + 1}.
                              </span>
                            )}
                            <span className="flex-1">
                              <span className="font-mono text-[11px] text-slate-400 mr-1">
                                {iIdx + 1}.
                              </span>
                              {ind.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {canEdit && (
                        <div className="flex items-center gap-1.5 pt-1 max-w-xl">
                          <input
                            type="text"
                            value={inlineIndicatorDrafts[comp.id] ?? ''}
                            onChange={(e) =>
                              setInlineIndicatorDrafts((prev) => ({
                                ...prev,
                                [comp.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleInlineAddIndicator(comp);
                              }
                            }}
                            placeholder="Hızlı davranış göstergesi / alt KPI ekle..."
                            className="flex-1 h-7.5 px-2.5 text-[12px] bg-slate-50 focus:bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#C8102E]"
                          />
                          <button
                            type="button"
                            onClick={() => handleInlineAddIndicator(comp)}
                            disabled={!(inlineIndicatorDrafts[comp.id] ?? '').trim()}
                            className="h-7.5 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[11.5px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            Ekle
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleCompetencyActive(comp.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          comp.isActive
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-50'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Aktif / Pasif Değiştir"
                      >
                        {comp.isActive ? (
                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-slate-400" />
                        )}
                        {comp.isActive ? 'Aktif' : 'Pasif'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditCompetency(comp)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-[12px] font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Düzenle
                      </button>

                      {competencies.length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteCompetency(comp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Yetkinliği Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredCompetencies.length === 0 && (
            <div className="p-8 text-center text-[13px] text-slate-500">
              Seçili filtrelere uygun yetkinlik bulunamadı.
            </div>
          )}
        </div>
      </section>

      {/* Modal: Create / Edit Competency + Sub-KPIs + Role Group Mapping */}
      {editingComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={() => setEditingComp(null)}
          />
          <form
            onSubmit={handleSaveCompetencyModal}
            className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <div className="text-[12px] text-slate-500">360° Yetkinlik ve Alt KPI Editörü</div>
                <h3 className="font-display text-[16px] font-bold text-slate-900">
                  {isCreatingComp ? 'Yeni Yetkinlik & Alt KPI Tanımla' : editingComp.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingComp(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Yetkinlik Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingComp.name}
                    onChange={(e) =>
                      setEditingComp((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    placeholder="Örn: Dijital Dönüşüm ve Veri Odaklı Karar Alma"
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={editingComp.category}
                    onChange={(e) =>
                      setEditingComp((prev) =>
                        prev
                          ? {
                              ...prev,
                              category: e.target.value as CompetencyDefinition['category'],
                            }
                          : prev
                      )
                    }
                    className="w-full h-9.5 px-2.5 text-[13px] bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="Temel Yetkinlik">Temel Yetkinlik</option>
                    <option value="Liderlik Yetkinliği">Liderlik Yetkinliği</option>
                    <option value="Fonksiyonel Yetkinlik">Fonksiyonel Yetkinlik</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                      Ağırlık Katsayısı
                    </label>
                    <input
                      type="number"
                      min={0.2}
                      max={3}
                      step={0.1}
                      value={editingComp.weight}
                      onChange={(e) =>
                        setEditingComp((prev) =>
                          prev ? { ...prev, weight: Number(e.target.value) } : prev
                        )
                      }
                      className="w-full h-9.5 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                      Hedef (0–100)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={editingComp.targetScore}
                      onChange={(e) =>
                        setEditingComp((prev) =>
                          prev ? { ...prev, targetScore: Number(e.target.value) } : prev
                        )
                      }
                      className="w-full h-9.5 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Yetkinlik Açıklaması
                  </label>
                  <textarea
                    rows={2}
                    value={editingComp.description}
                    onChange={(e) =>
                      setEditingComp((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev
                      )
                    }
                    placeholder="Yetkinliğin kurum içi kapsamı..."
                    className="w-full p-2.5 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
              </div>

              {/* Role Group Assignment */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[12.5px] font-bold text-slate-900">
                    Uygulanacak Rol / Seviye Grupları
                  </div>
                  <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingComp.isActive}
                      onChange={(e) =>
                        setEditingComp((prev) =>
                          prev ? { ...prev, isActive: e.target.checked } : prev
                        )
                      }
                      className="w-4 h-4 accent-[#C8102E]"
                    />
                    Aktif (Değerlendirmelerde Göster)
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roleGroupsDraft.map((grp) => {
                    const checked = editingComp.roleGroups.includes(grp);
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => handleToggleRoleGroupOnComp(grp)}
                        className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                          checked
                            ? 'bg-[#C8102E] text-white border-[#C8102E]'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {grp}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-KPI / Behavioral Indicators */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold text-slate-900">
                    Alt KPI / Davranış Göstergeleri ({editingComp.indicators.length})
                  </div>
                  <span className="text-[11.5px] text-slate-500">
                    360° formunda bu maddeler tek tek puanlanır
                  </span>
                </div>

                <div className="space-y-2">
                  {editingComp.indicators.map((ind, idx) => (
                    <div
                      key={ind.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={ind.isActive}
                        title="Aktif / Pasif"
                        onChange={(e) =>
                          setEditingComp((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  indicators: prev.indicators.map((item, i) =>
                                    i === idx ? { ...item, isActive: e.target.checked } : item
                                  ),
                                }
                              : prev
                          )
                        }
                        className="w-4 h-4 accent-[#C8102E] shrink-0"
                      />
                      <input
                        type="text"
                        value={ind.text}
                        onChange={(e) =>
                          setEditingComp((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  indicators: prev.indicators.map((item, i) =>
                                    i === idx ? { ...item, text: e.target.value } : item
                                  ),
                                }
                              : prev
                          )
                        }
                        placeholder="Davranış göstergesi / alt KPI sorusu..."
                        className="flex-1 h-8 px-2.5 text-[12.5px] border border-slate-200 rounded-md focus:outline-none focus:border-[#C8102E]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingComp((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  indicators: prev.indicators.filter((_, i) => i !== idx),
                                }
                              : prev
                          )
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                        title="Göstergeyi sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newIndicatorText}
                    onChange={(e) => setNewIndicatorText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddIndicatorToDraft();
                      }
                    }}
                    placeholder="Yeni alt KPI / davranış göstergesi yazın..."
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                  <button
                    type="button"
                    onClick={handleAddIndicatorToDraft}
                    className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Alt KPI Ekle
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditingComp(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yetkinliği Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Live 360° Evaluation Form Preview */}
      {showLivePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={() => setShowLivePreview(false)}
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <div className="text-[11.5px] font-semibold text-indigo-700 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  CANLI DEĞERLENDİRME FORMU ÖNİZLEMESİ
                </div>
                <h3 className="font-display text-[16px] font-bold text-slate-900">
                  360° Yetkinlik Değerlendirme Formu — {scaleDraft.name}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right font-mono tabular-nums">
                  <div className="text-[11px] font-sans text-slate-500">Önizleme Skoru</div>
                  <div className="text-[15px] font-bold text-[#C8102E]">
                    {previewComputed.overallScale.toFixed(2)} / {previewComputed.maxCoeff.toFixed(1)}
                    <span className="text-[11.5px] font-normal text-slate-500 ml-1">
                      ({previewComputed.overall100.toFixed(1)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLivePreview(false)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Role Group & Evaluator Preview Switcher */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-[12.5px] shrink-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="text-slate-600 font-medium">Rol Grubu:</label>
                <select
                  value={previewRoleGroup}
                  onChange={(e) => setPreviewRoleGroup(e.target.value)}
                  className="h-8 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                >
                  {roleGroupsDraft.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>

                <label className="text-slate-600 font-medium ml-1">Değerlendirici:</label>
                <select
                  value={previewRelation}
                  onChange={(e) => setPreviewRelation(e.target.value as RaterRelation)}
                  className="h-8 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                >
                  {(Object.keys(PREVIEW_RELATION_LABELS) as RaterRelation[]).map((rel) => (
                    <option key={rel} value={rel}>
                      {PREVIEW_RELATION_LABELS[rel]} (%{weightsDraft[rel]})
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[12px] text-slate-500 font-mono tabular-nums">
                {previewCompetencies.length} Aktif Yetkinlik · Ağırlık: %{weightsDraft[previewRelation]}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
              {previewCompetencies.map((comp) => {
                const activeInds = comp.indicators.filter((i) => i.isActive);
                const comp100 = previewComputed.compScores[comp.id] ?? 0;
                const compScale = score100ToScaleValue(comp100, scaleDraft.levels);
                return (
                  <div
                    key={comp.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[14px] font-bold text-slate-900">{comp.name}</div>
                        <div className="text-[11.5px] text-slate-500">
                          {comp.category} · Katsayı: {comp.weight.toFixed(1)}x
                        </div>
                      </div>
                      <div className="font-mono tabular-nums text-[12.5px] font-bold text-slate-900">
                        {compScale.toFixed(2)} / {previewComputed.maxCoeff.toFixed(1)}
                        <span className="text-[11px] font-normal text-slate-400 ml-1">
                          ({comp100.toFixed(0)})
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {(activeInds.length > 0
                        ? activeInds
                        : [{ id: comp.id, text: comp.description, isActive: true }]
                      ).map((ind, idx) => {
                        const selectedVal = previewRatings[ind.id] ?? previewComputed.midVal;
                        return (
                          <div key={ind.id} className="p-4 space-y-2.5">
                            <div className="text-[12.5px] font-medium text-slate-800">
                              <span className="font-mono text-slate-400 mr-1.5">{idx + 1}.</span>
                              {ind.text}
                            </div>
                            <div
                              className="grid gap-1.5"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(
                                  scaleDraft.levels.length,
                                  7
                                )}, minmax(0, 1fr))`,
                              }}
                            >
                              {scaleDraft.levels.map((lvl) => {
                                const isSel = selectedVal === lvl.value;
                                return (
                                  <button
                                    key={lvl.value}
                                    type="button"
                                    onClick={() =>
                                      setPreviewRatings((prev) => ({
                                        ...prev,
                                        [ind.id]: lvl.value,
                                      }))
                                    }
                                    className={`px-2 py-2 rounded-lg border text-center transition-all ${
                                      isSel
                                        ? 'bg-[#C8102E] text-white border-[#C8102E] shadow-xs'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="font-mono font-bold text-[13px]">
                                      {lvl.value}
                                    </div>
                                    <div
                                      className={`text-[10px] leading-tight mt-0.5 truncate ${
                                        isSel ? 'text-rose-100' : 'text-slate-500'
                                      }`}
                                      title={`${lvl.label} (Katsayı: ${lvl.coefficient})`}
                                    >
                                      {lvl.label}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[12px] text-slate-500">
                {hasUnsavedGlobalChanges
                  ? 'Ağırlık veya ölçek değişikliklerinin tüm kullanıcılara yansıması için yayınlayın.'
                  : 'Önizlenen tüm ayarlar şu anda canlı 360° formlarında aktiftir.'}
              </div>
              <div className="flex items-center gap-2">
                {canEdit && hasUnsavedGlobalChanges && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveGlobal360Config();
                      if (weightTotal === 100) setShowLivePreview(false);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Yayınla ve Kapat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowLivePreview(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

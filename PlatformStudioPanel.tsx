import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GitBranch,
  Grid3X3,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTalentStore } from '../context/TalentStore';
import type {
  FeatureFlags,
  KpiTemplateItem,
  NineBoxId,
  PlatformConfig,
} from '../types/talent';
import { NINE_BOX_GRID_ORDER } from '../utils/calculations';

type StudioSection = 'features' | 'kpis' | 'processes';

const FEATURE_META: {
  key: keyof FeatureFlags;
  label: string;
  description: string;
  group: 'Modüller' | 'Yetenek ve Otomasyonlar';
}[] = [
  {
    key: 'enablePerformance',
    label: 'Bireysel Performans (OKR & KPI)',
    description: 'Hedef belirleme, gerçekleşme puanlama ve dönem iş akışı modülü.',
    group: 'Modüller',
  },
  {
    key: 'enableFeedback360',
    label: '360° Yetkinlik Değerlendirme',
    description: 'Çoklu değerlendirici matrisi, radar grafik ve kör nokta analizi.',
    group: 'Modüller',
  },
  {
    key: 'enableNineBox',
    label: 'Nine-Box Yetenek Matrisi',
    description: '3×3 yetenek dağılımı ve kalibrasyon kurulu görünümü.',
    group: 'Modüller',
  },
  {
    key: 'enableMobility',
    label: 'İç Terfi, Rotasyon ve Atama',
    description: 'Çok adımlı terfi/atama onay akışı ve otomatik özlük senkronizasyonu.',
    group: 'Modüller',
  },
  {
    key: 'enableAssignments',
    label: 'Geçici Görevlendirme & Saha Atamaları',
    description: 'Saha, proje ve vekalet görevlendirmeleri ile geri sayım takibi.',
    group: 'Modüller',
  },
  {
    key: 'enableNineBoxDragDrop',
    label: 'Nine-Box Sürükle-Bırak Kalibrasyonu',
    description: 'Kalibrasyon toplantılarında kartların kutular arasında taşınmasına izin ver.',
    group: 'Yetenek ve Otomasyonlar',
  },
  {
    key: 'enableCalibrationOverride',
    label: 'İK Performans Kalibrasyon Kaydırıcısı',
    description: 'Performans puanlama ekranında gerekçe zorunlu kalibrasyon düzeltmesi.',
    group: 'Yetenek ve Otomasyonlar',
  },
  {
    key: 'enableAutoEligibilityEngine',
    label: 'Otomatik Terfi Uygunluk Kural Motoru',
    description: 'Terfi başlatırken kıdem, performans, 360° ve disiplin kontrollerini zorunlu kıl.',
    group: 'Yetenek ve Otomasyonlar',
  },
  {
    key: 'enableAssignmentConflictCheck',
    label: 'Görevlendirme Çakışma Kontrolü',
    description: 'Örtüşen görevlendirme veya aktif terfi süreci varsa otomatik uyarı göster.',
    group: 'Yetenek ve Otomasyonlar',
  },
  {
    key: 'enableCsvExport',
    label: 'CSV / Excel Veri Dışa Aktarımı',
    description: 'Tablo ve rapor ekranlarında CSV indirme düğmelerini aktif et.',
    group: 'Yetenek ve Otomasyonlar',
  },
];

export const PlatformStudioPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    platformConfig,
    updatePlatformConfig,
    resetPlatformConfig,
    applyDepartmentKpiTemplates,
    employees,
    activePeriod,
    role,
  } = useTalentStore();

  const canEdit =
    role === 'ADMIN' &&
    (currentUser?.role === 'ADMIN' || Boolean(currentUser?.permissions.actions.canEditSystemRules));

  const [section, setSection] = useState<StudioSection>('features');
  const [draft, setDraft] = useState<PlatformConfig>(() => structuredClone(platformConfig));
  const [selectedDept, setSelectedDept] = useState<string>(
    platformConfig.departments[0] ?? 'Operasyon'
  );
  const [newPeriodInput, setNewPeriodInput] = useState('');
  const [newDeptInput, setNewDeptInput] = useState('');
  const [newLocInput, setNewLocInput] = useState('');
  const [newPerfStage, setNewPerfStage] = useState('');
  const [newApprovalStep, setNewApprovalStep] = useState('');
  const [newProcessType, setNewProcessType] = useState('');
  const [newAssignCategory, setNewAssignCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeTemplates: KpiTemplateItem[] = useMemo(
    () => draft.kpiTemplatesByDepartment[selectedDept] ?? [],
    [draft.kpiTemplatesByDepartment, selectedDept]
  );

  const activeTemplateWeight = useMemo(
    () => activeTemplates.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
    [activeTemplates]
  );

  const deptEmployeeCount = useMemo(
    () => employees.filter((e) => e.department === selectedDept).length,
    [employees, selectedDept]
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(platformConfig),
    [draft, platformConfig]
  );

  const handleSaveAll = () => {
    if (!draft.platformName.trim()) {
      setError('Platform adı boş bırakılamaz.');
      return;
    }
    if (draft.evaluationPeriods.length === 0) {
      setError('En az bir değerlendirme dönemi bulunmalıdır.');
      return;
    }
    if (draft.departments.length === 0) {
      setError('En az bir birim / departman bulunmalıdır.');
      return;
    }
    if (draft.performanceStages.length < 2) {
      setError('Performans iş akışında en az 2 aşama bulunmalıdır.');
      return;
    }
    if (draft.mobilityApprovalSteps.length < 2) {
      setError('Terfi / atama onay akışında en az 2 adım bulunmalıdır.');
      return;
    }
    setError(null);
    updatePlatformConfig(draft);
  };

  const handleResetDefaults = () => {
    resetPlatformConfig();
    setError(null);
  };

  // Sync draft only when platformConfig changes in store (e.g. save or reset), never on department tab switch
  React.useEffect(() => {
    setDraft(structuredClone(platformConfig));
  }, [platformConfig]);

  // Keep selectedDept valid if departments list changes
  React.useEffect(() => {
    if (!draft.departments.includes(selectedDept) && draft.departments[0]) {
      setSelectedDept(draft.departments[0]);
    }
  }, [draft.departments, selectedDept]);

  // Helpers for reordering string lists
  const moveItem = (
    field: 'performanceStages' | 'mobilityApprovalSteps',
    index: number,
    direction: -1 | 1
  ) => {
    setDraft((prev) => {
      const list = [...prev[field]];
      const target = index + direction;
      if (target < 0 || target >= list.length) return prev;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, [field]: list };
    });
  };

  const updateListItem = (
    field:
      | 'evaluationPeriods'
      | 'performanceStages'
      | 'mobilityApprovalSteps'
      | 'mobilityProcessTypes'
      | 'assignmentCategories',
    index: number,
    value: string
  ) => {
    setDraft((prev) => {
      const list = [...prev[field]];
      list[index] = value;
      return { ...prev, [field]: list };
    });
  };

  const removeListItem = (
    field:
      | 'evaluationPeriods'
      | 'departments'
      | 'locations'
      | 'performanceStages'
      | 'mobilityApprovalSteps'
      | 'mobilityProcessTypes'
      | 'assignmentCategories',
    index: number
  ) => {
    setDraft((prev) => {
      if (prev[field].length <= 1) return prev;
      const list = prev[field].filter((_, i) => i !== index);
      return { ...prev, [field]: list };
    });
  };

  // KPI Template editors
  const updateKpiTemplateRow = <K extends keyof KpiTemplateItem>(
    index: number,
    field: K,
    value: KpiTemplateItem[K]
  ) => {
    setDraft((prev) => {
      const current = prev.kpiTemplatesByDepartment[selectedDept] ?? [];
      const updated = current.map((row, idx) => (idx === index ? { ...row, [field]: value } : row));
      return {
        ...prev,
        kpiTemplatesByDepartment: {
          ...prev.kpiTemplatesByDepartment,
          [selectedDept]: updated,
        },
      };
    });
  };

  const addKpiTemplateRow = () => {
    const remaining = Math.max(0, 100 - activeTemplateWeight);
    setDraft((prev) => {
      const current = prev.kpiTemplatesByDepartment[selectedDept] ?? [];
      return {
        ...prev,
        kpiTemplatesByDepartment: {
          ...prev.kpiTemplatesByDepartment,
          [selectedDept]: [
            ...current,
            {
              id: `tpl-${Date.now()}`,
              title: 'Yeni Birim Hedefi',
              category: 'KPI',
              weight: remaining > 0 ? remaining : 10,
              targetValue: 90,
              unit: '%',
            },
          ],
        },
      };
    });
  };

  const removeKpiTemplateRow = (index: number) => {
    setDraft((prev) => {
      const current = prev.kpiTemplatesByDepartment[selectedDept] ?? [];
      return {
        ...prev,
        kpiTemplatesByDepartment: {
          ...prev.kpiTemplatesByDepartment,
          [selectedDept]: current.filter((_, idx) => idx !== index),
        },
      };
    });
  };

  const handleApplyTemplatesToEmployees = () => {
    if (activeTemplates.length === 0) {
      setError(`${selectedDept} birimi için en az bir KPI/OKR hedefi tanımlanmalıdır.`);
      return;
    }
    if (activeTemplates.some((t) => !t.title.trim())) {
      setError('Tüm KPI/OKR şablonlarının başlıkları doldurulmalıdır.');
      return;
    }
    if (activeTemplateWeight !== 100) {
      setError(
        `${selectedDept} KPI ağırlıkları toplamı %100 olmalıdır (Mevcut: %${activeTemplateWeight}).`
      );
      return;
    }
    setError(null);
    updatePlatformConfig(draft);
    applyDepartmentKpiTemplates(selectedDept, activeTemplates);
  };

  const updateNineBoxField = (
    boxId: NineBoxId,
    field: 'name' | 'shortName' | 'recommendation',
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      nineBoxCatalog: {
        ...prev.nineBoxCatalog,
        [boxId]: {
          ...prev.nineBoxCatalog[boxId],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Section Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSection('features')}
            className={`px-3.5 py-2 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              section === 'features'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Özellikler & Kurumsal Yapı
          </button>
          <button
            type="button"
            onClick={() => setSection('kpis')}
            className={`px-3.5 py-2 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              section === 'kpis'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            KPI & OKR Şablonları
          </button>
          <button
            type="button"
            onClick={() => setSection('processes')}
            className={`px-3.5 py-2 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              section === 'processes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Süreçler & İş Akışları
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {hasUnsavedChanges && (
            <span className="text-[12px] font-semibold text-amber-700">
              Kaydedilmemiş değişiklikler var
            </span>
          )}
          <button
            type="button"
            disabled={!canEdit}
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-[12.5px] font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Varsayılana Dön
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            Değişiklikleri Yayınla
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
          Platform özelliklerini, KPI şablonlarını ve iş akışlarını düzenlemek için{' '}
          <strong>İK / Sistem Yöneticisi</strong> yetkisine sahip olmanız gerekir.
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: FEATURES, BRANDING, DASHBOARD KPIS, PERIODS & ORG STRUCTURE */}
      {section === 'features' && (
        <div className="space-y-6">
          {/* Platform Identity & Dashboard KPI Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Sliders className="w-4 h-4 text-[#C8102E]" />
                <h2 className="font-display text-[15px] font-bold text-slate-900">
                  Kurumsal Marka & Portal Başlığı
                </h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Platform Adı
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={draft.platformName}
                    onChange={(e) => setDraft((d) => ({ ...d, platformName: e.target.value }))}
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Alt Başlık
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={draft.platformSubtitle}
                    onChange={(e) => setDraft((d) => ({ ...d, platformSubtitle: e.target.value }))}
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
              </div>

              {/* Evaluation Periods */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="text-[13px] font-bold text-slate-900">
                  Değerlendirme Dönemleri ({draft.evaluationPeriods.length})
                </div>
                <div className="space-y-2">
                  {draft.evaluationPeriods.map((period, idx) => (
                    <div key={`${period}-${idx}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={period}
                        onChange={(e) => updateListItem('evaluationPeriods', idx, e.target.value)}
                        className="flex-1 h-8.5 px-2.5 text-[12.5px] border border-slate-200 rounded-lg"
                      />
                      {canEdit && draft.evaluationPeriods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeListItem('evaluationPeriods', idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                          title="Dönemi sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newPeriodInput}
                      onChange={(e) => setNewPeriodInput(e.target.value)}
                      placeholder="Örn: 2027 1. Çeyrek Dönemi"
                      className="flex-1 h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newPeriodInput.trim();
                        if (!val || draft.evaluationPeriods.includes(val)) return;
                        setDraft((d) => ({
                          ...d,
                          evaluationPeriods: [val, ...d.evaluationPeriods],
                        }));
                        setNewPeriodInput('');
                      }}
                      className="h-8.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ekle
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Executive Dashboard KPI Card Editor */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-display text-[15px] font-bold text-slate-900">
                    Yönetici Kokpiti KPI Kartları
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Ana ekranda gösterilen üst KPI kartlarını açıp kapatın ve başlıklarını özelleştirin
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {draft.dashboardKpis.map((kpi, idx) => (
                  <div
                    key={kpi.id}
                    className={`p-3 rounded-xl border flex flex-wrap items-center gap-3 ${
                      kpi.visible ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200/70 opacity-65'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={kpi.visible}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          dashboardKpis: d.dashboardKpis.map((item, i) =>
                            i === idx ? { ...item, visible: e.target.checked } : item
                          ),
                        }))
                      }
                      className="w-4 h-4 accent-[#C8102E] shrink-0"
                    />
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={kpi.label}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            dashboardKpis: d.dashboardKpis.map((item, i) =>
                              i === idx ? { ...item, label: e.target.value } : item
                            ),
                          }))
                        }
                        className="h-8.5 px-2.5 text-[12.5px] font-semibold border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={kpi.subtitle}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            dashboardKpis: d.dashboardKpis.map((item, i) =>
                              i === idx ? { ...item, subtitle: e.target.value } : item
                            ),
                          }))
                        }
                        className="h-8.5 px-2.5 text-[12px] text-slate-600 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Flags Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="font-display text-[15px] font-bold text-slate-900">
                Aktif Modüller ve Platform Özellikleri
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                Kurumunuzda kullanmadığınız modülleri veya otomasyonları tek tıkla kapatıp açabilirsiniz
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FEATURE_META.map((feat) => {
                const enabled = draft.features[feat.key];
                return (
                  <label
                    key={feat.key}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                      enabled
                        ? 'bg-emerald-50/35 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-400">{feat.group}</div>
                      <div className="text-[13.5px] font-semibold text-slate-900 mt-0.5">
                        {feat.label}
                      </div>
                      <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                        {feat.description}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={enabled}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          features: { ...d.features, [feat.key]: e.target.checked },
                        }))
                      }
                      className="w-4.5 h-4.5 mt-1 accent-[#C8102E] shrink-0"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Departments & Locations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-[14.5px] font-bold text-slate-900">
                Birim / Departman Listesi ({draft.departments.length})
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {draft.departments.map((dept, idx) => (
                  <div
                    key={`${dept}-${idx}`}
                    className="px-3.5 py-2 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="font-medium text-slate-800">{dept}</span>
                    {canEdit && draft.departments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeListItem('departments', idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newDeptInput}
                    onChange={(e) => setNewDeptInput(e.target.value)}
                    placeholder="Yeni birim adı (Örn: Kalite ve Denetim)"
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = newDeptInput.trim();
                      if (!val || draft.departments.includes(val)) return;
                      setDraft((d) => ({
                        ...d,
                        departments: [...d.departments, val],
                        kpiTemplatesByDepartment: {
                          ...d.kpiTemplatesByDepartment,
                          [val]: [
                            {
                              id: `tpl-${Date.now()}-1`,
                              title: `${val} Operasyonel Hedef Gerçekleşme`,
                              category: 'KPI',
                              weight: 50,
                              targetValue: 95,
                              unit: '%',
                            },
                            {
                              id: `tpl-${Date.now()}-2`,
                              title: `${val} Süreç ve Kalite İyileştirme`,
                              category: 'OKR',
                              weight: 50,
                              targetValue: 90,
                              unit: 'Puan',
                            },
                          ],
                        },
                      }));
                      setNewDeptInput('');
                    }}
                    className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Birim Ekle
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-[14.5px] font-bold text-slate-900">
                Kurumsal Lokasyonlar ({draft.locations.length})
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {draft.locations.map((loc, idx) => (
                  <div
                    key={`${loc}-${idx}`}
                    className="px-3.5 py-2 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="font-medium text-slate-800">{loc}</span>
                    {canEdit && draft.locations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeListItem('locations', idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newLocInput}
                    onChange={(e) => setNewLocInput(e.target.value)}
                    placeholder="Yeni lokasyon (Örn: Antalya Bölge Müdürlüğü)"
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = newLocInput.trim();
                      if (!val || draft.locations.includes(val)) return;
                      setDraft((d) => ({ ...d, locations: [...d.locations, val] }));
                      setNewLocInput('');
                    }}
                    className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lokasyon Ekle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: KPI & OKR TEMPLATE STUDIO */}
      {section === 'kpis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Department Selector List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
              <h2 className="font-display text-[14.5px] font-bold text-slate-900">
                Birim KPI Şablonları
              </h2>
              <p className="text-[11.5px] text-slate-500">
                Hedeflerini düzenlemek istediğiniz birimi seçin
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {draft.departments.map((dept) => {
                const list = draft.kpiTemplatesByDepartment[dept] ?? [];
                const wSum = list.reduce((s, x) => s + (Number(x.weight) || 0), 0);
                const empCount = employees.filter((e) => e.department === dept).length;
                const active = selectedDept === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between gap-2 transition-colors ${
                      active ? 'bg-rose-50/50 text-[#C8102E]' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-[13.5px] font-semibold">{dept}</div>
                      <div className="text-[11.5px] text-slate-500">
                        {list.length} hedef · {empCount} personel
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[12px] font-bold ${
                        wSum === 100 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      %{wSum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Active Department KPI/OKR Editor */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="text-[11.5px] font-semibold text-slate-500">
                  Aktif Dönem: {activePeriod} · {deptEmployeeCount} Personel Etkilenir
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {selectedDept} — Standart OKR & KPI Şablonu
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Toplam Ağırlık</div>
                  <div
                    className={`font-mono text-lg font-bold ${
                      activeTemplateWeight === 100 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    %{activeTemplateWeight}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addKpiTemplateRow}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12.5px] font-semibold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    KPI / OKR Ekle
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {activeTemplates.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      disabled={!canEdit}
                      value={item.category}
                      onChange={(e) =>
                        updateKpiTemplateRow(idx, 'category', e.target.value as 'KPI' | 'OKR')
                      }
                      className="h-9 px-2 text-[12px] font-semibold bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="KPI">KPI</option>
                      <option value="OKR">OKR</option>
                    </select>

                    <input
                      type="text"
                      disabled={!canEdit}
                      value={item.title}
                      onChange={(e) => updateKpiTemplateRow(idx, 'title', e.target.value)}
                      placeholder="Hedef / Gösterge adı..."
                      className="flex-1 min-w-[220px] h-9 px-3 text-[13px] font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                    />

                    {canEdit && activeTemplates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeKpiTemplateRow(idx)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Satırı kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-[12px]">
                    <div>
                      <label className="block text-slate-500 mb-1">Ağırlık (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!canEdit}
                        value={item.weight}
                        onChange={(e) =>
                          updateKpiTemplateRow(idx, 'weight', Math.max(0, Number(e.target.value)))
                        }
                        className="w-full h-8.5 px-2.5 font-mono font-semibold bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Hedef Değer</label>
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={item.targetValue}
                        onChange={(e) =>
                          updateKpiTemplateRow(idx, 'targetValue', Number(e.target.value))
                        }
                        className="w-full h-8.5 px-2.5 font-mono bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Ölçüm Birimi</label>
                      <select
                        disabled={!canEdit}
                        value={item.unit}
                        onChange={(e) => updateKpiTemplateRow(idx, 'unit', e.target.value)}
                        className="w-full h-8.5 px-2 bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="%">%</option>
                        <option value="Puan">Puan</option>
                        <option value="Gün">Gün</option>
                        <option value="Saat">Saat</option>
                        <option value="Adet">Adet</option>
                        <option value="₺">₺</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Şablonu uyguladığınızda <strong>{selectedDept}</strong> birimindeki{' '}
                  <strong>{deptEmployeeCount}</strong> personelin {activePeriod} hedefleri güncellenir.
                </span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleApplyTemplatesToEmployees}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Users className="w-4 h-4" />
                  Birimdeki Tüm Personele Uygula
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PROCESS & WORKFLOW EDITOR */}
      {section === 'processes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Workflow Stages */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div>
                <h2 className="font-display text-[15px] font-bold text-slate-900">
                  Bireysel Performans İş Akışı Aşamaları ({draft.performanceStages.length})
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Aşamaları yeniden adlandırın, sırasını değiştirin veya yeni aşama ekleyin
                </p>
              </div>
              <div className="space-y-2">
                {draft.performanceStages.map((stage, idx) => (
                  <div key={`perf-stage-${idx}`} className="flex items-center gap-2">
                    <span className="w-7 text-center font-mono text-[12px] font-semibold text-slate-400">
                      0{idx + 1}
                    </span>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={stage}
                      onChange={(e) => updateListItem('performanceStages', idx, e.target.value)}
                      className="flex-1 h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
                    />
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem('performanceStages', idx, -1)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.performanceStages.length - 1}
                          onClick={() => moveItem('performanceStages', idx, 1)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {draft.performanceStages.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeListItem('performanceStages', idx)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newPerfStage}
                    onChange={(e) => setNewPerfStage(e.target.value)}
                    placeholder="Yeni aşama (Örn: Üst Yönetici Gözden Geçirme)"
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newPerfStage.trim();
                      if (!v) return;
                      setDraft((d) => ({ ...d, performanceStages: [...d.performanceStages, v] }));
                      setNewPerfStage('');
                    }}
                    className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ekle
                  </button>
                </div>
              )}
            </div>

            {/* Mobility Approval Steps */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div>
                <h2 className="font-display text-[15px] font-bold text-slate-900">
                  Terfi ve Atama Onay Adımları ({draft.mobilityApprovalSteps.length})
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Son adım tamamlandığında personel özlük kartı otomatik güncellenir
                </p>
              </div>
              <div className="space-y-2">
                {draft.mobilityApprovalSteps.map((step, idx) => (
                  <div key={`mob-step-${idx}`} className="flex items-center gap-2">
                    <span className="w-7 text-center font-mono text-[12px] font-semibold text-slate-400">
                      0{idx + 1}
                    </span>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={step}
                      onChange={(e) => updateListItem('mobilityApprovalSteps', idx, e.target.value)}
                      className="flex-1 h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
                    />
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem('mobilityApprovalSteps', idx, -1)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.mobilityApprovalSteps.length - 1}
                          onClick={() => moveItem('mobilityApprovalSteps', idx, 1)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {draft.mobilityApprovalSteps.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeListItem('mobilityApprovalSteps', idx)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newApprovalStep}
                    onChange={(e) => setNewApprovalStep(e.target.value)}
                    placeholder="Yeni onay adımı (Örn: Mali İşler Onayı)"
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newApprovalStep.trim();
                      if (!v) return;
                      setDraft((d) => ({
                        ...d,
                        mobilityApprovalSteps: [...d.mobilityApprovalSteps, v],
                      }));
                      setNewApprovalStep('');
                    }}
                    className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ekle
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobility Process Types & Temporary Assignment Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-[14.5px] font-bold text-slate-900">
                Terfi / Hareketlilik Süreç Türleri
              </h3>
              <div className="space-y-2">
                {draft.mobilityProcessTypes.map((pt, idx) => (
                  <div key={`pt-${idx}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={pt}
                      onChange={(e) => updateListItem('mobilityProcessTypes', idx, e.target.value)}
                      className="flex-1 h-9 px-3 text-[12.5px] border border-slate-200 rounded-lg"
                    />
                    {canEdit && draft.mobilityProcessTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeListItem('mobilityProcessTypes', idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newProcessType}
                    onChange={(e) => setNewProcessType(e.target.value)}
                    placeholder="Yeni süreç türü..."
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newProcessType.trim();
                      if (!v) return;
                      setDraft((d) => ({
                        ...d,
                        mobilityProcessTypes: [...d.mobilityProcessTypes, v],
                      }));
                      setNewProcessType('');
                    }}
                    className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ekle
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[14.5px] font-bold text-slate-900">
                  Geçici Görevlendirme Kategorileri
                </h3>
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span className="text-slate-500">Uyarı Eşiği:</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    disabled={!canEdit}
                    value={draft.assignmentExpiryWarningDays}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        assignmentExpiryWarningDays: Math.max(1, Number(e.target.value)),
                      }))
                    }
                    className="w-16 h-8 px-2 text-right font-mono font-semibold border border-slate-200 rounded-lg"
                  />
                  <span className="text-slate-500">Gün</span>
                </div>
              </div>
              <div className="space-y-2">
                {draft.assignmentCategories.map((cat, idx) => (
                  <div key={`cat-${idx}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={cat}
                      onChange={(e) => updateListItem('assignmentCategories', idx, e.target.value)}
                      className="flex-1 h-9 px-3 text-[12.5px] border border-slate-200 rounded-lg"
                    />
                    {canEdit && draft.assignmentCategories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeListItem('assignmentCategories', idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newAssignCategory}
                    onChange={(e) => setNewAssignCategory(e.target.value)}
                    placeholder="Yeni görevlendirme kategorisi..."
                    className="flex-1 h-9 px-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newAssignCategory.trim();
                      if (!v) return;
                      setDraft((d) => ({
                        ...d,
                        assignmentCategories: [...d.assignmentCategories, v],
                      }));
                      setNewAssignCategory('');
                    }}
                    className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ekle
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Nine-Box Custom Labels & Recommendations */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Grid3X3 className="w-4 h-4 text-[#C8102E]" />
              <div>
                <h2 className="font-display text-[15px] font-bold text-slate-900">
                  Nine-Box Segment İsimleri ve Gelişim Önerileri
                </h2>
                <p className="text-[12px] text-slate-500">
                  Kurum kültürünüze göre 9 kutunun başlıklarını ve aksiyon önerilerini özelleştirin
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {NINE_BOX_GRID_ORDER.map((boxId) => {
                const box = draft.nineBoxCatalog[boxId];
                return (
                  <div
                    key={boxId}
                    className={`p-3.5 rounded-xl border space-y-2 ${box.accentBg} ${box.accentBorder}`}
                  >
                    <div className="text-[11px] font-mono text-slate-500">
                      {box.code} · {box.potBand} Pot / {box.perfBand} Perf
                    </div>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={box.name}
                      onChange={(e) => updateNineBoxField(boxId, 'name', e.target.value)}
                      className="w-full h-8.5 px-2.5 text-[12.5px] font-bold bg-white border border-slate-200 rounded-lg"
                      placeholder="Tam segment adı"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={box.shortName}
                      onChange={(e) => updateNineBoxField(boxId, 'shortName', e.target.value)}
                      className="w-full h-8 px-2.5 text-[12px] bg-white border border-slate-200 rounded-lg"
                      placeholder="Kısa etiket"
                    />
                    <textarea
                      rows={2}
                      disabled={!canEdit}
                      value={box.recommendation}
                      onChange={(e) => updateNineBoxField(boxId, 'recommendation', e.target.value)}
                      className="w-full p-2 text-[11.5px] bg-white border border-slate-200 rounded-lg leading-snug"
                      placeholder="Gelişim ve aksiyon önerisi..."
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

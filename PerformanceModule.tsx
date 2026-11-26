import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Edit3,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useTalentStore } from '../context/TalentStore';
import {
  classifyPerformanceScore,
  countFilledDimensionNotes,
  getEmployeeTermSummary,
  PERFORMANCE_DIMENSIONS,
  PERFORMANCE_TERM_KEYS,
  PerformanceBandLabel,
} from '../data/performanceCriteria';
import {
  Employee,
  KPIItem,
  PerformanceTermKey,
  PerformanceWorkflowStage,
} from '../types/talent';
import {
  calculateWeightedKpiScore,
  getEffectivePerformanceScore,
  getInitials,
} from '../utils/calculations';
import { exportWorkbookToXlsx } from '../utils/excelExport';
import { PerformanceTermEvalModal } from '../components/PerformanceTermEvalModal';

export const PerformanceModule: React.FC = () => {
  const {
    employees,
    activePeriod,
    platformConfig,
    role,
    currentRoleActorName,
    currentRoleEmployeeId,
    savePerformanceTermEvaluation,
    saveEmployeeKpis,
    advancePerformanceStage,
    openEmployeeDrawer,
  } = useTalentStore();

  const perfStages = platformConfig.performanceStages;

  // Primary module tab: 6-Dimension EK-13/14/15 Term Evaluation vs OKR/KPI Tracking
  const [moduleView, setModuleView] = useState<'ek13' | 'okr'>('ek13');
  const [selectedTerm, setSelectedTerm] = useState<PerformanceTermKey>('3. Dönem');
  const [bandFilter, setBandFilter] = useState<'ALL' | PerformanceBandLabel | 'BEKLEYEN'>('ALL');

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // EK-13/14/15 Modal state
  const [termEvalEmpId, setTermEvalEmpId] = useState<string | null>(null);

  // Interactive OKR/KPI & Calibration Modal state
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [draftKpis, setDraftKpis] = useState<KPIItem[]>([]);
  const [draftStage, setDraftStage] = useState<PerformanceWorkflowStage>('Hedef Belirleme');
  const [draftSummary, setDraftSummary] = useState('');
  const [useCalibration, setUseCalibration] = useState(false);
  const [draftCalibratedScore, setDraftCalibratedScore] = useState<number>(80);
  const [draftCalibrationNote, setDraftCalibrationNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const baseEmployees = useMemo(
    () =>
      role === 'EMPLOYEE'
        ? employees.filter((e) => e.id === currentRoleEmployeeId)
        : employees,
    [currentRoleEmployeeId, employees, role]
  );

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set([...platformConfig.departments, ...employees.map((e) => e.department)])),
    [employees, platformConfig.departments]
  );

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return baseEmployees.filter((emp) => {
      if (deptFilter !== 'ALL' && emp.department !== deptFilter) return false;
      if (moduleView === 'okr') {
        const rec = emp.performanceRecords[activePeriod];
        if (stageFilter !== 'ALL' && rec?.stage !== stageFilter) return false;
      } else if (bandFilter !== 'ALL') {
        const termRec = emp.termEvaluations?.[selectedTerm];
        const termDone = termRec?.status === 'Tamamlandı' && typeof termRec.termScore === 'number';
        if (bandFilter === 'BEKLEYEN') {
          if (termDone) return false;
        } else {
          const band = termDone ? classifyPerformanceScore(termRec.termScore) : null;
          if (!band || band.label !== bandFilter) return false;
        }
      }
      if (
        q &&
        !emp.fullName.toLocaleLowerCase('tr-TR').includes(q) &&
        !emp.sicilNo.toLocaleLowerCase('tr-TR').includes(q) &&
        !emp.title.toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    activePeriod,
    bandFilter,
    baseEmployees,
    deptFilter,
    moduleView,
    search,
    selectedTerm,
    stageFilter,
  ]);

  // EK-13/14/15 Summary metrics for selectedTerm
  const ek13Summary = useMemo(() => {
    let completed = 0;
    let expected = 0;
    let development = 0;
    let risky = 0;
    let sumScores = 0;

    baseEmployees.forEach((emp) => {
      const rec = emp.termEvaluations?.[selectedTerm];
      if (rec?.status === 'Tamamlandı' && typeof rec.termScore === 'number') {
        completed += 1;
        sumScores += rec.termScore;
        const band = classifyPerformanceScore(rec.termScore);
        if (band?.label === 'Beklenen Seviye') expected += 1;
        else if (band?.label === 'Gelişim Grubu') development += 1;
        else if (band?.label === 'Riskli Grup') risky += 1;
      }
    });

    return {
      total: baseEmployees.length,
      completed,
      pending: baseEmployees.length - completed,
      expected,
      development,
      risky,
      avgScore: completed > 0 ? Number((sumScores / completed).toFixed(2)) : null,
    };
  }, [baseEmployees, selectedTerm]);

  const stageCounts = useMemo(
    () =>
      perfStages.map((st) => ({
        stage: st,
        count: baseEmployees.filter((e) => e.performanceRecords[activePeriod]?.stage === st).length,
      })),
    [activePeriod, baseEmployees, perfStages]
  );

  const termEvalEmployee: Employee | null = useMemo(
    () => employees.find((e) => e.id === termEvalEmpId) ?? null,
    [employees, termEvalEmpId]
  );

  const editingEmployee: Employee | null = useMemo(
    () => employees.find((e) => e.id === editingEmpId) ?? null,
    [editingEmpId, employees]
  );

  const openScoringModal = (emp: Employee) => {
    const rec = emp.performanceRecords[activePeriod];
    setEditingEmpId(emp.id);
    setDraftKpis(rec ? rec.kpis.map((k) => ({ ...k })) : []);
    setDraftStage(rec?.stage ?? perfStages[0] ?? 'Hedef Belirleme');
    setDraftSummary(rec?.managerSummary ?? '');
    setUseCalibration(typeof rec?.calibratedScore === 'number');
    setDraftCalibratedScore(rec?.calibratedScore ?? rec?.calculatedScore ?? 80);
    setDraftCalibrationNote(rec?.calibrationNote ?? '');
    setFormError(null);
  };

  const totalWeight = useMemo(
    () => draftKpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0),
    [draftKpis]
  );

  const draftWeightedScore = useMemo(() => calculateWeightedKpiScore(draftKpis), [draftKpis]);

  const handleAddKpiRow = () => {
    const remaining = Math.max(0, 100 - totalWeight);
    setDraftKpis((prev) => [
      ...prev,
      {
        id: `kpi-${Date.now()}`,
        title: '',
        category: 'KPI',
        weight: remaining > 0 ? remaining : 10,
        targetValue: 100,
        actualValue: 85,
        unit: '%',
        selfScore: 85,
        managerScore: 85,
        managerComment: '',
      },
    ]);
  };

  const handleUpdateKpi = <K extends keyof KPIItem>(index: number, field: K, value: KPIItem[K]) => {
    setDraftKpis((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveKpi = (index: number) => {
    setDraftKpis((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    if (draftKpis.length === 0) {
      setFormError('En az bir KPI veya OKR hedefi tanımlanmalıdır.');
      return;
    }
    if (draftKpis.some((k) => !k.title.trim())) {
      setFormError('Tüm hedefler için başlık alanı doldurulmalıdır.');
      return;
    }
    if (totalWeight !== 100) {
      setFormError(`Hedef ağırlıkları toplamı tam olarak %100 olmalıdır (Mevcut: %${totalWeight}).`);
      return;
    }
    if (useCalibration && role === 'ADMIN' && !draftCalibrationNote.trim()) {
      setFormError('Kalibrasyon puanı değişikliği için zorunlu gerekçe notu girilmelidir.');
      return;
    }

    saveEmployeeKpis(
      editingEmployee.id,
      activePeriod,
      draftKpis,
      draftStage,
      draftSummary,
      useCalibration && role === 'ADMIN' ? draftCalibratedScore : undefined,
      useCalibration && role === 'ADMIN' ? draftCalibrationNote.trim() : undefined
    );
    setEditingEmpId(null);
  };

  const handleExportExcel = () => {
    exportWorkbookToXlsx(`bireysel-performans-${activePeriod.replace(/\s+/g, '-')}.xlsx`, [
      {
        name: 'EK-13 Dönem Sonuçları',
        headers: [
          'Sicil No',
          'Ad Soyad',
          'Departman',
          'Unvan',
          '1. Dönem (5.00)',
          '2. Dönem (5.00)',
          '3. Dönem (5.00)',
          'Yıllık Sonuç (5.00)',
          'Yıllık Sınıflandırma',
          `${selectedTerm} Durum`,
          `${selectedTerm} Kanıt Notu`,
        ],
        rows: visibleEmployees.map((emp) => {
          const s = getEmployeeTermSummary(emp);
          const curRec = emp.termEvaluations?.[selectedTerm];
          const noteCount = countFilledDimensionNotes(curRec?.dimensionNotes);
          return [
            emp.sicilNo,
            emp.fullName,
            emp.department,
            emp.title,
            s.t1 !== null ? Number(s.t1.toFixed(2)) : '-',
            s.t2 !== null ? Number(s.t2.toFixed(2)) : '-',
            s.t3 !== null ? Number(s.t3.toFixed(2)) : '-',
            s.annualScore !== null ? Number(s.annualScore.toFixed(2)) : '-',
            s.annualBand?.label ?? '-',
            curRec?.status ?? 'Taslak',
            `${noteCount}/${PERFORMANCE_DIMENSIONS.length}`,
          ];
        }),
      },
      {
        name: 'OKR ve KPI Özeti',
        headers: [
          'Sicil No',
          'Ad Soyad',
          'Departman',
          'Dönem Aşaması',
          'Hedef Sayısı',
          'Ağırlıklı Puan',
          'Kalibre Puan',
          'Nihai Puan',
        ],
        rows: visibleEmployees.map((emp) => {
          const rec = emp.performanceRecords[activePeriod];
          const eff = getEffectivePerformanceScore(emp, activePeriod);
          return [
            emp.sicilNo,
            emp.fullName,
            emp.department,
            rec?.stage ?? '-',
            rec?.kpis.length ?? 0,
            Number((rec?.calculatedScore ?? 0).toFixed(1)),
            typeof rec?.calibratedScore === 'number'
              ? Number(rec.calibratedScore.toFixed(1))
              : '-',
            Number(eff.toFixed(1)),
          ];
        }),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Bireysel Performans Değerlendirme Süreci
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            {moduleView === 'ek13'
              ? 'Yılda 3 Dönem · 6 Sabit Performans Boyutu (EK-13/14), Boyut Bazlı Zorunlu Kanıt/Yorum Notu, Sorumluluk Beyanı ve EK-15 Sınıflandırma'
              : `${activePeriod} · Ağırlıklı hedef yönetimi (%100 doğrulama), ${perfStages.length} aşamalı değerlendirme akışı ve İK kalibrasyonu`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-0.5 bg-slate-200/75 rounded-lg">
            <button
              type="button"
              onClick={() => setModuleView('ek13')}
              className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                moduleView === 'ek13'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 Boyutlu Değerlendirme (EK-13/14)
            </button>
            <button
              type="button"
              onClick={() => setModuleView('okr')}
              className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                moduleView === 'okr'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              OKR & KPI Hedefleri
            </button>
          </div>

          {platformConfig.features.enableCsvExport && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-[13px] font-semibold text-emerald-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Excel Raporu (.xlsx)
            </button>
          )}
        </div>
      </div>

      {moduleView === 'ek13' ? (
        <>
          {/* 3-Term Selector & EK-15 Legend Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[12.5px] font-semibold text-slate-700">
                Aktif Değerlendirme Dönemi:
              </span>
              <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                {PERFORMANCE_TERM_KEYS.map((termKey) => (
                  <button
                    key={termKey}
                    type="button"
                    onClick={() => setSelectedTerm(termKey)}
                    className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                      selectedTerm === termKey
                        ? 'bg-[#C8102E] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {termKey}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-slate-500">
                ({PERFORMANCE_DIMENSIONS.length} Sabit Boyut · Yıllık Sonuç = 3 Dönem Ortalaması)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold">
              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                1.00–2.49 Riskli Grup
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                2.50–3.49 Gelişim Grubu
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                3.50–5.00 Beklenen Seviye
              </span>
            </div>
          </div>

          {/* Interactive Classification Summary Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => setBandFilter('ALL')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                bandFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className={`text-[11.5px] font-medium ${
                  bandFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {selectedTerm} Tamamlanan
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-mono tabular-nums text-xl font-bold">
                  {ek13Summary.completed}/{ek13Summary.total}
                </span>
                <span
                  className={`font-mono text-[12px] ${
                    bandFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Ort: {ek13Summary.avgScore !== null ? ek13Summary.avgScore.toFixed(2) : '—'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBandFilter(bandFilter === 'Beklenen Seviye' ? 'ALL' : 'Beklenen Seviye')
              }
              className={`p-3.5 rounded-xl border text-left transition-all ${
                bandFilter === 'Beklenen Seviye'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div
                className={`text-[11.5px] font-semibold ${
                  bandFilter === 'Beklenen Seviye' ? 'text-emerald-100' : 'text-emerald-700'
                }`}
              >
                Beklenen Seviye (3.50–5.00)
              </div>
              <div className="mt-1 font-mono tabular-nums text-xl font-bold">
                {ek13Summary.expected}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBandFilter(bandFilter === 'Gelişim Grubu' ? 'ALL' : 'Gelişim Grubu')
              }
              className={`p-3.5 rounded-xl border text-left transition-all ${
                bandFilter === 'Gelişim Grubu'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white border-slate-200 hover:border-amber-300'
              }`}
            >
              <div
                className={`text-[11.5px] font-semibold ${
                  bandFilter === 'Gelişim Grubu' ? 'text-amber-100' : 'text-amber-800'
                }`}
              >
                Gelişim Grubu (2.50–3.49)
              </div>
              <div className="mt-1 font-mono tabular-nums text-xl font-bold">
                {ek13Summary.development}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBandFilter(bandFilter === 'Riskli Grup' ? 'ALL' : 'Riskli Grup')
              }
              className={`p-3.5 rounded-xl border text-left transition-all ${
                bandFilter === 'Riskli Grup'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white border-slate-200 hover:border-rose-300'
              }`}
            >
              <div
                className={`text-[11.5px] font-semibold ${
                  bandFilter === 'Riskli Grup' ? 'text-rose-100' : 'text-rose-700'
                }`}
              >
                Riskli Grup (1.00–2.49)
              </div>
              <div className="mt-1 font-mono tabular-nums text-xl font-bold">
                {ek13Summary.risky}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setBandFilter(bandFilter === 'BEKLEYEN' ? 'ALL' : 'BEKLEYEN')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                bandFilter === 'BEKLEYEN'
                  ? 'bg-[#C8102E] text-white border-[#C8102E]'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className={`text-[11.5px] font-medium ${
                  bandFilter === 'BEKLEYEN' ? 'text-rose-100' : 'text-slate-500'
                }`}
              >
                {selectedTerm} Değerlendirme Bekleyen
              </div>
              <div className="mt-1 font-mono tabular-nums text-xl font-bold">
                {ek13Summary.pending}
              </div>
            </button>
          </section>

          {/* EK-13 / EK-14 / EK-15 Employee Performance Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#C8102E]" />
                <h2 className="font-display text-[15px] font-bold text-slate-900">
                  {selectedTerm} Performans Değerlendirme Listesi ({visibleEmployees.length})
                </h2>
                {bandFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setBandFilter('ALL')}
                    className="text-[12px] text-[#C8102E] hover:underline ml-2"
                  >
                    Filtreyi Temizle ({bandFilter === 'BEKLEYEN' ? 'Bekleyenler' : bandFilter})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Personel, sicil veya unvan..."
                    className="h-8.5 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E] w-56"
                  />
                </div>

                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="ALL">Tüm Birimler</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">Personel</th>
                    <th className="py-2.5 px-3">Birim</th>
                    <th className="py-2.5 px-3 text-right">1. Dönem</th>
                    <th className="py-2.5 px-3 text-right">2. Dönem</th>
                    <th className="py-2.5 px-3 text-right">3. Dönem</th>
                    <th className="py-2.5 px-3">{selectedTerm} Sonucu</th>
                    <th className="py-2.5 px-3">Yıllık Sonuç (EK-15)</th>
                    <th className="py-2.5 px-3 text-center">Kanıt Notu</th>
                    <th className="py-2.5 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px]">
                  {visibleEmployees.map((emp) => {
                    const summary = getEmployeeTermSummary(emp);
                    const activeTermRec = emp.termEvaluations?.[selectedTerm];
                    const activeTermDone =
                      activeTermRec?.status === 'Tamamlandı' &&
                      typeof activeTermRec.termScore === 'number';
                    const activeTermBand = activeTermDone
                      ? classifyPerformanceScore(activeTermRec.termScore)
                      : null;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => openEmployeeDrawer(emp.id)}
                            className="flex items-center gap-2.5 text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11.5px] flex items-center justify-center shrink-0">
                              {getInitials(emp.fullName)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-[#C8102E] transition-colors">
                                {emp.fullName}
                              </div>
                              <div className="text-[11.5px] text-slate-500">
                                <span className="font-mono">{emp.sicilNo}</span> · {emp.title}
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                          {emp.department}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {summary.t1 !== null ? summary.t1.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {summary.t2 !== null ? summary.t2.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {summary.t3 !== null ? summary.t3.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-3">
                          {activeTermDone && activeTermBand ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className="font-mono tabular-nums font-bold text-slate-900">
                                {activeTermRec.termScore!.toFixed(2)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${activeTermBand.badgeClass}`}
                              >
                                {activeTermBand.label}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[12px] font-medium text-amber-700">
                              Bekliyor
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {summary.annualScore !== null && summary.annualBand ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className="font-mono tabular-nums font-bold text-slate-900">
                                {summary.annualScore.toFixed(2)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${summary.annualBand.badgeClass}`}
                              >
                                {summary.annualBand.label}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {(() => {
                            const noteCount = countFilledDimensionNotes(activeTermRec?.dimensionNotes);
                            return (
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-[12px] font-semibold ${
                                  noteCount === PERFORMANCE_DIMENSIONS.length
                                    ? 'text-emerald-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                <MessageSquareText className="w-3.5 h-3.5" />
                                {noteCount}/{PERFORMANCE_DIMENSIONS.length}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setTermEvalEmpId(emp.id)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              activeTermDone
                                ? 'border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-slate-700'
                                : 'bg-[#C8102E] hover:bg-[#A60D26] text-white'
                            }`}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            {role === 'EMPLOYEE'
                              ? 'Sonucu İncele'
                              : activeTermDone
                              ? 'İncele / Düzenle'
                              : 'Değerlendir'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleEmployees.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-[13px] text-slate-500">
                        Seçili filtrelere uygun personel kaydı bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Dynamic OKR/KPI Workflow Pipeline Filter Bar */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {stageCounts.map((item, idx) => {
              const active = stageFilter === item.stage;
              return (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => setStageFilter(active ? 'ALL' : item.stage)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-[#C8102E] text-white border-[#C8102E] shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className={active ? 'text-rose-100' : 'text-slate-400'}>
                      0{idx + 1}. Aşama
                    </span>
                    <span
                      className={`font-bold text-[14px] tabular-nums ${
                        active ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                  <div
                    className={`mt-1 text-[12.5px] font-semibold truncate ${
                      active ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {item.stage}
                  </div>
                </button>
              );
            })}
          </section>

          {/* Main OKR/KPI Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#C8102E]" />
                <h2 className="font-display text-[15px] font-bold text-slate-900">
                  Dönem OKR & KPI Hedef Listesi ({visibleEmployees.length})
                </h2>
                {stageFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setStageFilter('ALL')}
                    className="text-[12px] text-[#C8102E] hover:underline ml-2"
                  >
                    Aşama Filtresini Temizle ({stageFilter})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Personel, sicil veya unvan..."
                    className="h-8.5 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E] w-56"
                  />
                </div>

                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="ALL">Tüm Birimler</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">Personel</th>
                    <th className="py-2.5 px-4">Birim</th>
                    <th className="py-2.5 px-4">İş Akışı Aşaması</th>
                    <th className="py-2.5 px-4 text-right">Hedef / Ağırlık</th>
                    <th className="py-2.5 px-4 text-right">Ağırlıklı Puan</th>
                    <th className="py-2.5 px-4 text-right">Nihai / Kalibre</th>
                    <th className="py-2.5 px-4 text-right">Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px]">
                  {visibleEmployees.map((emp) => {
                    const rec = emp.performanceRecords[activePeriod];
                    const stageIdx = perfStages.indexOf(
                      rec?.stage ?? perfStages[0] ?? 'Hedef Belirleme'
                    );
                    const nextStage =
                      stageIdx >= 0 && stageIdx < perfStages.length - 1
                        ? perfStages[stageIdx + 1]
                        : null;
                    const effectiveScore = getEffectivePerformanceScore(emp, activePeriod);
                    const weightSum = rec?.kpis.reduce((s, k) => s + k.weight, 0) ?? 0;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => openEmployeeDrawer(emp.id)}
                            className="flex items-center gap-2.5 text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11.5px] flex items-center justify-center shrink-0">
                              {getInitials(emp.fullName)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-[#C8102E] transition-colors">
                                {emp.fullName}
                              </div>
                              <div className="text-[11.5px] text-slate-500">
                                <span className="font-mono">{emp.sicilNo}</span> · {emp.title}
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{emp.department}</td>
                        <td className="py-3 px-4">
                          <div className="text-[12.5px] font-medium text-slate-800">
                            {rec?.stage}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            {perfStages.map((st, idx) => (
                              <span
                                key={st}
                                className={`h-1.5 w-6 rounded-full ${
                                  idx <= stageIdx ? 'bg-[#C8102E]' : 'bg-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[12.5px] text-slate-700">
                          {rec?.kpis.length ?? 0} Hedef · %{weightSum}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {rec?.calculatedScore.toFixed(1) ?? '0.0'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono tabular-nums font-bold text-slate-900">
                            {effectiveScore.toFixed(1)}
                          </div>
                          {typeof rec?.calibratedScore === 'number' && (
                            <div className="text-[11px] font-medium text-amber-700">
                              Kalibre Edildi
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openScoringModal(emp)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-[12px] font-medium text-slate-700 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Hedef & Puanla
                            </button>
                            {nextStage && role !== 'EMPLOYEE' && (
                              <button
                                type="button"
                                onClick={() =>
                                  advancePerformanceStage(emp.id, activePeriod, nextStage)
                                }
                                title={`Sonraki Aşama: ${nextStage}`}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                İlerlet
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* EK-13 / EK-14 / EK-15 Evaluation Modal */}
      {termEvalEmployee && (
        <PerformanceTermEvalModal
          employee={termEvalEmployee}
          initialTerm={selectedTerm}
          evaluatorName={currentRoleActorName}
          readOnly={role === 'EMPLOYEE'}
          onClose={() => setTermEvalEmpId(null)}
          onSave={savePerformanceTermEvaluation}
        />
      )}

      {/* Interactive OKR/KPI & Calibration Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setEditingEmpId(null)}
          />
          <form
            onSubmit={handleSaveModal}
            className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4 shrink-0">
              <div>
                <div className="text-[12px] text-slate-500">
                  {activePeriod} · <span className="font-mono">{editingEmployee.sicilNo}</span> ·{' '}
                  {editingEmployee.department}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {editingEmployee.fullName} — OKR/KPI Hedef ve Puanlama Kartı
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmpId(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-[13px] text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Workflow Stage & Live Score Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="block text-[11.5px] font-semibold text-slate-500 mb-1.5">
                    Değerlendirme İş Akışı Aşaması
                  </label>
                  <select
                    value={draftStage}
                    disabled={role === 'EMPLOYEE'}
                    onChange={(e) => setDraftStage(e.target.value as PerformanceWorkflowStage)}
                    className="w-full h-9 px-2.5 text-[13px] bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#C8102E] disabled:opacity-60"
                  >
                    {perfStages.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11.5px] font-semibold text-slate-500">
                    Toplam Hedef Ağırlığı
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`font-mono tabular-nums text-xl font-bold ${
                        totalWeight === 100 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      %{totalWeight}
                    </span>
                    <span className="text-[12px] text-slate-500">
                      {totalWeight === 100 ? 'Doğrulandı' : 'Tam %100 olmalı'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11.5px] font-semibold text-slate-500">
                    Otomatik Ağırlıklı Puan
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono tabular-nums text-xl font-bold text-slate-900">
                      {draftWeightedScore.toFixed(1)}
                    </span>
                    {useCalibration && role === 'ADMIN' && (
                      <span className="text-[12px] font-mono font-semibold text-[#C8102E]">
                        → Kalibre: {draftCalibratedScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Weighted KPI / OKR List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-[14px] font-bold text-slate-900">
                    Ağırlıklı Hedef ve Gerçekleşme Karşılaştırması
                  </h4>
                  {role !== 'EMPLOYEE' && (
                    <button
                      type="button"
                      onClick={handleAddKpiRow}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Yeni Hedef Ekle
                    </button>
                  )}
                </div>

                {draftKpis.map((kpi, idx) => {
                  const realizationPct =
                    kpi.targetValue > 0
                      ? Math.round((kpi.actualValue / kpi.targetValue) * 100)
                      : 0;
                  return (
                    <div
                      key={kpi.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <select
                          value={kpi.category}
                          disabled={role === 'EMPLOYEE'}
                          onChange={(e) =>
                            handleUpdateKpi(idx, 'category', e.target.value as 'OKR' | 'KPI')
                          }
                          className="h-8.5 px-2 text-[12px] font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        >
                          <option value="KPI">KPI</option>
                          <option value="OKR">OKR</option>
                        </select>

                        <input
                          type="text"
                          value={kpi.title}
                          disabled={role === 'EMPLOYEE'}
                          onChange={(e) => handleUpdateKpi(idx, 'title', e.target.value)}
                          placeholder="Hedef başlığı..."
                          className="flex-1 min-w-[200px] h-8.5 px-3 text-[13px] font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] disabled:bg-slate-50"
                        />

                        <div className="flex items-center gap-1.5">
                          <label className="text-[11.5px] text-slate-500">Ağırlık (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={kpi.weight}
                            disabled={role === 'EMPLOYEE'}
                            onChange={(e) =>
                              handleUpdateKpi(idx, 'weight', Math.max(0, Number(e.target.value)))
                            }
                            className="w-16 h-8.5 px-2 text-right font-mono text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                          />
                        </div>

                        {role !== 'EMPLOYEE' && draftKpis.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKpi(idx)}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                            title="Hedefi sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[12px]">
                        <div>
                          <label className="block text-slate-500 mb-1">
                            Hedef Değer ({kpi.unit})
                          </label>
                          <input
                            type="number"
                            value={kpi.targetValue}
                            disabled={role === 'EMPLOYEE'}
                            onChange={(e) =>
                              handleUpdateKpi(idx, 'targetValue', Number(e.target.value))
                            }
                            className="w-full h-8.5 px-2.5 font-mono border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#C8102E]"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Gerçekleşen</label>
                          <input
                            type="number"
                            value={kpi.actualValue}
                            onChange={(e) =>
                              handleUpdateKpi(idx, 'actualValue', Number(e.target.value))
                            }
                            className="w-full h-8.5 px-2.5 font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#C8102E]"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Gerçekleşme %</label>
                          <div className="h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center font-mono font-semibold text-slate-800">
                            %{realizationPct}
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Öz Değerlendirme</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={kpi.selfScore}
                            onChange={(e) =>
                              handleUpdateKpi(
                                idx,
                                'selfScore',
                                Math.max(0, Math.min(100, Number(e.target.value)))
                              )
                            }
                            className="w-full h-8.5 px-2.5 font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#C8102E]"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Yönetici Puanı</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={role === 'EMPLOYEE'}
                            value={kpi.managerScore}
                            onChange={(e) =>
                              handleUpdateKpi(
                                idx,
                                'managerScore',
                                Math.max(0, Math.min(100, Number(e.target.value)))
                              )
                            }
                            className="w-full h-8.5 px-2.5 font-mono font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#C8102E] disabled:bg-slate-50"
                          />
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={kpi.managerComment}
                          disabled={role === 'EMPLOYEE'}
                          onChange={(e) => handleUpdateKpi(idx, 'managerComment', e.target.value)}
                          placeholder="Yönetici hedef değerlendirme notu..."
                          className="w-full h-8.5 px-3 text-[12.5px] bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#C8102E]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Manager General Feedback */}
              <div>
                <label className="block text-[12.5px] font-semibold text-slate-800 mb-1.5">
                  Dönem Sonu Yönetici Değerlendirme Özeti
                </label>
                <textarea
                  rows={2}
                  disabled={role === 'EMPLOYEE'}
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  className="w-full p-3 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#C8102E] disabled:bg-slate-50"
                  placeholder="Genel performans geri bildirimi ve gelişim notları..."
                />
              </div>

              {/* HR Admin Calibration Override Section */}
              {role === 'ADMIN' && platformConfig.features.enableCalibrationOverride && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-amber-700" />
                      <div>
                        <div className="text-[13.5px] font-bold text-slate-900">
                          Kalibrasyon Puanı Düzenle (İK Yöneticisi Yetkisi)
                        </div>
                        <div className="text-[12px] text-slate-600">
                          Kalibrasyon kurulu kararı ile ağırlıklı puan üzerinde gerekçeli düzeltme yapın
                        </div>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCalibration}
                        onChange={(e) => {
                          setUseCalibration(e.target.checked);
                          if (e.target.checked) {
                            setDraftCalibratedScore(draftWeightedScore);
                          }
                        }}
                        className="w-4 h-4 accent-[#C8102E]"
                      />
                      Kalibrasyon Aktif
                    </label>
                  </div>

                  {useCalibration && (
                    <div className="pt-2 space-y-3 border-t border-amber-200/70">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={40}
                          max={100}
                          step={0.5}
                          value={draftCalibratedScore}
                          onChange={(e) => setDraftCalibratedScore(Number(e.target.value))}
                          className="flex-1 accent-[#C8102E]"
                        />
                        <div className="w-24 text-right font-mono tabular-nums text-lg font-bold text-[#C8102E]">
                          {draftCalibratedScore.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-slate-800 mb-1">
                          Zorunlu Kalibrasyon Gerekçe Notu *
                        </label>
                        <input
                          type="text"
                          value={draftCalibrationNote}
                          onChange={(e) => setDraftCalibrationNote(e.target.value)}
                          placeholder="Örn: Bölge geneli puan dağılım dengesi ve kritik proje liderliği katkısı..."
                          className="w-full h-9 px-3 text-[13px] bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-[#C8102E]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <div className="text-[12px] text-slate-500">
                Kaydedilen değişiklikler Nine-Box ve Terfi Kural Motoruna anlık yansır.
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingEmpId(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Değerlendirmeyi Kaydet
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

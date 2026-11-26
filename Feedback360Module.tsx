import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CheckCircle2,
  ClipboardEdit,
  Download,
  Plus,
  Radar,
  Search,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTalentStore } from './TalentStore';
import { CompetencyDefinition, RaterAssignment, RaterRelation } from './talent';
import {
  calculate360Analytics,
  formatTrDate,
  getApplicableCompetencies,
  getInitials,
  scaleLevelToScore100,
  score100ToScaleValue,
} from './calculations';
import { exportWorkbookToXlsx } from './excelExport';

const RELATION_LABELS: Record<RaterRelation, string> = {
  MANAGER: 'Üst Yönetici',
  SELF: 'Öz Değerlendirme',
  PEER: 'Eş Düzey / Çalışma Arkadaşı',
  SUBORDINATE: 'Ast / Ekip Üyesi',
  INTERNAL_CUSTOMER: 'İç Müşteri / Paydaş',
};

export const Feedback360Module: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    employees,
    competencies,
    rules,
    platformConfig,
    role,
    currentRoleEmployeeId,
    addCompetency,
    toggleCompetencyActive,
    deleteCompetency,
    addRaterToEmployee,
    removeRaterFromEmployee,
    sendRaterReminder,
    submitRaterEvaluation,
    openEmployeeDrawer,
    openSettingsTab,
  } = useTalentStore();

  const [activeTab, setActiveTab] = useState<'matrix' | 'library'>('matrix');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [focusedEmpId, setFocusedEmpId] = useState<string>('emp-06');

  // Modals
  const [raterModalEmpId, setRaterModalEmpId] = useState<string | null>(null);
  const [newRaterName, setNewRaterName] = useState('');
  const [newRaterTitle, setNewRaterTitle] = useState('');
  const [newRaterRelation, setNewRaterRelation] = useState<RaterRelation>('PEER');

  const [evalModal, setEvalModal] = useState<{ empId: string; rater: RaterAssignment } | null>(
    null
  );
  // Dynamic sub-KPI scale ratings: subKpiId (or compId fallback) -> scale level value
  const [indicatorRatings, setIndicatorRatings] = useState<Record<string, number>>({});
  const [evalComment, setEvalComment] = useState('');

  // Quick competency library form
  const [compName, setCompName] = useState('');
  const [compCat, setCompCat] =
    useState<CompetencyDefinition['category']>('Liderlik Yetkinliği');
  const [compDesc, setCompDesc] = useState('');
  const [compTarget, setCompTarget] = useState(80);
  const [compRoleGroups, setCompRoleGroups] = useState<string[]>(platformConfig.roleGroupCatalog);
  const [compSubKpi, setCompSubKpi] = useState('');

  useEffect(() => {
    setCompRoleGroups(platformConfig.roleGroupCatalog);
  }, [platformConfig.roleGroupCatalog]);

  const scaleLevels = platformConfig.scale360.levels;
  const maxScaleCoeff = useMemo(
    () => Math.max(...scaleLevels.map((l) => l.coefficient), 1),
    [scaleLevels]
  );
  const midScaleLevel = useMemo(
    () => scaleLevels[Math.floor(scaleLevels.length / 2)]?.value ?? scaleLevels[0]?.value ?? 3,
    [scaleLevels]
  );

  const visibleEmployees = useMemo(() => {
    const base =
      role === 'EMPLOYEE'
        ? employees.filter((e) => e.id === currentRoleEmployeeId)
        : employees;
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return base.filter((emp) => {
      if (deptFilter !== 'ALL' && emp.department !== deptFilter) return false;
      if (
        q &&
        !emp.fullName.toLocaleLowerCase('tr-TR').includes(q) &&
        !emp.sicilNo.toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [currentRoleEmployeeId, deptFilter, employees, role, search]);

  const focusedEmployee = useMemo(() => {
    const found = visibleEmployees.find((e) => e.id === focusedEmpId);
    return found ?? visibleEmployees[0] ?? null;
  }, [focusedEmpId, visibleEmployees]);

  const focusedAnalytics = useMemo(
    () => (focusedEmployee ? calculate360Analytics(focusedEmployee, competencies, rules) : null),
    [competencies, focusedEmployee, rules]
  );

  const raterModalEmployee = useMemo(
    () => employees.find((e) => e.id === raterModalEmpId) ?? null,
    [employees, raterModalEmpId]
  );

  const evalModalEmployee = useMemo(
    () => (evalModal ? employees.find((e) => e.id === evalModal.empId) ?? null : null),
    [employees, evalModal]
  );

  const evalModalCompetencies = useMemo(
    () =>
      evalModalEmployee ? getApplicableCompetencies(evalModalEmployee, competencies) : [],
    [competencies, evalModalEmployee]
  );

  const departments = useMemo(
    () =>
      Array.from(new Set([...platformConfig.departments, ...employees.map((e) => e.department)])),
    [employees, platformConfig.departments]
  );

  const handleAddRater = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raterModalEmployee || !newRaterName.trim()) return;
    addRaterToEmployee(
      raterModalEmployee.id,
      newRaterName.trim(),
      newRaterTitle.trim() || 'Dış / Birim Paydaşı',
      newRaterRelation
    );
    setNewRaterName('');
    setNewRaterTitle('');
  };

  const openFillEvalModal = (empId: string, rater: RaterAssignment) => {
    const targetEmp = employees.find((e) => e.id === empId);
    const applicable = targetEmp ? getApplicableCompetencies(targetEmp, competencies) : [];
    const midLevel =
      scaleLevels[Math.floor(scaleLevels.length / 2)]?.value ?? scaleLevels[0]?.value ?? 3;

    const initRatings: Record<string, number> = {};
    applicable.forEach((comp) => {
      const activeIndicators = comp.indicators.filter((i) => i.isActive);
      const existingCompScore = rater.scores[comp.id];
      const fallbackLevel =
        typeof existingCompScore === 'number' && scaleLevels.length > 0
          ? scaleLevels.reduce((closest, lvl) => {
              const target = (existingCompScore / 100) * maxScaleCoeff;
              return Math.abs(lvl.coefficient - target) < Math.abs(closest.coefficient - target)
                ? lvl
                : closest;
            }, scaleLevels[0]).value
          : midLevel;

      if (activeIndicators.length > 0) {
        activeIndicators.forEach((ind) => {
          initRatings[ind.id] = rater.indicatorScores?.[ind.id] ?? fallbackLevel;
        });
      } else {
        initRatings[comp.id] = rater.indicatorScores?.[comp.id] ?? fallbackLevel;
      }
    });

    setIndicatorRatings(initRatings);
    setEvalComment(rater.comment ?? '');
    setEvalModal({ empId, rater });
  };

  // Compute live competency 0-100 scores from dynamic sub-KPI scale selections
  const computedModalScores = useMemo(() => {
    const compScores: Record<string, number> = {};
    let weightedSum = 0;
    let weightTotal = 0;

    evalModalCompetencies.forEach((comp) => {
      const activeIndicators = comp.indicators.filter((i) => i.isActive);
      let score100 = 0;
      if (activeIndicators.length > 0) {
        const subScores = activeIndicators.map((ind) => {
          const val = indicatorRatings[ind.id] ?? midScaleLevel;
          return scaleLevelToScore100(val, scaleLevels);
        });
        score100 =
          Math.round((subScores.reduce((a, b) => a + b, 0) / subScores.length) * 10) / 10;
      } else {
        const val = indicatorRatings[comp.id] ?? midScaleLevel;
        score100 = scaleLevelToScore100(val, scaleLevels);
      }
      compScores[comp.id] = score100;
      const w = comp.weight > 0 ? comp.weight : 1;
      weightedSum += score100 * w;
      weightTotal += w;
    });

    const overall100 = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0;
    const overallScale = score100ToScaleValue(overall100, scaleLevels);
    return { compScores, overall100, overallScale };
  }, [evalModalCompetencies, indicatorRatings, midScaleLevel, scaleLevels]);

  const handleSubmitEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalModal) return;
    submitRaterEvaluation(
      evalModal.empId,
      evalModal.rater.id,
      computedModalScores.compScores,
      evalComment.trim(),
      indicatorRatings
    );
    setEvalModal(null);
  };

  const handleAddCompetency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    addCompetency({
      name: compName.trim(),
      category: compCat,
      description: compDesc.trim() || 'Kurumsal yetkinlik çerçevesi kapsamında tanımlandı.',
      targetScore: compTarget,
      isActive: true,
      weight: 1.0,
      roleGroups:
        compRoleGroups.length > 0 ? compRoleGroups : [...platformConfig.roleGroupCatalog],
      indicators: [
        {
          id: `ind-${Date.now()}-1`,
          text:
            compSubKpi.trim() ||
            `${compName.trim()} yetkinliğini günlük iş süreçlerinde tutarlı biçimde sergiler.`,
          isActive: true,
        },
      ],
    });
    setCompName('');
    setCompDesc('');
    setCompSubKpi('');
    setCompTarget(80);
  };

  const handleExportExcel = () => {
    exportWorkbookToXlsx('360-yetkinlik-ozet.xlsx', [
      {
        name: '360 Yetkinlik',
        headers: [
          'Sicil No',
          'Ad Soyad',
          'Departman',
          'Rol Grubu',
          'Tamamlanma (%)',
          'Ağırlıklı 360 Puanı (100)',
          `Ölçek Karşılığı (${maxScaleCoeff.toFixed(1)})`,
          'Kör Nokta Sayısı',
          'Gizli Güç Sayısı',
        ],
        rows: visibleEmployees.map((emp) => {
          const a = calculate360Analytics(emp, competencies, rules);
          return [
            emp.sicilNo,
            emp.fullName,
            emp.department,
            a.roleGroup,
            a.completionRate,
            Number(a.overallScore.toFixed(1)),
            score100ToScaleValue(a.overallScore, scaleLevels),
            a.blindSpots.length,
            a.hiddenStrengths.length,
          ];
        }),
      },
    ]);
  };

  // SVG Radar Chart Geometry
  const radarSize = 270;
  const cx = radarSize / 2;
  const cy = radarSize / 2;
  const maxR = 92;
  const radarRows = focusedAnalytics?.rows ?? [];

  const getPolygonPoints = (accessor: (r: (typeof radarRows)[number]) => number) => {
    if (radarRows.length < 3) return '';
    return radarRows
      .map((row, idx) => {
        const angle = (Math.PI * 2 * idx) / radarRows.length - Math.PI / 2;
        const radius = (Math.max(0, Math.min(100, accessor(row))) / 100) * maxR;
        return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
      })
      .join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            360 Derece Yetkinlik Değerlendirme
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            5 kaynaklı dinamik değerlendirici matrisi, rol grubuna özel aktif yetkinlikler, kör nokta analizi ve yapılandırılabilir ölçek
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matris & Sonuç Analizi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'library'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yetkinlik Kütüphanesi ({competencies.filter((c) => c.isActive).length}/{competencies.length})
            </button>
          </div>

          {role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => openSettingsTab('config360')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-[12.5px] font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5" />
              Yetkinlik ve KPI Kurgusu
            </button>
          )}

          {platformConfig.features.enableCsvExport && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-[12.5px] font-semibold text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Excel (.xlsx)
            </button>
          )}
        </div>
      </div>

      {/* Dynamic 5-Source Weights & Active Scale Info Strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-slate-600">
          <span className="font-semibold text-slate-900">Aktif 360° Ağırlıkları:</span>
          <span className="font-mono tabular-nums">
            Üst Yönetici <strong className="text-slate-900">%{rules.raterWeights360.MANAGER}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono tabular-nums">
            Öz <strong className="text-slate-900">%{rules.raterWeights360.SELF}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono tabular-nums">
            Eş Düzey <strong className="text-slate-900">%{rules.raterWeights360.PEER}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono tabular-nums">
            Ast/Ekip <strong className="text-slate-900">%{rules.raterWeights360.SUBORDINATE}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono tabular-nums">
            İç Müşteri <strong className="text-slate-900">%{rules.raterWeights360.INTERNAL_CUSTOMER}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-700 font-medium">{platformConfig.scale360.name}</span>
        </div>
        {role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => openSettingsTab('config360')}
            className="text-[12px] font-semibold text-[#C8102E] hover:underline whitespace-nowrap"
          >
            Kurguları Düzenle
          </button>
        )}
      </div>

      {activeTab === 'matrix' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Employee 360 Tracking List */}
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#C8102E]" />
                  Değerlendirme Katılım Takibi ({visibleEmployees.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Çalışan ara..."
                    className="w-full h-8.5 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E]"
                  />
                </div>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-8.5 px-2.5 text-[12px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="ALL">Tüm Birimler</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {visibleEmployees.map((emp) => {
                const a = calculate360Analytics(emp, competencies, rules);
                const selected = focusedEmployee?.id === emp.id;
                const scaleEq = score100ToScaleValue(a.overallScore, scaleLevels);
                return (
                  <div
                    key={emp.id}
                    onClick={() => setFocusedEmpId(emp.id)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      selected ? 'bg-rose-50/45' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg text-[11.5px] font-semibold flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-[#C8102E] text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {getInitials(emp.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-900 truncate">
                            {emp.fullName}
                          </div>
                          <div className="text-[11.5px] text-slate-500 truncate">
                            {emp.department} · <span className="font-medium text-indigo-700">{a.roleGroup}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-[14px] font-bold text-slate-900">
                          {a.overallScore.toFixed(1)}
                          <span className="text-[11px] font-normal text-slate-400 ml-1">
                            ({scaleEq.toFixed(2)}/{maxScaleCoeff.toFixed(0)})
                          </span>
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {a.completedCount}/{a.totalCount} form · {a.rows.length} yetkinlik
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            a.completionRate === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${a.completionRate}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 w-9 text-right">
                        %{a.completionRate}
                      </span>
                      {role !== 'EMPLOYEE' &&
                        (currentUser?.permissions.actions.canManage360Raters ?? true) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRaterModalEmpId(emp.id);
                            }}
                            className="text-[11.5px] font-semibold text-[#C8102E] hover:underline whitespace-nowrap"
                          >
                            Matris Yönet
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed 360 Results & Gap Analysis */}
          {focusedEmployee && focusedAnalytics ? (
            <div className="xl:col-span-7 space-y-5">
              {/* Employee Summary & Radar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                      <span className="font-mono">{focusedEmployee.sicilNo}</span>
                      <span>·</span>
                      <span>{focusedEmployee.department}</span>
                      <span>·</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                        {focusedAnalytics.roleGroup} ({focusedAnalytics.rows.length} Aktif Yetkinlik)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEmployeeDrawer(focusedEmployee.id)}
                      className="font-display text-lg font-bold text-slate-900 hover:text-[#C8102E] text-left mt-0.5"
                    >
                      {focusedEmployee.fullName} — 360° Yetkinlik & Boşluk Analizi
                    </button>
                    <div className="mt-1 text-[11.5px] text-slate-500 font-mono tabular-nums">
                      Normalize Ağırlık: Üst Yönetici %{focusedAnalytics.normalizedWeights.MANAGER} · Öz %{focusedAnalytics.normalizedWeights.SELF} · Eş Düzey %{focusedAnalytics.normalizedWeights.PEER} · Ast %{focusedAnalytics.normalizedWeights.SUBORDINATE} · İç Müşteri %{focusedAnalytics.normalizedWeights.INTERNAL_CUSTOMER}
                    </div>
                  </div>

                  {role !== 'EMPLOYEE' &&
                    (currentUser?.permissions.actions.canManage360Raters ?? true) && (
                      <button
                        type="button"
                        onClick={() => setRaterModalEmpId(focusedEmployee.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Değerlendirici Ata / Hatırlat
                      </button>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* SVG Radar Chart */}
                  <div className="md:col-span-6 flex flex-col items-center">
                    <svg
                      viewBox={`0 0 ${radarSize} ${radarSize}`}
                      className="w-64 h-64 overflow-visible"
                    >
                      {[25, 50, 75, 100].map((lvl) => (
                        <circle
                          key={lvl}
                          cx={cx}
                          cy={cy}
                          r={(lvl / 100) * maxR}
                          fill="none"
                          stroke="#E2E8F0"
                          strokeDasharray={lvl === 100 ? undefined : '2 2'}
                        />
                      ))}
                      {radarRows.map((row, idx) => {
                        const angle = (Math.PI * 2 * idx) / radarRows.length - Math.PI / 2;
                        const x2 = cx + Math.cos(angle) * maxR;
                        const y2 = cy + Math.sin(angle) * maxR;
                        const lx = cx + Math.cos(angle) * (maxR + 18);
                        const ly = cy + Math.sin(angle) * (maxR + 18);
                        return (
                          <g key={row.competencyId}>
                            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#E2E8F0" />
                            <text
                              x={lx}
                              y={ly}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="fill-slate-600 text-[9.5px] font-medium"
                            >
                              {row.competencyName.split(' ')[0]}
                            </text>
                          </g>
                        );
                      })}

                      {/* Self Polygon */}
                      <polygon
                        points={getPolygonPoints((r) => r.selfAvg ?? 0)}
                        fill="rgba(100, 116, 139, 0.14)"
                        stroke="#64748B"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                      {/* Weighted Polygon */}
                      <polygon
                        points={getPolygonPoints((r) => r.weightedScore)}
                        fill="rgba(200, 16, 46, 0.16)"
                        stroke="#C8102E"
                        strokeWidth="2"
                      />
                    </svg>
                    <div className="flex items-center gap-4 text-[11.5px] text-slate-600 mt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-[#C8102E]" />
                        360° Ağırlıklı ({focusedAnalytics.overallScore.toFixed(1)} ·{' '}
                        {score100ToScaleValue(focusedAnalytics.overallScore, scaleLevels).toFixed(2)}
                        /{maxScaleCoeff.toFixed(0)})
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-slate-500" />
                        Öz Değ.
                      </span>
                    </div>
                  </div>

                  {/* Blind Spots & Hidden Strengths Summary */}
                  <div className="md:col-span-6 space-y-3">
                    <div className="p-3.5 rounded-xl bg-amber-50/75 border border-amber-200">
                      <div className="text-[12.5px] font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Kör Noktalar (Öz &gt; Diğerleri +8)
                      </div>
                      {focusedAnalytics.blindSpots.length === 0 ? (
                        <p className="text-[12px] text-amber-800/80 mt-1">
                          Belirgin kör nokta tespit edilmedi. Öz algı ile paydaş algısı tutarlı.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1 text-[12px] text-amber-900">
                          {focusedAnalytics.blindSpots.map((b) => (
                            <li key={b.competencyId} className="flex justify-between font-medium">
                              <span>{b.competencyName}</span>
                              <span className="font-mono">+{b.gap.toFixed(1)} fark</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-50/75 border border-emerald-200">
                      <div className="text-[12.5px] font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Gizli Güçler (Diğerleri &gt; Öz +8)
                      </div>
                      {focusedAnalytics.hiddenStrengths.length === 0 ? (
                        <p className="text-[12px] text-emerald-800/80 mt-1">
                          Belirgin gizli güç farkı bulunmuyor.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1 text-[12px] text-emerald-900">
                          {focusedAnalytics.hiddenStrengths.map((h) => (
                            <li key={h.competencyId} className="flex justify-between font-medium">
                              <span>{h.competencyName}</span>
                              <span className="font-mono">{h.gap.toFixed(1)} fark</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5-Source Comparison Matrix Table */}
                <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-3">Yetkinlik (Katsayı)</th>
                        <th className="py-2.5 px-2 text-right">Öz</th>
                        <th className="py-2.5 px-2 text-right">Üst Yön.</th>
                        <th className="py-2.5 px-2 text-right">Eş Düzey</th>
                        <th className="py-2.5 px-2 text-right">Ast</th>
                        <th className="py-2.5 px-2 text-right">İç Müşteri</th>
                        <th className="py-2.5 px-2.5 text-right">Ağırlıklı</th>
                        <th className="py-2.5 px-3 text-right">Analiz</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {focusedAnalytics.rows.map((r) => (
                        <tr key={r.competencyId} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                            {r.competencyName}{' '}
                            <span className="font-mono text-[10.5px] text-slate-400">
                              ({r.weight.toFixed(1)}x)
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600">
                            {r.selfAvg !== null ? r.selfAvg.toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700">
                            {r.managerAvg !== null ? r.managerAvg.toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700">
                            {r.peerAvg !== null ? r.peerAvg.toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700">
                            {r.subordinateAvg !== null ? r.subordinateAvg.toFixed(1) : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-indigo-700">
                            {r.internalCustomerAvg !== null
                              ? r.internalCustomerAvg.toFixed(1)
                              : '—'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">
                            {r.weightedScore.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans text-[11.5px] font-semibold">
                            <span
                              className={
                                r.insight === 'Kör Nokta'
                                  ? 'text-amber-700'
                                  : r.insight === 'Gizli Güç'
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }
                            >
                              {r.insight}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assigned Raters Quick Status List */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-[14.5px] font-bold text-slate-900">
                    Atanmış Değerlendiriciler ({focusedEmployee.raters360.length})
                  </h3>
                  <span className="text-[12px] text-slate-500">
                    Formlar aktif rol grubu yetkinlikleri ve tanımlı ölçekle dinamik açılır
                  </span>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {focusedEmployee.raters360.map((rater) => {
                    const canFillThisForm = role !== 'EMPLOYEE' || rater.relation === 'SELF';
                    return (
                      <div
                        key={rater.id}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px]"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {rater.raterName}{' '}
                            <span className="font-normal text-slate-500">· {rater.raterTitle}</span>
                          </div>
                          <div className="text-[11.5px] text-slate-500">
                            <span className="font-medium text-slate-700">
                              {RELATION_LABELS[rater.relation]}
                            </span>
                            {rater.submittedAt && ` · Tamamlandı: ${formatTrDate(rater.submittedAt)}`}
                            {!rater.completed &&
                              rater.remindedAt &&
                              ` · Son hatırlatma: ${formatTrDate(rater.remindedAt)}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {rater.completed ? (
                            <>
                              <span className="text-[12px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Tamamlandı
                              </span>
                              {canFillThisForm && (
                                <button
                                  type="button"
                                  onClick={() => openFillEvalModal(focusedEmployee.id, rater)}
                                  className="px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 text-slate-600 text-[11.5px] font-medium"
                                >
                                  Güncelle
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {canFillThisForm ? (
                                <button
                                  type="button"
                                  onClick={() => openFillEvalModal(focusedEmployee.id, rater)}
                                  className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11.5px] font-semibold inline-flex items-center gap-1"
                                >
                                  <ClipboardEdit className="w-3.5 h-3.5" />
                                  Formu Doldur
                                </button>
                              ) : (
                                <span className="text-[12px] font-medium text-amber-700">
                                  Değerlendirme Bekleniyor
                                </span>
                              )}
                              {role !== 'EMPLOYEE' && (
                                <button
                                  type="button"
                                  onClick={() => sendRaterReminder(focusedEmployee.id, rater.id)}
                                  className="px-2.5 py-1 rounded-md border border-slate-200 hover:border-[#C8102E] hover:text-[#C8102E] text-slate-700 text-[11.5px] font-medium inline-flex items-center gap-1"
                                >
                                  <BellRing className="w-3.5 h-3.5" />
                                  Hatırlat
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-10 text-center text-[13px] text-slate-500">
              Filtre kriterlerinize uyan personel bulunamadı.
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Competency Library Overview */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[15px] font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#C8102E]" />
                Kurumsal Yetkinlik & Alt KPI Kütüphanesi ({competencies.length})
              </h2>
              {role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => openSettingsTab('config360')}
                  className="text-[12px] font-semibold text-[#C8102E] hover:underline"
                >
                  Detaylı Alt KPI & Ölçek Editörüne Git →
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {competencies.map((comp) => (
                <div
                  key={comp.id}
                  className={`p-4 flex items-start justify-between gap-4 ${
                    comp.isActive ? 'hover:bg-slate-50/70' : 'bg-slate-50/80 opacity-75'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                      <span className="font-semibold text-indigo-700">{comp.category}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-600">
                        Katsayı: {comp.weight.toFixed(1)}x
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-600">
                        Hedef: {comp.targetScore}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`font-semibold ${
                          comp.isActive ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {comp.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <div className="text-[14px] font-bold text-slate-900">{comp.name}</div>
                    <p className="text-[12.5px] text-slate-600">{comp.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {comp.roleGroups.map((rg) => (
                        <span
                          key={rg}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700"
                        >
                          {rg}
                        </span>
                      ))}
                      <span className="text-[11px] text-slate-500 ml-1">
                        · {comp.indicators.filter((i) => i.isActive).length} aktif alt KPI sorusu
                      </span>
                    </div>
                  </div>
                  {role === 'ADMIN' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleCompetencyActive(comp.id)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                        title={comp.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                      >
                        {comp.isActive ? (
                          <ToggleRight className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      {competencies.length > 3 && (
                        <button
                          type="button"
                          onClick={() => deleteCompetency(comp.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Yetkinliği kaldır"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddCompetency}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="font-display text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
              <Radar className="w-4 h-4 text-[#C8102E]" />
              Hızlı Yetkinlik Ekle
            </h3>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Yetkinlik Adı *
              </label>
              <input
                type="text"
                required
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="Örn: Dijital Okuryazarlık ve Veri Analitiği"
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={compCat}
                onChange={(e) =>
                  setCompCat(e.target.value as CompetencyDefinition['category'])
                }
                className="w-full h-9 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
              >
                <option value="Temel Yetkinlik">Temel Yetkinlik</option>
                <option value="Liderlik Yetkinliği">Liderlik Yetkinliği</option>
                <option value="Fonksiyonel Yetkinlik">Fonksiyonel Yetkinlik</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Rol Grupları
              </label>
              <div className="flex flex-wrap gap-1.5">
                {platformConfig.roleGroupCatalog.map((grp) => {
                  const selected = compRoleGroups.includes(grp);
                  return (
                    <button
                      key={grp}
                      type="button"
                      onClick={() =>
                        setCompRoleGroups((prev) =>
                          prev.includes(grp) ? prev.filter((g) => g !== grp) : [...prev, grp]
                        )
                      }
                      className={`px-2.5 py-1 rounded-md border text-[11.5px] font-semibold transition-colors ${
                        selected
                          ? 'bg-[#C8102E] text-white border-[#C8102E]'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {grp}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                İlk Alt KPI / Davranış Göstergesi
              </label>
              <input
                type="text"
                value={compSubKpi}
                onChange={(e) => setCompSubKpi(e.target.value)}
                placeholder="Örn: Veri analiz araçlarıyla raporlama hızını artırır."
                className="w-full h-9 px-3 text-[12.5px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Hedef Yetkinlik Puanı (0–100)
              </label>
              <input
                type="number"
                min={50}
                max={100}
                value={compTarget}
                onChange={(e) => setCompTarget(Number(e.target.value))}
                className="w-full h-9 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Açıklama
              </label>
              <textarea
                rows={2}
                value={compDesc}
                onChange={(e) => setCompDesc(e.target.value)}
                placeholder="Yetkinliğin kurum içi beklenen davranış tanımı..."
                className="w-full p-2.5 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <button
              type="submit"
              disabled={
                role === 'EMPLOYEE' ||
                !(currentUser?.permissions.actions.canManage360Raters ?? true)
              }
              className="w-full py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Kütüphaneye Ekle
            </button>
          </form>
        </div>
      )}

      {/* Modal: Evaluator Matrix Assignment (5 Sources) */}
      {raterModalEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setRaterModalEmpId(null)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-[12px] text-slate-500">
                  360° 5 Kaynaklı Değerlendirici Matrisi
                </div>
                <h3 className="font-display text-[16px] font-bold text-slate-900">
                  {raterModalEmployee.fullName} — Değerlendirici Ekle / Çıkar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRaterModalEmpId(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Add new rater form */}
              <form
                onSubmit={handleAddRater}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3"
              >
                <div className="sm:col-span-4">
                  <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
                    Değerlendirici Ad Soyad *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRaterName}
                    onChange={(e) => setNewRaterName(e.target.value)}
                    placeholder="Örn: Tolga Yalçın"
                    className="w-full h-9 px-2.5 text-[12.5px] bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
                    Unvan / Birim
                  </label>
                  <input
                    type="text"
                    value={newRaterTitle}
                    onChange={(e) => setNewRaterTitle(e.target.value)}
                    placeholder="Örn: Kalite Müdürü"
                    className="w-full h-9 px-2.5 text-[12.5px] bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
                    İlişki Grubu
                  </label>
                  <select
                    value={newRaterRelation}
                    onChange={(e) => setNewRaterRelation(e.target.value as RaterRelation)}
                    className="w-full h-9 px-2 text-[12.5px] bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="MANAGER">Üst Yönetici</option>
                    <option value="PEER">Eş Düzey / Çalışma Arkadaşı</option>
                    <option value="SUBORDINATE">Ast / Ekip Üyesi</option>
                    <option value="INTERNAL_CUSTOMER">İç Müşteri / Paydaş</option>
                  </select>
                </div>
                <div className="sm:col-span-12 flex justify-end">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Matrise Ekle
                  </button>
                </div>
              </form>

              {/* Current Raters List */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {raterModalEmployee.raters360.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-[12.5px]"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {r.raterName}{' '}
                        <span className="font-normal text-slate-500">· {r.raterTitle}</span>
                      </div>
                      <div className="text-[11.5px] text-slate-500">
                        {RELATION_LABELS[r.relation]} ·{' '}
                        {r.completed ? 'Tamamlandı' : 'Değerlendirme Bekleniyor'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!r.completed && (
                        <button
                          type="button"
                          onClick={() => sendRaterReminder(raterModalEmployee.id, r.id)}
                          className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:text-[#C8102E] text-[11.5px] font-medium"
                        >
                          Hatırlat
                        </button>
                      )}
                      {r.relation !== 'SELF' && (
                        <button
                          type="button"
                          onClick={() => removeRaterFromEmployee(raterModalEmployee.id, r.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Çıkar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dynamic 360 Evaluation Form (Role-Filtered Active Competencies + Sub-KPIs + Configured Scale) */}
      {evalModal && evalModalEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={() => setEvalModal(null)}
          />
          <form
            onSubmit={handleSubmitEval}
            className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <div className="text-[12px] text-slate-500">
                  Değerlendirici: <strong>{evalModal.rater.raterName}</strong> (
                  {RELATION_LABELS[evalModal.rater.relation]}) · Ölçek: {platformConfig.scale360.name}
                </div>
                <h3 className="font-display text-[16px] font-bold text-slate-900">
                  {evalModalEmployee.fullName} — 360° Yetkinlik Değerlendirme Formu
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right font-mono tabular-nums">
                  <div className="text-[11px] font-sans text-slate-500">Anlık Form Puanı</div>
                  <div className="text-[15px] font-bold text-[#C8102E]">
                    {computedModalScores.overallScale.toFixed(2)} / {maxScaleCoeff.toFixed(1)}
                    <span className="text-[11.5px] font-normal text-slate-500 ml-1">
                      ({computedModalScores.overall100.toFixed(1)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEvalModal(null)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#F8FAFC]">
              {evalModalCompetencies.map((comp) => {
                const activeIndicators = comp.indicators.filter((i) => i.isActive);
                const compScore100 = computedModalScores.compScores[comp.id] ?? 0;
                const compScale = score100ToScaleValue(compScore100, scaleLevels);

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
                        {compScale.toFixed(2)} / {maxScaleCoeff.toFixed(1)}
                        <span className="text-[11px] font-normal text-slate-400 ml-1">
                          ({compScore100.toFixed(0)})
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {(activeIndicators.length > 0
                        ? activeIndicators
                        : [{ id: comp.id, text: comp.description, isActive: true }]
                      ).map((ind, idx) => {
                        const currentVal = indicatorRatings[ind.id] ?? midScaleLevel;
                        return (
                          <div key={ind.id} className="p-4 space-y-2.5">
                            <div className="text-[12.5px] font-medium text-slate-800">
                              <span className="font-mono text-slate-400 mr-1.5">
                                {idx + 1}.
                              </span>
                              {ind.text}
                            </div>
                            <div
                              className="grid gap-1.5"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(
                                  scaleLevels.length,
                                  7
                                )}, minmax(0, 1fr))`,
                              }}
                            >
                              {scaleLevels.map((lvl) => {
                                const selected = currentVal === lvl.value;
                                return (
                                  <button
                                    key={lvl.value}
                                    type="button"
                                    onClick={() =>
                                      setIndicatorRatings((prev) => ({
                                        ...prev,
                                        [ind.id]: lvl.value,
                                      }))
                                    }
                                    className={`px-2 py-2 rounded-lg border text-center transition-all ${
                                      selected
                                        ? 'bg-[#C8102E] text-white border-[#C8102E] shadow-xs'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="font-mono font-bold text-[13px]">
                                      {lvl.value}
                                    </div>
                                    <div
                                      className={`text-[10px] leading-tight mt-0.5 truncate ${
                                        selected ? 'text-rose-100' : 'text-slate-500'
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

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <label className="block text-[12.5px] font-semibold text-slate-800 mb-1.5">
                  Niteliksel Geribildirim Notu
                </label>
                <textarea
                  rows={2}
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  placeholder="Çalışanın güçlü yönleri ve gelişim önerileri hakkında somut gözlemler..."
                  className="w-full p-2.5 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="text-[12px] text-slate-500">
                Puanlar tanımlı ölçek katsayılarıyla hesaplanıp Nine-Box&apos;a otomatik yansıtılır.
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEvalModal(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700"
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

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Briefcase,
  CheckCircle2,
  Download,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTalentStore } from '../context/TalentStore';
import { NineBoxId } from '../types/talent';
import {
  calculate360Analytics,
  calculateCombinedPotentialIndex,
  formatTrDate,
  getActiveAssignmentForEmployee,
  getEffectiveNineBoxId,
  getEffectivePerformanceScore,
  getInitials,
  getRemainingDays,
  NINE_BOX_GRID_ORDER,
} from '../utils/calculations';
import { exportWorkbookToXlsx } from '../utils/excelExport';

export const DashboardModule: React.FC = () => {
  const {
    employees,
    competencies,
    mobilityRequests,
    assignments,
    rules,
    platformConfig,
    activePeriod,
    role,
    currentRoleEmployeeId,
    setActiveModule,
    jumpToNineBoxWithFilter,
    openEmployeeDrawer,
    approveMobilityStep,
    sendRaterReminder,
  } = useTalentStore();

  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [locFilter, setLocFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Scope employees by active role (Employee sees self, Manager sees direct & indirect team, Admin sees all)
  const scopedEmployees = useMemo(() => {
    if (role === 'EMPLOYEE') {
      return employees.filter((e) => e.id === currentRoleEmployeeId);
    }
    return employees;
  }, [currentRoleEmployeeId, employees, role]);

  const { currentUser } = useAuth();
  const scopedEmployeeIds = useMemo(
    () => new Set(scopedEmployees.map((e) => e.id)),
    [scopedEmployees]
  );

  const enriched = useMemo(() => {
    return scopedEmployees.map((emp) => {
      const perf = getEffectivePerformanceScore(emp, activePeriod);
      const a360 = calculate360Analytics(emp, competencies, rules);
      const pot = calculateCombinedPotentialIndex(emp, a360.overallScore);
      const boxId = getEffectiveNineBoxId(emp, activePeriod, competencies, rules);
      const activeAsg = getActiveAssignmentForEmployee(emp.id, assignments);
      const perfStage =
        emp.performanceRecords[activePeriod]?.stage ??
        platformConfig.performanceStages[0] ??
        'Hedef Belirleme';
      return { emp, perf, a360, pot, boxId, activeAsg, perfStage };
    });
  }, [
    activePeriod,
    assignments,
    competencies,
    platformConfig.performanceStages,
    rules,
    scopedEmployees,
  ]);

  // 6 Executive KPIs
  const kpis = useMemo(() => {
    const total = enriched.length || 1;
    const completedStages = new Set(platformConfig.performanceStages.slice(-2));
    const perfCompleted = enriched.filter((x) => completedStages.has(x.perfStage)).length;
    const perfRate = Math.round((perfCompleted / total) * 100);

    const totalRaters = enriched.reduce((s, x) => s + x.a360.totalCount, 0);
    const doneRaters = enriched.reduce((s, x) => s + x.a360.completedCount, 0);
    const comp360Rate = totalRaters > 0 ? Math.round((doneRaters / totalRaters) * 100) : 0;

    // High Potential pool: Box 1 (Yıldızlar) + Box 2 (Yüksek Potansiyelli Gelişenler) + Box 4 (Güçlü Performans)
    const highPotCount = enriched.filter((x) => x.boxId === 1 || x.boxId === 2 || x.boxId === 4).length;
    const highPotRate = Math.round((highPotCount / total) * 100);

    const activePromotions = mobilityRequests.filter(
      (m) => m.status === 'Devam Ediyor' && scopedEmployeeIds.has(m.employeeId)
    ).length;
    const activeAssignments = assignments.filter(
      (a) => a.status === 'Aktif' && scopedEmployeeIds.has(a.employeeId)
    ).length;

    return {
      totalEmployees: enriched.length,
      perfRate,
      perfCompleted,
      comp360Rate,
      doneRaters,
      totalRaters,
      highPotRate,
      highPotCount,
      activePromotions,
      activeAssignments,
    };
  }, [
    assignments,
    enriched,
    mobilityRequests,
    platformConfig.performanceStages,
    scopedEmployeeIds,
  ]);

  // Department averages for bar chart
  const deptStats = useMemo(() => {
    const deptList = Array.from(
      new Set([...platformConfig.departments, ...enriched.map((x) => x.emp.department)])
    );
    return deptList.map((dept) => {
      const items = enriched.filter((x) => x.emp.department === dept);
      if (!items.length) {
        return { dept, count: 0, avgPerf: 0, avg360: 0 };
      }
      const avgPerf =
        Math.round((items.reduce((s, x) => s + x.perf, 0) / items.length) * 10) / 10;
      const avg360 =
        Math.round((items.reduce((s, x) => s + x.a360.overallScore, 0) / items.length) * 10) / 10;
      return { dept, count: items.length, avgPerf, avg360 };
    });
  }, [enriched, platformConfig.departments]);

  // Nine-Box counts
  const nineBoxCounts = useMemo(() => {
    const map: Record<NineBoxId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    enriched.forEach((x) => {
      map[x.boxId] = (map[x.boxId] || 0) + 1;
    });
    return map;
  }, [enriched]);

  // Action Center Items (scoped to visible employees)
  const pendingPromotions = useMemo(
    () =>
      mobilityRequests.filter(
        (m) => m.status === 'Devam Ediyor' && scopedEmployeeIds.has(m.employeeId)
      ),
    [mobilityRequests, scopedEmployeeIds]
  );

  const overdue360Items = useMemo(() => {
    const relationLabels: Record<string, string> = {
      SELF: 'Öz Değerlendirme',
      MANAGER: 'Üst Yönetici',
      PEER: 'Eş Düzey',
      SUBORDINATE: 'Ast / Ekip Üyesi',
      INTERNAL_CUSTOMER: 'İç Müşteri',
    };
    const list: { empId: string; empName: string; raterId: string; raterName: string; relation: string }[] = [];
    scopedEmployees.forEach((emp) => {
      emp.raters360.forEach((r) => {
        if (!r.completed) {
          list.push({
            empId: emp.id,
            empName: emp.fullName,
            raterId: r.id,
            raterName: r.raterName,
            relation: relationLabels[r.relation] ?? r.relation,
          });
        }
      });
    });
    return list;
  }, [scopedEmployees]);

  const expiringAssignments = useMemo(
    () =>
      assignments
        .filter(
          (a) =>
            a.status === 'Aktif' &&
            scopedEmployeeIds.has(a.employeeId) &&
            getRemainingDays(a.endDate) <= platformConfig.assignmentExpiryWarningDays
        )
        .sort((a, b) => getRemainingDays(a.endDate) - getRemainingDays(b.endDate)),
    [assignments, platformConfig.assignmentExpiryWarningDays, scopedEmployeeIds]
  );

  const departments = useMemo(
    () =>
      Array.from(
        new Set([...platformConfig.departments, ...scopedEmployees.map((e) => e.department)])
      ),
    [platformConfig.departments, scopedEmployees]
  );

  const locations = useMemo(
    () =>
      Array.from(
        new Set([...platformConfig.locations, ...scopedEmployees.map((e) => e.location)])
      ).sort(),
    [platformConfig.locations, scopedEmployees]
  );

  const filteredTable = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return enriched.filter((item) => {
      if (deptFilter !== 'ALL' && item.emp.department !== deptFilter) return false;
      if (locFilter !== 'ALL' && item.emp.location !== locFilter) return false;
      if (
        q &&
        !item.emp.fullName.toLocaleLowerCase('tr-TR').includes(q) &&
        !item.emp.sicilNo.toLocaleLowerCase('tr-TR').includes(q) &&
        !item.emp.title.toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [deptFilter, enriched, locFilter, search]);

  const handleExportMasterExcel = () => {
    exportWorkbookToXlsx(`cati-personel-ozet-${activePeriod.replace(/\s+/g, '-')}.xlsx`, [
      {
        name: 'Personel Özeti',
        headers: [
          'Sicil No',
          'Ad Soyad',
          'Unvan',
          'Derece',
          'Departman',
          'Lokasyon',
          'Performans Puanı',
          '360 Yetkinlik',
          'Nine-Box Segmenti',
          'Aktif Görevlendirme',
        ],
        rows: filteredTable.map((x) => [
          x.emp.sicilNo,
          x.emp.fullName,
          x.emp.title,
          x.emp.grade,
          x.emp.department,
          x.emp.location,
          Number(x.perf.toFixed(1)),
          Number(x.a360.overallScore.toFixed(1)),
          platformConfig.nineBoxCatalog[x.boxId].name,
          x.activeAsg ? x.activeAsg.targetLocationOrProject : 'Asli Görevinde',
        ]),
      },
    ]);
  };

  const visibleKpiCards = useMemo(
    () => platformConfig.dashboardKpis.filter((card) => card.visible),
    [platformConfig.dashboardKpis]
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Yönetici Kokpiti
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            {activePeriod} · Kurumsal yetenek dağılımı, performans tamamlanma durumu ve bekleyen yönetim aksiyonları
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {platformConfig.features.enableNineBox && (
            <button
              type="button"
              onClick={() => setActiveModule('ninebox')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700 transition-colors whitespace-nowrap"
            >
              Kalibrasyon Matrisini Aç
            </button>
          )}
          {platformConfig.features.enableMobility && (
            <button
              type="button"
              onClick={() => setActiveModule('mobility')}
              className="px-3.5 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold transition-colors whitespace-nowrap"
            >
              Terfi / Atama Talebi Başlat
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Executive KPI Summary Strip */}
      {visibleKpiCards.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {visibleKpiCards.map((card) => {
            if (card.id === 'totalEmployees') {
              return (
                <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-[12px] font-medium text-slate-500">{card.label}</div>
                  <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
                    {kpis.totalEmployees}
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-500">
                    {card.subtitle || `${platformConfig.departments.length} birim · ${platformConfig.locations.length} lokasyon`}
                  </div>
                </div>
              );
            }
            if (card.id === 'perfRate') {
              return (
                <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-[12px] font-medium text-slate-500">{card.label}</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                      %{kpis.perfRate}
                    </span>
                    <span className="text-[11.5px] font-mono text-emerald-700 font-medium">
                      {kpis.perfCompleted}/{kpis.totalEmployees}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${kpis.perfRate}%` }}
                    />
                  </div>
                </div>
              );
            }
            if (card.id === 'comp360Rate') {
              return (
                <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-[12px] font-medium text-slate-500">{card.label}</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                      %{kpis.comp360Rate}
                    </span>
                    <span className="text-[11.5px] font-mono text-slate-500">
                      {kpis.doneRaters}/{kpis.totalRaters} form
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C8102E] rounded-full"
                      style={{ width: `${kpis.comp360Rate}%` }}
                    />
                  </div>
                </div>
              );
            }
            if (card.id === 'highPotRate') {
              return (
                <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-[12px] font-medium text-slate-500">{card.label}</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-mono tabular-nums text-2xl font-bold text-emerald-700">
                      %{kpis.highPotRate}
                    </span>
                    <span className="text-[11.5px] font-mono text-slate-500">{kpis.highPotCount} kişi</span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-500">{card.subtitle}</div>
                </div>
              );
            }
            if (card.id === 'activePromotions') {
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveModule('mobility')}
                  className="text-left bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-colors"
                >
                  <div className="flex items-center justify-between text-[12px] font-medium text-slate-500">
                    <span>{card.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-indigo-700">
                    {kpis.activePromotions}
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-500">{card.subtitle}</div>
                </button>
              );
            }
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveModule('assignments')}
                className="text-left bg-white border border-slate-200 hover:border-amber-300 rounded-xl p-4 shadow-2xs transition-colors"
              >
                <div className="flex items-center justify-between text-[12px] font-medium text-slate-500">
                  <span>{card.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-amber-700">
                  {kpis.activeAssignments}
                </div>
                <div className="mt-1 text-[11.5px] text-slate-500">
                  {expiringAssignments.length} görev süresi yaklaşıyor
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Main Analytics Split: Dept Performance/360 Bar Chart + Interactive Nine-Box Mini-Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Department Bar Chart */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-[16px] font-bold text-slate-900">
                Birim Bazlı Performans ve 360° Yetkinlik Dağılımı
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                Birim ortalamaları (0–100 ölçeği) · Filtrelemek için birime tıklayabilirsiniz
              </p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#C8102E]" />
                Bireysel Performans
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
                360° Yetkinlik
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between space-y-4">
            {deptStats.map((d) => {
              const isSelected = deptFilter === d.dept;
              return (
                <button
                  key={d.dept}
                  type="button"
                  onClick={() => setDeptFilter(isSelected ? 'ALL' : d.dept)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-[#C8102E] bg-rose-50/30'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="font-semibold text-slate-900">
                      {d.dept}{' '}
                      <span className="font-normal text-slate-400 text-[12px]">
                        ({d.count} kişi)
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-[12px] text-slate-600">
                      Perf: <strong className="text-slate-900">{d.avgPerf.toFixed(1)}</strong> · 360°:{' '}
                      <strong className="text-indigo-700">{d.avg360.toFixed(1)}</strong>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C8102E] rounded-full transition-all duration-300"
                        style={{ width: `${d.avgPerf}%` }}
                      />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${d.avg360}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Nine-Box Mini-Grid */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-[16px] font-bold text-slate-900">
                Nine-Box Yetenek Dağılım Özeti
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                Hücreye tıklayarak ilgili segmenti Kalibrasyon Matrisinde açın
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('ninebox')}
              className="text-[12px] font-semibold text-[#C8102E] hover:underline whitespace-nowrap shrink-0 inline-flex items-center gap-1"
            >
              Tam Matris
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-3 gap-2.5">
              {NINE_BOX_GRID_ORDER.map((boxId) => {
                const meta = platformConfig.nineBoxCatalog[boxId];
                const count = nineBoxCounts[boxId];
                const pct =
                  kpis.totalEmployees > 0
                    ? Math.round((count / kpis.totalEmployees) * 100)
                    : 0;
                return (
                  <button
                    key={boxId}
                    type="button"
                    onClick={() => jumpToNineBoxWithFilter(boxId)}
                    className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm hover:-translate-y-0.5 ${meta.accentBg} ${meta.accentBorder}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[11px] font-semibold ${meta.accentText} truncate`}>
                        {meta.shortName}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-mono tabular-nums text-xl font-bold text-slate-900">
                        {count}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        %{pct}
                      </span>
                    </div>
                    <div className="mt-1 text-[10.5px] text-slate-500 truncate">
                      {meta.potBand} Pot · {meta.perfBand} Perf
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>← Düşük Performans</span>
              <span>Beklenen</span>
              <span>Üstün Performans →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Center: Aksiyon Bekleyen İşlemler */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-[16px] font-bold text-slate-900">
              Aksiyon Bekleyen İşlemler
            </h2>
            <p className="text-[12.5px] text-slate-500">
              Onay bekleyen terfi talepleri, eksik 360° değerlendirmeler ve bitiş tarihi yaklaşan geçici görevlendirmeler
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Column 1: Pending Promotions */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-900">
                Onay Bekleyen Terfi / Atamalar
              </span>
              <span className="font-mono tabular-nums text-[12px] font-semibold text-indigo-700">
                {pendingPromotions.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100 flex-1">
              {pendingPromotions.length === 0 ? (
                <div className="p-5 text-[12.5px] text-slate-500 text-center">
                  Bekleyen terfi/atama talebi bulunmuyor.
                </div>
              ) : (
                pendingPromotions.map((req) => {
                  const emp = employees.find((e) => e.id === req.employeeId);
                  return (
                    <div key={req.id} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => emp && openEmployeeDrawer(emp.id)}
                          className="text-left group"
                        >
                          <div className="text-[13px] font-semibold text-slate-900 group-hover:text-[#C8102E] transition-colors">
                            {emp?.fullName}
                          </div>
                          <div className="text-[11.5px] text-slate-500">
                            {req.targetTitle} · Derece {req.targetGrade}
                          </div>
                        </button>
                        <span className="text-[11px] font-medium text-indigo-700 whitespace-nowrap">
                          Adım {Math.min(req.currentStepIndex + 1, platformConfig.mobilityApprovalSteps.length)}/{platformConfig.mobilityApprovalSteps.length}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-600">
                        Bekleyen:{' '}
                        <strong className="font-medium">
                          {platformConfig.mobilityApprovalSteps[
                            Math.min(req.currentStepIndex, Math.max(0, platformConfig.mobilityApprovalSteps.length - 1))
                          ]}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        {role !== 'EMPLOYEE' &&
                          (currentUser?.permissions.actions.canApproveMobility ?? true) && (
                          <button
                            type="button"
                            onClick={() => approveMobilityStep(req.id, 'Kokpit hızlı onay ile onaylandı.')}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Adımı Onayla
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveModule('mobility')}
                          className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11.5px] font-medium transition-colors"
                        >
                          Süreci İncele
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Overdue 360 Evaluations */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-900">
                Eksik 360° Değerlendirmeler
              </span>
              <span className="font-mono tabular-nums text-[12px] font-semibold text-[#C8102E]">
                {overdue360Items.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100 flex-1">
              {overdue360Items.length === 0 ? (
                <div className="p-5 text-[12.5px] text-slate-500 text-center">
                  Tüm 360° değerlendirme formları tamamlandı.
                </div>
              ) : (
                overdue360Items.slice(0, 4).map((item) => (
                  <div key={item.raterId} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openEmployeeDrawer(item.empId)}
                        className="text-[13px] font-semibold text-slate-900 hover:text-[#C8102E] truncate block text-left"
                      >
                        {item.empName}
                      </button>
                      <div className="text-[11.5px] text-slate-500 truncate">
                        Bekleyen: {item.raterName} ({item.relation})
                      </div>
                    </div>
                    {role !== 'EMPLOYEE' && (
                      <button
                        type="button"
                        onClick={() => sendRaterReminder(item.empId, item.raterId)}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-[#C8102E] hover:text-[#C8102E] text-slate-700 text-[11.5px] font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        Hatırlat
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Expiring Temporary Assignments */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-900">
                Süresi Dolmak Üzere Görevlendirmeler
              </span>
              <span className="font-mono tabular-nums text-[12px] font-semibold text-amber-700">
                {expiringAssignments.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100 flex-1">
              {expiringAssignments.length === 0 ? (
                <div className="p-5 text-[12.5px] text-slate-500 text-center">
                  Yakın zamanda sona erecek geçici görevlendirme bulunmuyor.
                </div>
              ) : (
                expiringAssignments.map((asg) => {
                  const emp = employees.find((e) => e.id === asg.employeeId);
                  const rem = getRemainingDays(asg.endDate);
                  return (
                    <div key={asg.id} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => emp && openEmployeeDrawer(emp.id)}
                            className="text-[13px] font-semibold text-slate-900 hover:text-[#C8102E] truncate block text-left"
                          >
                            {emp?.fullName}
                          </button>
                          <div className="text-[11.5px] text-slate-500 truncate">
                            {asg.targetLocationOrProject}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-mono font-semibold text-amber-700 whitespace-nowrap shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Kalan: {Math.max(0, rem)} Gün
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11.5px] text-slate-500">
                        <span>Bitiş: {formatTrDate(asg.endDate)}</span>
                        <button
                          type="button"
                          onClick={() => setActiveModule('assignments')}
                          className="font-semibold text-[#C8102E] hover:underline"
                        >
                          Uzat / Sonlandır →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Master Talent Directory Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C8102E]" />
            <h2 className="font-display text-[15px] font-bold text-slate-900">
              Entegre Personel Yetenek Listesi ({filteredTable.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Personel veya sicil ara..."
                className="h-8.5 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E] w-52"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#C8102E]"
            >
              <option value="ALL">Tüm Birimler</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
              className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#C8102E]"
            >
              <option value="ALL">Tüm Lokasyonlar</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            {platformConfig.features.enableCsvExport && (
              <button
                type="button"
                onClick={handleExportMasterExcel}
                className="h-8.5 px-3 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-[12.5px] font-semibold text-emerald-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Excel İndir (.xlsx)
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Personel</th>
                <th className="py-2.5 px-4">Birim & Lokasyon</th>
                <th className="py-2.5 px-4 text-right">Derece / Kıdem</th>
                <th className="py-2.5 px-4 text-right">Performans</th>
                <th className="py-2.5 px-4 text-right">360° Puan</th>
                <th className="py-2.5 px-4">Nine-Box Segmenti</th>
                <th className="py-2.5 px-4">Görev Durumu</th>
                <th className="py-2.5 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {filteredTable.map((row) => {
                const boxMeta = platformConfig.nineBoxCatalog[row.boxId];
                return (
                  <tr
                    key={row.emp.id}
                    onClick={() => openEmployeeDrawer(row.emp.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11.5px] flex items-center justify-center shrink-0">
                          {getInitials(row.emp.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {row.emp.fullName}
                          </div>
                          <div className="text-[11.5px] text-slate-500 truncate">
                            <span className="font-mono">{row.emp.sicilNo}</span> · {row.emp.title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-800">{row.emp.department}</div>
                      <div className="text-[11.5px] text-slate-500">{row.emp.location}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      <div>D-{row.emp.grade}</div>
                      <div className="text-[11px] text-slate-400">{row.emp.tenureMonths} ay</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.perf.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-indigo-700">
                      {row.a360.overallScore.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[12.5px] font-semibold ${boxMeta.accentText}`}>
                        {boxMeta.shortName}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[12px]">
                      {row.activeAsg ? (
                        <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                          <Briefcase className="w-3.5 h-3.5" />
                          Geçici Görevde ({Math.max(0, getRemainingDays(row.activeAsg.endDate))}g)
                        </span>
                      ) : (
                        <span className="text-slate-500">Asli Görevinde</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmployeeDrawer(row.emp.id);
                        }}
                        className="text-[12px] font-semibold text-[#C8102E] hover:underline whitespace-nowrap"
                      >
                        360° Kart
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTable.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-[13px]">
                    Seçili filtrelere uygun personel kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

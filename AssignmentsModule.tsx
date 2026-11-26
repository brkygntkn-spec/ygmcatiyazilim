import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  List,
  Plus,
  RotateCcw,
  Search,
  StopCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTalentStore } from '../context/TalentStore';
import { AssignmentCategory, TemporaryAssignment } from '../types/talent';
import {
  formatTrDate,
  getDaysBetween,
  getInitials,
  getRemainingDays,
  REFERENCE_TODAY,
} from '../utils/calculations';
import { exportWorkbookToXlsx } from '../utils/excelExport';

export const AssignmentsModule: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    employees,
    assignments,
    mobilityRequests,
    platformConfig,
    role,
    currentRoleEmployeeId,
    createAssignment,
    extendAssignment,
    endAssignmentEarly,
    completeAssignmentAndReturn,
    openEmployeeDrawer,
    pushToast,
  } = useTalentStore();

  const assignmentCategories = platformConfig.assignmentCategories;
  const expiryWarningDays = platformConfig.assignmentExpiryWarningDays;

  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');

  const reportingManagers = useMemo(() => {
    const subs = employees.filter((e) => e.hasSubordinates);
    return subs.length > 0 ? subs : employees;
  }, [employees]);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [empId, setEmpId] = useState(employees[4]?.id ?? employees[0]?.id ?? '');
  const [category, setCategory] = useState<AssignmentCategory>(
    assignmentCategories[0] ?? 'Saha / Afet / Operasyon Görevlendirmesi'
  );
  const [targetLoc, setTargetLoc] = useState('');
  const [startDate, setStartDate] = useState(REFERENCE_TODAY);
  const [endDate, setEndDate] = useState('2026-12-24');
  const [hasAllowance, setHasAllowance] = useState(true);
  const [reportingMgrId, setReportingMgrId] = useState(
    employees.find((e) => e.hasSubordinates)?.id ?? employees[0]?.id ?? ''
  );
  const [notes, setNotes] = useState('');

  // Extend modal
  const [extendTarget, setExtendTarget] = useState<TemporaryAssignment | null>(null);
  const [newEndDate, setNewEndDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  // End Early modal
  const [endEarlyTarget, setEndEarlyTarget] = useState<TemporaryAssignment | null>(null);
  const [endEarlyReason, setEndEarlyReason] = useState('');

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return assignments.filter((asg) => {
      if (role === 'EMPLOYEE' && asg.employeeId !== currentRoleEmployeeId) return false;
      if (statusFilter !== 'ALL' && asg.status !== statusFilter) return false;
      if (catFilter !== 'ALL' && asg.category !== catFilter) return false;
      const emp = employees.find((e) => e.id === asg.employeeId);
      if (
        q &&
        !emp?.fullName.toLocaleLowerCase('tr-TR').includes(q) &&
        !asg.targetLocationOrProject.toLocaleLowerCase('tr-TR').includes(q) &&
        !asg.category.toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [assignments, catFilter, currentRoleEmployeeId, employees, role, search, statusFilter]);

  // Conflict checker for creation modal
  const conflicts = useMemo(() => {
    const overlappingAsg = assignments.find(
      (a) =>
        a.employeeId === empId &&
        a.status === 'Aktif' &&
        !(endDate < a.startDate || startDate > a.endDate)
    );
    const activePromotion = mobilityRequests.find(
      (m) => m.employeeId === empId && m.status === 'Devam Ediyor'
    );
    return { overlappingAsg, activePromotion };
  }, [assignments, empId, endDate, mobilityRequests, startDate]);

  const scopedAssignments = useMemo(
    () =>
      role === 'EMPLOYEE'
        ? assignments.filter((a) => a.employeeId === currentRoleEmployeeId)
        : assignments,
    [assignments, currentRoleEmployeeId, role]
  );

  const activeCount = scopedAssignments.filter((a) => a.status === 'Aktif').length;
  const expiringCount = scopedAssignments.filter(
    (a) => a.status === 'Aktif' && getRemainingDays(a.endDate) <= expiryWarningDays
  ).length;
  const allowanceCount = scopedAssignments.filter(
    (a) => a.status === 'Aktif' && a.hasAllowance
  ).length;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !targetLoc.trim() || !startDate || !endDate) return;
    if (endDate < startDate) {
      pushToast('warning', 'Bitiş tarihi, başlangıç tarihinden önce olamaz.');
      return;
    }
    createAssignment({
      employeeId: empId,
      category,
      targetLocationOrProject: targetLoc.trim(),
      startDate,
      endDate,
      hasAllowance,
      reportingManagerId: reportingMgrId || reportingManagers[0]?.id || '',
      notes: notes.trim() || 'Geçici görevlendirme planı kapsamında oluşturuldu.',
    });
    setCreateOpen(false);
    setTargetLoc('');
    setNotes('');
  };

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendTarget || !newEndDate || !extendReason.trim()) return;
    if (newEndDate <= extendTarget.endDate) {
      pushToast('warning', 'Yeni bitiş tarihi mevcut bitiş tarihinden daha ileri bir tarih olmalıdır.');
      return;
    }
    extendAssignment(extendTarget.id, newEndDate, extendReason.trim());
    setExtendTarget(null);
    setExtendReason('');
  };

  const handleEndEarlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!endEarlyTarget || !endEarlyReason.trim()) return;
    endAssignmentEarly(endEarlyTarget.id, endEarlyReason.trim());
    setEndEarlyTarget(null);
    setEndEarlyReason('');
  };

  const handleExportExcel = () => {
    exportWorkbookToXlsx('gecici-gorevlendirmeler.xlsx', [
      {
        name: 'Geçici Görevlendirmeler',
        headers: [
          'Görev No',
          'Sicil No',
          'Personel',
          'Kategori',
          'Görev Yeri / Proje',
          'Başlangıç',
          'Bitiş',
          'Harcırah/Vekalet',
          'Durum',
        ],
        rows: filteredAssignments.map((a) => {
          const emp = employees.find((e) => e.id === a.employeeId);
          return [
            a.id,
            emp?.sicilNo ?? '-',
            emp?.fullName ?? '-',
            a.category,
            a.targetLocationOrProject,
            formatTrDate(a.startDate),
            formatTrDate(a.endDate),
            a.hasAllowance ? 'Evet' : 'Hayır',
            a.status,
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
            Geçici Görevlendirme ve Proje / Saha Atamaları
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            Çakışma kontrollü görevlendirme oluşturma, canlı geri sayım takibi, süre uzatımı ve asli göreve dönüş yönetimi
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {platformConfig.features.enableCsvExport && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-[13px] font-semibold text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Excel (.xlsx)
            </button>
          )}
          {role !== 'EMPLOYEE' &&
            (currentUser?.permissions.actions.canManageAssignments ?? true) && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Yeni Geçici Görevlendirme
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">Aktif Geçici Görevdeki Personel</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-indigo-700">
            {activeCount}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Saha, vekalet ve proje bazlı</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">
            Süresi Dolmak Üzere (≤ {expiryWarningDays} Gün)
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-amber-700">
            {expiringCount}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Uzatma veya dönüş aksiyonu gerektirir</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">Harcırah / Vekalet Ücretli Aktif</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {allowanceCount}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Bordro ve ödenek takibine bağlı</div>
        </div>
      </div>

      {/* Filters & View Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            {['ALL', 'Aktif', 'Tamamlandı', 'Erken Sonlandırıldı'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'Tümü' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tablo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1 ${
                viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Zaman Çizelgesi
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Personel, proje veya lokasyon..."
              className="h-8.5 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E] w-56"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="ALL">Tüm Kategoriler</option>
            {assignmentCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table View vs Timeline View */}
      {viewMode === 'table' ? (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Personel</th>
                  <th className="py-2.5 px-4">Görevlendirme Türü & Proje/Lokasyon</th>
                  <th className="py-2.5 px-4">Dönem Tarihleri</th>
                  <th className="py-2.5 px-4">Kalan Süre / Durum</th>
                  <th className="py-2.5 px-4">Bağlı Yönetici</th>
                  <th className="py-2.5 px-4 text-right">Yaşam Döngüsü İşlemleri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredAssignments.map((asg) => {
                  const emp = employees.find((e) => e.id === asg.employeeId);
                  const mgr = employees.find((e) => e.id === asg.reportingManagerId);
                  const rem = getRemainingDays(asg.endDate);
                  const isUrgent = asg.status === 'Aktif' && rem <= expiryWarningDays;

                  return (
                    <tr key={asg.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => emp && openEmployeeDrawer(emp.id)}
                          className="flex items-center gap-2.5 text-left group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11.5px] flex items-center justify-center shrink-0">
                            {emp ? getInitials(emp.fullName) : '??'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-[#C8102E]">
                              {emp?.fullName}
                            </div>
                            <div className="text-[11.5px] text-slate-500">
                              {emp?.department} · {emp?.location}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {asg.targetLocationOrProject}
                        </div>
                        <div className="text-[11.5px] text-slate-500">
                          {asg.category} ·{' '}
                          {asg.hasAllowance ? 'Harcırah / Vekalet Aktif' : 'Standart'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[12px] text-slate-700 whitespace-nowrap">
                        <div>{formatTrDate(asg.startDate)}</div>
                        <div className="text-slate-400">→ {formatTrDate(asg.endDate)}</div>
                      </td>
                      <td className="py-3 px-4">
                        {asg.status === 'Aktif' ? (
                          <div>
                            <div
                              className={`font-mono tabular-nums text-[12.5px] font-bold inline-flex items-center gap-1 ${
                                isUrgent ? 'text-amber-700' : 'text-indigo-700'
                              }`}
                            >
                              {isUrgent ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                              Kalan: {Math.max(0, rem)} Gün
                            </div>
                            {isUrgent && (
                              <div className="text-[11px] font-semibold text-amber-700">
                                Süresi Dolmak Üzere
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-[12.5px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {asg.status}
                            </div>
                            {asg.actualDaysServed && (
                              <div className="text-[11px] font-mono text-slate-500">
                                Toplam {asg.actualDaysServed} gün hizmet
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[12.5px] text-slate-700">
                        {mgr?.fullName ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {asg.status === 'Aktif' &&
                        role !== 'EMPLOYEE' &&
                        (currentUser?.permissions.actions.canManageAssignments ?? true) ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setExtendTarget(asg);
                                setNewEndDate(asg.endDate);
                                setExtendReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:border-indigo-400 hover:text-indigo-700 text-[11.5px] font-semibold text-slate-700 whitespace-nowrap"
                            >
                              Süre Uzat
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEndEarlyTarget(asg);
                                setEndEarlyReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-md border border-amber-200 bg-white hover:bg-amber-50 text-[11.5px] font-semibold text-amber-800 inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <StopCircle className="w-3.5 h-3.5" />
                              Erken Sonlandır
                            </button>
                            <button
                              type="button"
                              onClick={() => completeAssignmentAndReturn(asg.id)}
                              className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Asli Göreve Döndür
                            </button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-slate-400">
                            {asg.completedAt ? formatTrDate(asg.completedAt) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredAssignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-[13px]">
                      Seçili filtrelere uygun görevlendirme kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* Timeline View */
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#C8102E]" />
              Görevlendirme Zaman Çizelgesi ve İlerleme Durumu
            </h2>
            <span className="text-[12px] font-mono text-slate-500">
              Referans Tarih: {formatTrDate(REFERENCE_TODAY)}
            </span>
          </div>

          <div className="space-y-3.5">
            {filteredAssignments.map((asg) => {
              const emp = employees.find((e) => e.id === asg.employeeId);
              const totalDays = Math.max(1, getDaysBetween(asg.startDate, asg.endDate));
              const elapsed = Math.max(
                0,
                Math.min(totalDays, getDaysBetween(asg.startDate, REFERENCE_TODAY))
              );
              const pct = asg.status === 'Aktif' ? Math.round((elapsed / totalDays) * 100) : 100;
              const rem = getRemainingDays(asg.endDate);
              const urgent = asg.status === 'Aktif' && rem <= expiryWarningDays;

              return (
                <div
                  key={asg.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => emp && openEmployeeDrawer(emp.id)}
                        className="text-[14px] font-bold text-slate-900 hover:text-[#C8102E]"
                      >
                        {emp?.fullName}
                      </button>
                      <span className="text-[12.5px] text-slate-500">
                        {' '}
                        · {asg.targetLocationOrProject} ({asg.category})
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[12px] font-semibold ${
                        asg.status !== 'Aktif'
                          ? 'text-emerald-700'
                          : urgent
                          ? 'text-amber-700'
                          : 'text-indigo-700'
                      }`}
                    >
                      {asg.status === 'Aktif'
                        ? `Kalan ${Math.max(0, rem)} / ${totalDays} Gün (%${pct})`
                        : `${asg.status} (${asg.actualDaysServed ?? totalDays} Gün)`}
                    </span>
                  </div>

                  <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        asg.status !== 'Aktif'
                          ? 'bg-emerald-500'
                          : urgent
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11.5px] font-mono text-slate-500">
                    <span>Başlangıç: {formatTrDate(asg.startDate)}</span>
                    <span>Bitiş: {formatTrDate(asg.endDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal: Create Temporary Assignment with Conflict Check */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setCreateOpen(false)}
          />
          <form
            onSubmit={handleCreateSubmit}
            className="relative z-10 w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-[11.5px] text-slate-500">Otomatik Çakışma Kontrollü</div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Yeni Geçici Görevlendirme Oluştur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Conflict Warnings */}
              {platformConfig.features.enableAssignmentConflictCheck &&
                (conflicts.overlappingAsg || conflicts.activePromotion) && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-1.5 text-[12.5px] text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Çakışma Uyarısı Tespit Edildi
                  </div>
                  {conflicts.overlappingAsg && (
                    <p>
                      · Seçili personelin tarih aralığıyla çakışan aktif bir görevlendirmesi var:{' '}
                      <strong>{conflicts.overlappingAsg.targetLocationOrProject}</strong> (
                      {formatTrDate(conflicts.overlappingAsg.startDate)} –{' '}
                      {formatTrDate(conflicts.overlappingAsg.endDate)}).
                    </p>
                  )}
                  {conflicts.activePromotion && (
                    <p>
                      · Seçili personelin devam eden bir terfi/atama süreci bulunuyor:{' '}
                      <strong>{conflicts.activePromotion.targetTitle}</strong> (
                      {conflicts.activePromotion.processType}).
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Personel *
                  </label>
                  <select
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({e.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Görevlendirme Kategorisi
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AssignmentCategory)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {assignmentCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Hedef Lokasyon / Proje / Vekalet Makamı *
                </label>
                <input
                  type="text"
                  required
                  value={targetLoc}
                  onChange={(e) => setTargetLoc(e.target.value)}
                  placeholder="Örn: Karadeniz Bölgesi Acil Lojistik Destek Merkezi"
                  className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Başlangıç Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9.5 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Bitiş Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9.5 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Görev Süresince Bağlı Yönetici
                  </label>
                  <select
                    value={reportingMgrId}
                    onChange={(e) => setReportingMgrId(e.target.value)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {reportingManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.title})
                      </option>
                    ))}
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-800 pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAllowance}
                    onChange={(e) => setHasAllowance(e.target.checked)}
                    className="w-4 h-4 accent-[#C8102E]"
                  />
                  Harcırah / Vekalet Ücreti Uygulanacak
                </label>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Görev Kapsamı ve Notlar
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Görevlendirme kapsamı, beklentiler ve teslimatlar..."
                  className="w-full p-2.5 text-[13px] border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold"
              >
                Görevlendirmeyi Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Extend Assignment */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setExtendTarget(null)}
          />
          <form
            onSubmit={handleExtendSubmit}
            className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-slate-900">
                Görevlendirme Süresini Uzat
              </h3>
              <button
                type="button"
                onClick={() => setExtendTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-[12.5px] text-slate-600">
                <strong className="text-slate-900">{extendTarget.targetLocationOrProject}</strong> · Mevcut bitiş: <span className="font-mono">{formatTrDate(extendTarget.endDate)}</span>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Yeni Bitiş Tarihi *
                </label>
                <input
                  type="date"
                  required
                  min={extendTarget.endDate}
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full h-9.5 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Uzatma Gerekçesi *
                </label>
                <input
                  type="text"
                  required
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Örn: Saha devir teslim operasyonlarının tamamlanması..."
                  className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtendTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold"
              >
                Süreyi Uzat
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: End Assignment Early */}
      {endEarlyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setEndEarlyTarget(null)}
          />
          <form
            onSubmit={handleEndEarlySubmit}
            className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-slate-900">
                Görevlendirmeyi Erken Sonlandır
              </h3>
              <button
                type="button"
                onClick={() => setEndEarlyTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-[12.5px] text-slate-600">
                <strong>{endEarlyTarget.targetLocationOrProject}</strong> görevi sonlandırılarak personel asli kadrosuna döndürülecektir.
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Erken Sonlandırma Gerekçesi *
                </label>
                <textarea
                  rows={3}
                  required
                  value={endEarlyReason}
                  onChange={(e) => setEndEarlyReason(e.target.value)}
                  placeholder="Örn: Proje teslimatı planlanandan önce tamamlandı..."
                  className="w-full p-2.5 text-[13px] border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEndEarlyTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12.5px] font-semibold"
              >
                Erken Sonlandır
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

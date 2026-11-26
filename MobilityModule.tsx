import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Download,
  Plus,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTalentStore } from './TalentStore';
import {
  DepartmentName,
  MobilityProcessType,
  MobilityRequest,
} from './talent';
import {
  evaluatePromotionEligibility,
  formatTrDate,
  getInitials,
} from './calculations';
import { exportWorkbookToXlsx } from './excelExport';

export const MobilityModule: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    employees,
    competencies,
    mobilityRequests,
    rules,
    platformConfig,
    activePeriod,
    role,
    currentRoleEmployeeId,
    prefilledMobilityEmpId,
    clearPrefilledMobility,
    createMobilityRequest,
    approveMobilityStep,
    rejectMobilityRequest,
    openEmployeeDrawer,
  } = useTalentStore();

  const approvalSteps = platformConfig.mobilityApprovalSteps;
  const processTypes = platformConfig.mobilityProcessTypes;
  const departments = useMemo(
    () => Array.from(new Set([...platformConfig.departments, ...employees.map((e) => e.department)])),
    [employees, platformConfig.departments]
  );
  const locations = useMemo(
    () => Array.from(new Set([...platformConfig.locations, ...employees.map((e) => e.location)])),
    [employees, platformConfig.locations]
  );

  const getStepLabel = (idx: number) =>
    approvalSteps[Math.min(idx, Math.max(0, approvalSteps.length - 1))] ?? 'Onay Aşaması';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(
    mobilityRequests[0]?.id ?? null
  );

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [empId, setEmpId] = useState<string>(employees[0]?.id ?? '');
  const [processType, setProcessType] = useState<MobilityProcessType>(
    processTypes[0] ?? 'Dikey Terfi (Unvan & Derece Artışı)'
  );
  const [targetTitle, setTargetTitle] = useState('');
  const [targetGrade, setTargetGrade] = useState(8);
  const [targetDept, setTargetDept] = useState<DepartmentName>(departments[0] ?? 'Operasyon');
  const [targetLoc, setTargetLoc] = useState(locations[0] ?? 'Ankara Genel Merkez');
  const [justification, setJustification] = useState('');
  const [adminOverride, setAdminOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Reject Modal state
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approve step note
  const [stepNote, setStepNote] = useState('');

  const formatPromotedTitle = (currentTitle: string) =>
    currentTitle.trim().toLocaleLowerCase('tr-TR').startsWith('kıdemli ')
      ? currentTitle.trim()
      : `Kıdemli ${currentTitle.trim()}`;

  // Pre-fill creation modal if triggered from Nine-Box or Employee Drawer
  useEffect(() => {
    if (prefilledMobilityEmpId) {
      const emp = employees.find((e) => e.id === prefilledMobilityEmpId);
      if (emp) {
        setEmpId(emp.id);
        setProcessType(processTypes[0] ?? 'Dikey Terfi (Unvan & Derece Artışı)');
        setTargetTitle(formatPromotedTitle(emp.title));
        setTargetGrade(Math.min(12, emp.grade + 1));
        setTargetDept(emp.department);
        setTargetLoc(emp.location);
        setJustification('');
        setAdminOverride(false);
        setOverrideReason('');
        setFormError(null);
        setCreateOpen(true);
      }
      clearPrefilledMobility();
    }
  }, [clearPrefilledMobility, employees, prefilledMobilityEmpId, processTypes]);

  const selectedEmployeeForCreate = useMemo(
    () => employees.find((e) => e.id === empId) ?? employees[0],
    [empId, employees]
  );

  const eligibility = useMemo(() => {
    if (!selectedEmployeeForCreate) return null;
    return evaluatePromotionEligibility(
      selectedEmployeeForCreate,
      activePeriod,
      competencies,
      rules
    );
  }, [activePeriod, competencies, rules, selectedEmployeeForCreate]);

  const handleEmployeeSelectChange = (newEmpId: string) => {
    setEmpId(newEmpId);
    const emp = employees.find((e) => e.id === newEmpId);
    if (emp) {
      setTargetTitle(
        processType.includes('Terfi') ? formatPromotedTitle(emp.title) : emp.title
      );
      setTargetGrade(
        processType.includes('Terfi') ? Math.min(12, emp.grade + 1) : emp.grade
      );
      setTargetDept(emp.department);
      setTargetLoc(emp.location);
      setAdminOverride(false);
      setOverrideReason('');
      setFormError(null);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return mobilityRequests.filter((req) => {
      if (role === 'EMPLOYEE' && req.employeeId !== currentRoleEmployeeId) return false;
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && req.processType !== typeFilter) return false;
      const emp = employees.find((e) => e.id === req.employeeId);
      if (
        q &&
        !emp?.fullName.toLocaleLowerCase('tr-TR').includes(q) &&
        !req.targetTitle.toLocaleLowerCase('tr-TR').includes(q) &&
        !req.targetDepartment.toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [currentRoleEmployeeId, employees, mobilityRequests, role, search, statusFilter, typeFilter]);

  const activeReq: MobilityRequest | null = useMemo(() => {
    const found = filteredRequests.find((r) => r.id === selectedReqId);
    return found ?? filteredRequests[0] ?? null;
  }, [filteredRequests, selectedReqId]);

  const activeReqEmployee = useMemo(
    () => (activeReq ? employees.find((e) => e.id === activeReq.employeeId) ?? null : null),
    [activeReq, employees]
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeForCreate || !eligibility) return;

    if (!targetTitle.trim() || !justification.trim()) {
      setFormError('Hedef unvan ve talep gerekçesi alanları zorunludur.');
      return;
    }

    if (platformConfig.features.enableAutoEligibilityEngine && !eligibility.allPassed) {
      if (role !== 'ADMIN') {
        setFormError(
          'Uygunluk kural motorundan geçemeyen talepler yalnızca İK Yöneticisi istisna onayı ile başlatılabilir.'
        );
        return;
      }
      if (!adminOverride || overrideReason.trim().length < 5) {
        setFormError(
          'Eksik kriterler mevcut. Devam etmek için İK İstisna Onayını işaretleyip gerekçe giriniz.'
        );
        return;
      }
    }

    const overrideActive =
      platformConfig.features.enableAutoEligibilityEngine && !eligibility.allPassed && adminOverride;

    createMobilityRequest({
      employeeId: selectedEmployeeForCreate.id,
      processType,
      targetTitle: targetTitle.trim(),
      targetGrade,
      targetDepartment: targetDept,
      targetLocation: targetLoc,
      justification: justification.trim(),
      adminOverrideUsed: overrideActive,
      adminOverrideReason: overrideActive ? overrideReason.trim() : undefined,
    });
    setCreateOpen(false);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalId || !rejectReason.trim()) return;
    rejectMobilityRequest(rejectModalId, rejectReason.trim());
    setRejectModalId(null);
    setRejectReason('');
  };

  const handleExportExcel = () => {
    exportWorkbookToXlsx('terfi-ve-atama-surecleri.xlsx', [
      {
        name: 'Terfi ve Atama',
        headers: [
          'Talep No',
          'Sicil No',
          'Personel',
          'Süreç Türü',
          'Hedef Unvan',
          'Hedef Derece',
          'Hedef Birim',
          'Hedef Lokasyon',
          'Mevcut Aşama',
          'Durum',
        ],
        rows: filteredRequests.map((r) => {
          const emp = employees.find((e) => e.id === r.employeeId);
          return [
            r.id,
            emp?.sicilNo ?? '-',
            emp?.fullName ?? '-',
            r.processType,
            r.targetTitle,
            r.targetGrade,
            r.targetDepartment,
            r.targetLocation,
            getStepLabel(r.currentStepIndex),
            r.status,
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
            İç Terfi, Görev Değişikliği ve Atama Süreçleri
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            Otomatik uygunluk kural motoru, {approvalSteps.length} adımlı onay akışı ve nihai onayda anlık personel özlük senkronizasyonu
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
          {role !== 'EMPLOYEE' && employees.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const defaultEmpId = employees[1]?.id ?? employees[0]?.id;
                if (defaultEmpId) {
                  handleEmployeeSelectChange(defaultEmpId);
                }
                setJustification('');
                setFormError(null);
                setCreateOpen(true);
              }}
              className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Yeni Terfi / Atama Talebi
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
          {['ALL', 'Devam Ediyor', 'Onaylandı', 'Reddedildi'].map((st) => (
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

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Personel veya hedef unvan ara..."
              className="h-8.5 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E] w-56"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8.5 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="ALL">Tüm Süreç Türleri</option>
            {processTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Split Layout: Request Queue + Visual 6-Step Approval Workflow */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Requests List */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h2 className="font-display text-[14.5px] font-bold text-slate-900 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-[#C8102E]" />
              Süreç Kuyruğu ({filteredRequests.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-slate-500">
                Seçili kriterlere uygun terfi veya atama talebi bulunmuyor.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const emp = employees.find((e) => e.id === req.employeeId);
                const selected = activeReq?.id === req.id;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedReqId(req.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      selected ? 'bg-rose-50/45' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg text-[11.5px] font-semibold flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-[#C8102E] text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {emp ? getInitials(emp.fullName) : '??'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-slate-900 truncate">
                            {emp?.fullName}
                          </div>
                          <div className="text-[11.5px] text-slate-500 truncate">
                            {req.processType}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11.5px] font-semibold whitespace-nowrap shrink-0 ${
                          req.status === 'Onaylandı'
                            ? 'text-emerald-700'
                            : req.status === 'Reddedildi'
                            ? 'text-rose-700'
                            : 'text-indigo-700'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="mt-2 text-[12px] text-slate-700 flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-500">{emp?.title}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-900">
                        {req.targetTitle} (D-{req.targetGrade})
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11.5px] text-slate-500 font-mono tabular-nums">
                      <span>{getStepLabel(req.currentStepIndex)}</span>
                      <span>{formatTrDate(req.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Request Details & 6-Step Stepper */}
        <div className="xl:col-span-7">
          {activeReq && activeReqEmployee ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              {/* Top Title & Comparison */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-[12px] text-slate-500 font-mono">
                    Talep #{activeReq.id} · Oluşturan: {activeReq.createdBy} ·{' '}
                    {formatTrDate(activeReq.createdAt)}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEmployeeDrawer(activeReqEmployee.id)}
                    className="font-display text-xl font-bold text-slate-900 hover:text-[#C8102E] mt-0.5 text-left"
                  >
                    {activeReqEmployee.fullName}
                  </button>
                  <div className="text-[13px] font-medium text-indigo-700 mt-0.5">
                    {activeReq.processType}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] text-slate-500">Süreç Durumu</div>
                  <div
                    className={`text-[15px] font-bold ${
                      activeReq.status === 'Onaylandı'
                        ? 'text-emerald-700'
                        : activeReq.status === 'Reddedildi'
                        ? 'text-rose-700'
                        : 'text-indigo-700'
                    }`}
                  >
                    {activeReq.status}
                  </div>
                </div>
              </div>

              {/* Current vs Target Position Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Mevcut Pozisyon Bilgisi
                  </div>
                  <div className="text-[14px] font-bold text-slate-900">
                    {activeReqEmployee.title}
                  </div>
                  <div className="text-[12.5px] text-slate-600">
                    {activeReqEmployee.department} · {activeReqEmployee.location}
                  </div>
                  <div className="text-[12px] font-mono text-slate-500">
                    Kadro Derecesi: {activeReqEmployee.grade} · Kıdem: {activeReqEmployee.tenureMonths} Ay
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                  <div className="text-[11px] font-semibold text-indigo-700">
                    Hedef Pozisyon Bilgisi (Nihai Onayda Otomatik Senkronize Edilir)
                  </div>
                  <div className="text-[14px] font-bold text-slate-900">
                    {activeReq.targetTitle}
                  </div>
                  <div className="text-[12.5px] text-slate-700">
                    {activeReq.targetDepartment} · {activeReq.targetLocation}
                  </div>
                  <div className="text-[12px] font-mono font-semibold text-indigo-800">
                    Hedef Derece: {activeReq.targetGrade}
                  </div>
                </div>
              </div>

              {/* Justification & Override Note */}
              <div className="space-y-2">
                <div className="text-[12.5px] text-slate-700">
                  <strong className="font-semibold text-slate-900">Talep Gerekçesi:</strong>{' '}
                  {activeReq.justification}
                </div>
                {activeReq.adminOverrideUsed && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold">İK İstisna Onayı Kullanıldı:</strong>{' '}
                      {activeReq.adminOverrideReason}
                    </span>
                  </div>
                )}
                {activeReq.status === 'Reddedildi' && activeReq.rejectionReason && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12.5px] text-rose-900">
                    <strong className="font-semibold">Ret Gerekçesi:</strong>{' '}
                    {activeReq.rejectionReason}
                  </div>
                )}
              </div>

              {/* Dynamic Visual Approval Workflow */}
              <div>
                <h3 className="font-display text-[14px] font-bold text-slate-900 mb-3">
                  {approvalSteps.length} Aşamalı Kurumsal Onay Akışı
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {approvalSteps.map((stepLabel, idx) => {
                    const isCompleted =
                      activeReq.status === 'Onaylandı' || idx < activeReq.currentStepIndex;
                    const isCurrent =
                      activeReq.status === 'Devam Ediyor' &&
                      idx === Math.min(activeReq.currentStepIndex, approvalSteps.length - 1);
                    const isRejectedHere =
                      activeReq.status === 'Reddedildi' &&
                      idx === Math.min(activeReq.currentStepIndex, approvalSteps.length - 1);

                    return (
                      <div
                        key={`${stepLabel}-${idx}`}
                        className={`p-3 rounded-xl border text-[12px] ${
                          isCompleted
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : isCurrent
                            ? 'bg-rose-50/70 border-[#C8102E] text-slate-900 ring-1 ring-[#C8102E]/20'
                            : isRejectedHere
                            ? 'bg-rose-50 border-rose-300 text-rose-900'
                            : 'bg-slate-50/70 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                          <span>0{idx + 1}</span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : isRejectedHere ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          ) : isCurrent ? (
                            <span className="font-sans font-semibold text-[#C8102E]">Sırada</span>
                          ) : null}
                        </div>
                        <div className="font-semibold leading-snug">{stepLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Approval Action Controls */}
              {activeReq.status === 'Devam Ediyor' &&
                role !== 'EMPLOYEE' &&
                (currentUser?.permissions.actions.canApproveMobility ?? true) && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-[13px] font-bold text-slate-900">
                    Aktif Aşama İşlemi: {getStepLabel(activeReq.currentStepIndex)}
                  </div>
                  <input
                    type="text"
                    value={stepNote}
                    onChange={(e) => setStepNote(e.target.value)}
                    placeholder="Onay notu (opsiyonel)..."
                    className="w-full h-9 px-3 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] text-slate-500">
                      {activeReq.currentStepIndex >= approvalSteps.length - 2
                        ? 'Bu onay nihai atamayı gerçekleştirir ve personel profilini otomatik günceller.'
                        : 'Onaylandığında talep bir sonraki yetkili aşamaya aktarılır.'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalId(activeReq.id);
                          setRejectReason('');
                        }}
                        className="px-3.5 py-2 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[12.5px] font-semibold"
                      >
                        Reddet
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          approveMobilityStep(activeReq.id, stepNote.trim() || undefined);
                          setStepNote('');
                        }}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {activeReq.currentStepIndex >= approvalSteps.length - 2
                          ? 'Nihai Onayla & Profili Güncelle'
                          : 'Aşamayı Onayla'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step Audit Log */}
              <div>
                <h4 className="text-[12.5px] font-bold text-slate-700 mb-2">
                  Onay İşlem Geçmişi
                </h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-[12px]">
                  {activeReq.stepHistory.map((h, i) => (
                    <div key={`${h.step}-${i}`} className="px-3.5 py-2.5 flex items-start justify-between gap-3">
                      <div>
                        <span className="font-semibold text-slate-900">{h.step}</span>
                        <span className="text-slate-500"> · {h.actor}</span>
                        {h.note && <div className="text-slate-600 mt-0.5">{h.note}</div>}
                      </div>
                      <div className="text-right font-mono text-slate-500 shrink-0">
                        <div
                          className={`font-sans font-semibold ${
                            h.decision === 'Reddedildi' ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {h.decision}
                        </div>
                        <div>{formatTrDate(h.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-[13.5px]">
              Detaylarını incelemek için soldaki listeden bir süreç seçiniz.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Mobility Request with Live Eligibility Rule Engine */}
      {createOpen && selectedEmployeeForCreate && eligibility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setCreateOpen(false)}
          />
          <form
            onSubmit={handleCreateSubmit}
            className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <div className="text-[11.5px] text-slate-500">Otomatik Uygunluk Kural Motoru Destekli</div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Yeni İç Terfi / Görev Değişikliği Talebi
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

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12.5px] text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Personel Seçimi *
                  </label>
                  <select
                    value={empId}
                    onChange={(e) => handleEmployeeSelectChange(e.target.value)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({e.sicilNo} · {e.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Süreç Türü *
                  </label>
                  <select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value as MobilityProcessType)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {processTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Automated Eligibility Rule Engine Panel */}
              {platformConfig.features.enableAutoEligibilityEngine ? (
              <div
                className={`p-4 rounded-xl border space-y-2.5 ${
                  eligibility.allPassed
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-rose-50/50 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-slate-900">
                    Uygunluk Kural Motoru Kontrolü
                  </span>
                  <span
                    className={`text-[12px] font-bold ${
                      eligibility.allPassed ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {eligibility.allPassed
                      ? 'Tüm Koşullar Sağlandı'
                      : 'Kriter Eksikliği Tespit Edildi'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {eligibility.checks.map((chk) => (
                    <div
                      key={chk.key}
                      className={`px-3 py-2 rounded-lg bg-white border flex items-center justify-between gap-2 text-[12px] ${
                        chk.passed ? 'border-emerald-200' : 'border-rose-200'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 truncate">
                        {chk.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="truncate">{chk.label}</span>
                      </span>
                      <span
                        className={`font-mono font-semibold whitespace-nowrap ${
                          chk.passed ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {chk.actualText}
                      </span>
                    </div>
                  ))}
                </div>

                {!eligibility.allPassed && role === 'ADMIN' && (
                  <div className="pt-2 border-t border-rose-200/80 space-y-2">
                    <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-slate-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adminOverride}
                        onChange={(e) => setAdminOverride(e.target.checked)}
                        className="w-4 h-4 accent-[#C8102E]"
                      />
                      İK Yöneticisi İstisna Onayı (Override) ile süreci başlat
                    </label>
                    {adminOverride && (
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Zorunlu istisna gerekçesi (Örn: Kritik saha pozisyonu acil ihtiyacı)..."
                        className="w-full h-9 px-3 text-[12.5px] bg-white border border-rose-300 rounded-lg"
                      />
                    )}
                  </div>
                )}
              </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-600">
                  Otomatik Terfi Uygunluk Kural Motoru Platform Düzenleyici üzerinden devre dışı bırakılmıştır; talep doğrudan onay akışına gönderilecektir.
                </div>
              )}

              {/* Target Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Hedef Unvan *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Hedef Kadro Derecesi (1–12)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(Number(e.target.value))}
                    className="w-full h-9.5 px-3 font-mono text-[13px] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Hedef Departman / Birim
                  </label>
                  <select
                    value={targetDept}
                    onChange={(e) => setTargetDept(e.target.value as DepartmentName)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Hedef Lokasyon
                  </label>
                  <select
                    value={targetLoc}
                    onChange={(e) => setTargetLoc(e.target.value)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {locations.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Talep ve Atama Gerekçesi *
                </label>
                <textarea
                  rows={3}
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Terfi, rotasyon veya görev değişikliğine ilişkin iş gerekçesi ve performans referansları..."
                  className="w-full p-3 text-[13px] border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2.5 shrink-0">
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
                Onay Akışını Başlat
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Reject Request */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setRejectModalId(null)}
          />
          <form
            onSubmit={handleRejectSubmit}
            className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-slate-900">
                Terfi / Atama Talebini Reddet
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Ret Gerekçesi (Zorunlu) *
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Talebin reddedilme sebebini açıklayınız..."
                className="w-full p-2.5 text-[13px] border border-slate-200 rounded-lg"
              />
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-semibold"
              >
                Reddetmeyi Onayla
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

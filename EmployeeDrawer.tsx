import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  GraduationCap,
  History,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Radar,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useTalentStore } from '../context/TalentStore';
import {
  calculate360Analytics,
  calculateCombinedPotentialIndex,
  evaluatePromotionEligibility,
  formatTrDate,
  getActiveAssignmentForEmployee,
  getEffectiveNineBoxId,
  getEffectivePerformanceScore,
  getInitials,
  getRemainingDays,
} from '../utils/calculations';
import { exportSingleEmployeeSicilXlsx } from '../utils/excelExport';
import {
  classifyPerformanceScore,
  getEmployeeTermSummary,
  PERFORMANCE_TERM_KEYS,
} from '../data/performanceCriteria';
import { EmployeeFormModal } from './EmployeeFormModal';

type DrawerTab = 'sicil' | 'summary' | 'competency360' | 'assignments' | 'history';

export const EmployeeDrawer: React.FC = () => {
  const {
    selectedEmployeeId,
    closeEmployeeDrawer,
    employees,
    competencies,
    assignments,
    rules,
    platformConfig,
    activePeriod,
    startMobilityForEmployee,
    setActiveModule,
    pushToast,
    role,
  } = useTalentStore();

  const [activeTab, setActiveTab] = useState<DrawerTab>('sicil');
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    setActiveTab('sicil');
    setEditModalOpen(false);
  }, [selectedEmployeeId]);

  const employee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  const manager = useMemo(
    () => (employee?.managerId ? employees.find((e) => e.id === employee.managerId) : null),
    [employee, employees]
  );

  const directReports = useMemo(
    () => (employee ? employees.filter((e) => e.managerId === employee.id) : []),
    [employee, employees]
  );

  const analytics = useMemo(() => {
    if (!employee) return null;
    const perfScore = getEffectivePerformanceScore(employee, activePeriod);
    const activePerfRecord = employee.performanceRecords[activePeriod];
    const comp360 = calculate360Analytics(employee, competencies, rules);
    const potIndex = calculateCombinedPotentialIndex(employee, comp360.overallScore);
    const boxId = getEffectiveNineBoxId(employee, activePeriod, competencies, rules);
    const boxMeta = platformConfig.nineBoxCatalog[boxId];
    const eligibility = evaluatePromotionEligibility(employee, activePeriod, competencies, rules);
    const activeAsg = getActiveAssignmentForEmployee(employee.id, assignments);
    const empAssignments = assignments.filter((a) => a.employeeId === employee.id);

    const trendPoints = [...platformConfig.evaluationPeriods].reverse().map((p) => ({
      period: p,
      short: p.replace(' Dönemi', ''),
      score: getEffectivePerformanceScore(employee, p),
    }));

    return {
      perfScore,
      activePerfRecord,
      comp360,
      potIndex,
      boxId,
      boxMeta,
      eligibility,
      activeAsg,
      empAssignments,
      trendPoints,
    };
  }, [
    activePeriod,
    assignments,
    competencies,
    employee,
    platformConfig.evaluationPeriods,
    platformConfig.nineBoxCatalog,
    rules,
  ]);

  if (!employee || !analytics) return null;

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'sicil', label: 'Sicil & Özlük' },
    { key: 'summary', label: 'Performans & Trend' },
    { key: 'competency360', label: '360° Yetkinlik' },
    { key: 'assignments', label: `Görev (${analytics.empAssignments.length})` },
    { key: 'history', label: `Geçmiş (${employee.careerHistory.length})` },
  ];

  // SVG Trend chart dimensions
  const chartW = 540;
  const chartH = 140;
  const padX = 48;
  const padY = 20;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const polylinePoints = analytics.trendPoints
    .map((pt, idx) => {
      const x =
        padX +
        (analytics.trendPoints.length > 1
          ? (idx / (analytics.trendPoints.length - 1)) * innerW
          : innerW / 2);
      const y = padY + innerH - (Math.max(0, Math.min(100, pt.score)) / 100) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  const effectiveStatus = analytics.activeAsg ? 'Geçici Görevde' : employee.employmentStatus;

  const handleDownloadSicilExcel = () => {
    exportSingleEmployeeSicilXlsx({
      employee,
      allEmployees: employees,
      activePeriod,
      competencies,
      rules,
      platformConfig,
      assignments,
    });
    pushToast('success', `${employee.fullName} sicil kartı Excel (.xlsx) olarak indirildi.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px]"
        onClick={closeEmployeeDrawer}
      />

      {/* Slide-over Panel */}
      <aside className="relative z-10 w-full max-w-3xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-13 h-13 rounded-xl bg-[#C8102E] text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
                {getInitials(employee.fullName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span className="font-mono font-semibold text-slate-800">{employee.sicilNo}</span>
                  <span>·</span>
                  <span>Kadro Derecesi {employee.grade}</span>
                  <span>·</span>
                  <span>Pozisyonda {employee.tenureMonths} Ay</span>
                  <span>·</span>
                  <span
                    className={`font-semibold ${
                      effectiveStatus === 'Aktif'
                        ? 'text-emerald-700'
                        : effectiveStatus === 'Geçici Görevde'
                        ? 'text-indigo-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {effectiveStatus}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5 truncate">
                  {employee.fullName}
                </h2>
                <p className="text-[13.5px] font-medium text-slate-700 truncate">
                  {employee.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {employee.department}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {employee.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Giriş: {formatTrDate(employee.hireDate)}
                  </span>
                  {manager && (
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      Yönetici: {manager.fullName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {platformConfig.features.enableCsvExport && (
                <button
                  type="button"
                  onClick={handleDownloadSicilExcel}
                  title="Sicil Kartını Excel (.xlsx) İndir"
                  className="h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-emerald-800 text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Sicil (.xlsx)
                </button>
              )}
              {role !== 'EMPLOYEE' && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  title="Sicil Bilgilerini Düzenle"
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Düzenle
                </button>
              )}
              <button
                type="button"
                onClick={closeEmployeeDrawer}
                aria-label="Kapat"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alerts for Active Assignment or Disciplinary Warning */}
          {(analytics.activeAsg || employee.disciplinaryWarning) && (
            <div className="mt-3.5 space-y-1.5">
              {analytics.activeAsg && (
                <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[12px] text-indigo-900 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Aktif Geçici Görevde: {analytics.activeAsg.targetLocationOrProject}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-700 whitespace-nowrap">
                    Kalan {Math.max(0, getRemainingDays(analytics.activeAsg.endDate))} Gün
                  </span>
                </div>
              )}
              {employee.disciplinaryWarning && (
                <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-900 flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                  <span>
                    <strong className="font-semibold">Aktif Disiplin Kaydı:</strong>{' '}
                    {employee.disciplinaryNote || 'Terfi kural motorunda uyarı olarak işaretlenmiştir.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 4 Metric Strip */}
          <div className="mt-4 grid grid-cols-4 gap-2.5">
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Bireysel Performans</div>
              <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-slate-900">
                {analytics.perfScore.toFixed(1)}
                <span className="text-[11px] font-normal text-slate-400"> / 100</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-slate-500">360° Yetkinlik</div>
              <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-slate-900">
                {analytics.comp360.overallScore.toFixed(1)}
                <span className="text-[11px] font-normal text-slate-400"> / 100</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Potansiyel İndeksi</div>
              <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-slate-900">
                {analytics.potIndex.toFixed(1)}
                <span className="text-[11px] font-normal text-slate-400"> / 100</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Nine-Box Konumu</div>
              <div className={`mt-0.5 text-[13px] font-bold truncate ${analytics.boxMeta.accentText}`}>
                {analytics.boxMeta.shortName}
              </div>
            </div>
          </div>

          {/* Navigation Tabs & Quick Mobility Action */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === t.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {role !== 'EMPLOYEE' && platformConfig.features.enableMobility && (
              <button
                type="button"
                onClick={() => startMobilityForEmployee(employee.id)}
                className="px-3 py-1.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Terfi / Atama Başlat
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'sicil' && (
            <>
              {/* Kişisel Kimlik & İletişim */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-display text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
                    <IdCard className="w-4 h-4 text-[#C8102E]" />
                    Kişisel Kimlik ve İletişim Bilgileri
                  </h3>
                  <span className="font-mono text-[11.5px] text-slate-500">Sicil: {employee.sicilNo}</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">T.C. Kimlik No</div>
                    <div className="font-mono font-medium text-slate-900 mt-0.5">{employee.tcKimlikNo}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Doğum Tarihi / Cinsiyet</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      <span className="font-mono">{formatTrDate(employee.birthDate)}</span> · {employee.gender}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Kurumsal E-posta</div>
                    <div className="font-medium text-slate-900 mt-0.5 inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {employee.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Telefon (GSM)</div>
                    <div className="font-mono font-medium text-slate-900 mt-0.5 inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {employee.phone}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">İkamet İli</div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.city}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Acil Durum İletişim</div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.emergencyContact}</div>
                  </div>
                </div>
              </div>

              {/* Kadro, Organizasyon & İstihdam */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-display text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#C8102E]" />
                    Kadro, İstihdam ve İdari Özlük Bilgileri
                  </h3>
                  <span className="text-[11.5px] font-medium text-slate-500">
                    {employee.employmentType}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Departman / Birim</div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.department}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Görev Lokasyonu</div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.location}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Unvan ve Kadro Derecesi</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {employee.title} (Derece {employee.grade})
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Bağlı Yönetici</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {manager ? `${manager.fullName} (${manager.sicilNo})` : 'Doğrudan Üst Yönetim'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">İşe Giriş / Pozisyon Kıdemi</div>
                    <div className="font-mono font-medium text-slate-900 mt-0.5">
                      {formatTrDate(employee.hireDate)} · {employee.tenureMonths} Ay
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Çalışma Modeli / Durum</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {employee.workModel} · {effectiveStatus}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Masraf Merkezi</div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.costCenter}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">SGK İşyeri Şubesi</div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.sgkBranch}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Yıllık İzin Bakiyesi</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {employee.annualLeaveBalance} İş Günü
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Ekip / Doğrudan Bağlı Personel</div>
                    <div className="font-medium text-slate-900 mt-0.5">
                      {directReports.length > 0
                        ? `${directReports.length} Doğrudan Bağlı (${directReports
                            .map((d) => d.fullName)
                            .slice(0, 2)
                            .join(', ')}${directReports.length > 2 ? '...' : ''})`
                        : employee.hasSubordinates
                        ? 'Ekip Yöneticisi'
                        : 'Bireysel Katkı'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Eğitim, Nitelikler & İK Özlük Notu */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-display text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-[#C8102E]" />
                    Eğitim, Yabancı Dil ve Mesleki Yetkinlik Belgeleri
                  </h3>
                  <span className="text-[11.5px] font-medium text-slate-500">
                    {employee.educationLevel}
                  </span>
                </div>
                <div className="p-4 space-y-3 text-[12.5px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Üniversite / Bölüm</div>
                      <div className="font-medium text-slate-900 mt-0.5">{employee.university}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Yabancı Diller</div>
                      <div className="font-medium text-slate-900 mt-0.5">{employee.foreignLanguages}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      Sertifikalar & Mesleki Lisanslar
                    </div>
                    <div className="font-medium text-slate-900 mt-0.5">{employee.certifications}</div>
                  </div>
                  {employee.notes && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-400 font-medium">İK Özlük & Değerlendirme Notu</div>
                      <p className="text-slate-700 mt-0.5 leading-relaxed">{employee.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Nine-Box & Terfi Uygunluk Hızlı Özeti */}
              <div className={`p-4 rounded-xl border ${analytics.boxMeta.accentBg} ${analytics.boxMeta.accentBorder}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11.5px] text-slate-500">
                      Yetenek Segmenti ({activePeriod}) · Terfi Durumu:{' '}
                      <strong className={analytics.eligibility.allPassed ? 'text-emerald-700' : 'text-amber-700'}>
                        {analytics.eligibility.allPassed ? 'Tüm Kriterlere Uygun' : 'Eksik Kriter Mevcut'}
                      </strong>
                    </div>
                    <div className={`text-[15px] font-display font-bold mt-0.5 ${analytics.boxMeta.accentText}`}>
                      {analytics.boxMeta.name}
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-[12.5px] text-slate-700">
                  {analytics.boxMeta.recommendation}
                </p>
              </div>
            </>
          )}

          {activeTab === 'summary' && (
            <>
              {/* EK-13 / EK-14 / EK-15 3-Term Individual Performance Summary */}
              {(() => {
                const termSummary = getEmployeeTermSummary(employee);
                return (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-[13.5px] font-bold text-slate-900">
                          6 Boyutlu Bireysel Performans Sonuçları (EK-13 / EK-15)
                        </h3>
                        <p className="text-[11.5px] text-slate-500">
                          Yıllık 3 dönem ortalaması ve sınıflandırma durumu
                        </p>
                      </div>
                      {termSummary.annualScore !== null && termSummary.annualBand ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-[15px] font-bold text-slate-900">
                            {termSummary.annualScore.toFixed(2)} / 5.00
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${termSummary.annualBand.badgeClass}`}
                          >
                            {termSummary.annualBand.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-400">Henüz tamamlanmadı</span>
                      )}
                    </div>
                    <div className="p-3.5 grid grid-cols-3 gap-2.5">
                      {PERFORMANCE_TERM_KEYS.map((termKey) => {
                        const tRec = employee.termEvaluations?.[termKey];
                        const done = tRec?.status === 'Tamamlandı' && typeof tRec.termScore === 'number';
                        const band = done ? classifyPerformanceScore(tRec.termScore) : null;
                        return (
                          <div
                            key={termKey}
                            className={`p-3 rounded-lg border ${
                              band ? band.cardClass : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="text-[11px] font-semibold text-slate-500">
                              {termKey}
                            </div>
                            <div className="mt-0.5 font-mono tabular-nums text-[16px] font-bold text-slate-900">
                              {done ? tRec.termScore!.toFixed(2) : '—'}
                            </div>
                            <div className="mt-1">
                              {band ? (
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold ${band.badgeClass}`}
                                >
                                  {band.label}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Bekliyor</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Performance Trend Chart */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#C8102E]" />
                    Dönemsel Performans Trendi
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      closeEmployeeDrawer();
                      setActiveModule('performance');
                    }}
                    className="text-[12px] font-medium text-[#C8102E] hover:underline"
                  >
                    OKR/KPI Detayına Git
                  </button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-36">
                    {[25, 50, 75, 100].map((v) => {
                      const y = padY + innerH - (v / 100) * innerH;
                      return (
                        <g key={v}>
                          <line
                            x1={padX}
                            x2={chartW - padX}
                            y1={y}
                            y2={y}
                            stroke="#E2E8F0"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padX - 8}
                            y={y + 3}
                            textAnchor="end"
                            className="fill-slate-400 text-[10px] font-mono"
                          >
                            {v}
                          </text>
                        </g>
                      );
                    })}
                    <polyline
                      fill="none"
                      stroke="#C8102E"
                      strokeWidth="2.5"
                      points={polylinePoints}
                    />
                    {analytics.trendPoints.map((pt, idx) => {
                      const x =
                        padX +
                        (analytics.trendPoints.length > 1
                          ? (idx / (analytics.trendPoints.length - 1)) * innerW
                          : innerW / 2);
                      const y = padY + innerH - (Math.max(0, Math.min(100, pt.score)) / 100) * innerH;
                      return (
                        <g key={pt.period}>
                          <circle cx={x} cy={y} r="5" fill="#FFFFFF" stroke="#C8102E" strokeWidth="2.5" />
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            className="fill-slate-900 text-[11px] font-mono font-semibold"
                          >
                            {pt.score.toFixed(1)}
                          </text>
                          <text
                            x={x}
                            y={chartH - 3}
                            textAnchor="middle"
                            className="fill-slate-500 text-[10.5px]"
                          >
                            {pt.short}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Active Period KPI Table */}
              {analytics.activePerfRecord && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="font-display text-[14px] font-bold text-slate-900">
                      {activePeriod} KPI / OKR Karnesi
                    </h3>
                    <span className="text-[12px] text-slate-500">
                      Aşama: <strong className="text-slate-800">{analytics.activePerfRecord.stage}</strong>
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Hedef / KPI</th>
                          <th className="py-2 px-3 text-right">Ağırlık</th>
                          <th className="py-2 px-3 text-right">Hedef / Gerçek</th>
                          <th className="py-2 px-3 text-right">Puan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.activePerfRecord.kpis.map((k) => (
                          <tr key={k.id}>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900">{k.title}</div>
                              <div className="text-[11px] text-slate-400">{k.category}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              %{k.weight}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                              {k.actualValue} / {k.targetValue} {k.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {k.managerScore}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Promotion Eligibility Check */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-[14px] font-bold text-slate-900">
                    Terfi ve Atama Kural Motoru Durumu
                  </h3>
                  <span
                    className={`text-[12px] font-semibold ${
                      analytics.eligibility.allPassed ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {analytics.eligibility.allPassed
                      ? 'Tüm Kriterler Karşılanıyor'
                      : 'Bazı Kriterler Eksik (İK İstisnası Gerekir)'}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {analytics.eligibility.checks.map((chk) => (
                    <div
                      key={chk.key}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-[12.5px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {chk.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-medium text-slate-800 truncate">{chk.label}</span>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <span
                          className={`font-semibold ${
                            chk.passed ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {chk.actualText}
                        </span>
                        <span className="text-slate-400 text-[11px] ml-2">({chk.requiredText})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'competency360' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                    <Radar className="w-4 h-4 text-[#C8102E]" />
                    360° Yetkinlik Puan ve Boşluk Analizi
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Rol Grubu: <strong className="text-slate-700">{analytics.comp360.roleGroup}</strong> · Katılım: {analytics.comp360.completedCount}/{analytics.comp360.totalCount} değerlendirici (%{analytics.comp360.completionRate}) · Ağırlık: Yönetici %{analytics.comp360.normalizedWeights.MANAGER}, Eş Düzey %{analytics.comp360.normalizedWeights.PEER}, Ast %{analytics.comp360.normalizedWeights.SUBORDINATE}, İç Müşteri %{analytics.comp360.normalizedWeights.INTERNAL_CUSTOMER}, Öz %{analytics.comp360.normalizedWeights.SELF}
                  </p>
                </div>
              </div>

              {/* Blind spots & Hidden strengths */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="text-[12px] font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Kör Noktalar ({analytics.comp360.blindSpots.length})
                  </div>
                  <p className="text-[11.5px] text-amber-800 mt-1">
                    {analytics.comp360.blindSpots.length > 0
                      ? analytics.comp360.blindSpots.map((b) => b.competencyName).join(', ')
                      : 'Belirgin kör nokta saptanmadı.'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-[12px] font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Gizli Güçler ({analytics.comp360.hiddenStrengths.length})
                  </div>
                  <p className="text-[11.5px] text-emerald-800 mt-1">
                    {analytics.comp360.hiddenStrengths.length > 0
                      ? analytics.comp360.hiddenStrengths.map((h) => h.competencyName).join(', ')
                      : 'Öz algı ile dış değerlendirme dengeli.'}
                  </p>
                </div>
              </div>

              {/* Bar Breakdown */}
              <div className="space-y-3">
                {analytics.comp360.rows.map((row) => (
                  <div key={row.competencyId} className="p-3.5 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {row.competencyName}
                      </span>
                      <div className="flex items-center gap-2 text-[12px] font-mono tabular-nums">
                        <span className="text-slate-500">Ağırlıklı:</span>
                        <span className="font-bold text-slate-900">{row.weightedScore.toFixed(1)}</span>
                        {row.insight !== 'Uyumlu' && (
                          <span
                            className={`font-sans text-[11px] font-semibold ${
                              row.insight === 'Kör Nokta' ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            · {row.insight} ({row.gap > 0 ? `+${row.gap}` : row.gap})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-slate-500">Öz Değ.</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-400 rounded-full"
                            style={{ width: `${row.selfAvg ?? 0}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono tabular-nums text-slate-700">
                          {row.selfAvg?.toFixed(0) ?? '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-slate-500">Yönetici</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#C8102E] rounded-full"
                            style={{ width: `${row.managerAvg ?? 0}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono tabular-nums text-slate-700">
                          {row.managerAvg?.toFixed(0) ?? '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-slate-500">İç Müşteri</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${row.internalCustomerAvg ?? 0}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono tabular-nums text-slate-700">
                          {row.internalCustomerAvg?.toFixed(0) ?? '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-slate-500">Diğerleri Ort.</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${row.othersAvg ?? 0}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono tabular-nums text-slate-700">
                          {row.othersAvg?.toFixed(0) ?? '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#C8102E]" />
                  Geçici Görevlendirme ve Saha Atamaları
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    closeEmployeeDrawer();
                    setActiveModule('assignments');
                  }}
                  className="text-[12px] font-medium text-[#C8102E] hover:underline"
                >
                  Tüm Görevlendirmeleri Yönet
                </button>
              </div>
              {analytics.empAssignments.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500">
                  Bu çalışan için kayıtlı aktif veya geçmiş geçici görevlendirme bulunmuyor.
                </div>
              ) : (
                analytics.empAssignments.map((asg) => {
                  const rem = getRemainingDays(asg.endDate);
                  return (
                    <div
                      key={asg.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[13.5px] font-semibold text-slate-900">
                            {asg.targetLocationOrProject}
                          </div>
                          <div className="text-[12px] text-slate-500">{asg.category}</div>
                        </div>
                        <span
                          className={`text-[12px] font-semibold whitespace-nowrap ${
                            asg.status === 'Aktif'
                              ? rem <= platformConfig.assignmentExpiryWarningDays
                                ? 'text-amber-700'
                                : 'text-indigo-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {asg.status === 'Aktif'
                            ? `Aktif · Kalan ${Math.max(0, rem)} Gün`
                            : `${asg.status}${asg.actualDaysServed ? ` (${asg.actualDaysServed} Gün)` : ''}`}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-600 flex items-center gap-3 font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1 font-sans">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatTrDate(asg.startDate)} – {formatTrDate(asg.endDate)}
                        </span>
                        <span>·</span>
                        <span className="font-sans">
                          {asg.hasAllowance ? 'Harcırah / Vekalet Ücreti Var' : 'Ek Ödeme Yok'}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600">{asg.notes}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-display text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#C8102E]" />
                Kronolojik Kariyer, Sicil ve Değerlendirme Tarihçesi
              </h3>
              <div className="relative pl-5 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {employee.careerHistory.map((ev) => (
                  <div key={ev.id} className="relative">
                    <span
                      className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        ev.type === 'TERFİ'
                          ? 'bg-emerald-500'
                          : ev.type === 'KALİBRASYON'
                          ? 'bg-amber-500'
                          : ev.type === 'GÖREVLENDİRME'
                          ? 'bg-indigo-500'
                          : ev.type === 'SİCİL GÜNCELLEME'
                          ? 'bg-slate-500'
                          : 'bg-[#C8102E]'
                      }`}
                    />
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-slate-500">
                        <span className="font-semibold text-slate-700">{ev.type}</span>
                        <span className="font-mono tabular-nums">
                          {formatTrDate(ev.date)} · {ev.actor}
                        </span>
                      </div>
                      <div className="mt-1 text-[13.5px] font-semibold text-slate-900">
                        {ev.title}
                      </div>
                      <p className="mt-1 text-[12.5px] text-slate-600 leading-relaxed">
                        {ev.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {editModalOpen && (
        <EmployeeFormModal
          employee={employee}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
};

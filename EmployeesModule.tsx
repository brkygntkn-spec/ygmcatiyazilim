import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { EmployeeFormModal } from './EmployeeFormModal';
import { useTalentStore } from './TalentStore';
import { Employee, ParsedEmployeeImportRow } from './talent';
import {
  calculate360Analytics,
  formatTrDate,
  getActiveAssignmentForEmployee,
  getEffectiveNineBoxId,
  getEffectivePerformanceScore,
  getInitials,
} from './calculations';
import {
  downloadEmployeeImportTemplateXlsx,
  exportMasterEmployeesToXlsx,
  parseEmployeeExcelFile,
} from './excelExport';

export const EmployeesModule: React.FC = () => {
  const {
    employees,
    competencies,
    assignments,
    rules,
    platformConfig,
    activePeriod,
    role,
    currentRoleEmployeeId,
    openEmployeeDrawer,
    bulkImportEmployees,
    setExcelModalOpen,
    pushToast,
  } = useTalentStore();

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Manual Create/Edit Employee modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Excel Bulk Import / Update modal
  const [importOpen, setImportOpen] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ParsedEmployeeImportRow[]>([]);
  const [discoveredDepts, setDiscoveredDepts] = useState<string[]>([]);
  const [discoveredLocs, setDiscoveredLocs] = useState<string[]>([]);
  const [syncCatalogs, setSyncCatalogs] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManageEmployees = role !== 'EMPLOYEE';

  const departmentOptions = useMemo(
    () => Array.from(new Set([...platformConfig.departments, ...employees.map((e) => e.department)])),
    [employees, platformConfig.departments]
  );

  const locationOptions = useMemo(
    () => Array.from(new Set([...platformConfig.locations, ...employees.map((e) => e.location)])),
    [employees, platformConfig.locations]
  );

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const scopedEmployees = useMemo(
    () =>
      role === 'EMPLOYEE'
        ? employees.filter((e) => e.id === currentRoleEmployeeId)
        : employees,
    [currentRoleEmployeeId, employees, role]
  );

  const enrichedRows = useMemo(() => {
    return scopedEmployees.map((emp) => {
      const perf = getEffectivePerformanceScore(emp, activePeriod);
      const comp360 = calculate360Analytics(emp, competencies, rules).overallScore;
      const boxId = getEffectiveNineBoxId(emp, activePeriod, competencies, rules);
      const boxMeta = platformConfig.nineBoxCatalog[boxId];
      const activeAsg = getActiveAssignmentForEmployee(emp.id, assignments);
      const effectiveStatus = activeAsg ? 'Geçici Görevde' : emp.employmentStatus;
      const manager = emp.managerId ? empById.get(emp.managerId) : undefined;
      return {
        emp,
        perf,
        comp360,
        boxMeta,
        activeAsg,
        effectiveStatus,
        manager,
      };
    });
  }, [activePeriod, assignments, competencies, empById, platformConfig.nineBoxCatalog, rules, scopedEmployees]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return enrichedRows.filter(({ emp, effectiveStatus }) => {
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) return false;
      if (locationFilter !== 'ALL' && emp.location !== locationFilter) return false;
      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        emp.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.sicilNo.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.title.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.department.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.location.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.email.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.phone.toLocaleLowerCase('tr-TR').includes(q) ||
        emp.city.toLocaleLowerCase('tr-TR').includes(q)
      );
    });
  }, [departmentFilter, enrichedRows, locationFilter, search, statusFilter]);

  const summary = useMemo(() => {
    const total = scopedEmployees.length;
    const activeCount = enrichedRows.filter((r) => r.effectiveStatus === 'Aktif').length;
    const onAssignmentCount = enrichedRows.filter((r) => r.effectiveStatus === 'Geçici Görevde').length;
    const deptCount = new Set(scopedEmployees.map((e) => e.department)).size;
    const locCount = new Set(scopedEmployees.map((e) => e.location)).size;
    return { total, activeCount, onAssignmentCount, deptCount, locCount };
  }, [enrichedRows, scopedEmployees]);

  const resetImportModal = () => {
    setImportError(null);
    setImportFileName(null);
    setImportRows([]);
    setDiscoveredDepts([]);
    setDiscoveredLocs([]);
    setSyncCatalogs(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = async (file: File) => {
    setImportError(null);
    setImportLoading(true);
    try {
      const parsed = await parseEmployeeExcelFile(file, employees, platformConfig);
      setImportFileName(file.name);
      setImportRows(parsed.rows);
      setDiscoveredDepts(parsed.discoveredDepartments);
      setDiscoveredLocs(parsed.discoveredLocations);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : 'Excel dosyası okunamadı. Lütfen geçerli bir .xlsx veya .csv dosyası seçin.'
      );
      setImportRows([]);
      setImportFileName(null);
    } finally {
      setImportLoading(false);
    }
  };

  const importStats = useMemo(() => {
    const updates = importRows.filter((r) => r.status === 'UPDATE').length;
    const inserts = importRows.filter((r) => r.status === 'INSERT').length;
    const errors = importRows.filter((r) => r.status === 'ERROR').length;
    return { updates, inserts, errors, valid: updates + inserts };
  }, [importRows]);

  const handleConfirmImport = () => {
    if (importStats.valid === 0) return;
    bulkImportEmployees(importRows, { syncCatalogs });
    setImportOpen(false);
    resetImportModal();
  };

  const handleExportMasterList = () => {
    exportMasterEmployeesToXlsx({
      employees: filteredRows.map((r) => r.emp),
      allEmployees: employees,
      activePeriod,
      competencies,
      rules,
      platformConfig,
      assignments,
    });
    pushToast(
      'success',
      `${filteredRows.length} personelin tam sicil listesi Excel (.xlsx) olarak indirildi.`
    );
  };

  const handleDownloadTemplate = () => {
    downloadEmployeeImportTemplateXlsx(platformConfig);
    pushToast('info', 'Excel personel yükleme şablonu indirildi.');
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Personel Listesi ve Sicil Merkezi
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            Tüm modüllerin tek veri kaynağı — Excel ile toplu personel yükleyin, güncelleyin ve tam sicil kartlarını yönetin
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageEmployees && (
            <>
              <button
                type="button"
                onClick={() => {
                  resetImportModal();
                  setImportOpen(true);
                }}
                className="h-9 px-3.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Excel ile Yükle / Güncelle
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingEmployee(null);
                  setFormOpen(true);
                }}
                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4 text-[#C8102E]" />
                Yeni Personel
              </button>
            </>
          )}

          {platformConfig.features.enableCsvExport && (
            <>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                Şablon İndir
              </button>
              <button
                type="button"
                onClick={handleExportMasterList}
                className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-emerald-800 text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Listeyi İndir (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setExcelModalOpen(true)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Rapor Merkezi
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Toplam Kayıtlı Personel</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {summary.total}
          </div>
          <div className="mt-0.5 text-[11.5px] text-slate-500">
            Tüm modüllerin ana personel havuzu
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Asli Görevde Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-emerald-700">
            {summary.activeCount}
          </div>
          <div className="mt-0.5 text-[11.5px] text-slate-500">
            Toplam kadronun %{summary.total ? Math.round((summary.activeCount / summary.total) * 100) : 0}&apos;i
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Geçici Görevde / Sahada</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-indigo-700">
            {summary.onAssignmentCount}
          </div>
          <div className="mt-0.5 text-[11.5px] text-slate-500">
            Görevlendirme modülü ile senkronize
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span>Birim ve Lokasyon Ağı</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {summary.deptCount} <span className="text-[14px] font-sans font-medium text-slate-400">/ {summary.locCount}</span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-slate-500">
            Aktif departman / görev lokasyonu
          </div>
        </div>
      </div>

      {/* Filter Bar & Master Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad soyad, sicil no, unvan, e-posta, telefon veya il ara..."
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#C8102E]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Departman Filtresi"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 focus:outline-none focus:border-[#C8102E]"
            >
              <option value="ALL">Tüm Birimler</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              aria-label="Lokasyon Filtresi"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 focus:outline-none focus:border-[#C8102E]"
            >
              <option value="ALL">Tüm Lokasyonlar</option>
              {locationOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <select
              aria-label="Çalışma Durumu Filtresi"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 focus:outline-none focus:border-[#C8102E]"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="Aktif">Aktif</option>
              <option value="Geçici Görevde">Geçici Görevde</option>
              <option value="İzinli">İzinli</option>
              <option value="Pasif">Pasif</option>
            </select>

            <span className="text-[12px] font-mono tabular-nums text-slate-500 px-1.5">
              {filteredRows.length} / {employees.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                <th className="py-3 px-4 whitespace-nowrap">Sicil / Personel</th>
                <th className="py-3 px-4 whitespace-nowrap">Unvan & Derece</th>
                <th className="py-3 px-4 whitespace-nowrap">Birim & Lokasyon</th>
                <th className="py-3 px-4 whitespace-nowrap">İletişim</th>
                <th className="py-3 px-4 whitespace-nowrap">İstihdam & Giriş</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Perf. / 360°</th>
                <th className="py-3 px-4 whitespace-nowrap">Durum</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Arama veya filtre kriterlerine uygun personel kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ emp, perf, comp360, boxMeta, effectiveStatus, manager }) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openEmployeeDrawer(emp.id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-[#C8102E] group-hover:text-white transition-colors font-semibold text-xs flex items-center justify-center shrink-0">
                          {getInitials(emp.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 group-hover:text-[#C8102E] transition-colors truncate">
                            {emp.fullName}
                          </div>
                          <div className="text-[11.5px] font-mono text-slate-500">
                            {emp.sicilNo}
                            {manager ? (
                              <span className="font-sans text-slate-400"> · Yön: {manager.fullName}</span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{emp.title}</div>
                      <div className="text-[11.5px] text-slate-500 font-mono tabular-nums">
                        Derece {emp.grade} · {emp.tenureMonths} Ay
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{emp.department}</div>
                      <div className="text-[11.5px] text-slate-500 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {emp.location}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-[12px] text-slate-700 flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[190px]">{emp.email}</span>
                      </div>
                      <div className="text-[11.5px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.phone}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-[12px] text-slate-800">{emp.workModel} · {emp.educationLevel}</div>
                      <div className="text-[11.5px] font-mono text-slate-500">
                        {formatTrDate(emp.hireDate)} · İzin: {emp.annualLeaveBalance}g
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="font-mono tabular-nums font-semibold text-slate-900">
                        {perf.toFixed(1)} <span className="text-slate-300">/</span>{' '}
                        <span className="text-slate-700">{comp360.toFixed(1)}</span>
                      </div>
                      <div className={`text-[11px] font-medium ${boxMeta.accentText}`}>
                        {boxMeta.shortName}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[12px] font-semibold ${
                          effectiveStatus === 'Aktif'
                            ? 'text-emerald-700'
                            : effectiveStatus === 'Geçici Görevde'
                            ? 'text-indigo-700'
                            : effectiveStatus === 'İzinli'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {effectiveStatus}
                      </span>
                      {emp.disciplinaryWarning && (
                        <div className="text-[11px] text-rose-600 font-medium">Disiplin Kaydı</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEmployeeDrawer(emp.id)}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-[12px] font-medium text-slate-700 inline-flex items-center gap-1 transition-colors"
                        >
                          <IdCard className="w-3.5 h-3.5" />
                          Sicil Kartı
                        </button>
                        {canManageEmployees && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmployee(emp);
                              setFormOpen(true);
                            }}
                            title="Sicil Bilgilerini Düzenle"
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Bulk Import / Update Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={() => setImportOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-[#C8102E] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-[17px] font-bold text-slate-900">
                    Excel ile Personel Listesi Yükle ve Güncelle
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Mevcut Sicil No eşleşmeleri güncellenir (performans & 360° korunur), yeni Sicil No satırları eklenir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                aria-label="Kapat"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setImportDragging(true);
                }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setImportDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFileSelected(file);
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  importDragging
                    ? 'border-[#C8102E] bg-rose-50/40'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileSelected(file);
                  }}
                />
                <FileSpreadsheet className="w-9 h-9 text-emerald-600 mx-auto" />
                <div className="mt-2 text-[14px] font-semibold text-slate-900">
                  {importFileName ? `Yüklenen Dosya: ${importFileName}` : 'Excel dosyasını sürükleyip bırakın veya seçin'}
                </div>
                <p className="text-[12px] text-slate-500 mt-1">
                  Desteklenen formatlar: .xlsx, .xls, .csv (Maks. 5 MB) · Mevcut listeyi indirip Excel&apos;de düzenleyerek geri yükleyebilirsiniz
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={importLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 px-4 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {importLoading ? 'Dosya Okunuyor...' : 'Excel Dosyası Seç'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12.5px] font-medium inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Örnek Şablonu İndir (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMasterList}
                    className="h-9 px-3.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 text-[12.5px] font-medium inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Mevcut Listeyi İndir
                  </button>
                </div>
              </div>

              {importError && (
                <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-[13px] text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Parsed Preview */}
              {importRows.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="px-4 py-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <div className="text-[11.5px] text-indigo-700 font-medium">Güncellenecek Personel</div>
                      <div className="font-mono tabular-nums text-xl font-bold text-indigo-900 mt-0.5">
                        {importStats.updates}
                      </div>
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <div className="text-[11.5px] text-emerald-700 font-medium">Yeni Eklenecek Personel</div>
                      <div className="font-mono tabular-nums text-xl font-bold text-emerald-900 mt-0.5">
                        {importStats.inserts}
                      </div>
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-rose-50/70 border border-rose-200">
                      <div className="text-[11.5px] text-rose-700 font-medium">Hatalı / Atlanacak Satır</div>
                      <div className="font-mono tabular-nums text-xl font-bold text-rose-900 mt-0.5">
                        {importStats.errors}
                      </div>
                    </div>
                  </div>

                  {(discoveredDepts.length > 0 || discoveredLocs.length > 0) && (
                    <div className="px-4 py-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start justify-between gap-3">
                      <div className="text-[12.5px] text-amber-900">
                        <strong className="font-semibold">Yeni Organizasyon Tanımları Tespit Edildi:</strong>{' '}
                        {discoveredDepts.length > 0 && `Birimler: ${discoveredDepts.join(', ')}`}
                        {discoveredDepts.length > 0 && discoveredLocs.length > 0 ? ' · ' : ''}
                        {discoveredLocs.length > 0 && `Lokasyonlar: ${discoveredLocs.join(', ')}`}
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-900 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncCatalogs}
                          onChange={(e) => setSyncCatalogs(e.target.checked)}
                          className="rounded border-amber-400 text-[#C8102E]"
                        />
                        Kataloğa Ekle
                      </label>
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[12.5px]">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-[11px] text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Satır</th>
                          <th className="py-2.5 px-3">İşlem</th>
                          <th className="py-2.5 px-3">Sicil No</th>
                          <th className="py-2.5 px-3">Ad Soyad</th>
                          <th className="py-2.5 px-3">Unvan / Birim</th>
                          <th className="py-2.5 px-3">Değişiklik / Detay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importRows.map((row) => (
                          <tr key={`${row.rowNumber}-${row.data?.sicilNo ?? 'err'}`}>
                            <td className="py-2 px-3 font-mono text-slate-400">#{row.rowNumber}</td>
                            <td className="py-2 px-3 whitespace-nowrap font-semibold">
                              {row.status === 'UPDATE' ? (
                                <span className="text-indigo-700">Güncelleme</span>
                              ) : row.status === 'INSERT' ? (
                                <span className="text-emerald-700">Yeni Kayıt</span>
                              ) : (
                                <span className="text-rose-700">Hata</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-800">
                              {row.data?.sicilNo || '-'}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900">
                              {row.data?.fullName || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {row.status !== 'ERROR'
                                ? `${row.data.title} · ${row.data.department}`
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-[12px] text-slate-600">
                              {row.status === 'ERROR'
                                ? row.errorMessage
                                : row.status === 'INSERT'
                                ? 'Yeni sicil kartı ve dönem KPI şablonu oluşturulacak'
                                : row.changedFields.length > 0
                                ? `Değişenler: ${row.changedFields.join(', ')}`
                                : 'Mevcut verilerle birebir aynı'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              <div className="text-[12px] text-slate-500">
                {importStats.valid > 0
                  ? `${importStats.valid} geçerli kayıt tüm platform modüllerine işlenmeye hazır.`
                  : 'Önizleme için yukarıdan bir Excel dosyası yükleyin.'}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={importStats.valid === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-40 text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Onayla ve Listeyi Güncelle ({importStats.valid})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Create / Edit Employee Modal */}
      {formOpen && (
        <EmployeeFormModal
          employee={editingEmployee}
          onClose={() => {
            setFormOpen(false);
            setEditingEmployee(null);
          }}
        />
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  FileSpreadsheet,
  Square,
  X,
} from 'lucide-react';
import { useTalentStore } from './TalentStore';
import { EvaluationPeriod } from './talent';
import {
  ComprehensiveReportSelection,
  exportComprehensiveReportXlsx,
} from './excelExport';

export const ExcelExportModal: React.FC = () => {
  const {
    excelModalOpen,
    setExcelModalOpen,
    employees,
    competencies,
    rules,
    platformConfig,
    mobilityRequests,
    assignments,
    activePeriod,
    role,
    currentRoleEmployeeId,
    pushToast,
  } = useTalentStore();

  const [selectedPeriod, setSelectedPeriod] = useState<EvaluationPeriod>(activePeriod);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [selection, setSelection] = useState<ComprehensiveReportSelection>({
    summary: true,
    employees: true,
    performance: true,
    feedback360: true,
    ninebox: true,
    mobilityAssignments: true,
  });

  useEffect(() => {
    if (excelModalOpen) {
      setSelectedPeriod(activePeriod);
      if (role === 'EMPLOYEE') {
        setDepartmentFilter('ALL');
      }
    }
  }, [activePeriod, excelModalOpen, role]);

  const scopedEmployees = useMemo(
    () =>
      role === 'EMPLOYEE'
        ? employees.filter((e) => e.id === currentRoleEmployeeId)
        : employees,
    [currentRoleEmployeeId, employees, role]
  );

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set([...platformConfig.departments, ...scopedEmployees.map((e) => e.department)])
      ),
    [platformConfig.departments, scopedEmployees]
  );

  const filteredEmployees = useMemo(() => {
    if (departmentFilter === 'ALL') return scopedEmployees;
    return scopedEmployees.filter((e) => e.department === departmentFilter);
  }, [departmentFilter, scopedEmployees]);

  const sheetItems: {
    key: keyof ComprehensiveReportSelection;
    title: string;
    desc: string;
    countLabel: string;
  }[] = useMemo(() => {
    const empIds = new Set(filteredEmployees.map((e) => e.id));
    const kpiCount = filteredEmployees.reduce(
      (sum, e) => sum + (e.performanceRecords[selectedPeriod]?.kpis.length ?? 0),
      0
    );
    const mobAsgCount =
      mobilityRequests.filter((m) => empIds.has(m.employeeId)).length +
      assignments.filter((a) => empIds.has(a.employeeId)).length;

    return [
      {
        key: 'summary',
        title: 'Yönetici Özeti & Birim Ortalamaları',
        desc: 'Dönem geneli KPI özetleri, birim performans ve 360° ortalamaları',
        countLabel: 'Özet Sayfa',
      },
      {
        key: 'employees',
        title: 'Personel Listesi (Tam Sicil & Özlük)',
        desc: 'Tüm özlük, iletişim, eğitim, kadro, izin ve yetenek özetleri (Excel yükleme uyumlu)',
        countLabel: `${filteredEmployees.length} Personel`,
      },
      {
        key: 'performance',
        title: 'Bireysel Performans & KPI Detayı',
        desc: 'Hedef, gerçekleşen, ağırlık, öz/yönetici puanı ve kalibrasyon notları',
        countLabel: `${kpiCount} KPI Satırı`,
      },
      {
        key: 'feedback360',
        title: '360° Yetkinlik & Boşluk Analizi',
        desc: 'Yetkinlik bazlı ağırlıklı puanlar, kör noktalar ve gizli güçler',
        countLabel: `${filteredEmployees.length} Kayıt`,
      },
      {
        key: 'ninebox',
        title: 'Nine-Box Yetenek Dağılımı',
        desc: 'Kutu kodları, segment isimleri, kalibrasyon notları ve gelişim önerileri',
        countLabel: `${filteredEmployees.length} Kayıt`,
      },
      {
        key: 'mobilityAssignments',
        title: 'Terfi, Atama & Geçici Görevlendirmeler',
        desc: 'Aktif ve geçmiş tüm terfi süreçleri ile saha/proje görevlendirmeleri',
        countLabel: `${mobAsgCount} Süreç`,
      },
    ];
  }, [assignments, filteredEmployees, mobilityRequests, selectedPeriod]);

  if (!excelModalOpen) return null;

  const selectedCount = Object.values(selection).filter(Boolean).length;

  const toggleSheet = (key: keyof ComprehensiveReportSelection) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    if (selectedCount === 0) {
      pushToast('warning', 'Lütfen en az bir rapor sayfası seçin.');
      return;
    }
    exportComprehensiveReportXlsx({
      employees: filteredEmployees,
      allEmployees: employees,
      activePeriod: selectedPeriod,
      departmentFilter,
      competencies,
      rules,
      platformConfig,
      mobilityRequests,
      assignments,
      selection,
    });
    pushToast(
      'success',
      `${selectedCount} çalışma sayfalı Excel raporu (.xlsx) başarıyla indirildi.`
    );
    setExcelModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={() => setExcelModalOpen(false)}
      />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-slate-900">
                Excel Rapor Merkezi (.xlsx)
              </h2>
              <p className="text-[12.5px] text-slate-500">
                Personel listesinden canlı çekilen çok sayfalı kurumsal İK çalışma kitabı oluşturun
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExcelModalOpen(false)}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Scope Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Değerlendirme Dönemi
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] text-slate-900 focus:outline-none focus:bg-white focus:border-[#C8102E]"
              >
                {platformConfig.evaluationPeriods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Birim / Departman Kapsamı
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] text-slate-900 focus:outline-none focus:bg-white focus:border-[#C8102E]"
              >
                <option value="ALL">Tüm Birimler ({scopedEmployees.length} Personel)</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d} ({scopedEmployees.filter((e) => e.department === d).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sheet Selector */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12.5px] font-semibold text-slate-800">
                Çalışma Sayfaları ({selectedCount} / {sheetItems.length} seçili)
              </span>
              <div className="flex items-center gap-3 text-[12px]">
                <button
                  type="button"
                  onClick={() =>
                    setSelection({
                      summary: true,
                      employees: true,
                      performance: true,
                      feedback360: true,
                      ninebox: true,
                      mobilityAssignments: true,
                    })
                  }
                  className="font-medium text-[#C8102E] hover:underline"
                >
                  Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelection({
                      summary: false,
                      employees: false,
                      performance: false,
                      feedback360: false,
                      ninebox: false,
                      mobilityAssignments: false,
                    })
                  }
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {sheetItems.map((item) => {
                const checked = selection[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleSheet(item.key)}
                    className={`w-full px-4 py-3 rounded-xl border text-left flex items-start justify-between gap-3 transition-colors ${
                      checked
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900">{item.title}</div>
                        <div className="text-[12px] text-slate-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-[11.5px] font-medium text-slate-600 whitespace-nowrap shrink-0">
                      {item.countLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="text-[12px] text-slate-500">
            Kapsam: <strong className="text-slate-800">{filteredEmployees.length} personel</strong> ·{' '}
            {selectedPeriod}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExcelModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={selectedCount === 0}
              className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-45 text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Excel Raporu İndir (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

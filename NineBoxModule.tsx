import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Download,
  GripVertical,
  Info,
  RotateCcw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTalentStore } from './TalentStore';
import { Employee, NineBoxId } from './talent';
import {
  calculate360Analytics,
  calculateCombinedPotentialIndex,
  getEffectiveNineBoxId,
  getEffectivePerformanceScore,
  getInitials,
  NINE_BOX_GRID_ORDER,
} from './calculations';
import { exportWorkbookToXlsx } from './excelExport';

export const NineBoxModule: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    employees,
    competencies,
    rules,
    platformConfig,
    activePeriod,
    role,
    currentRoleEmployeeId,
    nineBoxFilterId,
    setNineBoxFilterId,
    calibrateEmployeeNineBox,
    resetEmployeeNineBoxOverride,
    startMobilityForEmployee,
    openEmployeeDrawer,
    openSettingsTab,
  } = useTalentStore();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [draggedEmpId, setDraggedEmpId] = useState<string | null>(null);
  const [dragOverBoxId, setDragOverBoxId] = useState<NineBoxId | null>(null);

  // Calibration confirmation modal
  const [pendingMove, setPendingMove] = useState<{
    employee: Employee;
    fromBoxId: NineBoxId;
    toBoxId: NineBoxId;
  } | null>(null);
  const [calibrationReason, setCalibrationReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const enriched = useMemo(() => {
    const base =
      role === 'EMPLOYEE'
        ? employees.filter((e) => e.id === currentRoleEmployeeId)
        : employees;
    const q = search.trim().toLocaleLowerCase('tr-TR');

    return base
      .map((emp) => {
        const perf = getEffectivePerformanceScore(emp, activePeriod);
        const a360 = calculate360Analytics(emp, competencies, rules);
        const pot = calculateCombinedPotentialIndex(emp, a360.overallScore);
        const boxId = getEffectiveNineBoxId(emp, activePeriod, competencies, rules);
        return { emp, perf, a360, pot, boxId };
      })
      .filter((item) => {
        if (deptFilter !== 'ALL' && item.emp.department !== deptFilter) return false;
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
  }, [activePeriod, competencies, currentRoleEmployeeId, deptFilter, employees, role, rules, search]);

  const byBox = useMemo(() => {
    const map: Record<NineBoxId, typeof enriched> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
    };
    enriched.forEach((item) => {
      map[item.boxId].push(item);
    });
    return map;
  }, [enriched]);

  const canDrag =
    platformConfig.features.enableNineBoxDragDrop &&
    role !== 'EMPLOYEE' &&
    (currentUser?.permissions.actions.canCalibrateNineBox ?? true);

  const initiateMove = (empId: string, targetBoxId: NineBoxId) => {
    const item = enriched.find((x) => x.emp.id === empId);
    if (!item || item.boxId === targetBoxId) return;
    setPendingMove({
      employee: item.emp,
      fromBoxId: item.boxId,
      toBoxId: targetBoxId,
    });
    setCalibrationReason('');
    setReasonError(null);
  };

  const handleConfirmMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMove) return;
    if (calibrationReason.trim().length < 6) {
      setReasonError('Lütfen en az 6 karakterlik geçerli bir kalibrasyon gerekçesi giriniz.');
      return;
    }
    calibrateEmployeeNineBox(pendingMove.employee.id, pendingMove.toBoxId, calibrationReason.trim());
    setPendingMove(null);
  };

  const totalCount = enriched.length || 1;

  const handleExportNineBoxExcel = () => {
    exportWorkbookToXlsx(`nine-box-dagilimi-${activePeriod.replace(/\s+/g, '-')}.xlsx`, [
      {
        name: 'Nine-Box Dağılımı',
        headers: [
          'Sicil No',
          'Ad Soyad',
          'Departman',
          'Unvan',
          'Performans',
          '360° Yetkinlik',
          'Birleşik Potansiyel',
          'Nine-Box Segmenti',
          'Hesaplama Tipi',
          'Gelişim Önerisi',
        ],
        rows: enriched.map((item) => {
          const meta = platformConfig.nineBoxCatalog[item.boxId];
          return [
            item.emp.sicilNo,
            item.emp.fullName,
            item.emp.department,
            item.emp.title,
            Number(item.perf.toFixed(1)),
            Number(item.a360.overallScore.toFixed(1)),
            Number(item.pot.toFixed(1)),
            meta.name,
            item.emp.manualNineBoxOverride ? 'Manuel Kalibre' : 'Otomatik',
            meta.recommendation,
          ];
        }),
      },
    ]);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Nine-Box Yetenek Matrisi & Kalibrasyon
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-0.5">
            {activePeriod} · Performans ve 360° Potansiyel eksenlerinde otomatik yerleştirme ve sürükle-bırak kalibrasyon oturumu
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Çalışan filtrele..."
              className="h-9 pl-8 pr-3 text-[12.5px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] w-48"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 px-2.5 text-[12.5px] bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="ALL">Tüm Birimler</option>
            {Array.from(
              new Set([...platformConfig.departments, ...employees.map((e) => e.department)])
            ).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {nineBoxFilterId !== 'ALL' && (
            <button
              type="button"
              onClick={() => setNineBoxFilterId('ALL')}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5"
            >
              Vurguyu Kaldır: {platformConfig.nineBoxCatalog[nineBoxFilterId].shortName}
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {platformConfig.features.enableCsvExport && (
            <button
              type="button"
              onClick={handleExportNineBoxExcel}
              className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 text-[12.5px] font-semibold text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Excel (.xlsx)
            </button>
          )}

          {role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => openSettingsTab('rules')}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12.5px] font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              Eşik Ayarları
            </button>
          )}
        </div>
      </div>

      {/* Active Threshold Legend */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
            <Info className="w-3.5 h-3.5 text-[#C8102E]" />
            Aktif Eşik Kuralları:
          </span>
          <span className="font-mono tabular-nums">
            Performans: Düşük &lt;{rules.nineBoxThresholds.perfLowMax} · Beklenen {rules.nineBoxThresholds.perfLowMax}–{(rules.nineBoxThresholds.perfMidMax - 0.1).toFixed(1)} · Üstün ≥{rules.nineBoxThresholds.perfMidMax}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-mono tabular-nums">
            Potansiyel/360°: Düşük &lt;{rules.nineBoxThresholds.potLowMax} · Orta {rules.nineBoxThresholds.potLowMax}–{(rules.nineBoxThresholds.potMidMax - 0.1).toFixed(1)} · Yüksek ≥{rules.nineBoxThresholds.potMidMax}
          </span>
        </div>
        {canDrag && (
          <span className="text-slate-500">
            Kalibrasyon için çalışan kartını hedef kutuya sürükleyip bırakın
          </span>
        )}
      </div>

      {/* 3x3 Interactive Grid with Axis Labels */}
      <div className="flex gap-3 items-stretch">
        {/* Vertical Y-Axis Label */}
        <div className="hidden lg:flex flex-col justify-between py-12 w-7 shrink-0 items-center select-none">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11.5px] font-semibold text-emerald-700 tracking-wide">
            Yüksek Potansiyel
          </span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11.5px] font-semibold text-slate-500 tracking-wide">
            Orta Potansiyel & Yetkinlik
          </span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11.5px] font-semibold text-slate-400 tracking-wide">
            Düşük Potansiyel
          </span>
        </div>

        {/* 3x3 Matrix */}
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {NINE_BOX_GRID_ORDER.map((boxId) => {
              const meta = platformConfig.nineBoxCatalog[boxId];
              const items = byBox[boxId];
              const pct = Math.round((items.length / totalCount) * 100);
              const isDropTarget = dragOverBoxId === boxId;
              const isFilteredFocus = nineBoxFilterId === boxId;
              const isDimmed = nineBoxFilterId !== 'ALL' && nineBoxFilterId !== boxId;

              return (
                <div
                  key={boxId}
                  onDragOver={(e) => {
                    if (!canDrag) return;
                    e.preventDefault();
                    setDragOverBoxId(boxId);
                  }}
                  onDragLeave={() => {
                    if (dragOverBoxId === boxId) setDragOverBoxId(null);
                  }}
                  onDrop={(e) => {
                    if (!canDrag) return;
                    e.preventDefault();
                    const empId = e.dataTransfer.getData('text/plain') || draggedEmpId;
                    setDragOverBoxId(null);
                    setDraggedEmpId(null);
                    if (empId) initiateMove(empId, boxId);
                  }}
                  className={`rounded-xl border p-3.5 min-h-[250px] flex flex-col transition-all ${meta.accentBg} ${
                    isDropTarget
                      ? 'border-[#C8102E] ring-2 ring-[#C8102E]/25 scale-[1.01]'
                      : isFilteredFocus
                      ? 'border-[#C8102E] ring-2 ring-[#C8102E]/20'
                      : meta.accentBorder
                  } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
                >
                  {/* Box Header */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/70">
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-mono text-slate-500">
                        {meta.potBand} Potansiyel · {meta.perfBand} Performans
                      </div>
                      <h3 className={`font-display text-[13.5px] font-bold leading-snug ${meta.accentText}`}>
                        {meta.name}
                      </h3>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-[14px] font-bold text-slate-900">{items.length}</div>
                      <div className="text-[10.5px] text-slate-500">%{pct}</div>
                    </div>
                  </div>

                  {/* Employee Cards inside Box */}
                  <div className="flex-1 space-y-2">
                    {items.length === 0 ? (
                      <div className="h-full min-h-[110px] rounded-lg border border-dashed border-slate-300/80 flex items-center justify-center text-[12px] text-slate-400 text-center px-3">
                        Bu segmentte çalışan bulunmuyor
                      </div>
                    ) : (
                      items.map(({ emp, perf, a360 }) => {
                        const isPromotableSegment = boxId === 1 || boxId === 2 || boxId === 4;
                        return (
                          <div
                            key={emp.id}
                            draggable={canDrag}
                            onDragStart={(e) => {
                              if (!canDrag) return;
                              setDraggedEmpId(emp.id);
                              e.dataTransfer.setData('text/plain', emp.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDraggedEmpId(null);
                              setDragOverBoxId(null);
                            }}
                            className={`bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs hover:border-slate-300 transition-all ${
                              canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {canDrag && (
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-1 shrink-0" />
                              )}
                              <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center justify-center shrink-0">
                                {getInitials(emp.fullName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEmployeeDrawer(emp.id)}
                                    className="text-[12.5px] font-semibold text-slate-900 hover:text-[#C8102E] truncate text-left"
                                  >
                                    {emp.fullName}
                                  </button>
                                  {emp.manualNineBoxOverride && (
                                    <button
                                      type="button"
                                      onClick={() => resetEmployeeNineBoxOverride(emp.id)}
                                      title={`Kalibre edildi (${emp.manualNineBoxOverride.reason}). Otomatiğe dönmek için tıklayın.`}
                                      className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-0.5 shrink-0"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Kalibre
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {emp.title} · {emp.department}
                                </div>
                                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600">
                                  <span>
                                    Perf: <strong className="text-slate-900">{perf.toFixed(0)}</strong> · 360°:{' '}
                                    <strong className="text-indigo-700">{a360.overallScore.toFixed(0)}</strong>
                                  </span>
                                  {role !== 'EMPLOYEE' && platformConfig.features.enableMobility && (
                                    <button
                                      type="button"
                                      onClick={() => startMobilityForEmployee(emp.id)}
                                      className={`font-sans text-[11px] font-semibold inline-flex items-center gap-0.5 whitespace-nowrap ${
                                        isPromotableSegment
                                          ? 'text-[#C8102E] hover:underline'
                                          : 'text-slate-500 hover:text-slate-900'
                                      }`}
                                    >
                                      <ArrowLeftRight className="w-3 h-3" />
                                      Terfi / Rotasyon
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Box Recommendation Footer */}
                  <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 leading-snug">
                    {meta.recommendation}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Horizontal X-Axis Label */}
          <div className="grid grid-cols-3 text-center pt-1 text-[12px] font-semibold text-slate-500">
            <div>Düşük Performans</div>
            <div>Beklenen Performans</div>
            <div className="text-emerald-700">Üstün Performans</div>
          </div>
        </div>
      </div>

      {/* Drag-and-Drop Calibration Confirmation Modal */}
      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setPendingMove(null)}
          />
          <form
            onSubmit={handleConfirmMove}
            className="relative z-10 w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-[11.5px] text-slate-500">Nine-Box Kalibrasyon Oturumu Onayı</div>
                <h3 className="font-display text-[16px] font-bold text-slate-900">
                  {pendingMove.employee.fullName} — Segment Değişikliği
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">Mevcut Segment</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {platformConfig.nineBoxCatalog[pendingMove.fromBoxId].name}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                  <div className="text-[11px] text-[#C8102E]">Hedef Kalibrasyon Segmenti</div>
                  <div className="font-bold text-[#C8102E] mt-0.5">
                    {platformConfig.nineBoxCatalog[pendingMove.toBoxId].name}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-slate-800 mb-1.5">
                  Kalibrasyon Gerekçesi (Zorunlu) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={calibrationReason}
                  onChange={(e) => {
                    setCalibrationReason(e.target.value);
                    setReasonError(null);
                  }}
                  placeholder="Örn: Bölge kriz yönetiminde gösterdiği liderlik potansiyeli komite kararıyla üst segmente taşındı..."
                  className="w-full p-3 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
                {reasonError && <p className="mt-1 text-[12px] text-rose-600">{reasonError}</p>}
              </div>

              <p className="text-[11.5px] text-slate-500">
                Bu değişiklik çalışanın Kariyer ve İşlem Tarihçesine denetim izi (Audit Log) olarak otomatik kaydedilecektir.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[13px] font-semibold"
              >
                Kalibrasyonu Onayla ve Kaydet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

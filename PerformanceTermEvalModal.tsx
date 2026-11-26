import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageSquareText,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  calculateAnnualPerformanceScore,
  calculateTermScoreFromSelections,
  classifyPerformanceScore,
  countFilledDimensionNotes,
  createEmptyTermEvaluation,
  PERFORMANCE_DIMENSIONS,
  PERFORMANCE_TERM_KEYS,
  RESPONSIBILITY_DECLARATION_TEXT,
} from '../data/performanceCriteria';
import {
  Employee,
  PerformanceDimensionId,
  PerformanceTermEvaluation,
  PerformanceTermKey,
} from '../types/talent';
import { formatTrDate, REFERENCE_TODAY } from '../utils/calculations';

interface PerformanceTermEvalModalProps {
  employee: Employee;
  initialTerm: PerformanceTermKey;
  evaluatorName: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (empId: string, evaluation: PerformanceTermEvaluation) => void;
}

export const PerformanceTermEvalModal: React.FC<PerformanceTermEvalModalProps> = ({
  employee,
  initialTerm,
  evaluatorName,
  readOnly,
  onClose,
  onSave,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<PerformanceTermKey>(initialTerm);

  const loadTermDraft = (term: PerformanceTermKey): PerformanceTermEvaluation => {
    const existing = employee.termEvaluations?.[term];
    if (existing) {
      return {
        ...existing,
        selections: { ...existing.selections },
        dimensionScores: { ...existing.dimensionScores },
        dimensionNotes: { ...(existing.dimensionNotes ?? {}) },
      };
    }
    return createEmptyTermEvaluation(term, evaluatorName);
  };

  const [draft, setDraft] = useState<PerformanceTermEvaluation>(() => loadTermDraft(initialTerm));

  const handleSwitchTerm = (term: PerformanceTermKey) => {
    setSelectedTerm(term);
    setDraft(loadTermDraft(term));
  };

  const handleSelectIndicator = (dimId: PerformanceDimensionId, level: 1 | 2 | 3) => {
    if (readOnly) return;
    setDraft((prev) => {
      const nextSelections = { ...prev.selections, [dimId]: level };
      const { dimensionScores, termScore } = calculateTermScoreFromSelections(nextSelections);
      return {
        ...prev,
        selections: nextSelections,
        dimensionScores,
        termScore,
      };
    });
  };

  const handleChangeDimensionNote = (dimId: PerformanceDimensionId, text: string) => {
    if (readOnly) return;
    setDraft((prev) => ({
      ...prev,
      dimensionNotes: {
        ...prev.dimensionNotes,
        [dimId]: text,
      },
    }));
  };

  const calc = useMemo(
    () => calculateTermScoreFromSelections(draft.selections),
    [draft.selections]
  );

  const filledNotesCount = useMemo(
    () => countFilledDimensionNotes(draft.dimensionNotes),
    [draft.dimensionNotes]
  );

  // Live preview of annual score including the current draft if all 6 dimensions are chosen
  const liveAnnualPreview = useMemo(() => {
    const simulated: Record<PerformanceTermKey, PerformanceTermEvaluation> = {
      ...employee.termEvaluations,
      [selectedTerm]: {
        ...draft,
        status: calc.termScore !== null ? 'Tamamlandı' : draft.status,
        termScore: calc.termScore,
      },
    };
    return calculateAnnualPerformanceScore(simulated);
  }, [calc.termScore, draft, employee.termEvaluations, selectedTerm]);

  const termBand = classifyPerformanceScore(calc.termScore);
  const annualBand = classifyPerformanceScore(liveAnnualPreview.annualScore);

  const allSixSelected = calc.selectedCount === PERFORMANCE_DIMENSIONS.length;
  const allSixNotesFilled = filledNotesCount === PERFORMANCE_DIMENSIONS.length;
  const hasResponsibility = draft.responsibilityAccepted;

  const canSubmit = !readOnly && allSixSelected && allSixNotesFilled && hasResponsibility;

  const missingItems: string[] = [];
  if (!allSixSelected) {
    missingItems.push(
      `6 boyut gösterge seçimi (${calc.selectedCount}/${PERFORMANCE_DIMENSIONS.length})`
    );
  }
  if (!allSixNotesFilled) {
    missingItems.push(
      `Her boyut için zorunlu kanıt/yorum notu (${filledNotesCount}/${PERFORMANCE_DIMENSIONS.length})`
    );
  }
  if (!hasResponsibility) missingItems.push('Sorumluluk Beyanı onayı');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || calc.termScore === null) return;

    const trimmedNotes: Partial<Record<PerformanceDimensionId, string>> = {};
    PERFORMANCE_DIMENSIONS.forEach((dim) => {
      trimmedNotes[dim.id] = (draft.dimensionNotes[dim.id] ?? '').trim();
    });

    onSave(employee.id, {
      ...draft,
      term: selectedTerm,
      status: 'Tamamlandı',
      dimensionScores: calc.dimensionScores,
      dimensionNotes: trimmedNotes,
      termScore: calc.termScore,
      justification: draft.justification.trim(),
      evaluatorName,
      submittedAt: REFERENCE_TODAY,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
              <span className="font-mono font-semibold text-slate-800">{employee.sicilNo}</span>
              <span>·</span>
              <span>{employee.department}</span>
              <span>·</span>
              <span>{employee.title}</span>
              {draft.submittedAt && (
                <>
                  <span>·</span>
                  <span className="font-mono text-emerald-700">
                    Son Kayıt: {formatTrDate(draft.submittedAt)}
                  </span>
                </>
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5 truncate">
              {employee.fullName} — Bireysel Performans Değerlendirme Formu (EK-13 / EK-14)
            </h3>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* 3-Term Switcher */}
            <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg">
              {PERFORMANCE_TERM_KEYS.map((termKey) => {
                const termRec = employee.termEvaluations?.[termKey];
                const isDone = termRec?.status === 'Tamamlandı';
                const active = selectedTerm === termKey;
                return (
                  <button
                    key={termKey}
                    type="button"
                    onClick={() => handleSwitchTerm(termKey)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{termKey}</span>
                    {isDone && (
                      <span className="font-mono text-[11px] text-emerald-700">
                        {termRec.termScore?.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sticky Live Score & EK-15 Classification Cards */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          {/* Progress: Dimensions + Notes */}
          <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Gösterge / Kanıt Notu
              </div>
              <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-slate-900">
                {calc.selectedCount}/{PERFORMANCE_DIMENSIONS.length}
                <span className="text-slate-300 mx-1.5">·</span>
                <span className={allSixNotesFilled ? 'text-emerald-700' : 'text-amber-700'}>
                  {filledNotesCount}/{PERFORMANCE_DIMENSIONS.length} Not
                </span>
              </div>
            </div>
            <div className="text-right text-[11.5px] text-slate-500">
              <div>{selectedTerm}</div>
              <div className="font-semibold text-slate-700">
                {draft.status === 'Tamamlandı' ? 'Tamamlandı' : 'Taslak / Bekliyor'}
              </div>
            </div>
          </div>

          {/* Period Result Card (EK-15) */}
          <div
            className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
              termBand ? termBand.cardClass : 'bg-slate-50/70 border-slate-200'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Dönem Sonucu ({selectedTerm})
              </div>
              <div
                className={`mt-0.5 font-mono tabular-nums text-xl font-bold ${
                  termBand ? termBand.scoreClass : 'text-slate-400'
                }`}
              >
                {calc.termScore !== null ? calc.termScore.toFixed(2) : '—'}
                <span className="text-[12px] font-normal text-slate-400"> / 5.00</span>
              </div>
            </div>
            {termBand ? (
              <span
                className={`px-2.5 py-1 rounded-md text-[11.5px] font-bold whitespace-nowrap ${termBand.badgeClass}`}
              >
                {termBand.label}
              </span>
            ) : (
              <span className="text-[11.5px] text-slate-400">6 boyut seçilmeli</span>
            )}
          </div>

          {/* Annual Result Card (EK-15) */}
          <div
            className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
              annualBand ? annualBand.cardClass : 'bg-slate-50/70 border-slate-200'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Yıllık Sonuç ({liveAnnualPreview.completedTerms}/3 Dönem Ort.)
              </div>
              <div
                className={`mt-0.5 font-mono tabular-nums text-xl font-bold ${
                  annualBand ? annualBand.scoreClass : 'text-slate-400'
                }`}
              >
                {liveAnnualPreview.annualScore !== null
                  ? liveAnnualPreview.annualScore.toFixed(2)
                  : '—'}
                <span className="text-[12px] font-normal text-slate-400"> / 5.00</span>
              </div>
            </div>
            {annualBand ? (
              <span
                className={`px-2.5 py-1 rounded-md text-[11.5px] font-bold whitespace-nowrap ${annualBand.badgeClass}`}
              >
                {annualBand.label}
              </span>
            ) : (
              <span className="text-[11.5px] text-slate-400">Henüz hesaplanmadı</span>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
          {/* 6 Fixed EK-13 Dimensions — Each with Mandatory Kanıt / Yorum Notu */}
          <div className="space-y-4">
            {PERFORMANCE_DIMENSIONS.map((dim) => {
              const selectedLevel = draft.selections[dim.id];
              const selectedScore = calc.dimensionScores[dim.id];
              const noteValue = draft.dimensionNotes[dim.id] ?? '';
              const hasDimNote = noteValue.trim().length > 0;

              return (
                <section
                  key={dim.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11.5px] font-bold text-[#C8102E]">
                          0{dim.order}.
                        </span>
                        <h4 className="font-display text-[14.5px] font-bold text-slate-900">
                          {dim.name}
                        </h4>
                      </div>
                      <p className="text-[12px] text-slate-500 mt-0.5">{dim.scope}</p>
                    </div>
                    <div className="shrink-0 font-mono tabular-nums text-[12.5px]">
                      {typeof selectedScore === 'number' ? (
                        <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-bold">
                          {selectedScore.toFixed(1)} Puan
                        </span>
                      ) : (
                        <span className="text-rose-600 font-sans text-[12px] font-semibold">
                          Gösterge Seçimi Zorunlu *
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3 EK-14 Indicators */}
                  <div className="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {dim.indicators.map((ind) => {
                      const isSelected = selectedLevel === ind.level;
                      const accentTone =
                        ind.level === 3
                          ? isSelected
                            ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500'
                            : 'border-slate-200 bg-white hover:border-emerald-300'
                          : ind.level === 2
                          ? isSelected
                            ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                            : 'border-slate-200 bg-white hover:border-amber-300'
                          : isSelected
                          ? 'border-rose-500 bg-rose-50/70 ring-1 ring-rose-500'
                          : 'border-slate-200 bg-white hover:border-rose-300';

                      const badgeTone =
                        ind.level === 3
                          ? 'text-emerald-700 bg-emerald-100/80'
                          : ind.level === 2
                          ? 'text-amber-800 bg-amber-100/80'
                          : 'text-rose-700 bg-rose-100/80';

                      return (
                        <button
                          key={ind.level}
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleSelectIndicator(dim.id, ind.level)}
                          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 disabled:cursor-default ${accentTone}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-[#C8102E] bg-[#C8102E]'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </span>
                              {ind.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11.5px] font-mono tabular-nums font-bold ${badgeTone}`}
                            >
                              {ind.score} Puan
                            </span>
                          </div>
                          <p className="text-[12.5px] leading-relaxed text-slate-700">
                            {ind.text}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mandatory Per-Dimension Kanıt / Yorum Notu */}
                  <div className="px-3.5 pb-3.5 pt-1">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                          <MessageSquareText className="w-3.5 h-3.5 text-[#C8102E]" />
                          {dim.name} — Kanıt / Yorum Notu *
                        </label>
                        <span
                          className={`text-[11px] font-semibold ${
                            hasDimNote ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {hasDimNote ? 'Kanıt Notu Girildi' : 'Zorunlu *'}
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        disabled={readOnly}
                        value={noteValue}
                        onChange={(e) => handleChangeDimensionNote(dim.id, e.target.value)}
                        placeholder={`"${dim.name}" boyutundaki seçim için somut örnek, gözlem veya kanıt notunuzu yazınız...`}
                        className="w-full p-2.5 text-[12.5px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] disabled:bg-slate-50 disabled:text-slate-600"
                      />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {/* General Summary Note (Optional) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                Dönem Genel Değerlendirme Özeti (Opsiyonel)
              </label>
              <span className="text-[11.5px] text-slate-400">
                Her boyutun kanıt/yorum notu yukarıda zorunludur
              </span>
            </div>
            <textarea
              rows={2}
              disabled={readOnly}
              value={draft.justification}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, justification: e.target.value }))
              }
              placeholder="İsterseniz dönem geneline ilişkin ek gelişim önerisi veya yönetici özet notu ekleyebilirsiniz..."
              className="w-full p-3 text-[13px] bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] disabled:opacity-75"
            />
          </section>

          {/* Mandatory Responsibility Declaration */}
          <section
            className={`p-4 rounded-xl border transition-colors ${
              hasResponsibility
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-amber-50/60 border-amber-200'
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.responsibilityAccepted}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    responsibilityAccepted: e.target.checked,
                  }))
                }
                className="mt-0.5 w-4.5 h-4.5 accent-[#C8102E] shrink-0"
              />
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#C8102E]" />
                  Değerlendirici Sorumluluk Beyanı (Zorunlu)
                </div>
                <p className="text-[13px] font-medium text-slate-900 mt-1">
                  {RESPONSIBILITY_DECLARATION_TEXT}
                </p>
              </div>
            </label>
          </section>
        </div>

        {/* Footer with Validation Checklist & Submit Button */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] max-w-xl">
            {readOnly ? (
              <span className="text-slate-500">
                Çalışan görünümünde değerlendirme formu salt okunur olarak görüntülenir.
              </span>
            ) : missingItems.length > 0 ? (
              <div className="flex items-start gap-1.5 text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Eksik zorunlu alanlar:</strong> {missingItems.join(' · ')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  6 boyut seçimi, her boyutun kanıt/yorum notu ve sorumluluk beyanı tamamlandı.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700"
            >
              {readOnly ? 'Kapat' : 'Vazgeç'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                Değerlendirmeyi Tamamla
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

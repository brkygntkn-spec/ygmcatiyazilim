import {
  ApprovalStepName,
  CompetencyDefinition,
  Employee,
  EvaluationPeriod,
  KPIItem,
  NineBoxId,
  NineBoxMeta,
  PerformanceWorkflowStage,
  RaterRelation,
  SystemRules,
  TemporaryAssignment,
} from '../types/talent';

export const EVALUATION_PERIODS: EvaluationPeriod[] = [
  '2026 Yıl Sonu Dönemi',
  '2026 Ara Dönem',
  '2025 Yıl Sonu Dönemi',
];

export const PERFORMANCE_STAGES: PerformanceWorkflowStage[] = [
  'Hedef Belirleme',
  'Ara Dönem Gözden Geçirme',
  'Çalışan Öz Değerlendirme',
  'Yönetici Değerlendirmesi',
  'Kalibrasyon & Kesinleşme',
];

export const APPROVAL_STEPS: ApprovalStepName[] = [
  'Talep Oluşturuldu',
  'Mevcut Yönetici Onayı',
  'Hedef Birim Yöneticisi Onayı',
  'İK Değerlendirme & Bütçe Kontrolü',
  'Üst Yönetim Onayı',
  'Atama Gerçekleşti',
];

export const NINE_BOX_CATALOG: Record<NineBoxId, NineBoxMeta> = {
  1: {
    id: 1,
    code: 'Kutu 1',
    name: 'Yıldızlar (Stars)',
    shortName: 'Yıldızlar',
    perfBand: 'Üstün',
    potBand: 'Yüksek',
    row: 0,
    col: 2,
    recommendation: 'Üst yönetim yedekleme havuzu ve hızlı dikey terfi önceliği',
    accentBg: 'bg-emerald-50/80',
    accentBorder: 'border-emerald-200',
    accentText: 'text-emerald-800',
  },
  2: {
    id: 2,
    code: 'Kutu 2',
    name: 'Yüksek Potansiyelli Gelişenler',
    shortName: 'Yüksek Potansiyel',
    perfBand: 'Beklenen',
    potBand: 'Yüksek',
    row: 0,
    col: 1,
    recommendation: 'Stratejik proje liderliği, mentorluk ve yatay rotasyon',
    accentBg: 'bg-teal-50/75',
    accentBorder: 'border-teal-200',
    accentText: 'text-teal-800',
  },
  3: {
    id: 3,
    code: 'Kutu 3',
    name: 'Muamma / Keşfedilmemiş Yetenek',
    shortName: 'Muamma',
    perfBand: 'Düşük',
    potBand: 'Yüksek',
    row: 0,
    col: 0,
    recommendation: 'Rol uyumu analizi, yakın koçluk ve hedef netleştirme',
    accentBg: 'bg-amber-50/70',
    accentBorder: 'border-amber-200',
    accentText: 'text-amber-800',
  },
  4: {
    id: 4,
    code: 'Kutu 4',
    name: 'Güçlü Performans / Büyüme Adayı',
    shortName: 'Güçlü Performans',
    perfBand: 'Üstün',
    potBand: 'Orta',
    row: 1,
    col: 2,
    recommendation: 'Kapsam genişletme, bir üst kadroya hazırlık ve liderlik programı',
    accentBg: 'bg-sky-50/75',
    accentBorder: 'border-sky-200',
    accentText: 'text-sky-800',
  },
  5: {
    id: 5,
    code: 'Kutu 5',
    name: 'Temel Taşlar (Core Players)',
    shortName: 'Temel Taşlar',
    perfBand: 'Beklenen',
    potBand: 'Orta',
    row: 1,
    col: 1,
    recommendation: 'Mevcut rolde yetkinlik derinleştirme ve istikrarlı gelişim',
    accentBg: 'bg-slate-50',
    accentBorder: 'border-slate-200',
    accentText: 'text-slate-800',
  },
  6: {
    id: 6,
    code: 'Kutu 6',
    name: 'Tutarsız / İkilem (Dilemma)',
    shortName: 'Tutarsız / İkilem',
    perfBand: 'Düşük',
    potBand: 'Orta',
    row: 1,
    col: 0,
    recommendation: '90 günlük performans gelişim planı ve düzenli ara değerlendirme',
    accentBg: 'bg-orange-50/70',
    accentBorder: 'border-orange-200',
    accentText: 'text-orange-800',
  },
  7: {
    id: 7,
    code: 'Kutu 7',
    name: 'Uzman / Güvenilir Profesyonel',
    shortName: 'Uzman Profesyonel',
    perfBand: 'Üstün',
    potBand: 'Düşük',
    row: 2,
    col: 2,
    recommendation: 'Uzmanlık kariyer yolu, kurum içi eğitmenlik ve takdir ödüllendirme',
    accentBg: 'bg-indigo-50/65',
    accentBorder: 'border-indigo-200',
    accentText: 'text-indigo-800',
  },
  8: {
    id: 8,
    code: 'Kutu 8',
    name: 'Etkili Uygulayıcı',
    shortName: 'Etkili Uygulayıcı',
    perfBand: 'Beklenen',
    potBand: 'Düşük',
    row: 2,
    col: 1,
    recommendation: 'Operasyonel mükemmeliyet desteği ve görev standardizasyonu',
    accentBg: 'bg-slate-100/70',
    accentBorder: 'border-slate-200',
    accentText: 'text-slate-700',
  },
  9: {
    id: 9,
    code: 'Kutu 9',
    name: 'Risk / Düşük Performans',
    shortName: 'Risk / Düşük',
    perfBand: 'Düşük',
    potBand: 'Düşük',
    row: 2,
    col: 0,
    recommendation: 'Acil performans iyileştirme planı (PIP) veya pozisyon yeniden değerlendirme',
    accentBg: 'bg-rose-50/80',
    accentBorder: 'border-rose-200',
    accentText: 'text-rose-800',
  },
};

// Grid rendering order: Row 0 (High Pot) -> Col 0,1,2 | Row 1 (Mid Pot) -> Col 0,1,2 | Row 2 (Low Pot) -> Col 0,1,2
export const NINE_BOX_GRID_ORDER: NineBoxId[] = [3, 2, 1, 6, 5, 4, 9, 8, 7];

export function calculateWeightedKpiScore(kpis: KPIItem[]): number {
  if (!kpis.length) return 0;
  const totalWeight = kpis.reduce((sum, k) => sum + k.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = kpis.reduce((sum, k) => sum + k.managerScore * (k.weight / totalWeight), 0);
  return Math.round(weighted * 10) / 10;
}

export function getEffectivePerformanceScore(
  employee: Employee,
  period: EvaluationPeriod
): number {
  const rec = employee.performanceRecords[period];
  if (!rec) return 0;
  if (typeof rec.calibratedScore === 'number') return rec.calibratedScore;
  return rec.calculatedScore;
}

export function getEmployeeRoleGroup(employee: Employee): string {
  if (employee.hasSubordinates || employee.grade >= 8) {
    return 'Yönetici Rolleri';
  }
  if (employee.workModel === 'Saha' || employee.department === 'Saha Koordinasyon') {
    return 'Saha Rolleri';
  }
  return 'Uzman / İdari Roller';
}

export function getApplicableCompetencies(
  employee: Employee,
  competencies: CompetencyDefinition[]
): CompetencyDefinition[] {
  const active = competencies.filter((c) => c.isActive !== false);
  const roleGroup = getEmployeeRoleGroup(employee);
  const empContext = `${employee.title} ${employee.department}`.toLocaleLowerCase('tr-TR');

  const matched = active.filter((c) => {
    if (!c.roleGroups || c.roleGroups.length === 0 || c.roleGroups.includes('Tümü')) {
      return true;
    }
    if (c.roleGroups.includes(roleGroup)) {
      return true;
    }
    // Support custom Admin-defined role groups by matching meaningful keywords against title/department
    return c.roleGroups.some((rg) => {
      const normalized = rg
        .toLocaleLowerCase('tr-TR')
        .replace(/\b(rolleri|grubu|ekibi|personeli)\b/g, '')
        .trim();
      if (normalized.length < 3) return false;
      const tokens = normalized.split(/\s+/).filter((t) => t.length >= 4);
      return tokens.some((tok) => empContext.includes(tok.slice(0, Math.min(tok.length, 6))));
    });
  });
  return matched.length > 0 ? matched : active;
}

export function scaleLevelToScore100(
  levelValue: number,
  levels: { value: number; coefficient: number }[]
): number {
  if (!levels.length) return Math.max(0, Math.min(100, levelValue * 20));
  const maxCoeff = Math.max(...levels.map((l) => l.coefficient), 1);
  const matched = levels.find((l) => l.value === levelValue);
  const coeff = matched ? matched.coefficient : levelValue;
  return Math.round((coeff / maxCoeff) * 1000) / 10;
}

export function score100ToScaleValue(
  score100: number,
  levels: { value: number; coefficient: number }[]
): number {
  if (!levels.length) return Number(((score100 / 100) * 5).toFixed(2));
  const maxCoeff = Math.max(...levels.map((l) => l.coefficient), 1);
  return Number(((score100 / 100) * maxCoeff).toFixed(2));
}

export function getNormalized360Weights(
  hasSubordinates: boolean,
  rules: SystemRules,
  hasInternalCustomers = true
): Record<RaterRelation, number> {
  const base = rules.raterWeights360;
  const activeMap: Record<RaterRelation, number> = {
    MANAGER: Math.max(0, base.MANAGER ?? 0),
    SELF: Math.max(0, base.SELF ?? 0),
    PEER: Math.max(0, base.PEER ?? 0),
    SUBORDINATE: hasSubordinates ? Math.max(0, base.SUBORDINATE ?? 0) : 0,
    INTERNAL_CUSTOMER: hasInternalCustomers ? Math.max(0, base.INTERNAL_CUSTOMER ?? 0) : 0,
  };

  const sum =
    activeMap.MANAGER +
    activeMap.SELF +
    activeMap.PEER +
    activeMap.SUBORDINATE +
    activeMap.INTERNAL_CUSTOMER;

  if (sum <= 0) {
    return {
      MANAGER: 50,
      SELF: 15,
      PEER: 35,
      SUBORDINATE: 0,
      INTERNAL_CUSTOMER: 0,
    };
  }

  const normalized: Record<RaterRelation, number> = {
    MANAGER: Math.round((activeMap.MANAGER / sum) * 1000) / 10,
    SELF: Math.round((activeMap.SELF / sum) * 1000) / 10,
    PEER: Math.round((activeMap.PEER / sum) * 1000) / 10,
    SUBORDINATE: Math.round((activeMap.SUBORDINATE / sum) * 1000) / 10,
    INTERNAL_CUSTOMER: Math.round((activeMap.INTERNAL_CUSTOMER / sum) * 1000) / 10,
  };

  return normalized;
}

export interface CompetencyBreakdownRow {
  competencyId: string;
  competencyName: string;
  weight: number;
  selfAvg: number | null;
  managerAvg: number | null;
  peerAvg: number | null;
  subordinateAvg: number | null;
  internalCustomerAvg: number | null;
  othersAvg: number | null;
  weightedScore: number;
  gap: number; // selfAvg - othersAvg (+ => Blind Spot, - => Hidden Strength)
  insight: 'Kör Nokta' | 'Gizli Güç' | 'Uyumlu';
}

export function calculate360Analytics(
  employee: Employee,
  competencies: CompetencyDefinition[],
  rules: SystemRules
): {
  overallScore: number;
  completionRate: number;
  completedCount: number;
  totalCount: number;
  roleGroup: string;
  normalizedWeights: Record<RaterRelation, number>;
  rows: CompetencyBreakdownRow[];
  blindSpots: CompetencyBreakdownRow[];
  hiddenStrengths: CompetencyBreakdownRow[];
} {
  const completedRaters = employee.raters360.filter((r) => r.completed);
  const totalCount = employee.raters360.length;
  const completedCount = completedRaters.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const hasSubRaters =
    employee.hasSubordinates && employee.raters360.some((r) => r.relation === 'SUBORDINATE');
  const hasInternalCustomerRaters = employee.raters360.some(
    (r) => r.relation === 'INTERNAL_CUSTOMER'
  );
  const normalizedWeights = getNormalized360Weights(
    hasSubRaters,
    rules,
    hasInternalCustomerRaters
  );
  const roleGroup = getEmployeeRoleGroup(employee);
  const applicableCompetencies = getApplicableCompetencies(employee, competencies);

  const avgFor = (relation: RaterRelation, compId: string): number | null => {
    const matching = completedRaters.filter(
      (r) => r.relation === relation && typeof r.scores[compId] === 'number'
    );
    if (!matching.length) return null;
    const sum = matching.reduce((acc, r) => acc + r.scores[compId], 0);
    return Math.round((sum / matching.length) * 10) / 10;
  };

  const rows: CompetencyBreakdownRow[] = applicableCompetencies.map((comp) => {
    const selfAvg = avgFor('SELF', comp.id);
    const managerAvg = avgFor('MANAGER', comp.id);
    const peerAvg = avgFor('PEER', comp.id);
    const subordinateAvg = avgFor('SUBORDINATE', comp.id);
    const internalCustomerAvg = avgFor('INTERNAL_CUSTOMER', comp.id);

    const presentPairs: { score: number; weight: number }[] = [];
    if (managerAvg !== null && normalizedWeights.MANAGER > 0) {
      presentPairs.push({ score: managerAvg, weight: normalizedWeights.MANAGER });
    }
    if (selfAvg !== null && normalizedWeights.SELF > 0) {
      presentPairs.push({ score: selfAvg, weight: normalizedWeights.SELF });
    }
    if (peerAvg !== null && normalizedWeights.PEER > 0) {
      presentPairs.push({ score: peerAvg, weight: normalizedWeights.PEER });
    }
    if (subordinateAvg !== null && normalizedWeights.SUBORDINATE > 0) {
      presentPairs.push({ score: subordinateAvg, weight: normalizedWeights.SUBORDINATE });
    }
    if (internalCustomerAvg !== null && normalizedWeights.INTERNAL_CUSTOMER > 0) {
      presentPairs.push({
        score: internalCustomerAvg,
        weight: normalizedWeights.INTERNAL_CUSTOMER,
      });
    }

    const totalActiveW = presentPairs.reduce((s, p) => s + p.weight, 0);
    const weightedScore =
      totalActiveW > 0
        ? Math.round(
            (presentPairs.reduce((s, p) => s + p.score * p.weight, 0) / totalActiveW) * 10
          ) / 10
        : 0;

    const othersScores = [managerAvg, peerAvg, subordinateAvg, internalCustomerAvg].filter(
      (v): v is number => v !== null
    );
    const othersAvg =
      othersScores.length > 0
        ? Math.round((othersScores.reduce((a, b) => a + b, 0) / othersScores.length) * 10) / 10
        : null;

    const gap =
      selfAvg !== null && othersAvg !== null
        ? Math.round((selfAvg - othersAvg) * 10) / 10
        : 0;

    let insight: 'Kör Nokta' | 'Gizli Güç' | 'Uyumlu' = 'Uyumlu';
    if (gap >= 8) insight = 'Kör Nokta';
    else if (gap <= -8) insight = 'Gizli Güç';

    return {
      competencyId: comp.id,
      competencyName: comp.name,
      weight: comp.weight > 0 ? comp.weight : 1,
      selfAvg,
      managerAvg,
      peerAvg,
      subordinateAvg,
      internalCustomerAvg,
      othersAvg,
      weightedScore,
      gap,
      insight,
    };
  });

  const validRows = rows.filter((r) => r.weightedScore > 0);
  const compWeightSum = validRows.reduce((s, r) => s + r.weight, 0);
  const overallScore =
    validRows.length > 0 && compWeightSum > 0
      ? Math.round(
          (validRows.reduce((s, r) => s + r.weightedScore * r.weight, 0) / compWeightSum) * 10
        ) / 10
      : 0;

  return {
    overallScore,
    completionRate,
    completedCount,
    totalCount,
    roleGroup,
    normalizedWeights,
    rows,
    blindSpots: rows.filter((r) => r.insight === 'Kör Nokta'),
    hiddenStrengths: rows.filter((r) => r.insight === 'Gizli Güç'),
  };
}

export function calculateCombinedPotentialIndex(
  employee: Employee,
  score360: number
): number {
  // 50% 360 competency + 50% manager potential evaluation
  if (score360 <= 0) return employee.potentialScore;
  return Math.round((score360 * 0.5 + employee.potentialScore * 0.5) * 10) / 10;
}

export function calculateAutoNineBoxId(
  perfScore: number,
  combinedPotential: number,
  rules: SystemRules
): NineBoxId {
  const { perfLowMax, perfMidMax, potLowMax, potMidMax } = rules.nineBoxThresholds;

  const perfCol: 0 | 1 | 2 = perfScore < perfLowMax ? 0 : perfScore < perfMidMax ? 1 : 2;
  const potRow: 0 | 1 | 2 = combinedPotential >= potMidMax ? 0 : combinedPotential >= potLowMax ? 1 : 2;

  const matrix: NineBoxId[][] = [
    [3, 2, 1], // High Potential (row 0)
    [6, 5, 4], // Mid Potential (row 1)
    [9, 8, 7], // Low Potential (row 2)
  ];
  return matrix[potRow][perfCol];
}

export function getEffectiveNineBoxId(
  employee: Employee,
  period: EvaluationPeriod,
  competencies: CompetencyDefinition[],
  rules: SystemRules
): NineBoxId {
  if (employee.manualNineBoxOverride) {
    return employee.manualNineBoxOverride.boxId;
  }
  const perf = getEffectivePerformanceScore(employee, period);
  const analytics360 = calculate360Analytics(employee, competencies, rules);
  const potIndex = calculateCombinedPotentialIndex(employee, analytics360.overallScore);
  return calculateAutoNineBoxId(perf, potIndex, rules);
}

export interface EligibilityCheckResult {
  allPassed: boolean;
  checks: {
    key: string;
    label: string;
    passed: boolean;
    actualText: string;
    requiredText: string;
  }[];
}

export function evaluatePromotionEligibility(
  employee: Employee,
  period: EvaluationPeriod,
  competencies: CompetencyDefinition[],
  rules: SystemRules
): EligibilityCheckResult {
  const perfScore = getEffectivePerformanceScore(employee, period);
  const comp360 = calculate360Analytics(employee, competencies, rules).overallScore;
  const { minTenureMonths, minPerformanceScore, minCompetency360Score } = rules.promotionEligibility;

  const checks = [
    {
      key: 'tenure',
      label: 'Mevcut Pozisyonda Kıdem Süresi',
      passed: employee.tenureMonths >= minTenureMonths,
      actualText: `${employee.tenureMonths} Ay`,
      requiredText: `En az ${minTenureMonths} Ay`,
    },
    {
      key: 'performance',
      label: 'Bireysel Performans Puanı',
      passed: perfScore >= minPerformanceScore,
      actualText: `${perfScore.toFixed(1)} Puan`,
      requiredText: `En az ${minPerformanceScore} Puan`,
    },
    {
      key: 'competency360',
      label: '360 Yetkinlik Değerlendirme Puanı',
      passed: comp360 >= minCompetency360Score,
      actualText: `${comp360.toFixed(1)} Puan`,
      requiredText: `En az ${minCompetency360Score} Puan`,
    },
    {
      key: 'disciplinary',
      label: 'Disiplin / İhtar Kaydı Kontrolü',
      passed: !employee.disciplinaryWarning,
      actualText: employee.disciplinaryWarning ? 'Aktif İhtar Mevcut' : 'Temiz',
      requiredText: 'Aktif İhtar Bulunmamalı',
    },
  ];

  return {
    allPassed: checks.every((c) => c.passed),
    checks,
  };
}

// Reference date aligned to current platform date for consistent realistic countdowns
export const REFERENCE_TODAY = '2026-11-24';

export function getDaysBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(endIso + 'T00:00:00');
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function getRemainingDays(endIso: string): number {
  return getDaysBetween(REFERENCE_TODAY, endIso);
}

export function getActiveAssignmentForEmployee(
  employeeId: string,
  assignments: TemporaryAssignment[]
): TemporaryAssignment | undefined {
  return assignments.find((a) => a.employeeId === employeeId && a.status === 'Aktif');
}

export function formatTrDate(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

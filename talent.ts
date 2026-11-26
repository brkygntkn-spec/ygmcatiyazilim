export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type ModuleKey =
  | 'dashboard'
  | 'employees'
  | 'performance'
  | 'feedback360'
  | 'ninebox'
  | 'mobility'
  | 'assignments'
  | 'settings';

export type EvaluationPeriod = string;

export type DepartmentName = string;

export type PerformanceWorkflowStage = string;

export type SettingsSubTab = 'studio' | 'config360' | 'users' | 'rules';

export type PerformanceTermKey = '1. Dönem' | '2. Dönem' | '3. Dönem';

export type PerformanceDimensionId =
  | 'is_kalitesi'
  | 'dogruluk_hata'
  | 'zaman_termin'
  | 'is_hacmi_verimlilik'
  | 'surec_mevzuat'
  | 'pozisyona_ozgu';

export interface PerformanceEvidenceItem {
  id: string;
  type: 'FILE' | 'LINK';
  label: string;
  value: string;
  fileSize?: string;
  addedAt: string;
}

export interface PerformanceTermEvaluation {
  term: PerformanceTermKey;
  status: 'Taslak' | 'Tamamlandı';
  selections: Partial<Record<PerformanceDimensionId, 1 | 2 | 3>>;
  dimensionScores: Partial<Record<PerformanceDimensionId, number>>;
  dimensionNotes: Partial<Record<PerformanceDimensionId, string>>;
  termScore: number | null; // 1.00 - 5.00 (2 decimals)
  justification: string;
  evidences?: PerformanceEvidenceItem[];
  responsibilityAccepted: boolean;
  evaluatorName: string;
  submittedAt?: string;
}

export type NineBoxId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type GenderType = 'Kadın' | 'Erkek' | 'Belirtilmemiş';

export type EducationLevel =
  | 'Lise'
  | 'Ön Lisans'
  | 'Lisans'
  | 'Yüksek Lisans'
  | 'Doktora';

export type EmploymentType =
  | 'Belirsiz Süreli (Kadrolu)'
  | 'Belirli Süreli'
  | 'Proje Bazlı'
  | 'Yönetici Sözleşmeli';

export type WorkModel = 'Ofis' | 'Hibrit' | 'Saha' | 'Uzaktan';

export type EmploymentStatus = 'Aktif' | 'İzinli' | 'Geçici Görevde' | 'Pasif';

export interface KPIItem {
  id: string;
  title: string;
  category: 'OKR' | 'KPI';
  weight: number; // percentage, sum must equal 100
  targetValue: number;
  actualValue: number;
  unit: string;
  selfScore: number; // 0-100
  managerScore: number; // 0-100
  managerComment: string;
}

export interface PeriodPerformanceRecord {
  period: EvaluationPeriod;
  stage: PerformanceWorkflowStage;
  kpis: KPIItem[];
  calculatedScore: number;
  calibratedScore?: number;
  calibrationNote?: string;
  managerSummary: string;
  updatedAt: string;
}

export interface CompetencySubKpi {
  id: string;
  text: string;
  isActive: boolean;
}

export interface CompetencyDefinition {
  id: string;
  name: string;
  category: 'Temel Yetkinlik' | 'Liderlik Yetkinliği' | 'Fonksiyonel Yetkinlik';
  description: string;
  targetScore: number;
  isActive: boolean;
  weight: number; // relative weight/coefficient (default 1)
  roleGroups: string[]; // empty or ['Tümü'] => applies to all; otherwise role group names
  indicators: CompetencySubKpi[];
}

export type RaterRelation =
  | 'MANAGER'
  | 'SELF'
  | 'PEER'
  | 'SUBORDINATE'
  | 'INTERNAL_CUSTOMER';

export interface RaterAssignment {
  id: string;
  raterEmployeeId: string;
  raterName: string;
  raterTitle: string;
  relation: RaterRelation;
  completed: boolean;
  submittedAt?: string;
  remindedAt?: string;
  scores: Record<string, number>; // competencyId -> 0-100 normalized
  indicatorScores?: Record<string, number>; // subKpiId -> raw scale value
  comment?: string;
}

export interface Scale360Level {
  value: number;
  label: string;
  coefficient: number; // score multiplier / numeric equivalent
}

export interface Scale360Config {
  name: string;
  levels: Scale360Level[];
}

export interface CareerHistoryEvent {
  id: string;
  date: string;
  type:
    | 'PERFORMANS'
    | 'TERFİ'
    | 'ROTASYON'
    | 'GÖREVLENDİRME'
    | 'KALİBRASYON'
    | 'ATAMA'
    | 'SİCİL GÜNCELLEME';
  title: string;
  detail: string;
  actor: string;
}

export interface Employee {
  id: string;
  sicilNo: string;
  fullName: string;
  title: string;
  grade: number; // Kadro Derecesi 1-12
  department: DepartmentName;
  location: string;
  managerId: string | null;
  hireDate: string;
  tenureMonths: number;
  hasSubordinates: boolean;
  disciplinaryWarning: boolean;
  disciplinaryNote?: string;
  potentialScore: number; // 0-100 manager potential evaluation

  // Full Sicil & Özlük Fields
  tcKimlikNo: string;
  birthDate: string;
  gender: GenderType;
  email: string;
  phone: string;
  city: string;
  emergencyContact: string;
  educationLevel: EducationLevel;
  university: string;
  foreignLanguages: string;
  certifications: string;
  employmentType: EmploymentType;
  workModel: WorkModel;
  employmentStatus: EmploymentStatus;
  costCenter: string;
  sgkBranch: string;
  annualLeaveBalance: number;
  notes?: string;

  manualNineBoxOverride?: {
    boxId: NineBoxId;
    reason: string;
    updatedBy: string;
    updatedAt: string;
  };
  performanceRecords: Record<EvaluationPeriod, PeriodPerformanceRecord>;
  termEvaluations: Record<PerformanceTermKey, PerformanceTermEvaluation>;
  raters360: RaterAssignment[];
  careerHistory: CareerHistoryEvent[];
}

export interface EmployeeFormPayload {
  id?: string;
  sicilNo: string;
  fullName: string;
  title: string;
  grade: number;
  department: DepartmentName;
  location: string;
  managerId: string | null;
  hireDate: string;
  tenureMonths: number;
  hasSubordinates: boolean;
  disciplinaryWarning: boolean;
  disciplinaryNote?: string;
  potentialScore: number;
  tcKimlikNo: string;
  birthDate: string;
  gender: GenderType;
  email: string;
  phone: string;
  city: string;
  emergencyContact: string;
  educationLevel: EducationLevel;
  university: string;
  foreignLanguages: string;
  certifications: string;
  employmentType: EmploymentType;
  workModel: WorkModel;
  employmentStatus: EmploymentStatus;
  costCenter: string;
  sgkBranch: string;
  annualLeaveBalance: number;
  notes?: string;
}

export interface ParsedEmployeeImportRow {
  rowNumber: number;
  status: 'INSERT' | 'UPDATE' | 'ERROR';
  errorMessage?: string;
  existingEmployeeId?: string;
  changedFields: string[];
  managerSicilNo?: string;
  data: EmployeeFormPayload;
}

export type MobilityProcessType = string;

export type ApprovalStepName = string;

export type MobilityStatus = 'Devam Ediyor' | 'Onaylandı' | 'Reddedildi';

export interface MobilityRequest {
  id: string;
  employeeId: string;
  processType: MobilityProcessType;
  targetTitle: string;
  targetGrade: number;
  targetDepartment: DepartmentName;
  targetLocation: string;
  justification: string;
  adminOverrideUsed: boolean;
  adminOverrideReason?: string;
  currentStepIndex: number; // 0..5
  status: MobilityStatus;
  createdAt: string;
  createdBy: string;
  rejectionReason?: string;
  stepHistory: {
    step: ApprovalStepName;
    actor: string;
    date: string;
    decision: 'Onaylandı' | 'Reddedildi' | 'Başlatıldı';
    note?: string;
  }[];
}

export type AssignmentCategory = string;

export type AssignmentStatus =
  | 'Aktif'
  | 'Tamamlandı'
  | 'Erken Sonlandırıldı';

export interface TemporaryAssignment {
  id: string;
  employeeId: string;
  category: AssignmentCategory;
  targetLocationOrProject: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  hasAllowance: boolean; // Harcırah / Vekalet Ücreti
  reportingManagerId: string;
  status: AssignmentStatus;
  notes: string;
  completedAt?: string;
  actualDaysServed?: number;
}

export interface SystemRules {
  nineBoxThresholds: {
    perfLowMax: number; // < perfLowMax => Düşük
    perfMidMax: number; // < perfMidMax => Beklenen, >= perfMidMax => Üstün
    potLowMax: number; // < potLowMax => Düşük
    potMidMax: number; // < potMidMax => Orta, >= potMidMax => Yüksek
  };
  raterWeights360: {
    MANAGER: number;
    SELF: number;
    PEER: number;
    SUBORDINATE: number;
    INTERNAL_CUSTOMER: number;
  };
  promotionEligibility: {
    minTenureMonths: number;
    minPerformanceScore: number;
    minCompetency360Score: number;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  date: string;
  read: boolean;
  targetModule: ModuleKey;
  employeeId?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export interface NineBoxMeta {
  id: NineBoxId;
  code: string;
  name: string;
  shortName: string;
  perfBand: 'Düşük' | 'Beklenen' | 'Üstün';
  potBand: 'Düşük' | 'Orta' | 'Yüksek';
  row: 0 | 1 | 2; // 0 = Yüksek Potansiyel (top), 2 = Düşük Potansiyel (bottom)
  col: 0 | 1 | 2; // 0 = Düşük Perf (left), 2 = Üstün Perf (right)
  recommendation: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
}

export interface FeatureFlags {
  enablePerformance: boolean;
  enableFeedback360: boolean;
  enableNineBox: boolean;
  enableMobility: boolean;
  enableAssignments: boolean;
  enableNineBoxDragDrop: boolean;
  enableCsvExport: boolean;
  enableAutoEligibilityEngine: boolean;
  enableAssignmentConflictCheck: boolean;
  enableCalibrationOverride: boolean;
}

export interface DashboardKpiConfig {
  id:
    | 'totalEmployees'
    | 'perfRate'
    | 'comp360Rate'
    | 'highPotRate'
    | 'activePromotions'
    | 'activeAssignments';
  label: string;
  subtitle: string;
  visible: boolean;
}

export interface KpiTemplateItem {
  id: string;
  title: string;
  category: 'OKR' | 'KPI';
  weight: number;
  targetValue: number;
  unit: string;
}

export interface PlatformConfig {
  platformName: string;
  platformSubtitle: string;
  features: FeatureFlags;
  dashboardKpis: DashboardKpiConfig[];
  evaluationPeriods: string[];
  departments: string[];
  locations: string[];
  performanceStages: string[];
  mobilityProcessTypes: string[];
  mobilityApprovalSteps: string[];
  assignmentCategories: string[];
  assignmentExpiryWarningDays: number;
  kpiTemplatesByDepartment: Record<string, KpiTemplateItem[]>;
  nineBoxCatalog: Record<NineBoxId, NineBoxMeta>;
  roleGroupCatalog: string[];
  scale360: Scale360Config;
}


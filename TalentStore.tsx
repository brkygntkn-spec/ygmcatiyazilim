import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  INITIAL_ASSIGNMENTS,
  INITIAL_COMPETENCIES,
  INITIAL_EMPLOYEES,
  INITIAL_MOBILITY_REQUESTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_SYSTEM_RULES,
} from './seedData';
import { INITIAL_PLATFORM_CONFIG } from './platformConfigSeed';
import {
  AssignmentCategory,
  CompetencyDefinition,
  DepartmentName,
  Employee,
  EmployeeFormPayload,
  EvaluationPeriod,
  KPIItem,
  KpiTemplateItem,
  MobilityProcessType,
  MobilityRequest,
  ModuleKey,
  NineBoxId,
  NotificationItem,
  ParsedEmployeeImportRow,
  PerformanceTermEvaluation,
  PerformanceWorkflowStage,
  PlatformConfig,
  RaterAssignment,
  RaterRelation,
  Scale360Config,
  SettingsSubTab,
  SystemRules,
  TemporaryAssignment,
  ToastMessage,
  UserRole,
} from './talent';
import {
  calculateWeightedKpiScore,
  getDaysBetween,
  REFERENCE_TODAY,
} from './calculations';
import {
  calculateAnnualPerformanceScore,
  classifyPerformanceScore,
  createEmptyTermEvaluation,
} from './performanceCriteria';

interface TalentContextValue {
  // Navigation & Global View State
  activeModule: ModuleKey;
  setActiveModule: (m: ModuleKey) => void;
  settingsTab: SettingsSubTab;
  setSettingsTab: (tab: SettingsSubTab) => void;
  openSettingsTab: (tab: SettingsSubTab) => void;
  activePeriod: EvaluationPeriod;
  setActivePeriod: (p: EvaluationPeriod) => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
  currentRoleActorName: string;
  currentRoleEmployeeId: string;

  // Cross-module triggers
  selectedEmployeeId: string | null;
  openEmployeeDrawer: (empId: string) => void;
  closeEmployeeDrawer: () => void;
  nineBoxFilterId: NineBoxId | 'ALL';
  setNineBoxFilterId: (id: NineBoxId | 'ALL') => void;
  jumpToNineBoxWithFilter: (boxId: NineBoxId) => void;
  prefilledMobilityEmpId: string | null;
  startMobilityForEmployee: (empId: string) => void;
  clearPrefilledMobility: () => void;
  excelModalOpen: boolean;
  setExcelModalOpen: (open: boolean) => void;

  // Core Data
  employees: Employee[];
  competencies: CompetencyDefinition[];
  mobilityRequests: MobilityRequest[];
  assignments: TemporaryAssignment[];
  rules: SystemRules;
  platformConfig: PlatformConfig;
  notifications: NotificationItem[];
  toasts: ToastMessage[];

  // Toast & Notification actions
  pushToast: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Master Employee Directory & Excel Import actions
  upsertEmployee: (payload: EmployeeFormPayload) => { ok: boolean; error?: string };
  bulkImportEmployees: (
    rows: ParsedEmployeeImportRow[],
    options: { syncCatalogs: boolean }
  ) => { updatedCount: number; insertedCount: number };

  // Module B: Performance actions
  savePerformanceTermEvaluation: (
    empId: string,
    evaluation: PerformanceTermEvaluation
  ) => void;
  saveEmployeeKpis: (
    empId: string,
    period: EvaluationPeriod,
    kpis: KPIItem[],
    stage: PerformanceWorkflowStage,
    managerSummary: string,
    calibratedScore?: number,
    calibrationNote?: string
  ) => void;
  advancePerformanceStage: (empId: string, period: EvaluationPeriod, nextStage: PerformanceWorkflowStage) => void;

  // Module C: 360 Competency actions
  addCompetency: (comp: Omit<CompetencyDefinition, 'id'>) => void;
  updateCompetency: (comp: CompetencyDefinition) => void;
  toggleCompetencyActive: (compId: string) => void;
  deleteCompetency: (compId: string) => void;
  save360Configuration: (
    nextWeights: SystemRules['raterWeights360'],
    nextScale: Scale360Config,
    nextRoleGroups: string[]
  ) => void;
  addRaterToEmployee: (
    empId: string,
    raterName: string,
    raterTitle: string,
    relation: RaterRelation
  ) => void;
  removeRaterFromEmployee: (empId: string, raterId: string) => void;
  sendRaterReminder: (empId: string, raterId: string) => void;
  submitRaterEvaluation: (
    empId: string,
    raterId: string,
    scores: Record<string, number>,
    comment: string,
    indicatorScores?: Record<string, number>
  ) => void;

  // Module D: Nine-Box Calibration actions
  calibrateEmployeeNineBox: (empId: string, targetBoxId: NineBoxId, reason: string) => void;
  resetEmployeeNineBoxOverride: (empId: string) => void;

  // Module E: Mobility & Promotion actions
  createMobilityRequest: (payload: {
    employeeId: string;
    processType: MobilityProcessType;
    targetTitle: string;
    targetGrade: number;
    targetDepartment: DepartmentName;
    targetLocation: string;
    justification: string;
    adminOverrideUsed: boolean;
    adminOverrideReason?: string;
  }) => void;
  approveMobilityStep: (requestId: string, note?: string) => void;
  rejectMobilityRequest: (requestId: string, reason: string) => void;

  // Module F: Temporary Assignments actions
  createAssignment: (payload: {
    employeeId: string;
    category: AssignmentCategory;
    targetLocationOrProject: string;
    startDate: string;
    endDate: string;
    hasAllowance: boolean;
    reportingManagerId: string;
    notes: string;
  }) => void;
  extendAssignment: (assignmentId: string, newEndDate: string, reason: string) => void;
  endAssignmentEarly: (assignmentId: string, reason: string) => void;
  completeAssignmentAndReturn: (assignmentId: string) => void;

  // Module G: System Rules & Platform Studio
  updateSystemRules: (nextRules: SystemRules) => void;
  updatePlatformConfig: (nextConfig: PlatformConfig) => void;
  resetPlatformConfig: () => void;
  applyDepartmentKpiTemplates: (department: string, templates: KpiTemplateItem[]) => void;
}

const TalentContext = createContext<TalentContextValue | null>(null);

function isModuleFeatureEnabled(m: ModuleKey, cfg: PlatformConfig): boolean {
  if (m === 'performance') return cfg.features.enablePerformance;
  if (m === 'feedback360') return cfg.features.enableFeedback360;
  if (m === 'ninebox') return cfg.features.enableNineBox;
  if (m === 'mobility') return cfg.features.enableMobility;
  if (m === 'assignments') return cfg.features.enableAssignments;
  return true;
}

export const TalentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeModule, setActiveModuleState] = useState<ModuleKey>('dashboard');
  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('studio');
  const [activePeriod, setActivePeriod] = useState<EvaluationPeriod>('2026 Yıl Sonu Dönemi');
  const [role, setRoleState] = useState<UserRole>(currentUser?.role ?? 'ADMIN');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [nineBoxFilterId, setNineBoxFilterId] = useState<NineBoxId | 'ALL'>('ALL');
  const [prefilledMobilityEmpId, setPrefilledMobilityEmpId] = useState<string | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [competencies, setCompetencies] = useState<CompetencyDefinition[]>(INITIAL_COMPETENCIES);
  const [mobilityRequests, setMobilityRequests] = useState<MobilityRequest[]>(
    INITIAL_MOBILITY_REQUESTS
  );
  const [assignments, setAssignments] = useState<TemporaryAssignment[]>(INITIAL_ASSIGNMENTS);
  const [rules, setRules] = useState<SystemRules>(INITIAL_SYSTEM_RULES);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(INITIAL_PLATFORM_CONFIG);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isUserAllowedModule = useCallback(
    (m: ModuleKey) => {
      if (!currentUser) return true;
      const perm = currentUser.permissions.modules[m];
      if (typeof perm === 'boolean') return perm;
      return m === 'employees' || m === 'dashboard';
    },
    [currentUser]
  );

  // Synchronize effective role only when the authenticated user or their assigned role changes
  // (preserves Admin preview role switching when navigating across modules)
  useEffect(() => {
    if (!currentUser) return;
    setRoleState(currentUser.role);
  }, [currentUser?.id, currentUser?.role]);

  // Redirect away from disallowed or disabled modules whenever permissions or feature flags change
  useEffect(() => {
    if (!currentUser) return;
    if (!isUserAllowedModule(activeModule) || !isModuleFeatureEnabled(activeModule, platformConfig)) {
      const firstAllowed = (
        [
          'dashboard',
          'employees',
          'performance',
          'feedback360',
          'ninebox',
          'mobility',
          'assignments',
          'settings',
        ] as ModuleKey[]
      ).find((m) => isUserAllowedModule(m) && isModuleFeatureEnabled(m, platformConfig));
      if (firstAllowed) {
        setActiveModuleState(firstAllowed);
      }
    }
  }, [activeModule, currentUser, isUserAllowedModule, platformConfig]);

  const setActiveModule = useCallback(
    (m: ModuleKey) => {
      if (!isUserAllowedModule(m)) {
        return;
      }
      if (!isModuleFeatureEnabled(m, platformConfig)) {
        return;
      }
      setActiveModuleState(m);
    },
    [isUserAllowedModule, platformConfig]
  );

  const openSettingsTab = useCallback(
    (tab: SettingsSubTab) => {
      if (currentUser && !currentUser.permissions.modules.settings) {
        return;
      }
      setSettingsTab(tab);
      setActiveModuleState('settings');
    },
    [currentUser]
  );

  const setRole = useCallback(
    (r: UserRole) => {
      // Only authenticated ADMIN accounts can switch preview role
      if (currentUser && currentUser.role !== 'ADMIN') return;
      setRoleState(r);
    },
    [currentUser]
  );

  const currentRoleActorName = useMemo(() => {
    if (currentUser && role === currentUser.role) {
      const roleTitle =
        currentUser.role === 'ADMIN'
          ? 'İK Yöneticisi'
          : currentUser.role === 'MANAGER'
          ? 'Birim Yöneticisi'
          : 'Çalışan';
      return `${currentUser.fullName} (${roleTitle})`;
    }
    if (role === 'ADMIN') return 'Elif Öztürk (İK Yöneticisi)';
    if (role === 'MANAGER') return 'Hakan Demirtaş (Birim Yöneticisi)';
    return 'Ayşe Yılmaz (Çalışan)';
  }, [currentUser, role]);

  const currentRoleEmployeeId = useMemo(() => {
    if (currentUser?.linkedEmployeeId && role === currentUser.role) {
      return currentUser.linkedEmployeeId;
    }
    if (role === 'ADMIN') return 'emp-05';
    if (role === 'MANAGER') return 'emp-01';
    return 'emp-08';
  }, [currentUser, role]);

  const pushToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const openEmployeeDrawer = useCallback((empId: string) => {
    setSelectedEmployeeId(empId);
  }, []);

  const closeEmployeeDrawer = useCallback(() => {
    setSelectedEmployeeId(null);
  }, []);

  const jumpToNineBoxWithFilter = useCallback((boxId: NineBoxId) => {
    setNineBoxFilterId(boxId);
    setActiveModule('ninebox');
  }, []);

  const startMobilityForEmployee = useCallback((empId: string) => {
    setPrefilledMobilityEmpId(empId);
    setSelectedEmployeeId(null);
    setActiveModule('mobility');
  }, []);

  const clearPrefilledMobility = useCallback(() => {
    setPrefilledMobilityEmpId(null);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    pushToast('info', 'Tüm bildirimler okundu olarak işaretlendi.');
  }, [pushToast]);

  // Helper to build default performance & 360 records for newly created / Excel-imported employees
  const buildNewEmployeeScaffold = useCallback(
    (
      empId: string,
      payload: EmployeeFormPayload,
      managerName: string
    ): Pick<Employee, 'performanceRecords' | 'termEvaluations' | 'raters360' | 'careerHistory'> => {
      const defaultStage = platformConfig.performanceStages[0] ?? 'Hedef Belirleme';
      const templates: KpiTemplateItem[] = platformConfig.kpiTemplatesByDepartment[payload.department] ?? [
        {
          id: 'def-1',
          title: 'Dönemsel Operasyonel Hedef Gerçekleşmesi',
          category: 'KPI',
          weight: 60,
          targetValue: 95,
          unit: '%',
        },
        {
          id: 'def-2',
          title: 'Kurumsal Süreç İyileştirme ve İş Birliği',
          category: 'OKR',
          weight: 40,
          targetValue: 100,
          unit: 'Puan',
        },
      ];

      const performanceRecords: Employee['performanceRecords'] = {};
      platformConfig.evaluationPeriods.forEach((period, pIdx) => {
        const baseScore = Math.max(60, Math.min(92, payload.potentialScore - pIdx * 2));
        const kpis: KPIItem[] = templates.map((t, idx) => ({
          id: `${empId}-${pIdx}-${idx + 1}`,
          title: t.title,
          category: t.category,
          weight: t.weight,
          targetValue: t.targetValue,
          actualValue: Math.round(t.targetValue * (baseScore / 100)),
          unit: t.unit,
          selfScore: baseScore,
          managerScore: baseScore,
          managerComment: '',
        }));
        performanceRecords[period] = {
          period,
          stage: pIdx === 0 ? defaultStage : 'Kalibrasyon & Kesinleşme',
          kpis,
          calculatedScore: calculateWeightedKpiScore(kpis),
          managerSummary: 'Personel kaydı oluşturulurken birim KPI şablonundan otomatik tanımlandı.',
          updatedAt: REFERENCE_TODAY,
        };
      });

      const baseCompScore = Math.max(62, Math.min(90, payload.potentialScore - 2));
      const buildCompScores = (delta: number): Record<string, number> => {
        const res: Record<string, number> = {};
        competencies.forEach((c, idx) => {
          res[c.id] = Math.max(50, Math.min(100, baseCompScore + delta + ((idx % 3) - 1) * 2));
        });
        return res;
      };

      const raters360: RaterAssignment[] = [
        {
          id: `${empId}-r-mgr`,
          raterEmployeeId: payload.managerId ?? 'emp-01',
          raterName: managerName || 'Birim Yöneticisi',
          raterTitle: 'Yönetici',
          relation: 'MANAGER',
          completed: true,
          submittedAt: REFERENCE_TODAY,
          scores: buildCompScores(0),
        },
        {
          id: `${empId}-r-self`,
          raterEmployeeId: empId,
          raterName: payload.fullName,
          raterTitle: payload.title,
          relation: 'SELF',
          completed: true,
          submittedAt: REFERENCE_TODAY,
          scores: buildCompScores(2),
        },
        {
          id: `${empId}-r-peer1`,
          raterEmployeeId: 'emp-05',
          raterName: 'Elif Öztürk',
          raterTitle: 'Yetenek ve Gelişim Yöneticisi',
          relation: 'PEER',
          completed: false,
          scores: {},
        },
      ];

      if (payload.hasSubordinates) {
        raters360.push({
          id: `${empId}-r-sub1`,
          raterEmployeeId: 'emp-12',
          raterName: 'Ekip Temsilcisi',
          raterTitle: 'Birim Uzmanı',
          relation: 'SUBORDINATE',
          completed: false,
          scores: {},
        });
      }

      raters360.push({
        id: `${empId}-r-ic1`,
        raterEmployeeId: 'emp-05',
        raterName: 'Elif Öztürk',
        raterTitle: 'İç Müşteri / İK Paydaşı',
        relation: 'INTERNAL_CUSTOMER',
        completed: false,
        scores: {},
      });

      const termEvaluations: Employee['termEvaluations'] = {
        '1. Dönem': createEmptyTermEvaluation('1. Dönem', managerName || 'Birim Yöneticisi'),
        '2. Dönem': createEmptyTermEvaluation('2. Dönem', managerName || 'Birim Yöneticisi'),
        '3. Dönem': createEmptyTermEvaluation('3. Dönem', managerName || 'Birim Yöneticisi'),
      };

      return {
        performanceRecords,
        termEvaluations,
        raters360,
        careerHistory: [
          {
            id: `ch-${empId}-init`,
            date: payload.hireDate || REFERENCE_TODAY,
            type: 'ATAMA',
            title: `Personel Sicil Kaydı Oluşturuldu — ${payload.title}`,
            detail: `${payload.department} · ${payload.location} (Derece ${payload.grade}, ${payload.employmentType})`,
            actor: currentRoleActorName,
          },
        ],
      };
    },
    [competencies, currentRoleActorName, platformConfig]
  );

  // MASTER EMPLOYEE DIRECTORY: Create or Update single employee
  const upsertEmployee = useCallback(
    (payload: EmployeeFormPayload): { ok: boolean; error?: string } => {
      const normalizedSicil = payload.sicilNo.trim().toLocaleUpperCase('tr-TR');
      if (!normalizedSicil || payload.fullName.trim().length < 2) {
        return { ok: false, error: 'Sicil No ve Ad Soyad alanları zorunludur.' };
      }

      const duplicate = employees.find(
        (e) =>
          e.sicilNo.trim().toLocaleUpperCase('tr-TR') === normalizedSicil &&
          e.id !== payload.id
      );
      if (duplicate) {
        return {
          ok: false,
          error: `"${normalizedSicil}" sicil numarası zaten ${duplicate.fullName} adına kayıtlı.`,
        };
      }

      // Sync any new department or location into platformConfig automatically
      setPlatformConfig((prev) => {
        const nextDepts = prev.departments.includes(payload.department)
          ? prev.departments
          : [...prev.departments, payload.department];
        const nextLocs = prev.locations.includes(payload.location)
          ? prev.locations
          : [...prev.locations, payload.location];
        if (nextDepts === prev.departments && nextLocs === prev.locations) return prev;
        return { ...prev, departments: nextDepts, locations: nextLocs };
      });

      if (payload.id) {
        setEmployees((prev) =>
          prev.map((emp) => {
            if (emp.id !== payload.id) return emp;
            const changed: string[] = [];
            if (emp.title !== payload.title) changed.push(`Unvan: ${payload.title}`);
            if (emp.department !== payload.department) changed.push(`Birim: ${payload.department}`);
            if (emp.location !== payload.location) changed.push(`Lokasyon: ${payload.location}`);
            if (emp.grade !== payload.grade) changed.push(`Derece: ${payload.grade}`);
            if (emp.employmentStatus !== payload.employmentStatus)
              changed.push(`Durum: ${payload.employmentStatus}`);

            const nextHistory =
              changed.length > 0
                ? [
                    {
                      id: `ch-${Date.now()}-sicil`,
                      date: REFERENCE_TODAY,
                      type: 'SİCİL GÜNCELLEME' as const,
                      title: 'Sicil ve Özlük Bilgileri Güncellendi',
                      detail: changed.join(' · '),
                      actor: currentRoleActorName,
                    },
                    ...emp.careerHistory,
                  ]
                : emp.careerHistory;

            return {
              ...emp,
              ...payload,
              sicilNo: normalizedSicil,
              careerHistory: nextHistory,
            };
          })
        );
        pushToast('success', `${payload.fullName} (${normalizedSicil}) sicil bilgileri güncellendi.`);
        return { ok: true };
      }

      const newId = `emp-${Date.now().toString(36)}`;
      const mgr = payload.managerId ? employees.find((e) => e.id === payload.managerId) : undefined;
      const scaffold = buildNewEmployeeScaffold(newId, payload, mgr?.fullName ?? 'Üst Yönetim');
      const newEmployee: Employee = {
        ...payload,
        id: newId,
        sicilNo: normalizedSicil,
        ...scaffold,
      };
      setEmployees((prev) => [newEmployee, ...prev]);
      pushToast('success', `${payload.fullName} (${normalizedSicil}) personel listesine eklendi.`);
      return { ok: true };
    },
    [buildNewEmployeeScaffold, currentRoleActorName, employees, pushToast]
  );

  // MASTER EMPLOYEE DIRECTORY: Bulk Excel Upsert (matches by Sicil No)
  const bulkImportEmployees = useCallback(
    (
      rows: ParsedEmployeeImportRow[],
      options: { syncCatalogs: boolean }
    ): { updatedCount: number; insertedCount: number } => {
      const validRows = rows.filter((r) => r.status === 'UPDATE' || r.status === 'INSERT');
      if (validRows.length === 0) {
        pushToast('warning', 'İçe aktarılacak geçerli satır bulunamadı.');
        return { updatedCount: 0, insertedCount: 0 };
      }

      // Compute accurate counts synchronously before batched React state updater
      const existingSicilSet = new Set(
        employees.map((emp) => emp.sicilNo.trim().toLocaleUpperCase('tr-TR'))
      );
      let updatedCount = 0;
      let insertedCount = 0;
      validRows.forEach((row) => {
        const normSicil = row.data.sicilNo.trim().toLocaleUpperCase('tr-TR');
        if (existingSicilSet.has(normSicil)) {
          updatedCount += 1;
        } else {
          existingSicilSet.add(normSicil);
          insertedCount += 1;
        }
      });

      if (options.syncCatalogs) {
        setPlatformConfig((prev) => {
          const depts = new Set(prev.departments);
          const locs = new Set(prev.locations);
          validRows.forEach((r) => {
            if (r.data.department) depts.add(r.data.department);
            if (r.data.location) locs.add(r.data.location);
          });
          return {
            ...prev,
            departments: Array.from(depts),
            locations: Array.from(locs),
          };
        });
      }

      setEmployees((prev) => {
        const nextList = [...prev];
        const indexBySicil = new Map<string, number>();
        nextList.forEach((emp, idx) => {
          indexBySicil.set(emp.sicilNo.trim().toLocaleUpperCase('tr-TR'), idx);
        });

        const managerLinks: { employeeId: string; managerSicilNo: string }[] = [];

        validRows.forEach((row, rIdx) => {
          const normSicil = row.data.sicilNo.trim().toLocaleUpperCase('tr-TR');
          const existingIdx = indexBySicil.get(normSicil);

          if (existingIdx !== undefined) {
            const existing = nextList[existingIdx];
            const historyEntries =
              row.changedFields.length > 0
                ? [
                    {
                      id: `ch-${Date.now()}-xls-${rIdx}`,
                      date: REFERENCE_TODAY,
                      type: 'SİCİL GÜNCELLEME' as const,
                      title: 'Excel Toplu Güncelleme İşlendi',
                      detail: `Güncellenen alanlar: ${row.changedFields.join(', ')}`,
                      actor: currentRoleActorName,
                    },
                    ...existing.careerHistory,
                  ]
                : existing.careerHistory;

            nextList[existingIdx] = {
              ...existing,
              ...row.data,
              id: existing.id,
              sicilNo: normSicil,
              careerHistory: historyEntries,
            };
            if (row.managerSicilNo) {
              managerLinks.push({ employeeId: existing.id, managerSicilNo: row.managerSicilNo });
            }
          } else {
            const newId = `emp-xls-${Date.now().toString(36)}-${rIdx}`;
            const scaffold = buildNewEmployeeScaffold(newId, row.data, 'Birim Yöneticisi');
            const created: Employee = {
              ...row.data,
              id: newId,
              sicilNo: normSicil,
              ...scaffold,
            };
            nextList.unshift(created);
            indexBySicil.clear();
            nextList.forEach((emp, idx) => {
              indexBySicil.set(emp.sicilNo.trim().toLocaleUpperCase('tr-TR'), idx);
            });
            if (row.managerSicilNo) {
              managerLinks.push({ employeeId: newId, managerSicilNo: row.managerSicilNo });
            }
          }
        });

        // Second pass: resolve managerSicilNo -> managerId
        if (managerLinks.length > 0) {
          const idBySicil = new Map(
            nextList.map((e) => [e.sicilNo.trim().toLocaleUpperCase('tr-TR'), e.id])
          );
          const linkMap = new Map(managerLinks.map((l) => [l.employeeId, l.managerSicilNo]));
          return nextList.map((emp) => {
            const targetMgrSicil = linkMap.get(emp.id);
            if (!targetMgrSicil) return emp;
            const resolvedId = idBySicil.get(targetMgrSicil);
            if (!resolvedId || resolvedId === emp.id) return emp;
            return { ...emp, managerId: resolvedId };
          });
        }

        return nextList;
      });

      const summaryText = `${updatedCount} personel güncellendi, ${insertedCount} yeni personel eklendi. Tüm modüller senkronize edildi.`;
      setNotifications((prev) => [
        {
          id: `not-${Date.now()}-xls`,
          title: 'Excel Personel Listesi Güncellendi',
          description: summaryText,
          date: REFERENCE_TODAY,
          read: false,
          targetModule: 'employees',
        },
        ...prev,
      ]);
      pushToast('success', summaryText);
      return { updatedCount, insertedCount };
    },
    [buildNewEmployeeScaffold, currentRoleActorName, employees, pushToast]
  );

  // MODULE B: Performance (EK-13 / EK-14 / EK-15 3-Term + OKR/KPI)
  const savePerformanceTermEvaluation = useCallback(
    (empId: string, evaluation: PerformanceTermEvaluation) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          const nextTermEvaluations: Employee['termEvaluations'] = {
            ...emp.termEvaluations,
            [evaluation.term]: {
              ...evaluation,
              evaluatorName: evaluation.evaluatorName || currentRoleActorName,
              submittedAt: REFERENCE_TODAY,
            },
          };

          const { annualScore } = calculateAnnualPerformanceScore(nextTermEvaluations);
          const effective5 = annualScore ?? evaluation.termScore;
          const synced100 =
            typeof effective5 === 'number'
              ? Math.round(effective5 * 20 * 10) / 10
              : emp.performanceRecords[activePeriod]?.calculatedScore ?? 0;

          const existingPerf = emp.performanceRecords[activePeriod];
          const defaultStage = platformConfig.performanceStages[0] ?? 'Hedef Belirleme';
          const nextPerformanceRecords = {
            ...emp.performanceRecords,
            [activePeriod]: existingPerf
              ? {
                  ...existingPerf,
                  calculatedScore: synced100,
                  managerSummary: evaluation.justification || existingPerf.managerSummary,
                  updatedAt: REFERENCE_TODAY,
                }
              : {
                  period: activePeriod,
                  stage: defaultStage,
                  kpis: [],
                  calculatedScore: synced100,
                  managerSummary: evaluation.justification || 'Dönem değerlendirmesi kaydedildi.',
                  updatedAt: REFERENCE_TODAY,
                },
          };

          const band = classifyPerformanceScore(evaluation.termScore);
          const annualBand = classifyPerformanceScore(annualScore);

          const nextHistory = [
            {
              id: `ch-${Date.now()}-ek13`,
              date: REFERENCE_TODAY,
              type: 'PERFORMANS' as const,
              title: `Bireysel Performans (${evaluation.term}) Tamamlandı — ${
                evaluation.termScore?.toFixed(2) ?? '-'
              } / 5.00`,
              detail: `Dönem Sınıfı: ${band?.label ?? '-'}${
                annualScore !== null
                  ? ` · Yıllık Sonuç: ${annualScore.toFixed(2)} (${annualBand?.label ?? '-'})`
                  : ''
              } · 6/6 boyut kanıt/yorum notu girildi.`,
              actor: currentRoleActorName,
            },
            ...emp.careerHistory,
          ];

          return {
            ...emp,
            termEvaluations: nextTermEvaluations,
            performanceRecords: nextPerformanceRecords,
            careerHistory: nextHistory,
          };
        })
      );

      pushToast(
        'success',
        `${evaluation.term} bireysel performans değerlendirmesi kaydedildi; yıllık sonuç ve Nine-Box verileri güncellendi.`
      );
    },
    [activePeriod, currentRoleActorName, platformConfig.performanceStages, pushToast]
  );

  const saveEmployeeKpis = useCallback(
    (
      empId: string,
      period: EvaluationPeriod,
      kpis: KPIItem[],
      stage: PerformanceWorkflowStage,
      managerSummary: string,
      calibratedScore?: number,
      calibrationNote?: string
    ) => {
      const calcScore = calculateWeightedKpiScore(kpis);
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          const prevRec = emp.performanceRecords[period];
          const calibrationChanged =
            typeof calibratedScore === 'number' && calibratedScore !== prevRec?.calibratedScore;
          const stageFinalized =
            stage === 'Kalibrasyon & Kesinleşme' && prevRec?.stage !== 'Kalibrasyon & Kesinleşme';

          const newHistory = [...emp.careerHistory];
          if (calibrationChanged && calibrationNote) {
            newHistory.unshift({
              id: `ch-${Date.now()}-cal`,
              date: REFERENCE_TODAY,
              type: 'KALİBRASYON',
              title: `${period} Performans Kalibrasyonu (${calibratedScore.toFixed(1)} Puan)`,
              detail: `Ham puan ${calcScore.toFixed(1)} → Kalibre puan ${calibratedScore.toFixed(1)}. Gerekçe: ${calibrationNote}`,
              actor: currentRoleActorName,
            });
          } else if (stageFinalized) {
            newHistory.unshift({
              id: `ch-${Date.now()}-perf`,
              date: REFERENCE_TODAY,
              type: 'PERFORMANS',
              title: `${period} Performans Süreci Kesinleşti`,
              detail: `Ağırlıklı dönem puanı ${(calibratedScore ?? calcScore).toFixed(1)} olarak onaylandı.`,
              actor: currentRoleActorName,
            });
          }

          return {
            ...emp,
            performanceRecords: {
              ...emp.performanceRecords,
              [period]: {
                period,
                stage,
                kpis,
                calculatedScore: calcScore,
                calibratedScore,
                calibrationNote,
                managerSummary,
                updatedAt: REFERENCE_TODAY,
              },
            },
            careerHistory: newHistory,
          };
        })
      );
      pushToast('success', 'Performans hedefleri ve değerlendirme puanları güncellendi.');
    },
    [currentRoleActorName, pushToast]
  );

  const advancePerformanceStage = useCallback(
    (empId: string, period: EvaluationPeriod, nextStage: PerformanceWorkflowStage) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          const rec = emp.performanceRecords[period];
          if (!rec) return emp;
          const newHistory = [...emp.careerHistory];
          if (nextStage === 'Kalibrasyon & Kesinleşme') {
            newHistory.unshift({
              id: `ch-${Date.now()}-fin`,
              date: REFERENCE_TODAY,
              type: 'PERFORMANS',
              title: `${period} Değerlendirmesi Kesinleşti`,
              detail: `Nihai puan ${(rec.calibratedScore ?? rec.calculatedScore).toFixed(1)} ile dönem kapatıldı.`,
              actor: currentRoleActorName,
            });
          }
          return {
            ...emp,
            performanceRecords: {
              ...emp.performanceRecords,
              [period]: { ...rec, stage: nextStage, updatedAt: REFERENCE_TODAY },
            },
            careerHistory: newHistory,
          };
        })
      );
      pushToast('success', `Değerlendirme aşaması "${nextStage}" olarak güncellendi.`);
    },
    [currentRoleActorName, pushToast]
  );

  // MODULE C: 360 Competency
  const addCompetency = useCallback(
    (comp: Omit<CompetencyDefinition, 'id'>) => {
      const id = `comp-${Date.now()}`;
      setCompetencies((prev) => [...prev, { ...comp, id }]);
      pushToast('success', `"${comp.name}" yetkinliği 360° kurgusuna eklendi.`);
    },
    [pushToast]
  );

  const updateCompetency = useCallback(
    (comp: CompetencyDefinition) => {
      setCompetencies((prev) => prev.map((c) => (c.id === comp.id ? comp : c)));
      pushToast('success', `"${comp.name}" yetkinliği ve alt KPI göstergeleri güncellendi.`);
    },
    [pushToast]
  );

  const toggleCompetencyActive = useCallback(
    (compId: string) => {
      setCompetencies((prev) =>
        prev.map((c) => (c.id === compId ? { ...c, isActive: !c.isActive } : c))
      );
      pushToast('info', 'Yetkinlik aktif/pasif durumu tüm 360° değerlendirme formlarına yansıtıldı.');
    },
    [pushToast]
  );

  const deleteCompetency = useCallback(
    (compId: string) => {
      setCompetencies((prev) => prev.filter((c) => c.id !== compId));
      pushToast('info', 'Yetkinlik tanımı kütüphaneden kaldırıldı.');
    },
    [pushToast]
  );

  const save360Configuration = useCallback(
    (
      nextWeights: SystemRules['raterWeights360'],
      nextScale: Scale360Config,
      nextRoleGroups: string[]
    ) => {
      setRules((prev) => ({
        ...prev,
        raterWeights360: nextWeights,
      }));
      setPlatformConfig((prev) => ({
        ...prev,
        scale360: nextScale,
        roleGroupCatalog: nextRoleGroups,
      }));
      pushToast(
        'success',
        '360° yetkinlik ağırlıkları, ölçek katsayıları ve rol grupları yayınlandı; tüm değerlendirme formları anlık güncellendi.'
      );
    },
    [pushToast]
  );

  const addRaterToEmployee = useCallback(
    (empId: string, raterName: string, raterTitle: string, relation: RaterRelation) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          return {
            ...emp,
            raters360: [
              ...emp.raters360,
              {
                id: `${empId}-r-${Date.now()}`,
                raterEmployeeId: `ext-${Date.now()}`,
                raterName,
                raterTitle,
                relation,
                completed: false,
                scores: {},
              },
            ],
          };
        })
      );
      pushToast('success', `${raterName} 360° değerlendirici matrisine atandı.`);
    },
    [pushToast]
  );

  const removeRaterFromEmployee = useCallback(
    (empId: string, raterId: string) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          return {
            ...emp,
            raters360: emp.raters360.filter((r) => r.id !== raterId),
          };
        })
      );
      pushToast('info', 'Değerlendirici matristen çıkarıldı.');
    },
    [pushToast]
  );

  const sendRaterReminder = useCallback(
    (empId: string, raterId: string) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          return {
            ...emp,
            raters360: emp.raters360.map((r) =>
              r.id === raterId ? { ...r, remindedAt: REFERENCE_TODAY } : r
            ),
          };
        })
      );
      pushToast('info', 'Değerlendiriciye e-posta ve sistem içi hatırlatma bildirimi gönderildi.');
    },
    [pushToast]
  );

  const submitRaterEvaluation = useCallback(
    (
      empId: string,
      raterId: string,
      scores: Record<string, number>,
      comment: string,
      indicatorScores?: Record<string, number>
    ) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          return {
            ...emp,
            raters360: emp.raters360.map((r) =>
              r.id === raterId
                ? {
                    ...r,
                    completed: true,
                    submittedAt: REFERENCE_TODAY,
                    scores,
                    indicatorScores: indicatorScores ?? r.indicatorScores,
                    comment,
                  }
                : r
            ),
          };
        })
      );
      pushToast('success', '360° yetkinlik değerlendirme formu kaydedildi; Nine-Box verileri senkronize edildi.');
    },
    [pushToast]
  );

  // MODULE D: Nine-Box Calibration
  const calibrateEmployeeNineBox = useCallback(
    (empId: string, targetBoxId: NineBoxId, reason: string) => {
      const boxMeta = platformConfig.nineBoxCatalog[targetBoxId];
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          return {
            ...emp,
            manualNineBoxOverride: {
              boxId: targetBoxId,
              reason,
              updatedBy: currentRoleActorName,
              updatedAt: REFERENCE_TODAY,
            },
            careerHistory: [
              {
                id: `ch-${Date.now()}-9b`,
                date: REFERENCE_TODAY,
                type: 'KALİBRASYON',
                title: `Nine-Box Kalibrasyon Güncellemesi: ${boxMeta.shortName}`,
                detail: `Kalibrasyon toplantısı kararı ile "${boxMeta.name}" segmentine taşındı. Gerekçe: ${reason}`,
                actor: currentRoleActorName,
              },
              ...emp.careerHistory,
            ],
          };
        })
      );
      pushToast('success', `Nine-Box konumu "${boxMeta.shortName}" olarak kalibre edildi ve tarihe işlendi.`);
    },
    [currentRoleActorName, platformConfig.nineBoxCatalog, pushToast]
  );

  const resetEmployeeNineBoxOverride = useCallback(
    (empId: string) => {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== empId) return emp;
          return {
            ...emp,
            manualNineBoxOverride: undefined,
          };
        })
      );
      pushToast('info', 'Manuel Nine-Box kalibrasyonu kaldırıldı; otomatik puan hesaplamasına dönüldü.');
    },
    [pushToast]
  );

  // MODULE E: Mobility & Promotions
  const createMobilityRequest = useCallback(
    (payload: {
      employeeId: string;
      processType: MobilityProcessType;
      targetTitle: string;
      targetGrade: number;
      targetDepartment: DepartmentName;
      targetLocation: string;
      justification: string;
      adminOverrideUsed: boolean;
      adminOverrideReason?: string;
    }) => {
      const emp = employees.find((e) => e.id === payload.employeeId);
      const steps = platformConfig.mobilityApprovalSteps;
      const firstStep = steps[0] ?? 'Talep Oluşturuldu';
      const newReq: MobilityRequest = {
        id: `mob-${Date.now().toString().slice(-4)}`,
        employeeId: payload.employeeId,
        processType: payload.processType,
        targetTitle: payload.targetTitle,
        targetGrade: payload.targetGrade,
        targetDepartment: payload.targetDepartment,
        targetLocation: payload.targetLocation,
        justification: payload.justification,
        adminOverrideUsed: payload.adminOverrideUsed,
        adminOverrideReason: payload.adminOverrideReason,
        currentStepIndex: steps.length > 1 ? 1 : 0,
        status: 'Devam Ediyor',
        createdAt: REFERENCE_TODAY,
        createdBy: currentRoleActorName,
        stepHistory: [
          {
            step: firstStep,
            actor: currentRoleActorName,
            date: REFERENCE_TODAY,
            decision: 'Başlatıldı',
            note: payload.adminOverrideUsed
              ? `İK İstisna Onayı ile başlatıldı: ${payload.adminOverrideReason}`
              : payload.justification,
          },
        ],
      };

      setMobilityRequests((prev) => [newReq, ...prev]);
      setNotifications((prev) => [
        {
          id: `not-${Date.now()}`,
          title: `Yeni ${payload.processType} Talebi`,
          description: `${emp?.fullName ?? 'Personel'} için ${payload.targetTitle} atama süreci başlatıldı.`,
          date: REFERENCE_TODAY,
          read: false,
          targetModule: 'mobility',
          employeeId: payload.employeeId,
        },
        ...prev,
      ]);
      pushToast('success', `${emp?.fullName ?? 'Çalışan'} için terfi/atama süreci onay akışına alındı.`);
    },
    [currentRoleActorName, employees, platformConfig.mobilityApprovalSteps, pushToast]
  );

  const approveMobilityStep = useCallback(
    (requestId: string, note?: string) => {
      const targetReq = mobilityRequests.find((r) => r.id === requestId);
      if (!targetReq || targetReq.status !== 'Devam Ediyor') return;

      const steps = platformConfig.mobilityApprovalSteps;
      const clampedIdx = Math.min(targetReq.currentStepIndex, Math.max(0, steps.length - 1));
      const currentStepName = steps[clampedIdx] ?? 'Onay Aşaması';
      const nextStepIndex = Math.min(steps.length - 1, clampedIdx + 1);
      const isFinalizing = nextStepIndex >= steps.length - 1;
      const finalStepLabel = steps[steps.length - 1] ?? 'Atama Gerçekleşti';

      setMobilityRequests((prev) =>
        prev.map((req) => {
          if (req.id !== requestId) return req;
          const updatedHistory = [
            ...req.stepHistory,
            {
              step: currentStepName,
              actor: currentRoleActorName,
              date: REFERENCE_TODAY,
              decision: 'Onaylandı' as const,
              note: note || 'Onay aşaması tamamlandı.',
            },
          ];
          if (isFinalizing) {
            updatedHistory.push({
              step: finalStepLabel,
              actor: 'Sistem Otomasyonu',
              date: REFERENCE_TODAY,
              decision: 'Onaylandı' as const,
              note: 'Çalışan özlük kartı (Unvan, Derece, Birim, Lokasyon) otomatik güncellendi.',
            });
          }
          return {
            ...req,
            currentStepIndex: nextStepIndex,
            status: isFinalizing ? 'Onaylandı' : 'Devam Ediyor',
            stepHistory: updatedHistory,
          };
        })
      );

      if (isFinalizing) {
        // Automated Profile Sync across entire platform
        setEmployees((prev) =>
          prev.map((emp) => {
            if (emp.id !== targetReq.employeeId) return emp;
            const eventType = targetReq.processType.includes('Terfi')
              ? 'TERFİ'
              : targetReq.processType.includes('Rotasyon')
              ? 'ROTASYON'
              : 'ATAMA';
            return {
              ...emp,
              title: targetReq.targetTitle,
              grade: targetReq.targetGrade,
              department: targetReq.targetDepartment,
              location: targetReq.targetLocation,
              tenureMonths: 0,
              careerHistory: [
                {
                  id: `ch-${Date.now()}-mob`,
                  date: REFERENCE_TODAY,
                  type: eventType,
                  title: `${targetReq.processType}: ${targetReq.targetTitle} (Derece ${targetReq.targetGrade})`,
                  detail: `${emp.department} (${emp.location}) → ${targetReq.targetDepartment} (${targetReq.targetLocation}). ${targetReq.justification}`,
                  actor: currentRoleActorName,
                },
                ...emp.careerHistory,
              ],
            };
          })
        );
        pushToast(
          'success',
          'Nihai onay tamamlandı! Çalışanın Unvan, Derece, Birim ve Lokasyon bilgileri sistem genelinde otomatik güncellendi.'
        );
      } else {
        pushToast('success', `"${currentStepName}" onaylandı. Süreç bir sonraki adıma ilerledi.`);
      }
    },
    [currentRoleActorName, mobilityRequests, platformConfig.mobilityApprovalSteps, pushToast]
  );

  const rejectMobilityRequest = useCallback(
    (requestId: string, reason: string) => {
      const steps = platformConfig.mobilityApprovalSteps;
      setMobilityRequests((prev) =>
        prev.map((req) => {
          if (req.id !== requestId) return req;
          const clampedIdx = Math.min(req.currentStepIndex, Math.max(0, steps.length - 1));
          const stepName = steps[clampedIdx] ?? 'Onay Aşaması';
          return {
            ...req,
            status: 'Reddedildi',
            rejectionReason: reason,
            stepHistory: [
              ...req.stepHistory,
              {
                step: stepName,
                actor: currentRoleActorName,
                date: REFERENCE_TODAY,
                decision: 'Reddedildi',
                note: reason,
              },
            ],
          };
        })
      );
      pushToast('warning', 'Terfi / atama talebi gerekçesiyle birlikte reddedildi.');
    },
    [currentRoleActorName, platformConfig.mobilityApprovalSteps, pushToast]
  );

  // MODULE F: Temporary Assignments
  const createAssignment = useCallback(
    (payload: {
      employeeId: string;
      category: AssignmentCategory;
      targetLocationOrProject: string;
      startDate: string;
      endDate: string;
      hasAllowance: boolean;
      reportingManagerId: string;
      notes: string;
    }) => {
      const newAsg: TemporaryAssignment = {
        id: `asg-${Date.now().toString().slice(-4)}`,
        ...payload,
        status: 'Aktif',
      };
      setAssignments((prev) => [newAsg, ...prev]);

      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== payload.employeeId) return emp;
          return {
            ...emp,
            careerHistory: [
              {
                id: `ch-${Date.now()}-asg-start`,
                date: REFERENCE_TODAY,
                type: 'GÖREVLENDİRME',
                title: `Geçici Görevlendirme Başladı: ${payload.targetLocationOrProject}`,
                detail: `${payload.category} (${payload.startDate} – ${payload.endDate})${payload.hasAllowance ? ' · Harcırah/Vekalet Aktif' : ''}`,
                actor: currentRoleActorName,
              },
              ...emp.careerHistory,
            ],
          };
        })
      );
      pushToast('success', 'Geçici görevlendirme kaydı oluşturuldu ve personel durumuna işlendi.');
    },
    [currentRoleActorName, pushToast]
  );

  const extendAssignment = useCallback(
    (assignmentId: string, newEndDate: string, reason: string) => {
      const asg = assignments.find((a) => a.id === assignmentId);
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                endDate: newEndDate,
                notes: `${a.notes} | Süre Uzatımı (${REFERENCE_TODAY}): ${reason}`,
              }
            : a
        )
      );
      if (asg) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id !== asg.employeeId
              ? emp
              : {
                  ...emp,
                  careerHistory: [
                    {
                      id: `ch-${Date.now()}-asg-ext`,
                      date: REFERENCE_TODAY,
                      type: 'GÖREVLENDİRME',
                      title: `Görevlendirme Süresi Uzatıldı: ${asg.targetLocationOrProject}`,
                      detail: `Bitiş tarihi ${asg.endDate} → ${newEndDate} olarak güncellendi. Gerekçe: ${reason}`,
                      actor: currentRoleActorName,
                    },
                    ...emp.careerHistory,
                  ],
                }
          )
        );
      }
      pushToast('success', `Görevlendirme bitiş tarihi ${newEndDate} olarak uzatıldı.`);
    },
    [assignments, currentRoleActorName, pushToast]
  );

  const endAssignmentEarly = useCallback(
    (assignmentId: string, reason: string) => {
      const asg = assignments.find((a) => a.id === assignmentId);
      if (!asg) return;
      const daysServed = Math.max(1, getDaysBetween(asg.startDate, REFERENCE_TODAY));
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                status: 'Erken Sonlandırıldı',
                completedAt: REFERENCE_TODAY,
                actualDaysServed: daysServed,
                notes: `${a.notes} | Erken Sonlandırma: ${reason}`,
              }
            : a
        )
      );
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id !== asg.employeeId
            ? emp
            : {
                ...emp,
                careerHistory: [
                  {
                    id: `ch-${Date.now()}-asg-early`,
                    date: REFERENCE_TODAY,
                    type: 'GÖREVLENDİRME',
                    title: `Görevlendirme Erken Sonlandırıldı (${daysServed} Gün)`,
                    detail: `${asg.targetLocationOrProject} görevlendirmesi sonlandırıldı ve asli görevine döndü. Gerekçe: ${reason}`,
                    actor: currentRoleActorName,
                  },
                  ...emp.careerHistory,
                ],
              }
        )
      );
      pushToast('warning', `Görevlendirme erken sonlandırıldı (${daysServed} gün hizmet işlendi).`);
    },
    [assignments, currentRoleActorName, pushToast]
  );

  const completeAssignmentAndReturn = useCallback(
    (assignmentId: string) => {
      const asg = assignments.find((a) => a.id === assignmentId);
      if (!asg) return;
      const daysServed = Math.max(1, getDaysBetween(asg.startDate, REFERENCE_TODAY));
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                status: 'Tamamlandı',
                completedAt: REFERENCE_TODAY,
                actualDaysServed: daysServed,
              }
            : a
        )
      );
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id !== asg.employeeId
            ? emp
            : {
                ...emp,
                careerHistory: [
                  {
                    id: `ch-${Date.now()}-asg-done`,
                    date: REFERENCE_TODAY,
                    type: 'GÖREVLENDİRME',
                    title: `Asli Görevine Döndü (${daysServed} Gün Hizmet)`,
                    detail: `${asg.targetLocationOrProject} (${asg.category}) başarıyla tamamlandı.`,
                    actor: currentRoleActorName,
                  },
                  ...emp.careerHistory,
                ],
              }
        )
      );
      pushToast('success', `Personel asli görevine döndürüldü (${daysServed} gün kariyer geçmişine işlendi).`);
    },
    [assignments, currentRoleActorName, pushToast]
  );

  // MODULE G: System Rules & Platform Studio
  const updateSystemRules = useCallback(
    (nextRules: SystemRules) => {
      setRules(nextRules);
      pushToast(
        'success',
        'Sistem kuralları güncellendi! Nine-Box konumları, 360° ağırlıkları ve terfi uygunluk durumları anlık yeniden hesaplandı.'
      );
    },
    [pushToast]
  );

  const updatePlatformConfig = useCallback(
    (nextConfig: PlatformConfig) => {
      setPlatformConfig(nextConfig);

      if (
        nextConfig.evaluationPeriods.length > 0 &&
        !nextConfig.evaluationPeriods.includes(activePeriod)
      ) {
        setActivePeriod(nextConfig.evaluationPeriods[0]);
      }

      // Ensure every employee has a performance record for any newly added evaluation period
      const defaultStage = nextConfig.performanceStages[0] ?? 'Hedef Belirleme';
      setEmployees((prev) =>
        prev.map((emp) => {
          let changed = false;
          const nextRecords = { ...emp.performanceRecords };
          for (const period of nextConfig.evaluationPeriods) {
            if (!nextRecords[period]) {
              changed = true;
              const templates: KpiTemplateItem[] = nextConfig.kpiTemplatesByDepartment[emp.department] ?? [
                {
                  id: 'fallback-1',
                  title: 'Dönemsel Operasyonel Hedef Gerçekleşmesi',
                  category: 'KPI',
                  weight: 60,
                  targetValue: 95,
                  unit: '%',
                },
                {
                  id: 'fallback-2',
                  title: 'Kurumsal Gelişim ve İş Birliği Katkısı',
                  category: 'OKR',
                  weight: 40,
                  targetValue: 100,
                  unit: 'Puan',
                },
              ];
              const kpis: KPIItem[] = templates.map((t, idx) => ({
                id: `${emp.id}-${period.slice(0, 4)}-${idx + 1}`,
                title: t.title,
                category: t.category,
                weight: t.weight,
                targetValue: t.targetValue,
                actualValue: Math.round(t.targetValue * 0.85),
                unit: t.unit,
                selfScore: 80,
                managerScore: 80,
                managerComment: '',
              }));
              nextRecords[period] = {
                period,
                stage: defaultStage,
                kpis,
                calculatedScore: calculateWeightedKpiScore(kpis),
                managerSummary: 'Yeni dönem hedefleri şablondan otomatik oluşturuldu.',
                updatedAt: REFERENCE_TODAY,
              };
            }
          }
          return changed ? { ...emp, performanceRecords: nextRecords } : emp;
        })
      );

      pushToast(
        'success',
        'Platform yapılandırması kaydedildi! Özellikler, KPI tanımları ve süreç adımları tüm modüllere uygulandı.'
      );
    },
    [activePeriod, pushToast]
  );

  const resetPlatformConfig = useCallback(() => {
    setPlatformConfig(INITIAL_PLATFORM_CONFIG);
    if (!INITIAL_PLATFORM_CONFIG.evaluationPeriods.includes(activePeriod)) {
      setActivePeriod(INITIAL_PLATFORM_CONFIG.evaluationPeriods[0]);
    }
    pushToast('info', 'Platform yapılandırması varsayılan ayarlara sıfırlandı.');
  }, [activePeriod, pushToast]);

  const applyDepartmentKpiTemplates = useCallback(
    (department: string, templates: KpiTemplateItem[]) => {
      setPlatformConfig((prev) => ({
        ...prev,
        kpiTemplatesByDepartment: {
          ...prev.kpiTemplatesByDepartment,
          [department]: templates,
        },
      }));

      const defaultStage = platformConfig.performanceStages[0] ?? 'Hedef Belirleme';
      const affectedCount = employees.filter((emp) => emp.department === department).length;

      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.department !== department) return emp;
          const existingRec = emp.performanceRecords[activePeriod];
          const kpis: KPIItem[] = templates.map((t, idx) => {
            const match = existingRec?.kpis[idx];
            return {
              id: `${emp.id}-tpl-${t.id}-${idx}`,
              title: t.title,
              category: t.category,
              weight: t.weight,
              targetValue: t.targetValue,
              actualValue:
                typeof match?.actualValue === 'number'
                  ? match.actualValue
                  : Math.round(t.targetValue * 0.88),
              unit: t.unit,
              selfScore: match?.selfScore ?? 82,
              managerScore: match?.managerScore ?? 82,
              managerComment: match?.managerComment ?? '',
            };
          });
          const calculatedScore = calculateWeightedKpiScore(kpis);
          return {
            ...emp,
            performanceRecords: {
              ...emp.performanceRecords,
              [activePeriod]: {
                period: activePeriod,
                stage: existingRec?.stage ?? defaultStage,
                kpis,
                calculatedScore,
                calibratedScore: existingRec?.calibratedScore,
                calibrationNote: existingRec?.calibrationNote,
                managerSummary:
                  existingRec?.managerSummary ||
                  `${department} birim KPI şablonu toplu olarak uygulandı.`,
                updatedAt: REFERENCE_TODAY,
              },
            },
          };
        })
      );

      pushToast(
        'success',
        `"${department}" birimi KPI şablonu kaydedildi ve ${affectedCount} çalışanın "${activePeriod}" dönemine uygulandı.`
      );
    },
    [activePeriod, employees, platformConfig.performanceStages, pushToast]
  );

  const value: TalentContextValue = {
    activeModule,
    setActiveModule,
    settingsTab,
    setSettingsTab,
    openSettingsTab,
    activePeriod,
    setActivePeriod,
    role,
    setRole,
    currentRoleActorName,
    currentRoleEmployeeId,
    selectedEmployeeId,
    openEmployeeDrawer,
    closeEmployeeDrawer,
    nineBoxFilterId,
    setNineBoxFilterId,
    jumpToNineBoxWithFilter,
    prefilledMobilityEmpId,
    startMobilityForEmployee,
    clearPrefilledMobility,
    excelModalOpen,
    setExcelModalOpen,
    employees,
    competencies,
    mobilityRequests,
    assignments,
    rules,
    platformConfig,
    notifications,
    toasts,
    pushToast,
    dismissToast,
    markNotificationRead,
    markAllNotificationsRead,
    upsertEmployee,
    bulkImportEmployees,
    savePerformanceTermEvaluation,
    saveEmployeeKpis,
    advancePerformanceStage,
    addCompetency,
    updateCompetency,
    toggleCompetencyActive,
    deleteCompetency,
    save360Configuration,
    addRaterToEmployee,
    removeRaterFromEmployee,
    sendRaterReminder,
    submitRaterEvaluation,
    calibrateEmployeeNineBox,
    resetEmployeeNineBoxOverride,
    createMobilityRequest,
    approveMobilityStep,
    rejectMobilityRequest,
    createAssignment,
    extendAssignment,
    endAssignmentEarly,
    completeAssignmentAndReturn,
    updateSystemRules,
    updatePlatformConfig,
    resetPlatformConfig,
    applyDepartmentKpiTemplates,
  };

  return <TalentContext.Provider value={value}>{children}</TalentContext.Provider>;
};

export function useTalentStore(): TalentContextValue {
  const ctx = useContext(TalentContext);
  if (!ctx) throw new Error('useTalentStore must be used inside TalentProvider');
  return ctx;
}

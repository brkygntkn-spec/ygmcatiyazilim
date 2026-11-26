import type { DepartmentName, ModuleKey, UserRole } from './talent';

export interface UserPermissions {
  modules: Record<ModuleKey, boolean>;
  actions: {
    canApproveMobility: boolean;
    canCalibrateNineBox: boolean;
    canManage360Raters: boolean;
    canManageAssignments: boolean;
    canEditSystemRules: boolean;
    canManageUsers: boolean;
  };
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: DepartmentName;
  title: string;
  linkedEmployeeId: string | null;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  permissions: UserPermissions;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthStatusResponse {
  initialized: boolean;
  hasEnvAdmin: boolean;
  defaultAdminEmail: string;
}

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  if (role === 'ADMIN') {
    return {
      modules: {
        dashboard: true,
        employees: true,
        performance: true,
        feedback360: true,
        ninebox: true,
        mobility: true,
        assignments: true,
        settings: true,
      },
      actions: {
        canApproveMobility: true,
        canCalibrateNineBox: true,
        canManage360Raters: true,
        canManageAssignments: true,
        canEditSystemRules: true,
        canManageUsers: true,
      },
    };
  }

  if (role === 'MANAGER') {
    return {
      modules: {
        dashboard: true,
        employees: true,
        performance: true,
        feedback360: true,
        ninebox: true,
        mobility: true,
        assignments: true,
        settings: false,
      },
      actions: {
        canApproveMobility: true,
        canCalibrateNineBox: true,
        canManage360Raters: true,
        canManageAssignments: true,
        canEditSystemRules: false,
        canManageUsers: false,
      },
    };
  }

  return {
    modules: {
      dashboard: true,
      employees: true,
      performance: true,
      feedback360: true,
      ninebox: false,
      mobility: false,
      assignments: true,
      settings: false,
    },
    actions: {
      canApproveMobility: false,
      canCalibrateNineBox: false,
      canManage360Raters: false,
      canManageAssignments: false,
      canEditSystemRules: false,
      canManageUsers: false,
    },
  };
}

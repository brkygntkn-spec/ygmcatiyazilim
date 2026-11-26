import React from 'react';
import { EmployeeDrawer } from './EmployeeDrawer';
import { ExcelExportModal } from './ExcelExportModal';
import { Layout } from './Layout';
import { LoginScreen } from './LoginScreen';
import { AuthProvider, useAuth } from './AuthContext';
import { TalentProvider, useTalentStore } from './TalentStore';
import { AssignmentsModule } from './AssignmentsModule';
import { DashboardModule } from './DashboardModule';
import { EmployeesModule } from './EmployeesModule';
import { Feedback360Module } from './Feedback360Module';
import { MobilityModule } from './MobilityModule';
import { NineBoxModule } from './NineBoxModule';
import { PerformanceModule } from './PerformanceModule';
import { SettingsModule } from './SettingsModule';

const ActiveModuleView: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule } = useTalentStore();

  const permValue = currentUser?.permissions.modules[activeModule];
  const isAllowed =
    !currentUser ||
    (typeof permValue === 'boolean'
      ? permValue
      : activeModule === 'employees' || activeModule === 'dashboard');

  if (!isAllowed) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Bu Modüle Erişim Yetkiniz Bulunmuyor
        </h2>
        <p className="text-[13.5px] text-slate-500">
          Gerekli modül erişimi için sistem yöneticinizle iletişime geçebilirsiniz.
        </p>
      </div>
    );
  }

  switch (activeModule) {
    case 'dashboard':
      return <DashboardModule />;
    case 'employees':
      return <EmployeesModule />;
    case 'performance':
      return <PerformanceModule />;
    case 'feedback360':
      return <Feedback360Module />;
    case 'ninebox':
      return <NineBoxModule />;
    case 'mobility':
      return <MobilityModule />;
    case 'assignments':
      return <AssignmentsModule />;
    case 'settings':
      return <SettingsModule />;
    default:
      return <DashboardModule />;
  }
};

const AuthenticatedApp: React.FC = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <TalentProvider>
      <Layout>
        <ActiveModuleView />
      </Layout>
      <EmployeeDrawer />
      <ExcelExportModal />
    </TalentProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

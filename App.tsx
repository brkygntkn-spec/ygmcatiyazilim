import React from 'react';
import { EmployeeDrawer } from './components/EmployeeDrawer';
import { ExcelExportModal } from './components/ExcelExportModal';
import { Layout } from './components/Layout';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TalentProvider, useTalentStore } from './context/TalentStore';
import { AssignmentsModule } from './modules/AssignmentsModule';
import { DashboardModule } from './modules/DashboardModule';
import { EmployeesModule } from './modules/EmployeesModule';
import { Feedback360Module } from './modules/Feedback360Module';
import { MobilityModule } from './modules/MobilityModule';
import { NineBoxModule } from './modules/NineBoxModule';
import { PerformanceModule } from './modules/PerformanceModule';
import { SettingsModule } from './modules/SettingsModule';

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

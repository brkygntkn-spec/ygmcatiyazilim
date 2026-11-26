import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  Grid3X3,
  IdCard,
  LayoutDashboard,
  LogOut,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Target,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTalentStore } from './TalentStore';
import { EvaluationPeriod, ModuleKey, SettingsSubTab, UserRole } from './talent';
import { formatTrDate, getInitials } from './calculations';

interface NavGroup {
  id: string;
  label: string;
  items: {
    id: string;
    key: ModuleKey;
    settingsTabTarget?: SettingsSubTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }[];
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const {
    activeModule,
    setActiveModule,
    settingsTab,
    openSettingsTab,
    activePeriod,
    setActivePeriod,
    role,
    setRole,
    currentRoleEmployeeId,
    employees,
    mobilityRequests,
    assignments,
    platformConfig,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    openEmployeeDrawer,
    setExcelModalOpen,
    toasts,
    dismissToast,
  } = useTalentStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const pendingMobilityCount = useMemo(
    () => mobilityRequests.filter((r) => r.status === 'Devam Ediyor').length,
    [mobilityRequests]
  );

  const activeAssignmentsCount = useMemo(
    () => assignments.filter((a) => a.status === 'Aktif').length,
    [assignments]
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const navGroups: NavGroup[] = useMemo(() => {
    const f = platformConfig.features;
    const allGroups: NavGroup[] = [
      {
        id: 'overview',
        label: 'Genel Bakış',
        items: [
          {
            id: 'dashboard',
            key: 'dashboard',
            label: 'Yönetici Kokpiti',
            shortLabel: 'Kokpit',
            icon: LayoutDashboard,
          },
          {
            id: 'employees',
            key: 'employees',
            label: 'Personel Listesi',
            shortLabel: 'Personel',
            icon: IdCard,
            badgeCount: employees.length,
          },
        ],
      },
      {
        id: 'talent',
        label: 'Performans ve Yetkinlik',
        items: [
          ...(f.enablePerformance
            ? [
                {
                  id: 'performance',
                  key: 'performance' as ModuleKey,
                  label: 'Bireysel Performans',
                  shortLabel: 'Performans',
                  icon: Target,
                },
              ]
            : []),
          ...(f.enableFeedback360
            ? [
                {
                  id: 'feedback360',
                  key: 'feedback360' as ModuleKey,
                  label: '360° Yetkinlik',
                  shortLabel: '360°',
                  icon: Radar,
                },
              ]
            : []),
          ...(f.enableNineBox
            ? [
                {
                  id: 'ninebox',
                  key: 'ninebox' as ModuleKey,
                  label: 'Nine-Box Matrisi',
                  shortLabel: 'Nine-Box',
                  icon: Grid3X3,
                },
              ]
            : []),
        ],
      },
      {
        id: 'mobility',
        label: 'Kariyer ve Hareketlilik',
        items: [
          ...(f.enableMobility
            ? [
                {
                  id: 'mobility',
                  key: 'mobility' as ModuleKey,
                  label: 'Terfi ve Atama',
                  shortLabel: 'Terfi',
                  icon: ArrowLeftRight,
                  badgeCount: pendingMobilityCount,
                },
              ]
            : []),
          ...(f.enableAssignments
            ? [
                {
                  id: 'assignments',
                  key: 'assignments' as ModuleKey,
                  label: 'Geçici Görevlendirme',
                  shortLabel: 'Görev',
                  icon: Briefcase,
                  badgeCount: activeAssignmentsCount,
                },
              ]
            : []),
        ],
      },
      {
        id: 'admin',
        label: 'Ayarlar ve Özelleştirme',
        items: [
          {
            id: 'settings-studio',
            key: 'settings',
            settingsTabTarget: 'studio',
            label: 'Platform Düzenleyici',
            shortLabel: 'Stüdyo',
            icon: Sliders,
          },
          {
            id: 'settings-config360',
            key: 'settings',
            settingsTabTarget: 'config360',
            label: 'Yetkinlik ve KPI Kurgusu',
            shortLabel: '360 KPI',
            icon: Radar,
          },
          {
            id: 'settings-users',
            key: 'settings',
            settingsTabTarget: 'users',
            label: 'Üyeler & Kurallar',
            shortLabel: 'Ayarlar',
            icon: Settings,
          },
        ],
      },
    ];

    return allGroups
      .map((g) => ({
        ...g,
        items: currentUser
          ? g.items.filter((item) => {
              const p = currentUser.permissions.modules[item.key];
              return typeof p === 'boolean' ? p : item.key === 'employees' || item.key === 'dashboard';
            })
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [
    activeAssignmentsCount,
    currentUser,
    employees.length,
    pendingMobilityCount,
    platformConfig.features,
  ]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return [];
    const pool =
      role === 'EMPLOYEE'
        ? employees.filter((e) => e.id === currentRoleEmployeeId)
        : employees;
    return pool
      .filter(
        (e) =>
          e.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
          e.sicilNo.toLocaleLowerCase('tr-TR').includes(q) ||
          e.department.toLocaleLowerCase('tr-TR').includes(q) ||
          e.title.toLocaleLowerCase('tr-TR').includes(q) ||
          e.location.toLocaleLowerCase('tr-TR').includes(q)
      )
      .slice(0, 7);
  }, [currentRoleEmployeeId, employees, role, searchQuery]);

  const roleOptions: { value: UserRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'ADMIN', label: 'İK Yöneticisi', icon: ShieldCheck },
    { value: 'MANAGER', label: 'Birim Yöneticisi', icon: Users },
    { value: 'EMPLOYEE', label: 'Çalışan', icon: User },
  ];

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Fixed Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="flex items-center gap-2.5 text-left min-w-0 focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-[#C8102E] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="font-display font-bold text-[15px] tracking-tight text-slate-900 truncate">
                  {platformConfig.platformName}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {platformConfig.platformSubtitle}
                </div>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.id];
            return (
              <div key={group.id}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        isGroupCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>
                )}

                {!isGroupCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.key === 'settings' && item.settingsTabTarget
                          ? activeModule === 'settings' &&
                            (item.settingsTabTarget === 'users'
                              ? settingsTab === 'users' || settingsTab === 'rules'
                              : settingsTab === item.settingsTabTarget)
                          : activeModule === item.key;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.settingsTabTarget) {
                              openSettingsTab(
                                item.settingsTabTarget === 'users' && settingsTab === 'rules'
                                  ? 'rules'
                                  : item.settingsTabTarget
                              );
                            } else {
                              setActiveModule(item.key);
                            }
                          }}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                            isActive
                              ? 'bg-[#C8102E] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                          } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                        >
                          <Icon
                            className={`w-[18px] h-[18px] shrink-0 ${
                              isActive ? 'text-white' : 'text-slate-500'
                            }`}
                          />
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1 text-left truncate whitespace-nowrap">
                                {item.label}
                              </span>
                              {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                                <span
                                  className={`font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                    isActive
                                      ? 'bg-white/20 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {item.badgeCount}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Authenticated Profile Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 shrink-0">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-9 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center"
                title={currentUser ? `${currentUser.fullName} · ${currentUser.title}` : 'Kullanıcı'}
              >
                {currentUser ? getInitials(currentUser.fullName) : 'EÖ'}
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                title="Çıkış Yap"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[#C8102E] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {currentUser ? getInitials(currentUser.fullName) : 'EÖ'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 truncate">
                  {currentUser?.fullName ?? 'Elif Öztürk'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {currentUser?.title ?? 'İK Yöneticisi'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                title="Güvenli Çıkış Yap"
                aria-label="Güvenli Çıkış Yap"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[#C8102E] hover:border-rose-200 flex items-center justify-center shrink-0 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'pl-[72px]' : 'pl-[260px]'
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          {/* Global Employee Search */}
          <div ref={searchRef} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Çalışan ara (Ad soyad, sicil no, birim, lokasyon)..."
              className="w-full h-9 pl-9 pr-8 text-[13px] bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/10 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {searchOpen && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-5 text-center text-[13px] text-slate-500">
                    &ldquo;{searchQuery}&rdquo; ile eşleşen personel bulunamadı.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {searchResults.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          openEmployeeDrawer(emp.id);
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                          {getInitials(emp.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-slate-900 truncate">
                            {emp.fullName}
                          </div>
                          <div className="text-[11.5px] text-slate-500 truncate">
                            <span className="font-mono">{emp.sicilNo}</span> · {emp.title} ·{' '}
                            {emp.department}
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-[#C8102E] whitespace-nowrap shrink-0">
                          Sicil Kartı
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls: Excel Report + Period Selector + Role Switcher + Notifications */}
          <div className="flex items-center gap-2.5 shrink-0">
            {platformConfig.features.enableCsvExport && (
              <button
                type="button"
                onClick={() => setExcelModalOpen(true)}
                className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50/75 hover:bg-emerald-50 text-emerald-800 text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden md:inline">Excel Rapor</span>
              </button>
            )}

            {/* Evaluation Period Selector */}
            <div className="flex items-center gap-1.5 h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="Değerlendirme Dönemi"
                value={activePeriod}
                onChange={(e) => setActivePeriod(e.target.value as EvaluationPeriod)}
                className="bg-transparent text-[12.5px] font-medium text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                {platformConfig.evaluationPeriods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Switcher (Preview mode for Admin users) */}
            {currentUser?.role === 'ADMIN' ? (
              <>
                <div
                  className="hidden xl:flex items-center p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg"
                  role="group"
                  aria-label="Rol Önizleme Değiştirici"
                >
                  {roleOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 ${active ? 'text-[#C8102E]' : 'text-slate-400'}`}
                        />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <select
                  aria-label="Aktif Rol Önizleme"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="xl:hidden h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[12.5px] font-medium text-slate-800 focus:outline-none"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 text-[12.5px] text-slate-600 px-2">
                <span className="font-semibold text-slate-900">{currentUser?.fullName}</span>
                <span>·</span>
                <span>
                  {currentUser?.role === 'MANAGER' ? 'Birim Yöneticisi' : 'Çalışan'}
                </span>
              </div>
            )}

            {/* Notification Center */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Bildirim Merkezi"
                className="relative w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C8102E] text-white text-[10px] font-mono font-semibold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-900">
                      Bildirim Merkezi ({unreadNotifCount} okunmamış)
                    </span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11.5px] font-medium text-[#C8102E] hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Tümünü Okundu İşaretle
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          setActiveModule(n.targetModule);
                          setNotifOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                          n.read ? 'bg-white' : 'bg-rose-50/35'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12.5px] font-semibold text-slate-900">
                            {n.title}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                            {formatTrDate(n.date)}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-slate-600 leading-relaxed">
                          {n.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-[#C8102E] text-[12.5px] font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </header>

        {/* Active Role Scope Notice when Admin previews Manager/Employee */}
        {currentUser?.role === 'ADMIN' && role !== 'ADMIN' && (
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between text-[12px] text-slate-600">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-3.5 h-3.5 text-[#C8102E]" />
              <span>
                {role === 'MANAGER'
                  ? 'Birim Yöneticisi önizleme görünümündesiniz. Ekip performans, 360° ve onay ekranlarını test edebilirsiniz.'
                  : 'Çalışan önizleme görünümündesiniz. Bireysel hedefler ve kariyer özetini test edebilirsiniz.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRole('ADMIN')}
              className="text-[12px] font-medium text-[#C8102E] hover:underline whitespace-nowrap shrink-0"
            >
              İK Yöneticisi Görünümüne Dön
            </button>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* Toast Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg bg-white border shadow-lg text-[13px] text-slate-800 ${
              toast.type === 'success'
                ? 'border-emerald-200'
                : toast.type === 'warning'
                ? 'border-amber-200'
                : toast.type === 'error'
                ? 'border-rose-200'
                : 'border-slate-200'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                toast.type === 'success'
                  ? 'text-emerald-600'
                  : toast.type === 'warning'
                  ? 'text-amber-600'
                  : toast.type === 'error'
                  ? 'text-rose-600'
                  : 'text-indigo-600'
              }`}
            />
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

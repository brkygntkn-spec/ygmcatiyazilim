import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTalentStore } from '../context/TalentStore';
import { getDefaultPermissionsForRole } from '../types/auth';
import type { AuthUser, UserPermissions } from '../types/auth';
import type { DepartmentName, ModuleKey, UserRole } from '../types/talent';
import { formatTrDate, getInitials } from '../utils/calculations';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'İK / Sistem Yöneticisi',
  MANAGER: 'Birim Yöneticisi',
  EMPLOYEE: 'Çalışan',
};

const MODULE_LABELS: { key: ModuleKey; label: string; desc: string }[] = [
  { key: 'dashboard', label: 'Yönetici Kokpiti', desc: 'KPI özetleri ve yönetici analitiği' },
  {
    key: 'employees',
    label: 'Personel Listesi & Sicil',
    desc: 'Ana personel verisi, sicil kartları ve Excel içe/dışa aktarım',
  },
  { key: 'performance', label: 'Bireysel Performans', desc: 'OKR & KPI hedef ve puanlama ekranı' },
  { key: 'feedback360', label: '360° Yetkinlik', desc: 'Çoklu değerlendirici matrisi ve raporlar' },
  { key: 'ninebox', label: 'Nine-Box Matrisi', desc: '3×3 yetenek dağılımı ve kalibrasyon' },
  { key: 'mobility', label: 'Terfi ve Atama', desc: 'İç terfi, rotasyon ve onay süreçleri' },
  { key: 'assignments', label: 'Geçici Görevlendirme', desc: 'Saha, proje ve vekalet atamaları' },
  { key: 'settings', label: 'Ayarlar & Yönetim', desc: 'Sistem kuralları ve kullanıcı yönetimi' },
];

const ACTION_LABELS: {
  key: keyof UserPermissions['actions'];
  label: string;
  desc: string;
}[] = [
  {
    key: 'canApproveMobility',
    label: 'Terfi / Atama Onaylama',
    desc: 'Onay akışındaki talepleri onaylama veya reddetme',
  },
  {
    key: 'canCalibrateNineBox',
    label: 'Nine-Box & Performans Kalibrasyonu',
    desc: 'Sürükle-bırak kalibrasyon ve kalibrasyon puanı düzenleme',
  },
  {
    key: 'canManage360Raters',
    label: '360° Matris & Yetkinlik Yönetimi',
    desc: 'Değerlendirici ekleme/çıkarma ve yetkinlik kütüphanesi düzenleme',
  },
  {
    key: 'canManageAssignments',
    label: 'Geçici Görevlendirme Yönetimi',
    desc: 'Görevlendirme oluşturma, süre uzatma ve sonlandırma',
  },
  {
    key: 'canEditSystemRules',
    label: 'Sistem Kuralları & Eşikler',
    desc: 'Nine-Box eşikleri, 360° ağırlıkları ve terfi kriterlerini değiştirme',
  },
  {
    key: 'canManageUsers',
    label: 'Üye Ekleme & Kullanıcı Yetkilendirme',
    desc: 'Yeni kullanıcı hesabı açma, yetki verme ve hesapları yönetme',
  },
];

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*';
  const all = upper + lower + digits + symbols;
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  const out = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  for (let i = 4; i < 12; i++) {
    out.push(all[arr[i] % all.length]);
  }
  return out.join('');
}

export const UserManagementPanel: React.FC = () => {
  const { currentUser, users, usersLoading, createUser, updateUser, deleteUser } = useAuth();
  const { employees, platformConfig, pushToast } = useTalentStore();

  const departmentOptions = useMemo(
    () => Array.from(new Set([...platformConfig.departments, ...users.map((u) => u.department)])),
    [platformConfig.departments, users]
  );

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PASSIVE'>('ALL');

  // Create/Edit Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('MANAGER');
  const [department, setDepartment] = useState<DepartmentName>(
    platformConfig.departments[0] ?? 'Operasyon'
  );
  const [title, setTitle] = useState('');
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string>('');
  const [permissions, setPermissions] = useState<UserPermissions>(() =>
    getDefaultPermissionsForRole('MANAGER')
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);

  const canManage =
    currentUser?.role === 'ADMIN' || Boolean(currentUser?.permissions.actions.canManageUsers);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !u.isActive) return false;
      if (statusFilter === 'PASSIVE' && u.isActive) return false;
      if (
        q &&
        !u.fullName.toLocaleLowerCase('tr-TR').includes(q) &&
        !u.email.toLocaleLowerCase('tr-TR').includes(q) &&
        !u.department.toLocaleLowerCase('tr-TR').includes(q) &&
        !u.title.toLocaleLowerCase('tr-TR').includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [roleFilter, search, statusFilter, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role === 'ADMIN').length;
    const passive = total - active;
    return { total, active, admins, passive };
  }, [users]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setUserRole('MANAGER');
    setDepartment(platformConfig.departments[0] ?? 'Operasyon');
    setTitle('');
    setLinkedEmployeeId('');
    setPermissions(getDefaultPermissionsForRole('MANAGER'));
    setFormError(null);
  };

  const openEditModal = (u: AuthUser) => {
    setModalMode('edit');
    setEditingUser(u);
    setFullName(u.fullName);
    setEmail(u.email);
    setPassword('');
    setShowPassword(false);
    setUserRole(u.role);
    setDepartment(u.department);
    setTitle(u.title);
    setLinkedEmployeeId(u.linkedEmployeeId || '');
    setPermissions({
      modules: { ...u.permissions.modules },
      actions: { ...u.permissions.actions },
    });
    setFormError(null);
  };

  const handleRolePresetChange = (nextRole: UserRole) => {
    setUserRole(nextRole);
    setPermissions(getDefaultPermissionsForRole(nextRole));
  };

  const handleEmployeeLinkChange = (empId: string) => {
    setLinkedEmployeeId(empId);
    if (empId && modalMode === 'create') {
      const emp = employees.find((e) => e.id === empId);
      if (emp) {
        if (!fullName.trim()) setFullName(emp.fullName);
        if (!title.trim()) setTitle(emp.title);
        setDepartment(emp.department);
      }
    }
  };

  const toggleModulePerm = (key: ModuleKey) => {
    setPermissions((prev) => ({
      ...prev,
      modules: { ...prev.modules, [key]: !prev.modules[key] },
    }));
  };

  const toggleActionPerm = (key: keyof UserPermissions['actions']) => {
    setPermissions((prev) => ({
      ...prev,
      actions: { ...prev.actions, [key]: !prev.actions[key] },
    }));
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError('Ad soyad en az 2 karakter olmalıdır.');
      return;
    }

    if (modalMode === 'create') {
      if (password.length < 8) {
        setFormError('Yeni üye şifresi en az 8 karakter olmalıdır.');
        return;
      }
      setSaving(true);
      const res = await createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: userRole,
        department,
        title: title.trim() || ROLE_LABELS[userRole],
        linkedEmployeeId: linkedEmployeeId || null,
        permissions,
      });
      setSaving(false);
      if (!res.ok) {
        setFormError(res.error || 'Üye oluşturulamadı.');
        return;
      }
      pushToast('success', `${fullName.trim()} sisteme üye olarak eklendi ve yetkilendirildi.`);
      setModalMode(null);
    } else if (modalMode === 'edit' && editingUser) {
      if (password.length > 0 && password.length < 8) {
        setFormError('Yeni şifre en az 8 karakter olmalıdır.');
        return;
      }
      setSaving(true);
      const res = await updateUser(editingUser.id, {
        fullName: fullName.trim(),
        role: userRole,
        department,
        title: title.trim() || editingUser.title,
        linkedEmployeeId: linkedEmployeeId || null,
        permissions,
        newPassword: password.length > 0 ? password : undefined,
      });
      setSaving(false);
      if (!res.ok) {
        setFormError(res.error || 'Kullanıcı yetkileri güncellenemedi.');
        return;
      }
      pushToast('success', `${fullName.trim()} kullanıcısının bilgileri ve yetkileri güncellendi.`);
      setModalMode(null);
    }
  };

  const handleToggleActive = async (u: AuthUser) => {
    const res = await updateUser(u.id, { isActive: !u.isActive });
    if (!res.ok) {
      pushToast('error', res.error || 'Durum güncellenemedi.');
      return;
    }
    pushToast(
      u.isActive ? 'warning' : 'success',
      `${u.fullName} hesabı ${u.isActive ? 'pasif' : 'aktif'} duruma alındı.`
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteUser(deleteTarget.id);
    if (!res.ok) {
      pushToast('error', res.error || 'Kullanıcı silinemedi.');
      setDeleteTarget(null);
      return;
    }
    pushToast('info', `${deleteTarget.fullName} sistem kullanıcılarından kaldırıldı.`);
    setDeleteTarget(null);
  };

  if (!canManage) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-[13.5px] text-slate-600">
        Üye ekleme ve kullanıcı yetkilendirme ekranı yalnızca <strong>İK / Sistem Yöneticisi</strong>{' '}
        yetkisine sahip hesaplar tarafından görüntülenebilir.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">Toplam Kayıtlı Üye</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {stats.total}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Sunucuda doğrulanan hesaplar</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">Aktif Hesaplar</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-emerald-700">
            {stats.active}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Platforma giriş yetkisi açık</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">Yönetici (Admin)</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-[#C8102E]">
            {stats.admins}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Tam yönetim yetkili</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[12px] font-medium text-slate-500">Pasif / Askıya Alınan</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-slate-500">
            {stats.passive}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">Girişi engellenmiş hesaplar</div>
        </div>
      </div>

      {/* Main Users & Authorization Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C8102E]" />
            <h2 className="font-display text-[15px] font-bold text-slate-900">
              Kullanıcı Hesapları ve Yetki Matrisi ({filteredUsers.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Üye adı, e-posta veya birim..."
                className="h-9 pl-8 pr-3 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#C8102E] w-52"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="ALL">Tüm Roller</option>
              <option value="ADMIN">İK / Sistem Yöneticisi</option>
              <option value="MANAGER">Birim Yöneticisi</option>
              <option value="EMPLOYEE">Çalışan</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'PASSIVE')}
              className="h-9 px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
            </select>

            <button
              type="button"
              onClick={openCreateModal}
              className="h-9 px-3.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Yeni Üye Ekle
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11.5px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Kullanıcı</th>
                <th className="py-2.5 px-4">Rol & Birim</th>
                <th className="py-2.5 px-4">Eşleşen Personel Kartı</th>
                <th className="py-2.5 px-4">Modül / İşlem Yetkisi</th>
                <th className="py-2.5 px-4">Durum</th>
                <th className="py-2.5 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {usersLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Kullanıcı listesi yükleniyor...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Arama kriterlerine uygun üye bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const linkedEmp = u.linkedEmployeeId
                    ? employees.find((e) => e.id === u.linkedEmployeeId)
                    : null;
                  const modCount = Object.values(u.permissions.modules).filter(Boolean).length;
                  const actCount = Object.values(u.permissions.actions).filter(Boolean).length;
                  const isSelf = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg font-semibold text-[11.5px] flex items-center justify-center shrink-0 ${
                              u.role === 'ADMIN'
                                ? 'bg-[#C8102E] text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {getInitials(u.fullName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {u.fullName}
                              {isSelf && (
                                <span className="ml-1.5 text-[11px] font-medium text-[#C8102E]">
                                  (Siz)
                                </span>
                              )}
                            </div>
                            <div className="text-[11.5px] font-mono text-slate-500 truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{ROLE_LABELS[u.role]}</div>
                        <div className="text-[11.5px] text-slate-500">
                          {u.department} · {u.title}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[12.5px] text-slate-700">
                        {linkedEmp ? (
                          <div>
                            <div className="font-medium text-slate-900">{linkedEmp.fullName}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {linkedEmp.sicilNo}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Eşleştirilmedi</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[12px] text-slate-700">
                        <div>
                          <strong className="text-slate-900">
                            {modCount}/{MODULE_LABELS.length}
                          </strong>{' '}
                          Modül ·{' '}
                          <strong className="text-indigo-700">
                            {actCount}/{ACTION_LABELS.length}
                          </strong>{' '}
                          İşlem
                        </div>
                        <div className="font-sans text-[11px] text-slate-400">
                          Kayıt: {formatTrDate(u.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                            u.isActive ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {u.isActive ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
                          {u.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-[12px] font-semibold text-slate-700 inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Yetkileri Düzenle
                          </button>

                          {!u.isPrimaryAdmin && !isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleToggleActive(u)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                {u.isActive ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5 text-amber-600" />
                                    Pasifleştir
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    Aktifleştir
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                title="Üyeyi sil"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit Member & Permission Matrix Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setModalMode(null)}
          />
          <form
            onSubmit={handleSubmitModal}
            className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <div className="text-[11.5px] text-slate-500">
                  {modalMode === 'create'
                    ? 'Yeni Kullanıcı Hesabı ve Yetki Tanımı'
                    : `Kullanıcı Yetkilendirme · ${editingUser?.email}`}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {modalMode === 'create'
                    ? 'Yeni Üye Ekle'
                    : `${editingUser?.fullName} — Yetki ve Profil Düzenle`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12.5px] text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Identity & Role Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Ad Soyad *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Örn: Zeynep Aydın"
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Kurumsal E-posta *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={modalMode === 'edit'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="zeynep.aydin@cati.com.tr"
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E] disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Rol Şablonu
                  </label>
                  <select
                    value={userRole}
                    disabled={Boolean(editingUser?.isPrimaryAdmin)}
                    onChange={(e) => handleRolePresetChange(e.target.value as UserRole)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
                  >
                    <option value="ADMIN">İK / Sistem Yöneticisi (Tam Yetki)</option>
                    <option value="MANAGER">Birim Yöneticisi</option>
                    <option value="EMPLOYEE">Çalışan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Personel Kartı Eşleştirme (Opsiyonel)
                  </label>
                  <select
                    value={linkedEmployeeId}
                    onChange={(e) => handleEmployeeLinkChange(e.target.value)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Eşleştirme Yok</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.sicilNo} · {emp.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Departman / Birim
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as DepartmentName)}
                    className="w-full h-9.5 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white"
                  >
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Unvan
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Bölge Operasyon Müdürü"
                    className="w-full h-9.5 px-3 text-[13px] border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-semibold text-slate-800 inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#C8102E]" />
                    {modalMode === 'create'
                      ? 'Başlangıç Giriş Şifresi (En az 8 karakter) *'
                      : 'Şifre Sıfırlama (Değiştirmek istemiyorsanız boş bırakın)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generateTempPassword());
                      setShowPassword(true);
                    }}
                    className="text-[11.5px] font-semibold text-[#C8102E] hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Güçlü Şifre Üret
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={modalMode === 'create'}
                    minLength={password.length > 0 ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      modalMode === 'create'
                        ? 'En az 8 karakterlik başlangıç şifresi...'
                        : 'Yeni şifre belirlemek için yazın...'
                    }
                    className="w-full h-9.5 pl-3 pr-10 font-mono text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#C8102E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Granular Module Access Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-[14px] font-bold text-slate-900">
                    Modül Erişim Yetkileri
                  </h4>
                  <span className="text-[11.5px] text-slate-500">
                    Kullanıcının menüde görebileceği ve erişebileceği modüller
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MODULE_LABELS.map((m) => {
                    const locked =
                      m.key === 'settings' &&
                      (editingUser?.isPrimaryAdmin || editingUser?.id === currentUser?.id);
                    return (
                      <label
                        key={m.key}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          permissions.modules[m.key]
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={permissions.modules[m.key]}
                          disabled={locked}
                          onChange={() => toggleModulePerm(m.key)}
                          className="w-4 h-4 mt-0.5 accent-[#C8102E]"
                        />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-slate-900">
                            {m.label}
                          </div>
                          <div className="text-[11.5px] text-slate-500 leading-snug">{m.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Granular Action Authorization Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-[14px] font-bold text-slate-900">
                    İşlem ve Onay Yetkileri
                  </h4>
                  <span className="text-[11.5px] text-slate-500">
                    Kritik aksiyonlar için granüler yetkilendirme
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ACTION_LABELS.map((a) => {
                    const locked =
                      a.key === 'canManageUsers' &&
                      (editingUser?.isPrimaryAdmin || editingUser?.id === currentUser?.id);
                    return (
                      <label
                        key={a.key}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          permissions.actions[a.key]
                            ? 'bg-indigo-50/40 border-indigo-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={permissions.actions[a.key]}
                          disabled={locked}
                          onChange={() => toggleActionPerm(a.key)}
                          className="w-4 h-4 mt-0.5 accent-[#C8102E]"
                        />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-slate-900">
                            {a.label}
                          </div>
                          <div className="text-[11.5px] text-slate-500 leading-snug">{a.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-60 text-white text-[13px] font-semibold"
              >
                {saving
                  ? 'Kaydediliyor...'
                  : modalMode === 'create'
                  ? 'Üyeyi Oluştur ve Yetkilendir'
                  : 'Yetkileri Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-slate-900">
                Üye Hesabını Sil
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-[13px] text-slate-600 leading-relaxed">
              <strong className="text-slate-900">{deleteTarget.fullName}</strong> (
              <span className="font-mono">{deleteTarget.email}</span>) hesabını kalıcı olarak silmek
              istediğinizden emin misiniz? Aktif oturumu anında sonlandırılacaktır.
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-semibold"
              >
                Hesabı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

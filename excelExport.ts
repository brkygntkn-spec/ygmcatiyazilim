import * as XLSX from 'xlsx';
import {
  CompetencyDefinition,
  EducationLevel,
  Employee,
  EmployeeFormPayload,
  EmploymentStatus,
  EmploymentType,
  EvaluationPeriod,
  GenderType,
  MobilityRequest,
  ParsedEmployeeImportRow,
  PlatformConfig,
  SystemRules,
  TemporaryAssignment,
  WorkModel,
} from './talent';
import {
  calculate360Analytics,
  calculateCombinedPotentialIndex,
  evaluatePromotionEligibility,
  formatTrDate,
  getActiveAssignmentForEmployee,
  getEffectiveNineBoxId,
  getEffectivePerformanceScore,
  getRemainingDays,
  REFERENCE_TODAY,
} from './calculations';
import { getEmployeeTermSummary } from './performanceCriteria';

export interface ExcelSheetDefinition {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

// Guard against spreadsheet formula injection (CSV/Excel formula payloads)
export function safeExcelCell(value: string | number | boolean | null | undefined): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Sayfa').slice(0, 31);
}

function buildWorksheet(sheet: ExcelSheetDefinition): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [
    sheet.headers.map((h) => safeExcelCell(h)),
    ...sheet.rows.map((row) => row.map((cell) => safeExcelCell(cell))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colCount = sheet.headers.length;
  const colWidths: XLSX.ColInfo[] = [];
  for (let c = 0; c < colCount; c++) {
    let maxLen = String(sheet.headers[c] ?? '').length;
    for (let r = 0; r < sheet.rows.length; r++) {
      const len = String(sheet.rows[r]?.[c] ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    colWidths.push({ wch: Math.min(48, Math.max(12, maxLen + 3)) });
  }
  ws['!cols'] = colWidths;
  return ws;
}

export function exportWorkbookToXlsx(filename: string, sheets: ExcelSheetDefinition[]): void {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of sheets) {
    let name = sanitizeSheetName(sheet.name);
    let suffix = 2;
    while (usedNames.has(name)) {
      const base = name.slice(0, 28);
      name = `${base} ${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    const ws = buildWorksheet(sheet);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalFilename);
}

// ---------- MASTER EMPLOYEE LIST EXCEL EXPORT (ROUND-TRIP COMPATIBLE) ----------

export const MASTER_EMPLOYEE_HEADERS = [
  'Sicil No',
  'Ad Soyad',
  'Unvan',
  'Kadro Derecesi',
  'Departman',
  'Lokasyon',
  'Yönetici Sicil No',
  'Yönetici Adı',
  'İşe Giriş Tarihi',
  'Pozisyon Kıdemi (Ay)',
  'İstihdam Türü',
  'Çalışma Modeli',
  'Çalışma Durumu',
  'E-posta',
  'Telefon',
  'T.C. Kimlik No',
  'Doğum Tarihi',
  'Cinsiyet',
  'İkamet İli',
  'Acil Durum İletişim',
  'Eğitim Düzeyi',
  'Üniversite / Bölüm',
  'Yabancı Dil',
  'Sertifikalar',
  'Masraf Merkezi',
  'SGK İşyeri',
  'Yıllık İzin Bakiyesi',
  'Astı Var mı',
  'Potansiyel Puanı',
  'Disiplin Uyarısı',
  'Disiplin Notu',
  'Özlük Notu',
  'Bireysel Performans',
  '360 Yetkinlik',
  'Nine-Box Segmenti',
  'Terfi Uygunluk',
  'Aktif Görevlendirme',
];

export function buildMasterEmployeeRows(
  employees: Employee[],
  allEmployees: Employee[],
  activePeriod: EvaluationPeriod,
  competencies: CompetencyDefinition[],
  rules: SystemRules,
  platformConfig: PlatformConfig,
  assignments: TemporaryAssignment[]
): (string | number)[][] {
  const byId = new Map(allEmployees.map((e) => [e.id, e]));

  return employees.map((emp) => {
    const manager = emp.managerId ? byId.get(emp.managerId) : undefined;
    const perf = getEffectivePerformanceScore(emp, activePeriod);
    const comp360 = calculate360Analytics(emp, competencies, rules);
    const boxId = getEffectiveNineBoxId(emp, activePeriod, competencies, rules);
    const boxMeta = platformConfig.nineBoxCatalog[boxId];
    const elig = evaluatePromotionEligibility(emp, activePeriod, competencies, rules);
    const activeAsg = getActiveAssignmentForEmployee(emp.id, assignments);

    return [
      emp.sicilNo,
      emp.fullName,
      emp.title,
      emp.grade,
      emp.department,
      emp.location,
      manager?.sicilNo ?? '',
      manager?.fullName ?? '',
      emp.hireDate,
      emp.tenureMonths,
      emp.employmentType,
      emp.workModel,
      activeAsg ? 'Geçici Görevde' : emp.employmentStatus,
      emp.email,
      emp.phone,
      emp.tcKimlikNo,
      emp.birthDate,
      emp.gender,
      emp.city,
      emp.emergencyContact,
      emp.educationLevel,
      emp.university,
      emp.foreignLanguages,
      emp.certifications,
      emp.costCenter,
      emp.sgkBranch,
      emp.annualLeaveBalance,
      emp.hasSubordinates ? 'Evet' : 'Hayır',
      emp.potentialScore,
      emp.disciplinaryWarning ? 'Evet' : 'Hayır',
      emp.disciplinaryNote ?? '',
      emp.notes ?? '',
      perf,
      comp360.overallScore,
      boxMeta.name,
      elig.allPassed ? 'Uygun' : 'Eksik Kriter',
      activeAsg ? `${activeAsg.targetLocationOrProject} (Kalan ${Math.max(0, getRemainingDays(activeAsg.endDate))} Gün)` : 'Asli Görevinde',
    ];
  });
}

export function exportMasterEmployeesToXlsx(params: {
  employees: Employee[];
  allEmployees: Employee[];
  activePeriod: EvaluationPeriod;
  competencies: CompetencyDefinition[];
  rules: SystemRules;
  platformConfig: PlatformConfig;
  assignments: TemporaryAssignment[];
}): void {
  const rows = buildMasterEmployeeRows(
    params.employees,
    params.allEmployees,
    params.activePeriod,
    params.competencies,
    params.rules,
    params.platformConfig,
    params.assignments
  );

  exportWorkbookToXlsx(`personel-listesi-sicil-${REFERENCE_TODAY}.xlsx`, [
    {
      name: 'Personel Listesi',
      headers: MASTER_EMPLOYEE_HEADERS,
      rows,
    },
  ]);
}

// ---------- DOWNLOAD EXCEL IMPORT TEMPLATE ----------

export function downloadEmployeeImportTemplateXlsx(platformConfig: PlatformConfig): void {
  const templateHeaders = MASTER_EMPLOYEE_HEADERS.slice(0, 32); // Editable master Sicil columns
  const defaultDept1 = platformConfig.departments[0] ?? 'Operasyon';
  const defaultDept2 = platformConfig.departments[1] ?? 'Lojistik';
  const defaultLoc1 = platformConfig.locations[0] ?? 'Ankara Genel Merkez';
  const defaultLoc2 = platformConfig.locations[1] ?? 'İstanbul Bölge';

  const sampleRows: (string | number)[][] = [
    [
      'TR-10455',
      'Burak Şahin',
      'Bölge Operasyon Lideri',
      7,
      defaultDept1,
      defaultLoc2,
      'TR-10118',
      'Zeynep Aydın',
      '2023-09-11',
      16,
      'Belirsiz Süreli (Kadrolu)',
      'Hibrit',
      'Aktif',
      'burak.sahin@cati.com.tr',
      '+90 537 902 18 55',
      '467*****755',
      '1993-07-16',
      'Erkek',
      'İstanbul',
      'Nazan Şahin (Anne) · +90 537 902 18 56',
      'Lisans',
      'Uludağ Üniversitesi · Endüstri Mühendisliği',
      'İngilizce (B2)',
      'Lean Six Sigma Green Belt, PMP',
      'MM-110 · Marmara Bölge Operasyon',
      'İstanbul Ümraniye Bölge İşyeri',
      12,
      'Evet',
      82,
      'Hayır',
      '',
      'Mevcut personel Sicil No ile eşleştiğinde bilgileri güncellenir.',
    ],
    [
      'TR-10901',
      'Kaan Demir',
      'Kıdemli Tedarik Zinciri Uzmanı',
      7,
      defaultDept2,
      defaultLoc1,
      'TR-10164',
      'Kerem Yıldırım',
      '2026-10-01',
      2,
      'Belirsiz Süreli (Kadrolu)',
      'Ofis',
      'Aktif',
      'kaan.demir@cati.com.tr',
      '+90 532 640 19 01',
      '519*****901',
      '1993-05-14',
      'Erkek',
      'Ankara',
      'Ece Demir (Eş) · +90 532 640 19 02',
      'Yüksek Lisans',
      'ODTÜ · Endüstri Mühendisliği',
      'İngilizce (C1)',
      'APICS CPIM, SAP MM',
      'MM-200 · Merkez Lojistik',
      'Ankara Çankaya Merkez İşyeri',
      14,
      'Hayır',
      84,
      'Hayır',
      '',
      'Yeni Sicil No girildiğinde sistem yeni personel açar ve birim KPI şablonunu atar.',
    ],
  ];

  const guideRows: (string | number)[][] = [
    ['Sicil No', 'Zorunlu', 'Benzersiz personel anahtarıdır. Sistemde varsa GÜNCELLEME, yoksa YENİ KAYIT yapılır.'],
    ['Ad Soyad', 'Zorunlu', 'Çalışanın tam adı ve soyadı.'],
    ['Unvan / Departman / Lokasyon', 'Önerilen', 'Yeni departman veya lokasyon yazıldığında içe aktarım sırasında kataloğa otomatik eklenebilir.'],
    ['Kadro Derecesi', 'Sayı (1-12)', 'Örn: 6, 7, 8, 9. Boş bırakılırsa mevcut değer veya 5 atanır.'],
    ['Yönetici Sicil No', 'Opsiyonel', 'Yöneticinin Sicil No değeri (örn: TR-10042). Sistem yönetici bağlantısını otomatik kurar.'],
    ['İşe Giriş / Doğum Tarihi', 'YYYY-AA-GG', 'Örn: 2024-03-15 veya GG.AA.YYYY formatı desteklenir.'],
    ['İstihdam Türü', 'Seçenek', 'Belirsiz Süreli (Kadrolu) | Belirli Süreli | Proje Bazlı | Yönetici Sözleşmeli'],
    ['Çalışma Modeli', 'Seçenek', 'Ofis | Hibrit | Saha | Uzaktan'],
    ['Çalışma Durumu', 'Seçenek', 'Aktif | İzinli | Geçici Görevde | Pasif'],
    ['Eğitim Düzeyi', 'Seçenek', 'Lise | Ön Lisans | Lisans | Yüksek Lisans | Doktora'],
    ['Astı Var mı / Disiplin Uyarısı', 'Evet / Hayır', 'Evet, Hayır, True, False, 1, 0 değerleri kabul edilir.'],
    ['Performans & 360 Koruma', 'Bilgi', 'Mevcut çalışan güncellenirken geçmiş performans, 360° ve kariyer kayıtları korunur.'],
  ];

  exportWorkbookToXlsx('cati-personel-yukleme-sablonu.xlsx', [
    {
      name: 'Personel Şablonu',
      headers: templateHeaders,
      rows: sampleRows,
    },
    {
      name: 'Kullanım Kılavuzu',
      headers: ['Sütun / Kural', 'Tip / Format', 'Açıklama'],
      rows: guideRows,
    },
  ]);
}

// ---------- EXCEL IMPORT PARSER & DIFF ENGINE ----------

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function normalizeKey(raw: string): string {
  return raw
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIAS_MAP: Record<string, string> = {
  sicilno: 'sicilNo',
  sicil: 'sicilNo',
  sicilnumarasi: 'sicilNo',
  personelno: 'sicilNo',
  employeeid: 'sicilNo',
  adsoyad: 'fullName',
  adisoyadi: 'fullName',
  personel: 'fullName',
  calisan: 'fullName',
  fullname: 'fullName',
  unvan: 'title',
  gorev: 'title',
  pozisyon: 'title',
  title: 'title',
  kadroderecesi: 'grade',
  derece: 'grade',
  kadro: 'grade',
  grade: 'grade',
  departman: 'department',
  birim: 'department',
  mudurluk: 'department',
  department: 'department',
  lokasyon: 'location',
  bolge: 'location',
  sube: 'location',
  isyeri: 'location',
  location: 'location',
  yoneticisicilno: 'managerSicilNo',
  yoneticisicil: 'managerSicilNo',
  managersicilno: 'managerSicilNo',
  isegiristarihi: 'hireDate',
  giristarihi: 'hireDate',
  hiredate: 'hireDate',
  pozisyonkidemiay: 'tenureMonths',
  pozisyonsuresi: 'tenureMonths',
  kidemay: 'tenureMonths',
  tenuremonths: 'tenureMonths',
  istihdamturu: 'employmentType',
  sozlesmeturu: 'employmentType',
  calismasekli: 'employmentType',
  employmenttype: 'employmentType',
  calismamodeli: 'workModel',
  workmodel: 'workModel',
  calismadurumu: 'employmentStatus',
  durum: 'employmentStatus',
  status: 'employmentStatus',
  eposta: 'email',
  email: 'email',
  mail: 'email',
  telefon: 'phone',
  gsm: 'phone',
  cep: 'phone',
  phone: 'phone',
  tckimlikno: 'tcKimlikNo',
  tckn: 'tcKimlikNo',
  kimlikno: 'tcKimlikNo',
  dogumtarihi: 'birthDate',
  birthdate: 'birthDate',
  cinsiyet: 'gender',
  gender: 'gender',
  ikametili: 'city',
  il: 'city',
  sehir: 'city',
  city: 'city',
  acildurumiletisim: 'emergencyContact',
  acildurum: 'emergencyContact',
  egitimduzeyi: 'educationLevel',
  egitim: 'educationLevel',
  ogrenimdurumu: 'educationLevel',
  universitebolum: 'university',
  universite: 'university',
  okul: 'university',
  yabancidil: 'foreignLanguages',
  diller: 'foreignLanguages',
  sertifikalar: 'certifications',
  belgeler: 'certifications',
  masrafmerkezi: 'costCenter',
  costcenter: 'costCenter',
  sgkisyeri: 'sgkBranch',
  sgksubesi: 'sgkBranch',
  yillikizinbakiyesi: 'annualLeaveBalance',
  izinbakiyesi: 'annualLeaveBalance',
  kalanyillikizin: 'annualLeaveBalance',
  astivarmi: 'hasSubordinates',
  ekibivarmi: 'hasSubordinates',
  hassubordinates: 'hasSubordinates',
  potansiyelpuani: 'potentialScore',
  potansiyel: 'potentialScore',
  potentialscore: 'potentialScore',
  disiplinuyarisi: 'disciplinaryWarning',
  disiplinkaydi: 'disciplinaryWarning',
  disiplinnotu: 'disciplinaryNote',
  ozluknotu: 'notes',
  notlar: 'notes',
  not: 'notes',
};

function parseExcelDate(val: unknown, fallback: string): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number' && val > 10000 && val < 90000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim().replace(/^'/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dotMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const [, dd, mm, yyyy] = dotMatch;
    const dayNum = Number(dd);
    const monthNum = Number(mm);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }
  return fallback;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = normalizeKey(String(val));
  if (['evet', 'var', 'true', '1', 'yes', 'aktif'].includes(s)) return true;
  if (['hayir', 'yok', 'false', '0', 'no', 'pasif'].includes(s)) return false;
  return fallback;
}

function parseNum(val: unknown, fallback: number, min: number, max: number): number {
  if (val === null || val === undefined || val === '') return fallback;
  const cleaned = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim().replace(/^'/, '');
  return s.length > 0 ? s : fallback;
}

function matchGender(val: unknown, fallback: GenderType): GenderType {
  const s = normalizeKey(String(val ?? ''));
  if (!s) return fallback;
  if (s.startsWith('kadin') || s === 'k' || s === 'f' || s === 'female') return 'Kadın';
  if (s.startsWith('erkek') || s === 'e' || s === 'm' || s === 'male') return 'Erkek';
  return fallback;
}

function matchEducation(val: unknown, fallback: EducationLevel): EducationLevel {
  const s = normalizeKey(String(val ?? ''));
  if (!s) return fallback;
  if (s.includes('doktora') || s.includes('phd')) return 'Doktora';
  if (s.includes('yuksek') || s.includes('master') || s.includes('mba')) return 'Yüksek Lisans';
  if (s.includes('onlisans')) return 'Ön Lisans';
  if (s.includes('lisans')) return 'Lisans';
  if (s.includes('lise')) return 'Lise';
  return fallback;
}

function matchEmploymentType(val: unknown, fallback: EmploymentType): EmploymentType {
  const s = normalizeKey(String(val ?? ''));
  if (!s) return fallback;
  if (s.includes('yonetici')) return 'Yönetici Sözleşmeli';
  if (s.includes('proje')) return 'Proje Bazlı';
  if (s.includes('belirlisureli')) return 'Belirli Süreli';
  if (s.includes('belirsiz') || s.includes('kadrolu')) return 'Belirsiz Süreli (Kadrolu)';
  return fallback;
}

function matchWorkModel(val: unknown, fallback: WorkModel): WorkModel {
  const s = normalizeKey(String(val ?? ''));
  if (!s) return fallback;
  if (s.includes('hibrit') || s.includes('hybrid')) return 'Hibrit';
  if (s.includes('saha') || s.includes('field')) return 'Saha';
  if (s.includes('uzak') || s.includes('remote')) return 'Uzaktan';
  if (s.includes('ofis') || s.includes('office')) return 'Ofis';
  return fallback;
}

function matchEmploymentStatus(val: unknown, fallback: EmploymentStatus): EmploymentStatus {
  const s = normalizeKey(String(val ?? ''));
  if (!s) return fallback;
  if (s.includes('izin')) return 'İzinli';
  if (s.includes('gecici') || s.includes('gorev')) return 'Geçici Görevde';
  if (s.includes('pasif') || s.includes('ayril')) return 'Pasif';
  if (s.includes('aktif')) return 'Aktif';
  return fallback;
}

function diffEmployeeFields(existing: Employee, next: EmployeeFormPayload): string[] {
  const labels: [keyof EmployeeFormPayload, string][] = [
    ['fullName', 'Ad Soyad'],
    ['title', 'Unvan'],
    ['grade', 'Kadro Derecesi'],
    ['department', 'Departman'],
    ['location', 'Lokasyon'],
    ['hireDate', 'İşe Giriş'],
    ['tenureMonths', 'Pozisyon Kıdemi'],
    ['employmentType', 'İstihdam Türü'],
    ['workModel', 'Çalışma Modeli'],
    ['employmentStatus', 'Çalışma Durumu'],
    ['email', 'E-posta'],
    ['phone', 'Telefon'],
    ['tcKimlikNo', 'T.C. Kimlik'],
    ['birthDate', 'Doğum Tarihi'],
    ['gender', 'Cinsiyet'],
    ['city', 'İkamet İli'],
    ['emergencyContact', 'Acil Durum İletişim'],
    ['educationLevel', 'Eğitim'],
    ['university', 'Üniversite'],
    ['foreignLanguages', 'Yabancı Dil'],
    ['certifications', 'Sertifikalar'],
    ['costCenter', 'Masraf Merkezi'],
    ['sgkBranch', 'SGK İşyeri'],
    ['annualLeaveBalance', 'İzin Bakiyesi'],
    ['hasSubordinates', 'Ekip / Ast Durumu'],
    ['potentialScore', 'Potansiyel'],
    ['disciplinaryWarning', 'Disiplin'],
    ['disciplinaryNote', 'Disiplin Notu'],
    ['notes', 'Özlük Notu'],
  ];

  const changed: string[] = [];
  for (const [key, label] of labels) {
    if ((existing as unknown as Record<string, unknown>)[key] !== (next as unknown as Record<string, unknown>)[key]) {
      changed.push(label);
    }
  }
  return changed;
}

export async function parseEmployeeExcelFile(
  file: File,
  existingEmployees: Employee[],
  platformConfig: PlatformConfig
): Promise<{
  rows: ParsedEmployeeImportRow[];
  sheetName: string;
  discoveredDepartments: string[];
  discoveredLocations: string[];
}> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Dosya boyutu 5 MB sınırını aşıyor. Lütfen daha küçük bir Excel dosyası yükleyin.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel dosyasında okunabilir çalışma sayfası bulunamadı.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawMatrix.length < 2) {
    throw new Error('Excel dosyasında başlık satırının altında veri bulunamadı.');
  }

  const headerRow = (rawMatrix[0] as unknown[]).map((h) => normalizeKey(String(h ?? '')));
  const colMap = new Map<number, string>();
  headerRow.forEach((norm, idx) => {
    const mapped = HEADER_ALIAS_MAP[norm];
    if (mapped) colMap.set(idx, mapped);
  });

  if (!Array.from(colMap.values()).includes('sicilNo') && !Array.from(colMap.values()).includes('fullName')) {
    throw new Error(
      'Gerekli sütunlar ("Sicil No" ve "Ad Soyad") bulunamadı. Lütfen şablon formatını kontrol edin.'
    );
  }

  const existingBySicil = new Map(
    existingEmployees.map((e) => [e.sicilNo.trim().toLocaleUpperCase('tr-TR'), e])
  );
  const seenSicilsInFile = new Set<string>();
  const discoveredDepartments = new Set<string>();
  const discoveredLocations = new Set<string>();

  const defaultDept = platformConfig.departments[0] ?? 'Operasyon';
  const defaultLoc = platformConfig.locations[0] ?? 'Ankara Genel Merkez';

  const parsedRows: ParsedEmployeeImportRow[] = [];

  for (let i = 1; i < rawMatrix.length; i++) {
    const rowArr = rawMatrix[i] as unknown[];
    const hasAnyValue = rowArr.some((cell) => String(cell ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const record: Record<string, unknown> = {};
    colMap.forEach((fieldName, colIdx) => {
      record[fieldName] = rowArr[colIdx];
    });

    const sicilNo = cleanStr(record.sicilNo).toLocaleUpperCase('tr-TR');
    const existing = sicilNo ? existingBySicil.get(sicilNo) : undefined;
    const fullName = cleanStr(record.fullName, existing?.fullName ?? '');

    if (!sicilNo) {
      parsedRows.push({
        rowNumber: i + 1,
        status: 'ERROR',
        errorMessage: 'Sicil No boş bırakılamaz.',
        changedFields: [],
        data: {} as EmployeeFormPayload,
      });
      continue;
    }

    if (seenSicilsInFile.has(sicilNo)) {
      parsedRows.push({
        rowNumber: i + 1,
        status: 'ERROR',
        errorMessage: `Dosya içinde mükerrer Sicil No (${sicilNo}).`,
        changedFields: [],
        data: {} as EmployeeFormPayload,
      });
      continue;
    }
    seenSicilsInFile.add(sicilNo);

    if (!fullName) {
      parsedRows.push({
        rowNumber: i + 1,
        status: 'ERROR',
        errorMessage: `${sicilNo} satırında Ad Soyad alanı zorunludur.`,
        changedFields: [],
        data: {} as EmployeeFormPayload,
      });
      continue;
    }

    const department = cleanStr(record.department, existing?.department ?? defaultDept);
    const location = cleanStr(record.location, existing?.location ?? defaultLoc);

    if (!platformConfig.departments.includes(department)) {
      discoveredDepartments.add(department);
    }
    if (!platformConfig.locations.includes(location)) {
      discoveredLocations.add(location);
    }

    const emailFallback =
      existing?.email ??
      `${normalizeKey(fullName).slice(0, 18) || sicilNo.toLowerCase()}@cati.com.tr`;

    const payload: EmployeeFormPayload = {
      id: existing?.id,
      sicilNo,
      fullName,
      title: cleanStr(record.title, existing?.title ?? 'Uzman'),
      grade: parseNum(record.grade, existing?.grade ?? 6, 1, 12),
      department,
      location,
      managerId: existing?.managerId ?? null,
      hireDate: parseExcelDate(record.hireDate, existing?.hireDate ?? REFERENCE_TODAY),
      tenureMonths: parseNum(record.tenureMonths, existing?.tenureMonths ?? 12, 0, 600),
      hasSubordinates: parseBool(record.hasSubordinates, existing?.hasSubordinates ?? false),
      disciplinaryWarning: parseBool(record.disciplinaryWarning, existing?.disciplinaryWarning ?? false),
      disciplinaryNote: cleanStr(record.disciplinaryNote, existing?.disciplinaryNote ?? ''),
      potentialScore: parseNum(record.potentialScore, existing?.potentialScore ?? 75, 0, 100),
      tcKimlikNo: cleanStr(record.tcKimlikNo, existing?.tcKimlikNo ?? 'Belirtilmedi'),
      birthDate: parseExcelDate(record.birthDate, existing?.birthDate ?? '1992-01-01'),
      gender: matchGender(record.gender, existing?.gender ?? 'Belirtilmemiş'),
      email: cleanStr(record.email, emailFallback).toLocaleLowerCase('tr-TR'),
      phone: cleanStr(record.phone, existing?.phone ?? '+90 500 000 00 00'),
      city: cleanStr(record.city, existing?.city ?? location.split(' ')[0] ?? 'Ankara'),
      emergencyContact: cleanStr(record.emergencyContact, existing?.emergencyContact ?? 'Belirtilmedi'),
      educationLevel: matchEducation(record.educationLevel, existing?.educationLevel ?? 'Lisans'),
      university: cleanStr(record.university, existing?.university ?? 'Belirtilmedi'),
      foreignLanguages: cleanStr(record.foreignLanguages, existing?.foreignLanguages ?? 'İngilizce (B1)'),
      certifications: cleanStr(record.certifications, existing?.certifications ?? '-'),
      employmentType: matchEmploymentType(
        record.employmentType,
        existing?.employmentType ?? 'Belirsiz Süreli (Kadrolu)'
      ),
      workModel: matchWorkModel(record.workModel, existing?.workModel ?? 'Ofis'),
      employmentStatus: matchEmploymentStatus(
        record.employmentStatus,
        existing?.employmentStatus ?? 'Aktif'
      ),
      costCenter: cleanStr(
        record.costCenter,
        existing?.costCenter ?? `MM-${department.slice(0, 3).toLocaleUpperCase('tr-TR')}`
      ),
      sgkBranch: cleanStr(record.sgkBranch, existing?.sgkBranch ?? `${location} İşyeri`),
      annualLeaveBalance: parseNum(record.annualLeaveBalance, existing?.annualLeaveBalance ?? 14, 0, 120),
      notes: cleanStr(record.notes, existing?.notes ?? ''),
    };

    const managerSicilNo = cleanStr(record.managerSicilNo).toLocaleUpperCase('tr-TR') || undefined;
    const changedFields = existing ? diffEmployeeFields(existing, payload) : [];

    parsedRows.push({
      rowNumber: i + 1,
      status: existing ? 'UPDATE' : 'INSERT',
      existingEmployeeId: existing?.id,
      changedFields,
      managerSicilNo,
      data: payload,
    });
  }

  return {
    rows: parsedRows,
    sheetName,
    discoveredDepartments: Array.from(discoveredDepartments),
    discoveredLocations: Array.from(discoveredLocations),
  };
}

// ---------- COMPREHENSIVE MULTI-SHEET CORPORATE EXCEL REPORT ----------

export interface ComprehensiveReportSelection {
  summary: boolean;
  employees: boolean;
  performance: boolean;
  feedback360: boolean;
  ninebox: boolean;
  mobilityAssignments: boolean;
}

export function exportComprehensiveReportXlsx(params: {
  employees: Employee[];
  allEmployees: Employee[];
  activePeriod: EvaluationPeriod;
  departmentFilter: string;
  competencies: CompetencyDefinition[];
  rules: SystemRules;
  platformConfig: PlatformConfig;
  mobilityRequests: MobilityRequest[];
  assignments: TemporaryAssignment[];
  selection: ComprehensiveReportSelection;
}): void {
  const {
    employees,
    allEmployees,
    activePeriod,
    departmentFilter,
    competencies,
    rules,
    platformConfig,
    mobilityRequests,
    assignments,
    selection,
  } = params;

  const sheets: ExcelSheetDefinition[] = [];
  const empIds = new Set(employees.map((e) => e.id));
  const empById = new Map(allEmployees.map((e) => [e.id, e]));

  // 1. Yönetici Özeti
  if (selection.summary) {
    const perfScores = employees.map((e) => getEffectivePerformanceScore(e, activePeriod));
    const avgPerf =
      perfScores.length > 0
        ? Math.round((perfScores.reduce((a, b) => a + b, 0) / perfScores.length) * 10) / 10
        : 0;
    const compScores = employees.map((e) => calculate360Analytics(e, competencies, rules).overallScore);
    const avg360 =
      compScores.length > 0
        ? Math.round((compScores.reduce((a, b) => a + b, 0) / compScores.length) * 10) / 10
        : 0;
    const highPotCount = employees.filter((e) => {
      const box = getEffectiveNineBoxId(e, activePeriod, competencies, rules);
      return box === 1 || box === 2 || box === 4;
    }).length;
    const activeMob = mobilityRequests.filter(
      (m) => m.status === 'Devam Ediyor' && empIds.has(m.employeeId)
    ).length;
    const activeAsg = assignments.filter(
      (a) => a.status === 'Aktif' && empIds.has(a.employeeId)
    ).length;

    const deptNames = Array.from(new Set(employees.map((e) => e.department)));
    const deptRows = deptNames.map((dept) => {
      const list = employees.filter((e) => e.department === dept);
      const dPerf =
        list.reduce((s, e) => s + getEffectivePerformanceScore(e, activePeriod), 0) / list.length;
      const d360 =
        list.reduce((s, e) => s + calculate360Analytics(e, competencies, rules).overallScore, 0) /
        list.length;
      const dStars = list.filter(
        (e) => getEffectiveNineBoxId(e, activePeriod, competencies, rules) === 1
      ).length;
      return [
        dept,
        list.length,
        Math.round(dPerf * 10) / 10,
        Math.round(d360 * 10) / 10,
        dStars,
      ];
    });

    sheets.push({
      name: 'Yönetici Özeti',
      headers: ['Rapor Parametresi / Birim', 'Değer / Personel', 'Ort. Performans', 'Ort. 360°', 'Yıldız (Kutu 1)'],
      rows: [
        ['Platform', platformConfig.platformName, '', '', ''],
        ['Değerlendirme Dönemi', activePeriod, '', '', ''],
        ['Birim Filtresi', departmentFilter === 'ALL' ? 'Tüm Birimler' : departmentFilter, '', '', ''],
        ['Rapor Tarihi', formatTrDate(REFERENCE_TODAY), '', '', ''],
        ['Toplam Personel', employees.length, avgPerf, avg360, highPotCount],
        ['Aktif Terfi / Atama Talebi', activeMob, '', '', ''],
        ['Aktif Geçici Görevlendirme', activeAsg, '', '', ''],
        ['', '', '', '', ''],
        ['--- BİRİM BAZLI ÖZET ---', 'Personel Sayısı', 'Ort. Performans', 'Ort. 360° Yetkinlik', 'Yıldız Sayısı'],
        ...deptRows,
      ],
    });
  }

  // 2. Personel Listesi (Sicil)
  if (selection.employees) {
    sheets.push({
      name: 'Personel Listesi (Sicil)',
      headers: MASTER_EMPLOYEE_HEADERS,
      rows: buildMasterEmployeeRows(
        employees,
        allEmployees,
        activePeriod,
        competencies,
        rules,
        platformConfig,
        assignments
      ),
    });
  }

  // 3. Bireysel Performans (KPI)
  if (selection.performance) {
    const kpiRows: (string | number)[][] = [];
    for (const emp of employees) {
      const rec = emp.performanceRecords[activePeriod];
      const finalScore = getEffectivePerformanceScore(emp, activePeriod);
      if (!rec || rec.kpis.length === 0) {
        kpiRows.push([
          emp.sicilNo,
          emp.fullName,
          emp.department,
          emp.title,
          activePeriod,
          rec?.stage ?? '-',
          '-',
          '-',
          0,
          0,
          0,
          '-',
          0,
          0,
          finalScore,
          rec?.calibratedScore ?? '',
          rec?.calibrationNote ?? '',
        ]);
      } else {
        for (const k of rec.kpis) {
          kpiRows.push([
            emp.sicilNo,
            emp.fullName,
            emp.department,
            emp.title,
            activePeriod,
            rec.stage,
            k.category,
            k.title,
            k.weight,
            k.targetValue,
            k.actualValue,
            k.unit,
            k.selfScore,
            k.managerScore,
            finalScore,
            rec.calibratedScore ?? '',
            rec.calibrationNote ?? '',
          ]);
        }
      }
    }

    sheets.push({
      name: 'Bireysel Performans KPI',
      headers: [
        'Sicil No',
        'Ad Soyad',
        'Departman',
        'Unvan',
        'Dönem',
        'Süreç Aşaması',
        'Hedef Tipi',
        'KPI / OKR Tanımı',
        'Ağırlık (%)',
        'Hedef Değer',
        'Gerçekleşen',
        'Birim',
        'Öz Puan',
        'Yönetici Puanı',
        'Nihai Dönem Puanı',
        'Kalibre Puan',
        'Kalibrasyon Notu',
      ],
      rows: kpiRows,
    });
  }

  // 4. 360 Yetkinlik Analizi
  if (selection.feedback360) {
    const rows360: (string | number)[][] = [];
    for (const emp of employees) {
      const an = calculate360Analytics(emp, competencies, rules);
      rows360.push([
        emp.sicilNo,
        emp.fullName,
        emp.department,
        emp.title,
        an.roleGroup,
        `${an.completedCount}/${an.totalCount}`,
        `%${an.completionRate}`,
        an.overallScore,
        an.blindSpots.map((b) => b.competencyName).join(', ') || 'Yok',
        an.hiddenStrengths.map((h) => h.competencyName).join(', ') || 'Yok',
        ...competencies.map((c) => {
          const match = an.rows.find((r) => r.competencyId === c.id);
          return match ? match.weightedScore : '-';
        }),
      ]);
    }
    sheets.push({
      name: '360 Yetkinlik Analizi',
      headers: [
        'Sicil No',
        'Ad Soyad',
        'Departman',
        'Unvan',
        'Rol Grubu',
        'Tamamlanan Rater',
        'Katılım Oranı',
        'Genel 360° Puanı',
        'Kör Noktalar',
        'Gizli Güçler',
        ...competencies.map((c) => c.name),
      ],
      rows: rows360,
    });
  }

  // 5. Nine-Box Dağılımı
  if (selection.ninebox) {
    const nineBoxRows = employees.map((emp) => {
      const perf = getEffectivePerformanceScore(emp, activePeriod);
      const comp360 = calculate360Analytics(emp, competencies, rules).overallScore;
      const pot = calculateCombinedPotentialIndex(emp, comp360);
      const boxId = getEffectiveNineBoxId(emp, activePeriod, competencies, rules);
      const meta = platformConfig.nineBoxCatalog[boxId];
      return [
        emp.sicilNo,
        emp.fullName,
        emp.department,
        emp.title,
        emp.grade,
        perf,
        comp360,
        emp.potentialScore,
        pot,
        meta.code,
        meta.name,
        emp.manualNineBoxOverride ? 'Manuel Kalibre' : 'Otomatik',
        emp.manualNineBoxOverride?.reason ?? '',
        meta.recommendation,
      ];
    });
    sheets.push({
      name: 'Nine-Box Dağılımı',
      headers: [
        'Sicil No',
        'Ad Soyad',
        'Departman',
        'Unvan',
        'Derece',
        'Performans',
        '360° Yetkinlik',
        'Yönetici Potansiyel',
        'Birleşik Potansiyel',
        'Kutu Kodu',
        'Nine-Box Segmenti',
        'Hesaplama Tipi',
        'Kalibrasyon Gerekçesi',
        'Gelişim Önerisi',
      ],
      rows: nineBoxRows,
    });
  }

  // 6. Terfi & Görevlendirme
  if (selection.mobilityAssignments) {
    const mobRows = mobilityRequests
      .filter((r) => empIds.has(r.employeeId))
      .map((req) => {
        const emp = empById.get(req.employeeId);
        const stepName =
          platformConfig.mobilityApprovalSteps[
            Math.min(req.currentStepIndex, Math.max(0, platformConfig.mobilityApprovalSteps.length - 1))
          ] ?? '-';
        return [
          'Terfi / Atama',
          emp?.sicilNo ?? '-',
          emp?.fullName ?? '-',
          emp?.department ?? '-',
          req.processType,
          `${req.targetTitle} (Derece ${req.targetGrade}) · ${req.targetDepartment} / ${req.targetLocation}`,
          req.status,
          stepName,
          formatTrDate(req.createdAt),
          req.justification,
        ];
      });

    const asgRows = assignments
      .filter((a) => empIds.has(a.employeeId))
      .map((asg) => {
        const emp = empById.get(asg.employeeId);
        return [
          'Geçici Görevlendirme',
          emp?.sicilNo ?? '-',
          emp?.fullName ?? '-',
          emp?.department ?? '-',
          asg.category,
          asg.targetLocationOrProject,
          asg.status,
          `${formatTrDate(asg.startDate)} – ${formatTrDate(asg.endDate)}`,
          asg.hasAllowance ? 'Harcırah/Vekalet Var' : 'Ek Ödeme Yok',
          asg.notes,
        ];
      });

    sheets.push({
      name: 'Terfi ve Görevlendirme',
      headers: [
        'Kayıt Tipi',
        'Sicil No',
        'Ad Soyad',
        'Birim',
        'Süreç / Kategori',
        'Hedef Pozisyon / Görev Yeri',
        'Durum',
        'Aşama / Tarih Aralığı',
        'Talep Tarihi / Ödeme',
        'Gerekçe / Not',
      ],
      rows: [...mobRows, ...asgRows],
    });
  }

  if (sheets.length === 0) return;

  const deptSlug =
    departmentFilter === 'ALL' ? 'tum-birimler' : normalizeKey(departmentFilter).slice(0, 16);
  exportWorkbookToXlsx(`cati-ik-raporu-${deptSlug}-${REFERENCE_TODAY}.xlsx`, sheets);
}

// ---------- SINGLE EMPLOYEE SICIL CARD EXCEL EXPORT ----------

export function exportSingleEmployeeSicilXlsx(params: {
  employee: Employee;
  allEmployees: Employee[];
  activePeriod: EvaluationPeriod;
  competencies: CompetencyDefinition[];
  rules: SystemRules;
  platformConfig: PlatformConfig;
  assignments: TemporaryAssignment[];
}): void {
  const { employee, allEmployees, activePeriod, competencies, rules, platformConfig, assignments } =
    params;
  const manager = employee.managerId
    ? allEmployees.find((e) => e.id === employee.managerId)
    : undefined;
  const perf = getEffectivePerformanceScore(employee, activePeriod);
  const comp360 = calculate360Analytics(employee, competencies, rules);
  const potIndex = calculateCombinedPotentialIndex(employee, comp360.overallScore);
  const boxId = getEffectiveNineBoxId(employee, activePeriod, competencies, rules);
  const boxMeta = platformConfig.nineBoxCatalog[boxId];
  const elig = evaluatePromotionEligibility(employee, activePeriod, competencies, rules);
  const activeAsg = getActiveAssignmentForEmployee(employee.id, assignments);

  const sicilRows: (string | number)[][] = [
    ['Sicil No', employee.sicilNo, 'İstihdam Türü', employee.employmentType],
    ['Ad Soyad', employee.fullName, 'Çalışma Modeli', employee.workModel],
    ['Unvan', employee.title, 'Çalışma Durumu', activeAsg ? 'Geçici Görevde' : employee.employmentStatus],
    ['Kadro Derecesi', `Derece ${employee.grade}`, 'Masraf Merkezi', employee.costCenter],
    ['Departman / Birim', employee.department, 'SGK İşyeri', employee.sgkBranch],
    ['Lokasyon', employee.location, 'Yıllık İzin Bakiyesi', `${employee.annualLeaveBalance} Gün`],
    ['Yönetici', manager ? `${manager.fullName} (${manager.sicilNo})` : 'Doğrudan Üst Yönetim', 'Ekip / Ast Durumu', employee.hasSubordinates ? 'Yönetici (Astı Var)' : 'Bireysel Katkı'],
    ['İşe Giriş Tarihi', formatTrDate(employee.hireDate), 'Pozisyon Kıdemi', `${employee.tenureMonths} Ay`],
    ['T.C. Kimlik No', employee.tcKimlikNo, 'Eğitim Düzeyi', employee.educationLevel],
    ['Doğum Tarihi', formatTrDate(employee.birthDate), 'Üniversite / Bölüm', employee.university],
    ['Cinsiyet', employee.gender, 'Yabancı Dil', employee.foreignLanguages],
    ['Kurumsal E-posta', employee.email, 'Sertifikalar', employee.certifications],
    ['Telefon', employee.phone, 'Disiplin Durumu', employee.disciplinaryWarning ? `Aktif İhtar: ${employee.disciplinaryNote ?? ''}` : 'Temiz'],
    ['İkamet İli', employee.city, 'Acil Durum İletişim', employee.emergencyContact],
    ['Bireysel Performans', perf, '360° Yetkinlik Puanı', comp360.overallScore],
    ['Potansiyel İndeksi', potIndex, 'Nine-Box Segmenti', boxMeta.name],
    ['Terfi Uygunluğu', elig.allPassed ? 'Uygun' : 'Eksik Kriter Mevcut', 'Özlük Notu', employee.notes ?? '-'],
  ];

  const rec = employee.performanceRecords[activePeriod];
  const kpiRows = (rec?.kpis ?? []).map((k) => [
    activePeriod,
    rec?.stage ?? '-',
    k.category,
    k.title,
    k.weight,
    k.targetValue,
    k.actualValue,
    k.unit,
    k.selfScore,
    k.managerScore,
    k.managerComment,
  ]);

  const termSummary = getEmployeeTermSummary(employee);
  const sicilRowsExtended: (string | number)[][] = [
    ...sicilRows,
    [
      'EK-13 Yıllık Performans (5.00)',
      termSummary.annualScore !== null
        ? `${termSummary.annualScore.toFixed(2)} (${termSummary.annualBand?.label ?? '-'})`
        : '-',
      'Dönem Skorları (D1 / D2 / D3)',
      `${termSummary.t1?.toFixed(2) ?? '-'} / ${termSummary.t2?.toFixed(2) ?? '-'} / ${
        termSummary.t3?.toFixed(2) ?? '-'
      }`,
    ],
  ];

  const compRows = comp360.rows.map((r) => [
    r.competencyName,
    r.selfAvg ?? '-',
    r.managerAvg ?? '-',
    r.peerAvg ?? '-',
    r.subordinateAvg ?? '-',
    r.internalCustomerAvg ?? '-',
    r.weightedScore,
    r.gap,
    r.insight,
  ]);

  const historyRows = employee.careerHistory.map((h) => [
    formatTrDate(h.date),
    h.type,
    h.title,
    h.detail,
    h.actor,
  ]);

  exportWorkbookToXlsx(`sicil-karti-${employee.sicilNo}-${REFERENCE_TODAY}.xlsx`, [
    {
      name: 'Sicil ve Özlük',
      headers: ['Bilgi Alanı', 'Değer', 'Bilgi Alanı', 'Değer'],
      rows: sicilRowsExtended,
    },
    {
      name: 'Performans KPI',
      headers: [
        'Dönem',
        'Aşama',
        'Tip',
        'Hedef / KPI',
        'Ağırlık (%)',
        'Hedef',
        'Gerçekleşen',
        'Birim',
        'Öz Puan',
        'Yönetici Puanı',
        'Yönetici Notu',
      ],
      rows: kpiRows,
    },
    {
      name: '360 Yetkinlik',
      headers: [
        'Yetkinlik',
        'Öz Değ.',
        'Üst Yönetici',
        'Eş Düzey',
        'Astlar',
        'İç Müşteri',
        'Ağırlıklı Puan',
        'Fark',
        'Analiz',
      ],
      rows: compRows,
    },
    {
      name: 'Kariyer Geçmişi',
      headers: ['Tarih', 'Olay Türü', 'Başlık', 'Detay', 'İşlem Yapan'],
      rows: historyRows,
    },
  ]);
}

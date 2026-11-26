import type {
  Employee,
  PerformanceDimensionId,
  PerformanceTermEvaluation,
  PerformanceTermKey,
} from '../types/talent';

export const PERFORMANCE_TERM_KEYS: PerformanceTermKey[] = [
  '1. Dönem',
  '2. Dönem',
  '3. Dönem',
];

export const RESPONSIBILITY_DECLARATION_TEXT =
  'Bu değerlendirmede yer alan puan, açıklama ve kanıtların doğruluğundan ve objektifliğinden değerlendirici olarak sorumluyum.';

export interface PerformanceIndicatorOption {
  level: 3 | 2 | 1;
  label: string;
  score: number;
  text: string;
}

export interface PerformanceDimensionDef {
  id: PerformanceDimensionId;
  order: number;
  code: string;
  name: string;
  scope: string;
  indicators: PerformanceIndicatorOption[];
}

export const PERFORMANCE_DIMENSIONS: PerformanceDimensionDef[] = [
  {
    id: 'is_kalitesi',
    order: 1,
    code: 'B1',
    name: 'İş Kalitesi',
    scope:
      'Çıktının standartlara uygunluğu, eksiksizliği ve tekrar iş gerektirmeden kullanılabilmesi.',
    indicators: [
      {
        level: 3,
        label: 'Gösterge 3',
        score: 5,
        text: 'Çıktılar tutarlı biçimde standardın üzerinde; başkalarına örnek veya şablon olacak nitelikte.',
      },
      {
        level: 2,
        label: 'Gösterge 2',
        score: 3.5,
        text: 'Çıktılar genel olarak standartlara uygun ve eksiksiz; küçük düzeltmeler dışında doğrudan kullanılabiliyor.',
      },
      {
        level: 1,
        label: 'Gösterge 1',
        score: 1,
        text: 'Çıktılar sıklıkla eksik veya standart dışı; düzeltme ya da tekrar çalışma gerektiriyor.',
      },
    ],
  },
  {
    id: 'dogruluk_hata',
    order: 2,
    code: 'B2',
    name: 'Doğruluk ve Hata Düzeyi',
    scope:
      'Yapılan işlerdeki hata sıklığı, hataların etkisi ve tekrar edip etmediği.',
    indicators: [
      {
        level: 3,
        label: 'Gösterge 3',
        score: 5,
        text: 'Dönem boyunca düzeltme gerektiren hata neredeyse yok; kendi kontrolünü yapıyor, süreçteki hata risklerini fark edip bildiriyor.',
      },
      {
        level: 2,
        label: 'Gösterge 2',
        score: 3.5,
        text: 'Hatalar seyrek ve etkisi sınırlı; fark edildiğinde düzeltiliyor ve tekrarlanmıyor.',
      },
      {
        level: 1,
        label: 'Gösterge 1',
        score: 1,
        text: 'Hatalar düzenli olarak başkaları tarafından yakalanıyor ya da benzer hatalar tekrarlanıyor; bazı hatalar paydaşa yansıyor.',
      },
    ],
  },
  {
    id: 'zaman_termin',
    order: 3,
    code: 'B3',
    name: 'Zaman Yönetimi ve Termin Uyumu',
    scope:
      "İşlerin belirlenen tarihlerde tamamlanması ve olası gecikmelerin önceden yönetilmesi (sonuç odaklı; planlama davranışı 360'ta ölçülür).",
    indicators: [
      {
        level: 3,
        label: 'Gösterge 3',
        score: 5,
        text: 'Terminlere tam uyum; yoğun veya acil dönemlerde de planlanan işler aksamadan teslim ediliyor.',
      },
      {
        level: 2,
        label: 'Gösterge 2',
        score: 3.5,
        text: 'İşlerin büyük bölümü zamanında tamamlanıyor; olası gecikmeler önceden bildiriliyor.',
      },
      {
        level: 1,
        label: 'Gösterge 1',
        score: 2, // EK-14 özel kuralı: 3. boyutta 1. göstergenin puanı 2'dir
        text: 'Terminler sık kaçırılıyor veya işler hatırlatma ile ilerliyor; gecikmeler başka işleri etkiliyor.',
      },
    ],
  },
  {
    id: 'is_hacmi_verimlilik',
    order: 4,
    code: 'B4',
    name: 'İş Hacmi ve Verimlilik',
    scope:
      'Rolün gerektirdiği iş yükünün karşılanma düzeyi ve kaynakların (zaman, malzeme) kullanımı.',
    indicators: [
      {
        level: 3,
        label: 'Gösterge 3',
        score: 5,
        text: 'Kaliteyi düşürmeden beklenenin üzerinde iş hacmi üstleniyor ya da işi daha az kaynakla yapmanın yolunu buluyor.',
      },
      {
        level: 2,
        label: 'Gösterge 2',
        score: 3.5,
        text: 'Rolün gerektirdiği iş yükünü karşılıyor; kaynakları makul kullanıyor.',
      },
      {
        level: 1,
        label: 'Gösterge 1',
        score: 1,
        text: 'Rolün gerektirdiği iş yükünün altında kalıyor; işler birikiyor veya başkalarına devrediliyor.',
      },
    ],
  },
  {
    id: 'surec_mevzuat',
    order: 5,
    code: 'B5',
    name: 'Süreç ve Mevzuat Uyumu',
    scope:
      'Tanımlı süreç, prosedür, mevzuat ve kayıt/dokümantasyon gerekliliklerine uyum.',
    indicators: [
      {
        level: 3,
        label: 'Gösterge 3',
        score: 5,
        text: 'Süreç ve mevzuata uyumu tutarlı biçimde sağlıyor; süreçteki aksaklık ve boşlukları fark edip iyileştirme önerisi getiriyor.',
      },
      {
        level: 2,
        label: 'Gösterge 2',
        score: 3.5,
        text: 'Süreç ve prosedürlere uyuyor; kayıt ve dokümantasyonu eksiksiz tutuyor.',
      },
      {
        level: 1,
        label: 'Gösterge 1',
        score: 1,
        text: 'Süreç/prosedür adımları atlanıyor; uygunsuzluk, denetim bulgusu veya düzeltici işlem gerektiren durumlar oluşuyor.',
      },
    ],
  },
  {
    id: 'pozisyona_ozgu',
    order: 6,
    code: 'B6',
    name: 'Pozisyona Özgü İş Sonuçları',
    scope:
      'Mesleki bilgi ve becerilerine hakim olması, yenilikler ve geri bildirimlerle kendini geliştirerek öğrendiklerini işine yansıtması.',
    indicators: [
      {
        level: 3,
        label: 'Gösterge 3',
        score: 5,
        text: 'Mesleki alanda yüksek uzmanlık sergiliyor. Karmaşık ve rutin dışı sorunlara çözüm üretiyor. Alanındaki yenilikleri takip ederek öğrendiği yöntemleri işine uyarlıyor ve mevcut uygulamaları geliştiriyor.',
      },
      {
        level: 2,
        label: 'Gösterge 2',
        score: 3.5,
        text: 'Mesleki bilgi ve becerilerini işinde kullanıyor. Yenilikleri takip ediyor, geri bildirimlerle gelişiyor ve öğrendiklerini uyguluyor.',
      },
      {
        level: 1,
        label: 'Gösterge 1',
        score: 1,
        text: 'Mesleki bilgi ve becerilerini uygulamakta zorlanıyor, sık yönlendirme gerekiyor. Verilen destek ve geri bildirimlere rağmen beklenen gelişimi gösteremiyor.',
      },
    ],
  },
];

export function getDimensionIndicatorScore(
  dimId: PerformanceDimensionId,
  level: 1 | 2 | 3
): number {
  const dim = PERFORMANCE_DIMENSIONS.find((d) => d.id === dimId);
  const ind = dim?.indicators.find((i) => i.level === level);
  return ind ? ind.score : 0;
}

export function calculateTermScoreFromSelections(
  selections: Partial<Record<PerformanceDimensionId, 1 | 2 | 3>>
): {
  selectedCount: number;
  dimensionScores: Partial<Record<PerformanceDimensionId, number>>;
  termScore: number | null;
} {
  const dimensionScores: Partial<Record<PerformanceDimensionId, number>> = {};
  let sum = 0;
  let count = 0;

  for (const dim of PERFORMANCE_DIMENSIONS) {
    const level = selections[dim.id];
    if (level === 1 || level === 2 || level === 3) {
      const score = getDimensionIndicatorScore(dim.id, level);
      dimensionScores[dim.id] = score;
      sum += score;
      count += 1;
    }
  }

  const termScore = count === PERFORMANCE_DIMENSIONS.length ? Number((sum / count).toFixed(2)) : null;
  return { selectedCount: count, dimensionScores, termScore };
}

export function calculateAnnualPerformanceScore(
  termEvaluations: Record<PerformanceTermKey, PerformanceTermEvaluation> | undefined
): {
  annualScore: number | null;
  completedTerms: number;
  totalTerms: number;
} {
  if (!termEvaluations) {
    return { annualScore: null, completedTerms: 0, totalTerms: PERFORMANCE_TERM_KEYS.length };
  }
  const completedScores: number[] = [];
  for (const term of PERFORMANCE_TERM_KEYS) {
    const rec = termEvaluations[term];
    if (rec && rec.status === 'Tamamlandı' && typeof rec.termScore === 'number') {
      completedScores.push(rec.termScore);
    }
  }
  const annualScore =
    completedScores.length > 0
      ? Number(
          (completedScores.reduce((a, b) => a + b, 0) / completedScores.length).toFixed(2)
        )
      : null;

  return {
    annualScore,
    completedTerms: completedScores.length,
    totalTerms: PERFORMANCE_TERM_KEYS.length,
  };
}

export type PerformanceBandLabel = 'Riskli Grup' | 'Gelişim Grubu' | 'Beklenen Seviye';

export interface PerformanceClassification {
  label: PerformanceBandLabel;
  rangeText: string;
  badgeClass: string;
  cardClass: string;
  scoreClass: string;
}

export function classifyPerformanceScore(score: number | null): PerformanceClassification | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score < 2.5) {
    return {
      label: 'Riskli Grup',
      rangeText: '1.00 – 2.49',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      cardClass: 'bg-rose-50/60 border-rose-200',
      scoreClass: 'text-rose-700',
    };
  }
  if (score < 3.5) {
    return {
      label: 'Gelişim Grubu',
      rangeText: '2.50 – 3.49',
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
      cardClass: 'bg-amber-50/60 border-amber-200',
      scoreClass: 'text-amber-800',
    };
  }
  return {
    label: 'Beklenen Seviye',
    rangeText: '3.50 – 5.00',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    cardClass: 'bg-emerald-50/60 border-emerald-200',
    scoreClass: 'text-emerald-700',
  };
}

export function countFilledDimensionNotes(
  notes: Partial<Record<PerformanceDimensionId, string>> | undefined
): number {
  if (!notes) return 0;
  return PERFORMANCE_DIMENSIONS.filter((d) => Boolean(notes[d.id]?.trim())).length;
}

export function createEmptyTermEvaluation(
  term: PerformanceTermKey,
  evaluatorName = ''
): PerformanceTermEvaluation {
  return {
    term,
    status: 'Taslak',
    selections: {},
    dimensionScores: {},
    dimensionNotes: {},
    termScore: null,
    justification: '',
    responsibilityAccepted: false,
    evaluatorName,
  };
}

export function buildDefaultTermEvaluations(
  empId: string,
  baseScore100: number,
  evaluatorName: string,
  completeThirdTerm = false
): Record<PerformanceTermKey, PerformanceTermEvaluation> {
  // Derive realistic 1..3 selections matching the employee's performance tier
  const makeLevels = (score: number, seedOffset: number): Record<PerformanceDimensionId, 1 | 2 | 3> => {
    const ids: PerformanceDimensionId[] = [
      'is_kalitesi',
      'dogruluk_hata',
      'zaman_termin',
      'is_hacmi_verimlilik',
      'surec_mevzuat',
      'pozisyona_ozgu',
    ];
    const result = {} as Record<PerformanceDimensionId, 1 | 2 | 3>;
    ids.forEach((id, idx) => {
      const hash = (idx + seedOffset) % 6;
      if (score >= 86) {
        result[id] = hash === 5 ? 2 : 3;
      } else if (score >= 76) {
        result[id] = hash < 2 ? 3 : 2;
      } else if (score >= 66) {
        result[id] = hash === 0 ? 1 : 2;
      } else {
        result[id] = hash < 4 ? 1 : 2;
      }
    });
    return result;
  };

  const buildNotesForSelections = (
    selections: Record<PerformanceDimensionId, 1 | 2 | 3>,
    term: PerformanceTermKey
  ): Record<PerformanceDimensionId, string> => {
    const templates: Record<PerformanceDimensionId, Record<1 | 2 | 3, string>> = {
      is_kalitesi: {
        3: `${term} raporları ve teslimatları sıfır revizyonla şablon niteliğinde hazırlandı.`,
        2: `${term} çıktıları genel kalite standartlarına uygun ve doğrudan kullanılabilir düzeyde teslim edildi.`,
        1: `${term} çıktılarında eksik kontrol nedeniyle tekrar çalışma gerektiren revizyonlar yaşandı.`,
      },
      dogruluk_hata: {
        3: 'Öz kontrol disiplini yüksek; dönem içi denetimlerde hata kaydı oluşmadı, riskler önceden bildirildi.',
        2: 'Dönem içinde oluşan sınırlı veri/kayıt sapmaları hızla düzeltildi ve tekrarlanmadı.',
        1: 'Benzer veri girişi ve kontrol hataları birden fazla kez paydaş aşamasında tespit edildi.',
      },
      zaman_termin: {
        3: 'Yoğun operasyon haftaları dahil tüm dönem terminlerine %100 zamanında uyum sağlandı.',
        2: 'Planlanan görevlerin büyük bölümü zamanında tamamlandı, olası gecikmeler önceden paylaşıldı.',
        1: 'Bazı kritik teslimatlar hatırlatma sonrası tamamlandı ve bağlı süreçlerde gecikme oluştu.',
      },
      is_hacmi_verimlilik: {
        3: 'Kalite standardını koruyarak ek proje sorumlulukları üstlendi ve kaynak kullanımını optimize etti.',
        2: 'Pozisyonun gerektirdiği düzenli iş hacmini mevcut kaynaklarla dengeli biçimde karşıladı.',
        1: 'Dönem içi iş yükü birikmesi yaşandı ve bazı görevler diğer ekip üyelerine devredildi.',
      },
      surec_mevzuat: {
        3: 'Tüm prosedür ve kayıt adımlarına eksiksiz uydu; süreç verimliliği için iyileştirme önerisi sundu.',
        2: 'Kurumsal prosedürlere ve dokümantasyon kurallarına uyumlu çalıştı.',
        1: 'Bazı kayıt ve onay adımlarında prosedür eksiklikleri gözlendi, düzeltici aksiyon açıldı.',
      },
      pozisyona_ozgu: {
        3: 'Uzmanlık alanında karmaşık vakalara çözüm üretti, yeni yöntemleri ekibe yaygınlaştırdı.',
        2: 'Mesleki bilgisini işine etkili yansıttı ve alınan geri bildirimlerle gelişim gösterdi.',
        1: 'Teknik uygulamalarda sık yönlendirmeye ihtiyaç duydu; geri bildirimlerin işine yansıması sınırlı kaldı.',
      },
    };

    const notes = {} as Record<PerformanceDimensionId, string>;
    (Object.keys(selections) as PerformanceDimensionId[]).forEach((dimId) => {
      notes[dimId] = templates[dimId][selections[dimId]];
    });
    return notes;
  };

  const makeCompleted = (
    term: PerformanceTermKey,
    score: number,
    seedOffset: number,
    date: string,
    note: string
  ): PerformanceTermEvaluation => {
    const selections = makeLevels(score, seedOffset);
    const { dimensionScores, termScore } = calculateTermScoreFromSelections(selections);
    return {
      term,
      status: 'Tamamlandı',
      selections,
      dimensionScores,
      dimensionNotes: buildNotesForSelections(selections, term),
      termScore,
      justification: note,
      responsibilityAccepted: true,
      evaluatorName,
      submittedAt: date,
    };
  };

  const noteHigh =
    'Dönem boyunca çıktı kalitesi, termin uyumu ve mevzuat disiplini kurumsal standartların üzerinde gerçekleşmiştir.';
  const noteMid =
    'Görev kapsamındaki çıktılar genel standartları karşılamış, gelişim alanları için dönemsel aksiyonlar paylaşılmıştır.';
  const noteLow =
    'Dönem içi teslimat süreleri ve çıktı doğruluğunda aksaklıklar gözlenmiştir; yapılandırılmış gelişim desteği planlanmıştır.';

  const pickNote = (s: number) => (s >= 84 ? noteHigh : s >= 68 ? noteMid : noteLow);

  const term1 = makeCompleted(
    '1. Dönem',
    Math.max(45, baseScore100 - 3),
    1,
    '2026-04-28',
    pickNote(baseScore100 - 3)
  );

  const term2 = makeCompleted(
    '2. Dönem',
    baseScore100,
    3,
    '2026-08-29',
    pickNote(baseScore100)
  );

  const term3 = completeThirdTerm
    ? makeCompleted(
        '3. Dönem',
        Math.min(98, baseScore100 + 2),
        2,
        '2026-11-20',
        pickNote(baseScore100 + 2)
      )
    : createEmptyTermEvaluation('3. Dönem', evaluatorName);

  void empId;

  return {
    '1. Dönem': term1,
    '2. Dönem': term2,
    '3. Dönem': term3,
  };
}

export function getEmployeeTermSummary(employee: Employee): {
  t1: number | null;
  t2: number | null;
  t3: number | null;
  annualScore: number | null;
  completedTerms: number;
  annualBand: PerformanceClassification | null;
} {
  const evals = employee.termEvaluations;
  const t1 = evals?.['1. Dönem']?.status === 'Tamamlandı' ? evals['1. Dönem'].termScore : null;
  const t2 = evals?.['2. Dönem']?.status === 'Tamamlandı' ? evals['2. Dönem'].termScore : null;
  const t3 = evals?.['3. Dönem']?.status === 'Tamamlandı' ? evals['3. Dönem'].termScore : null;
  const { annualScore, completedTerms } = calculateAnnualPerformanceScore(evals);
  return {
    t1,
    t2,
    t3,
    annualScore,
    completedTerms,
    annualBand: classifyPerformanceScore(annualScore),
  };
}

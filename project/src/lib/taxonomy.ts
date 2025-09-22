export type TaxonomyNode = {
  value: string;
  label: string;
  subfamilies: { value: string; label: string }[];
};

type KeywordRule = {
  pattern: RegExp;
  family: string;
  subfamily?: string;
};

const TAXONOMY_DATA: TaxonomyNode[] = [
  {
    value: 'Desechables',
    label: 'Desechables',
    subfamilies: [
      { value: 'Vasos', label: 'Vasos' },
      { value: 'Bandejas', label: 'Bandejas' },
      { value: 'Platos', label: 'Platos' },
      { value: 'Potes', label: 'Potes' },
      { value: 'Servilletas', label: 'Servilletas' },
      { value: 'Cubiertos', label: 'Cubiertos' },
      { value: 'Sorbetes', label: 'Sorbetes' },
      { value: 'Torteras', label: 'Torteras' },
    ],
  },
  {
    value: 'Empaque & Embalaje',
    label: 'Empaque & Embalaje',
    subfamilies: [
      { value: 'Bolsas', label: 'Bolsas' },
      { value: 'Bobinas', label: 'Bobinas' },
      { value: 'Films', label: 'Films' },
      { value: 'Rollos', label: 'Rollos' },
      { value: 'Estuches', label: 'Estuches & Blisters' },
      { value: 'Cajas', label: 'Cajas' },
      { value: 'Etiquetas', label: 'Etiquetas' },
    ],
  },
  {
    value: 'Repostería & Gastronomía',
    label: 'Repostería & Gastronomía',
    subfamilies: [
      { value: 'Reposteria', label: 'Accesorios de repostería' },
      { value: 'Panificados', label: 'Panificados' },
      { value: 'Bandejas', label: 'Bandejas especiales' },
    ],
  },
  {
    value: 'Limpieza',
    label: 'Limpieza',
    subfamilies: [
      { value: 'Quimicos', label: 'Químicos & accesorios' },
      { value: 'Papel', label: 'Papel' },
      { value: 'Aromas', label: 'Aromatización' },
      { value: 'Guantes', label: 'Guantes' },
    ],
  },
  {
    value: 'Papeleria',
    label: 'Papelería',
    subfamilies: [
      { value: 'Escritura', label: 'Escritura & oficina' },
      { value: 'Cuadernos', label: 'Cuadernos & blocks' },
      { value: 'Archivos', label: 'Archivos & sobres' },
      { value: 'Cintas', label: 'Cintas' },
      { value: 'Laminas', label: 'Láminas' },
    ],
  },
  {
    value: 'Otros',
    label: 'Otros',
    subfamilies: [
      { value: 'Accesorios', label: 'Accesorios' },
      { value: 'Decoracion', label: 'Decoración' },
      { value: 'Varios', label: 'Varios' },
    ],
  },
];

const removeDiacritics = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const normalizeName = (value: string) =>
  removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const KEYWORD_RULES: KeywordRule[] = [
  // ===== Desechables =====
  { pattern: /\bvasos?\b/, family: 'Desechables', subfamily: 'Vasos' },
  { pattern: /\btapas?\s+vasos?\b/, family: 'Desechables', subfamily: 'Vasos' },
  { pattern: /\bbandejas?\b/, family: 'Desechables', subfamily: 'Bandejas' },
  { pattern: /\bplatos?\b/, family: 'Desechables', subfamily: 'Platos' },
  { pattern: /\bpotes?\b/, family: 'Desechables', subfamily: 'Potes' },
  { pattern: /\bservilletas?\b/, family: 'Desechables', subfamily: 'Servilletas' },
  { pattern: /\bcubiertos?\b/, family: 'Desechables', subfamily: 'Cubiertos' },
  { pattern: /\bcuchar(as?|itas?)\b/, family: 'Desechables', subfamily: 'Cubiertos' },
  { pattern: /\btenedore?s?\b/, family: 'Desechables', subfamily: 'Cubiertos' },
  { pattern: /\bcuchill(os|as)?\b/, family: 'Desechables', subfamily: 'Cubiertos' },
  { pattern: /\bsorbete?s?\b/, family: 'Desechables', subfamily: 'Sorbetes' },
  { pattern: /\btorteras?\b/, family: 'Desechables', subfamily: 'Torteras' },

  // ===== Empaque & Embalaje =====
  { pattern: /\bbolsas?\b/, family: 'Empaque & Embalaje', subfamily: 'Bolsas' },
  { pattern: /\bbobinas?\b/, family: 'Empaque & Embalaje', subfamily: 'Bobinas' },
  { pattern: /\bfilm?s?\b/, family: 'Empaque & Embalaje', subfamily: 'Films' },
  { pattern: /\bstretch\b/, family: 'Empaque & Embalaje', subfamily: 'Films' },
  { pattern: /\brollos?\b/, family: 'Empaque & Embalaje', subfamily: 'Rollos' },
  { pattern: /\bestuches?\b/, family: 'Empaque & Embalaje', subfamily: 'Estuches' },
  { pattern: /\bblister\b/, family: 'Empaque & Embalaje', subfamily: 'Estuches' },
  { pattern: /\bcajas?\b/, family: 'Empaque & Embalaje', subfamily: 'Cajas' },
  { pattern: /\betiquetas?\b/, family: 'Empaque & Embalaje', subfamily: 'Etiquetas' },

  // ===== Repostería & Gastronomía =====
  { pattern: /\brepost(eria|ero|er[íi]a)\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\bpirotin(es)?\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\btelgopor\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\bmarmitas?\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\bplantill(as?|a)\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\bpalillos?\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\bpinches?\b/, family: 'Repostería & Gastronomía', subfamily: 'Reposteria' },
  { pattern: /\bbizcoch?uelo?s?\b/, family: 'Repostería & Gastronomía', subfamily: 'Panificados' },
  { pattern: /\bbudin(es)?\b/, family: 'Repostería & Gastronomía', subfamily: 'Panificados' },
  { pattern: /\bobleas?\b/, family: 'Repostería & Gastronomía', subfamily: 'Panificados' },
  { pattern: /\bpan\s+dulce\b/, family: 'Repostería & Gastronomía', subfamily: 'Panificados' },
  { pattern: /\bpizzas?\b/, family: 'Repostería & Gastronomía', subfamily: 'Panificados' },
  { pattern: /\bbocaditos?\b/, family: 'Repostería & Gastronomía', subfamily: 'Panificados' },

  // ===== Limpieza =====
  { pattern: /\blimpiador(es)?\b/, family: 'Limpieza', subfamily: 'Quimicos' },
  { pattern: /\blustramuebles?\b/, family: 'Limpieza', subfamily: 'Quimicos' },
  { pattern: /\baerosoles?\b/, family: 'Limpieza', subfamily: 'Quimicos' },
  { pattern: /\bdispensers?\b/, family: 'Limpieza', subfamily: 'Quimicos' },
  { pattern: /\bresiduos?\b/, family: 'Limpieza', subfamily: 'Quimicos' },
  { pattern: /\bpapel\s+higienic[oa]\b/, family: 'Limpieza', subfamily: 'Papel' },
  { pattern: /\btoallas?\s+intercaladas\b/, family: 'Limpieza', subfamily: 'Papel' },
  { pattern: /\baromatizad(or|ores|ora|oras)\b/, family: 'Limpieza', subfamily: 'Aromas' },
  { pattern: /\bspray\b/, family: 'Limpieza', subfamily: 'Aromas' },
  { pattern: /\bdifusores?\b/, family: 'Limpieza', subfamily: 'Aromas' },
  { pattern: /\bperfumes?\s+textiles\b/, family: 'Limpieza', subfamily: 'Aromas' },
  { pattern: /\bguantes?\b/, family: 'Limpieza', subfamily: 'Guantes' },

  // ===== Papelería =====
  { pattern: /\bboligrafos?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\blapices?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\bmarcadores?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\bresaltadores?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\btizas?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\breglas?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\bclips?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\bcorrectores?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\btijeras?\b/, family: 'Papeleria', subfamily: 'Escritura' },
  { pattern: /\bcuadernos?\b/, family: 'Papeleria', subfamily: 'Cuadernos' },
  { pattern: /\bblocks?\b/, family: 'Papeleria', subfamily: 'Cuadernos' },
  { pattern: /\bcarpetas?\b/, family: 'Papeleria', subfamily: 'Archivos' },
  { pattern: /\bsobres?\b/, family: 'Papeleria', subfamily: 'Archivos' },
  { pattern: /\bfolios?\b/, family: 'Papeleria', subfamily: 'Archivos' },
  { pattern: /\bcintas?\b/, family: 'Papeleria', subfamily: 'Cintas' },
  { pattern: /\blaminas?\b/, family: 'Papeleria', subfamily: 'Laminas' },

  // ===== Otros =====
  { pattern: /\baccesorios?\b/, family: 'Otros', subfamily: 'Accesorios' },
  { pattern: /\bporta\s+bobinas?\b/, family: 'Otros', subfamily: 'Accesorios' },
  { pattern: /\btripodes?\b/, family: 'Otros', subfamily: 'Accesorios' },
  { pattern: /\bconos?\s+para\s+papas\b/, family: 'Otros', subfamily: 'Accesorios' },
  { pattern: /\bmonos?\b/, family: 'Otros', subfamily: 'Decoracion' },
  { pattern: /\bblondas?\b/, family: 'Otros', subfamily: 'Decoracion' },
  { pattern: /\bindividuales?\b/, family: 'Otros', subfamily: 'Decoracion' },
  { pattern: /\bcaminos?\b/, family: 'Otros', subfamily: 'Decoracion' },
  { pattern: /\bnepacos?\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\broscas?\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\broute\s*66\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\bsenaletica\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\btouch\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\bhueveras?\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\bhilos?\b/, family: 'Otros', subfamily: 'Varios' },
  { pattern: /\bsisal\b/, family: 'Otros', subfamily: 'Varios' },
];

export const TAXONOMY = TAXONOMY_DATA;

export function inferFamilyByName(name: string): { family: string; subfamily?: string } | null {
  if (!name) return null;
  const normalized = normalizeName(name);
  if (!normalized) return null;

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.subfamily
        ? { family: rule.family, subfamily: rule.subfamily }
        : { family: rule.family };
    }
  }

  return null;
}

export function getFamilyNode(familyValue: string | null | undefined) {
  if (!familyValue) return undefined;
  return TAXONOMY.find((item) => item.value === familyValue);
}

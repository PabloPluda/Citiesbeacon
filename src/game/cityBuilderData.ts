export interface BuildItem {
  key: string; label: string; cost: number; color: number; bh: number;
}

export const CATS: { label: string; emoji: string; items: BuildItem[] }[] = [
  { label: 'Housing', emoji: '🏠', items: [
    { key: 'casa',      label: 'Small House', cost: 50,  color: 0xF97316, bh: 28 },
    { key: 'edif_s',    label: 'Sm. Building',cost: 100, color: 0x3B82F6, bh: 44 },
    { key: 'edif_g',    label: 'Lg. Building', cost: 200, color: 0x6366F1, bh: 62 },
  ]},
  { label: 'Commerce', emoji: '🏪', items: [
    { key: 'tienda',    label: 'Shop',        cost: 80,  color: 0xEAB308, bh: 26 },
    { key: 'shopping',  label: 'Mall',        cost: 180, color: 0xEC4899, bh: 50 },
    { key: 'oficina',   label: 'Office',      cost: 120, color: 0x0EA5E9, bh: 54 },
  ]},
  { label: 'Infra', emoji: '🏗️', items: [
    { key: 'calle',     label: 'Road',        cost: 20,  color: 0x6B7280, bh: 4  },
    { key: 'escuela',   label: 'School',      cost: 150, color: 0xEF4444, bh: 52 },
    { key: 'hospital',  label: 'Hospital',    cost: 180, color: 0xF4F4F5, bh: 54 },
  ]},
  { label: 'Parks', emoji: '🌳', items: [
    { key: 'arbol',     label: 'Tree',        cost: 10,  color: 0x22C55E, bh: 32 },
    { key: 'parque',    label: 'Park',        cost: 30,  color: 0x16A34A, bh: 6  },
    { key: 'fuente',    label: 'Fountain',    cost: 60,  color: 0x06B6D4, bh: 24 },
  ]},
];

export const colorToCss = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

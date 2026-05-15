export interface BuildItem {
  key:   string;
  label: string;
  cost:  number;
  w:     number;   // footprint cols
  d:     number;   // footprint rows
  file:  string;   // filename without .png, under /Builder/
}

export const CATS: { label: string; emoji: string; items: BuildItem[] }[] = [
  { label: 'Housing', emoji: '🏠', items: [
    { key: 'house1',     label: 'House 1',    cost: 20, w: 1, d: 1, file: 'Housing_1x1_House 1_20' },
    { key: 'house2',     label: 'House 2',    cost: 20, w: 1, d: 1, file: 'Housing_1x1_House 2_20' },
    { key: 'bldg_40',    label: 'Building',   cost: 40, w: 2, d: 2, file: 'Housing_2x2_Building_40' },
    { key: 'bldg_50',    label: 'Building',   cost: 50, w: 2, d: 2, file: 'Housing_2x2_Building_50' },
    { key: 'bldg_60',    label: 'Skyscraper', cost: 60, w: 2, d: 2, file: 'Housing_2x2_Building_60' },
  ]},
  { label: 'Park', emoji: '🌳', items: [
    { key: 'grass',      label: 'Grass',      cost: 10, w: 1, d: 1, file: 'Park_1x1_Grass_10' },
    { key: 'garden',     label: 'Park',       cost: 10, w: 1, d: 1, file: 'Park_1x1_Grass 2_10' },
    { key: 'meadow',     label: 'Meadow',     cost: 50, w: 2, d: 2, file: 'Park_2x2_Grass_50' },
    { key: 'lake',       label: 'Lake',       cost: 50, w: 2, d: 2, file: 'Park_2x2_Lake_50' },
    { key: 'park',       label: 'Park',       cost: 30, w: 2, d: 2, file: 'Park_2x2_Park_30' },
  ]},
  { label: 'Public', emoji: '🏛️', items: [
    { key: 'club_30',    label: 'Club',       cost: 30, w: 1, d: 1, file: 'Public_1x1_Club_30' },
    { key: 'club_40',    label: 'Club',       cost: 40, w: 1, d: 1, file: 'Public_1x1_Club_40' },
    { key: 'market',     label: 'Market',     cost: 30, w: 2, d: 1, file: 'Public_2x1_Market_30' },
    { key: 'school',     label: 'School',     cost: 30, w: 2, d: 1, file: 'Public_2x1_School_30' },
    { key: 'shopping',   label: 'Shopping',   cost: 30, w: 2, d: 1, file: 'Public_2x1_Shopping_30' },
  ]},
  { label: 'Road', emoji: '🛣️', items: [
    { key: 'sidewalk',   label: 'Sidewalk',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Sidewalk_10' },
    { key: 'street_1',   label: 'Street 1',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 1_10' },
    { key: 'street_2',   label: 'Street 2',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 2_10' },
    { key: 'street_3',   label: 'Street 3',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 3_10' },
    { key: 'street_4',   label: 'Street 4',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 4_10' },
    { key: 'street_5',   label: 'Street 5',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 5_10' },
    { key: 'street_6',   label: 'Street 6',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 6_10' },
    { key: 'street_7',   label: 'Street 7',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 7_10' },
    { key: 'street_8',   label: 'Street 8',   cost: 10, w: 1, d: 1, file: 'Road_1x1_Street 8_10' },
  ]},
];

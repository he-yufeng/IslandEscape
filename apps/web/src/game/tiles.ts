// ============================================================
// Island Escape — Tile Map Data & Types
// ============================================================

export type TileType =
  | 'water'
  | 'sand'
  | 'grass'
  | 'farmland'
  | 'dock'
  | 'house'
  | 'tree'
  | 'rock'
  | 'fishing_spot'
  | 'path'
  | 'cave'

export const TILE_SIZE = 32
export const MAP_COLS = 20
export const MAP_ROWS = 15

/** Whether a character can walk on this tile */
export function isWalkable(tile: TileType): boolean {
  switch (tile) {
    case 'water':
    case 'house':
    case 'tree':
    case 'rock':
    case 'cave':
      return false
    default:
      return true
  }
}

/** Whether a tile is interactable and what type */
export function getInteraction(tile: TileType): string | null {
  switch (tile) {
    case 'fishing_spot':
      return 'fish'
    case 'farmland':
      return 'farm'
    case 'dock':
      return 'merchant'
    case 'cave':
      return 'dungeon'
    default:
      return null
  }
}

// W = water, S = sand, G = grass, F = farmland, D = dock,
// H = house, T = tree, R = rock, X = fishing_spot, P = path
const MAP_KEY: Record<string, TileType> = {
  W: 'water',
  S: 'sand',
  G: 'grass',
  F: 'farmland',
  D: 'dock',
  H: 'house',
  T: 'tree',
  R: 'rock',
  X: 'fishing_spot',
  P: 'path',
  C: 'cave',
}

// 20 columns x 15 rows island map
const MAP_RAW: string[] = [
  'WWWWWWWWWWWWWWWWWWWW', // row 0
  'WWWWSSSSSSSSSSSSWWWW', // row 1
  'WWSSSGCTTGGGRGSSWWWW', // row 2
  'WWSSGGGPGGGGGGSSWWWW', // row 3
  'WWSGGHPPHGGRGGSSWWWW', // row 4
  'WWSGGPPPPPGGGGXSWWWW', // row 5
  'WWSGGPGHPGGGGGSSWWWW', // row 6
  'WSSGGPGGPGGFFFGSWWWW', // row 7
  'WSXGGPGGPGGFFFGSSWWW', // row 8
  'WSSGGPGGPGGFFFGSDDWW', // row 9
  'WWSGGPPPPPGGGGSDDWWW', // row 10
  'WWSSGTRGGGTRGSSSSWWW', // row 11
  'WWWSSSSSSSSSSSSSWWWW', // row 12
  'WWWWWWSSSSSSWWWWWWWW', // row 13
  'WWWWWWWWWWWWWWWWWWWW', // row 14
]

export const ISLAND_MAP: TileType[][] = MAP_RAW.map((row) =>
  row.split('').map((ch) => MAP_KEY[ch] ?? 'water'),
)

/** Get tile at grid position, or water if out of bounds */
export function getTile(col: number, row: number): TileType {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return 'water'
  return ISLAND_MAP[row]![col]!
}

// ----- Named Locations for Characters -----

export interface MapPosition {
  col: number
  row: number
}

/** Starting positions for all characters */
export const CHARACTER_POSITIONS: Record<string, MapPosition> = {
  player: { col: 7, row: 5 },
  tom: { col: 5, row: 4 },
  sam: { col: 12, row: 8 },
  lily: { col: 8, row: 7 },
  jack: { col: 10, row: 10 },
}

/** Important locations on the map */
export const LOCATIONS = {
  village_center: { col: 7, row: 6 },
  dock: { col: 16, row: 9 },
  fishing_spot_1: { col: 18, row: 5 },
  fishing_spot_2: { col: 1, row: 8 },
  farmland: { col: 13, row: 8 },
  merchant_ship: { col: 17, row: 9 },
  dungeon: { col: 6, row: 2 },
} as const

/** AI movement targets for different actions */
export function getActionTarget(action: string): MapPosition {
  switch (action) {
    case 'fish':
      return LOCATIONS.fishing_spot_1
    case 'farm':
      return LOCATIONS.farmland
    case 'trade_merchant':
      return LOCATIONS.dock
    default:
      return LOCATIONS.village_center
  }
}

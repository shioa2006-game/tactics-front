// 地形定数
const TERRAIN_PLAIN  = 0; // 平地: 移動コスト1
const TERRAIN_FOREST = 1; // 森:   移動コスト2
const TERRAIN_WALL   = 2; // 壁:   移動不可

// 移動コスト（地形定数をインデックスとして使用）
const TERRAIN_MOVE_COST = [1, 2, Infinity];

// 高さ定数
const HEIGHT_LOW  = 0; // 低地: 特別な効果なし
const HEIGHT_HIGH = 1; // 高地: Archerの攻撃力+2

// 陣地定義（左上隅の座標）
const TERRITORY_DEFS = {
  territory_A: { x: 3,  y: 3  },
  territory_B: { x: 26, y: 3  },
  territory_C: { x: 3,  y: 26 },
  territory_D: { x: 26, y: 26 },
};

class Map {
  constructor() {
    this.width       = 32;
    this.height      = 32;
    this.territories = TERRITORY_DEFS;
    this.grid        = this._createMap();
    this.heightMap   = this._createHeightMap();
  }

  // 32×32固定マップを生成する
  _createMap() {
    const P = TERRAIN_PLAIN;
    const F = TERRAIN_FOREST;
    const W = TERRAIN_WALL;

    // 全マスを平地で初期化
    const g = Array.from({ length: 32 }, () => Array(32).fill(P));

    // 壁の配置 ─ 中央付近にチョークポイントを形成
    const walls = [
      // 上部 横壁（左側・右側、中央に通路あり）
      [12, 8], [13, 8], [14, 8],
      [17, 8], [18, 8], [19, 8],
      // 縦壁（左）
      [11, 13], [11, 14], [11, 15], [11, 16], [11, 17], [11, 18],
      // 縦壁（右）
      [20, 13], [20, 14], [20, 15], [20, 16], [20, 17], [20, 18],
      // 下部 横壁（左側・右側、中央に通路あり）
      [12, 23], [13, 23], [14, 23],
      [17, 23], [18, 23], [19, 23],
    ];
    for (const [x, y] of walls) g[y][x] = W;

    // 森の配置 ─ 各エリアに戦術的な草むらを配置
    const forests = [
      // 左上エリア（territory_A周辺）
      [7, 7], [8, 7], [7, 8], [8, 8],
      // 右上エリア（territory_B周辺）
      [23, 7], [24, 7], [23, 8], [24, 8],
      // 左下エリア（territory_C周辺）
      [7, 23], [8, 23], [7, 24], [8, 24],
      // 右下エリア（territory_D周辺）
      [23, 23], [24, 23], [23, 24], [24, 24],
      // 中央エリア（壁に囲まれた内部）
      [14, 14], [15, 14], [16, 14], [17, 14],
      [14, 15],                     [17, 15],
      [14, 16],                     [17, 16],
      [14, 17], [15, 17], [16, 17], [17, 17],
      // 左中央
      [7, 14], [7, 15], [7, 16], [7, 17],
      // 右中央
      [24, 14], [24, 15], [24, 16], [24, 17],
    ];
    for (const [x, y] of forests) g[y][x] = F;

    // 陣地エリアは必ず平地にする（壁・森を上書き）
    for (const { x: ox, y: oy } of Object.values(this.territories)) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          g[oy + dy][ox + dx] = P;
        }
      }
    }

    return g;
  }

  // 高さマップを生成する
  // 高地エリア: 各コーナー砲台・壁外側の射台・中央通路見下ろしポジション
  _createHeightMap() {
    const h = Array.from({ length: 32 }, () => Array(32).fill(HEIGHT_LOW));

    const highGrounds = [
      // 左上コーナー（territory_A 北西接近路を制圧するArcher砲台）
      [1, 1], [2, 1], [1, 2], [2, 2],
      // 右上コーナー（territory_B 北東接近路を制圧するArcher砲台）
      [29, 1], [30, 1], [29, 2], [30, 2],
      // 左下コーナー（territory_C 南西接近路を制圧するArcher砲台）
      [1, 29], [2, 29], [1, 30], [2, 30],
      // 右下コーナー（territory_D 南東接近路を制圧するArcher砲台）
      [29, 29], [30, 29], [29, 30], [30, 30],
      // 左中央（縦壁の外側から通路を見下ろすポジション）
      [9, 12], [9, 13], [9, 14], [9, 15], [9, 16], [9, 17],
      // 右中央（縦壁の外側から通路を見下ろすポジション）
      [22, 12], [22, 13], [22, 14], [22, 15], [22, 16], [22, 17],
      // 上中央（横壁の上方から中央制圧ポジション）
      [15, 6], [16, 6],
      // 下中央（横壁の下方から中央制圧ポジション）
      [15, 25], [16, 25],
    ];

    for (const [x, y] of highGrounds) {
      if (y >= 0 && y < 32 && x >= 0 && x < 32) {
        h[y][x] = HEIGHT_HIGH;
      }
    }

    return h;
  }

  // 指定座標の地形種別を返す
  getTerrain(x, y) {
    if (!this.isInBounds(x, y)) return TERRAIN_WALL;
    return this.grid[y][x];
  }

  // 指定座標の移動コストを返す（壁はInfinity）
  getMoveCost(x, y) {
    return TERRAIN_MOVE_COST[this.getTerrain(x, y)];
  }

  // 指定座標が移動可能か返す
  isWalkable(x, y) {
    return this.isInBounds(x, y) && this.grid[y][x] !== TERRAIN_WALL;
  }

  // 座標がマップ内か返す
  isInBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // 指定座標の高さを返す
  getHeight(x, y) {
    if (!this.isInBounds(x, y)) return HEIGHT_LOW;
    return this.heightMap[y][x];
  }

  // 指定座標が高地かどうかを返す
  isHighGround(x, y) {
    return this.getHeight(x, y) === HEIGHT_HIGH;
  }

  // 指定座標がどの陣地に属するか返す（属さない場合はnull）
  getTerritoryAt(x, y) {
    for (const [name, { x: ox, y: oy }] of Object.entries(this.territories)) {
      if (x >= ox && x < ox + 3 && y >= oy && y < oy + 3) return name;
    }
    return null;
  }

  // 指定陣地の全マス座標を配列で返す
  getTerritorySquares(territoryName) {
    const origin = this.territories[territoryName];
    if (!origin) return [];
    const squares = [];
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        squares.push({ x: origin.x + dx, y: origin.y + dy });
      }
    }
    return squares;
  }
}

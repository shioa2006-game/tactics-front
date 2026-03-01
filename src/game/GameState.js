// ゲーム全体の状態を管理するクラス（描画・AI処理は行わない）
class GameState {
  constructor() {
    this.map           = new Map();
    this.units         = [];
    this.currentTurn   = 1;         // 現在のターン数（1始まり、最大50）
    this.currentPlayer = 'player';  // "player" または "cpu"
    this.scores        = { player: 0, cpu: 0 };
    this.isGameOver    = false;
    this.winner        = null;      // "player" / "cpu" / "draw" / null
    this.logs          = [];        // 行動ログ

    this._initUnits();
  }

  // ユニットの初期配置
  // Phase 2: 各プレイヤー Knight×2、Scout×2、Archer×2、Cleric×2 = 8ユニット
  _initUnits() {
    // プレイヤーユニット（左下・陣地C に集結）
    // territory_C の原点: (3, 26)、3×3マス = (3-5, 26-28)
    // Knights / Scouts は陣地内、Archers / Clerics は陣地外縁
    this.units.push(new Knight('player_knight_1', 'player', 3, 27));
    this.units.push(new Knight('player_knight_2', 'player', 4, 27));
    this.units.push(new Scout ('player_scout_1',  'player', 5, 26));
    this.units.push(new Scout ('player_scout_2',  'player', 5, 28));
    this.units.push(new Archer('player_archer_1', 'player', 6, 26));
    this.units.push(new Archer('player_archer_2', 'player', 6, 28));
    this.units.push(new Cleric('player_cleric_1', 'player', 6, 27));
    this.units.push(new Cleric('player_cleric_2', 'player', 3, 29));

    // CPUユニット（右上・陣地B に集結）
    // territory_B の原点: (26, 3)、3×3マス = (26-28, 3-5)
    // Player配置の180°回転対称（中心 (15.5, 15.5)、公式: x'=31-x, y'=31-y）
    // Knights / Scouts は陣地内、Archers / Clerics は陣地左外縁（territory_A 方向）
    this.units.push(new Knight('cpu_knight_1', 'cpu', 28, 4));
    this.units.push(new Knight('cpu_knight_2', 'cpu', 27, 4));
    this.units.push(new Scout ('cpu_scout_1',  'cpu', 26, 5));
    this.units.push(new Scout ('cpu_scout_2',  'cpu', 26, 3));
    this.units.push(new Archer('cpu_archer_1', 'cpu', 25, 5));
    this.units.push(new Archer('cpu_archer_2', 'cpu', 25, 3));
    this.units.push(new Cleric('cpu_cleric_1', 'cpu', 25, 4));
    this.units.push(new Cleric('cpu_cleric_2', 'cpu', 28, 2));
  }

  // IDでユニットを取得
  getUnit(id) {
    return this.units.find(u => u.id === id) || null;
  }

  // 指定マスにいる生存ユニットを返す
  getUnitsAt(x, y) {
    return this.units.filter(u => u.isAlive && u.position.x === x && u.position.y === y);
  }

  // 生存ユニット一覧を返す（ownerを指定すると絞り込み）
  getAliveUnits(owner) {
    if (owner) return this.units.filter(u => u.isAlive && u.owner === owner);
    return this.units.filter(u => u.isAlive);
  }

  // ゲーム終了判定（currentTurnが50を超えたら終了）
  checkGameOver() {
    if (this.currentTurn > 50) {
      this.isGameOver = true;
      this.winner     = this._determineWinner();
    }
    return this.isGameOver;
  }

  // 勝者を決定する
  _determineWinner() {
    if (this.scores.player > this.scores.cpu) return 'player';
    if (this.scores.cpu > this.scores.player) return 'cpu';
    return 'draw';
  }

  // 勝者を返す
  getWinner() {
    return this.winner;
  }

  // 状態をディープコピーする（AI用）
  clone() {
    const cloned = Object.create(GameState.prototype);
    cloned.map           = this.map; // マップは不変なので参照共有
    cloned.currentTurn   = this.currentTurn;
    cloned.currentPlayer = this.currentPlayer;
    cloned.scores        = { ...this.scores };
    cloned.isGameOver    = this.isGameOver;
    cloned.winner        = this.winner;
    cloned.logs          = [...this.logs];

    // ユニットをディープコピー
    cloned.units = this.units.map(u => {
      const unitClone = Object.create(Object.getPrototypeOf(u));
      Object.assign(unitClone, u);
      unitClone.position = { ...u.position };
      return unitClone;
    });

    return cloned;
  }

  // ログ出力用データを返す
  toLog() {
    return {
      turn:          this.currentTurn,
      currentPlayer: this.currentPlayer,
      scores:        { ...this.scores },
      aliveUnits:    this.getAliveUnits().map(u => ({
        id:       u.id,
        owner:    u.owner,
        type:     u.type,
        position: { ...u.position },
        hp:       u.hp,
      })),
    };
  }
}

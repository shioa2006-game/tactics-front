// ターン進行を管理するクラス
class TurnManager {
  constructor(gameState, playerAI, cpuAI) {
    this.gameState        = gameState;
    this.playerAI         = playerAI || null; // null = 手動プレイ
    this.cpuAI            = cpuAI    || null;
    this.actionResolver   = new ActionResolver(gameState);
    this.territoryManager = new TerritoryManager(gameState);
  }

  // ゲームを開始状態にリセットする
  startGame() {
    this.gameState.currentTurn   = 1;
    this.gameState.currentPlayer = 'cpu'; // CPUが先手
    this.gameState.isGameOver    = false;
    this.gameState.winner        = null;
    this._resetAllTurnFlags();
  }

  // プレイヤーのターン終了を宣言する（手動プレイ用）
  endPlayerTurn() {
    if (this.gameState.currentPlayer !== 'player') return;
    if (this.gameState.isGameOver) return;
    this._finishCurrentTurn();
  }

  // CPUのターンをAIで自動実行する
  executeCpuTurn() {
    if (this.gameState.currentPlayer !== 'cpu') return;
    if (this.gameState.isGameOver) return;
    if (!this.cpuAI) return;

    // AIが行動リストを決定し、TurnManagerが適用する
    const actions = this.cpuAI.decideActions();
    this._applyActions(actions);

    this._finishCurrentTurn();
  }

  // ゲームが終了しているか返す
  isGameOver() {
    return this.gameState.isGameOver;
  }

  // フルゲームをAI同士で最後まで実行する（バッチテスト用）
  runFullGame() {
    this.startGame();

    while (!this.isGameOver()) {
      const ai = this.gameState.currentPlayer === 'player'
        ? this.playerAI
        : this.cpuAI;

      if (!ai) break; // AIが設定されていないプレイヤーのターンでは停止

      const actions = ai.decideActions();
      this._applyActions(actions);

      this._finishCurrentTurn();
    }
  }

  // ターンを終了して次のターンへ進める（共通処理）
  _finishCurrentTurn() {
    // ターン終了時に陣地ポイントを計算
    this.territoryManager.calculatePoints();

    // ターン数インクリメント
    this.gameState.currentTurn++;

    // ゲーム終了チェック
    if (this.gameState.currentTurn > 50) {
      this.gameState.isGameOver = true;
      this.gameState.winner     = this._determineWinner();
      return;
    }

    // プレイヤーを交代してターンフラグをリセット
    this.gameState.currentPlayer =
      this.gameState.currentPlayer === 'player' ? 'cpu' : 'player';
    this._resetAllTurnFlags();
  }

  // 全生存ユニットのターンフラグをリセットする
  _resetAllTurnFlags() {
    for (const unit of this.gameState.getAliveUnits()) {
      unit.resetTurnFlags();
    }
  }

  // 行動リストを適用する（move / attack / heal に対応）
  _applyActions(actions) {
    for (const action of actions) {
      if (action.type === 'move') {
        this.actionResolver.moveUnit(action.unitId, action.toX, action.toY);
      } else if (action.type === 'attack') {
        this.actionResolver.attackUnit(action.unitId, action.targetId);
      } else if (action.type === 'heal') {
        this.actionResolver.healUnit(action.unitId, action.targetId);
      }
    }
  }

  // スコアから勝者を決定する
  _determineWinner() {
    const { player, cpu } = this.gameState.scores;
    if (player > cpu) return 'player';
    if (cpu > player) return 'cpu';
    return 'draw';
  }
}

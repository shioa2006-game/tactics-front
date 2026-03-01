// Canvas描画の統括クラス（requestAnimationFrameでループ）
class GameRenderer {
  constructor(canvas, gameState) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.gameState   = gameState;
    this.mapRenderer  = new MapRenderer(this.ctx, gameState);
    this.unitRenderer = new UnitRenderer(this.ctx, gameState);
    this.uiRenderer   = new UIRenderer(gameState);

    this._animFrameId = null;

    // 操作状態（index.htmlのイベントハンドラから参照・更新される）
    this.selectedUnitId      = null;
    this.movablePositions    = [];
    this.attackableTargets   = []; // Unit インスタンスの配列
    this.healableTargets     = []; // Cleric回復対象 Unit インスタンスの配列
  }

  // 1フレーム分を描画する
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 攻撃・回復可能ターゲットの座標を取り出す
    const attackablePositions = this.attackableTargets.map(u => u.position);
    const healablePositions   = this.healableTargets.map(u => u.position);

    this.mapRenderer.render(this.movablePositions, attackablePositions, healablePositions);
    this.unitRenderer.render(this.selectedUnitId, this.attackableTargets, this.healableTargets);
    this.uiRenderer.render();
  }

  // 描画ループを開始する
  startLoop() {
    const loop = () => {
      this.render();
      this._animFrameId = requestAnimationFrame(loop);
    };
    this._animFrameId = requestAnimationFrame(loop);
  }

  // 描画ループを停止する
  stopLoop() {
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }

  // 選択状態をクリアする
  clearSelection() {
    this.selectedUnitId    = null;
    this.movablePositions  = [];
    this.attackableTargets = [];
    this.healableTargets   = [];
  }
}

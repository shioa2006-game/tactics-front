// ユニットの描画を担当するクラス（ゲーム状態を変更しない）
class UnitRenderer {
  constructor(ctx, gameState) {
    this.ctx       = ctx;
    this.gameState = gameState;
    this.cellSize  = 25;

    // キャラクター画像を事前読み込み
    this.images = {};
    this._loadImage('Knight', 'assets/Knight.png');
    this._loadImage('Scout',  'assets/Scout.png');
    this._loadImage('Archer', 'assets/Archer.png');
    this._loadImage('Cleric', 'assets/Cleric.png');
  }

  _loadImage(name, src) {
    const img = new Image();
    img.src = src;
    this.images[name] = img;
  }

  // 全生存ユニットを描画する
  // attackableTargets: 攻撃可能な敵Unitの配列
  // healableTargets  : 回復可能な味方Unitの配列
  render(selectedUnitId, attackableTargets = [], healableTargets = []) {
    const { ctx, gameState, cellSize } = this;
    const units = gameState.getAliveUnits();

    // ─── 第1パス: 全ユニットを通常描画 ──────────────────────
    for (const unit of units) {
      const px = unit.position.x * cellSize;
      const py = unit.position.y * cellSize;

      // 行動済みユニットは半透明（ClericはhasHealed、それ以外はhasAttackedで判定）
      const fullyDone = unit.type === 'Cleric'
        ? (unit.hasMoved && unit.hasHealed)
        : (unit.hasMoved && unit.hasAttacked);
      ctx.globalAlpha = fullyDone ? 0.45 : 1.0;

      // 背景色マス（プレイヤー: 青、CPU: 赤）※完全不透明で地形と明確に区別
      ctx.fillStyle = unit.owner === 'player' ? '#1a57b0' : '#b01a28';
      ctx.fillRect(px, py, cellSize, cellSize);

      // キャラクター画像を描画（ロード済みの場合）
      const img = this.images[unit.type];
      if (img && img.complete && img.naturalWidth > 0) {
        const pad = 1;
        ctx.drawImage(img, px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);
      } else {
        // 画像未ロード時のフォールバック（テキスト表示）
        ctx.fillStyle    = '#FFF';
        ctx.font         = `bold ${Math.floor(cellSize * 0.45)}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.type[0], px + cellSize / 2, py + cellSize / 2);
      }

      // タイル輪郭（暗いボーダーで地形との境界を明確に）
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

      // HPバー（マスの下端）
      const barW    = cellSize - 4;
      const barH    = 3;
      const barX    = px + 2;
      const barY    = py + cellSize - barH - 1;
      const hpRatio = unit.hp / unit.maxHp;

      ctx.globalAlpha = 1.0;
      ctx.fillStyle   = '#111';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle   = hpRatio > 0.5 ? '#00CC00'
                      : hpRatio > 0.25 ? '#FFAA00'
                      : '#FF2200';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    // ─── 第2パス: 攻撃・回復ターゲットをユニットの上から強調 ──
    // ユニット描画の後に重ねることで背景色に隠れず確実に表示される
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 350));

    // 攻撃可能ターゲット（赤オーバーレイ + 外側赤パルス枠）
    for (const unit of attackableTargets) {
      const px = unit.position.x * cellSize;
      const py = unit.position.y * cellSize;
      // 案②: ユニット全体に半透明の赤オーバーレイを重ねる
      ctx.fillStyle = 'rgba(255, 50, 50, 0.42)';
      ctx.fillRect(px, py, cellSize, cellSize);
      // 案①: タイル外側にパルスアニメーション付きの赤枠
      ctx.strokeStyle = `rgba(255, 90, 90, ${pulse})`;
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(px - 2, py - 2, cellSize + 4, cellSize + 4);
    }

    // 回復可能ターゲット（緑オーバーレイ + 外側緑パルス枠）
    for (const unit of healableTargets) {
      const px = unit.position.x * cellSize;
      const py = unit.position.y * cellSize;
      // 案②: ユニット全体に半透明の緑オーバーレイを重ねる
      ctx.fillStyle = 'rgba(0, 220, 100, 0.42)';
      ctx.fillRect(px, py, cellSize, cellSize);
      // 案①: タイル外側にパルスアニメーション付きの緑枠
      ctx.strokeStyle = `rgba(80, 255, 160, ${pulse})`;
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(px - 2, py - 2, cellSize + 4, cellSize + 4);
    }

    // ─── 選択中ユニットの外側パルス枠（金色、最前面に描画） ──
    if (selectedUnitId) {
      const sel = units.find(u => u.id === selectedUnitId);
      if (sel) {
        const px    = sel.position.x * cellSize;
        const py    = sel.position.y * cellSize;
        const selPulse = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 400));
        ctx.strokeStyle = `rgba(255, 215, 0, ${selPulse})`;
        ctx.lineWidth   = 2;
        ctx.strokeRect(px - 1, py - 1, cellSize + 2, cellSize + 2);
      }
    }

    // Canvas状態のリセット
    ctx.globalAlpha  = 1.0;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

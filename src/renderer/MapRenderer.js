// マップ・地形の描画を担当するクラス（ゲーム状態を変更しない）
class MapRenderer {
  constructor(ctx, gameState) {
    this.ctx       = ctx;
    this.gameState = gameState;
    this.cellSize  = 25;
  }

  // マップ全体を描画する
  // movablePositions   : 移動可能マスの配列 [{x, y}, ...]
  // attackablePositions: 攻撃可能マスの配列 [{x, y}, ...]
  // healablePositions  : 回復可能マスの配列 [{x, y}, ...]（省略可）
  render(movablePositions, attackablePositions, healablePositions) {
    const { ctx, gameState, cellSize } = this;
    const map = gameState.map;

    // ─── 地形の塗りつぶし ────────────────────────────────
    // 明るい緑から離れたダーク系パレットを採用し、
    // ユニットタイル・ハイライトを際立たせる
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.getTerrain(x, y);
        if      (terrain === TERRAIN_PLAIN)  ctx.fillStyle = '#4a7c52'; // ダーク・セージグリーン
        else if (terrain === TERRAIN_FOREST) ctx.fillStyle = '#1e4020'; // 深いダークグリーン
        else if (terrain === TERRAIN_WALL)   ctx.fillStyle = '#252525'; // チャコールブラック
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        // 高地マスを砂色のオーバーレイで表示（壁以外のみ）
        if (terrain !== TERRAIN_WALL && map.isHighGround(x, y)) {
          ctx.fillStyle = 'rgba(200, 170, 90, 0.32)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }

        // 陣地エリアをオレンジで強調（不透明度を上げて確実に視認）
        if (map.getTerritoryAt(x, y)) {
          ctx.fillStyle = 'rgba(255, 165, 0, 0.38)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // ─── 移動可能マスのハイライト ────────────────────────
    // fill（面）+ 各マスへの枠線（stroke）で二重に主張
    if (movablePositions && movablePositions.length > 0) {
      // 面：鮮やかなブルー
      ctx.fillStyle = 'rgba(60, 150, 255, 0.55)';
      for (const { x, y } of movablePositions) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      // 枠線：明るいシアンブルーで各マスを縁取る
      ctx.strokeStyle = 'rgba(110, 200, 255, 0.95)';
      ctx.lineWidth   = 1;
      for (const { x, y } of movablePositions) {
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // ─── 攻撃可能マスのハイライト ────────────────────────
    // fill（面）+ 各マスへの枠線（stroke）
    if (attackablePositions && attackablePositions.length > 0) {
      // 面：鮮やかなレッド
      ctx.fillStyle = 'rgba(255, 50, 50, 0.62)';
      for (const { x, y } of attackablePositions) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      // 枠線：明るいサーモンレッドで縁取る
      ctx.strokeStyle = 'rgba(255, 120, 120, 0.95)';
      ctx.lineWidth   = 1;
      for (const { x, y } of attackablePositions) {
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // ─── 回復可能マスのハイライト ────────────────────────
    // fill（面）+ 各マスへの枠線（stroke）でグリーンに表示
    if (healablePositions && healablePositions.length > 0) {
      // 面：エメラルドグリーン
      ctx.fillStyle = 'rgba(0, 210, 100, 0.50)';
      for (const { x, y } of healablePositions) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      // 枠線：明るいライムグリーンで縁取る
      ctx.strokeStyle = 'rgba(80, 255, 160, 0.95)';
      ctx.lineWidth   = 1;
      for (const { x, y } of healablePositions) {
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // ─── グリッド線 ──────────────────────────────────────
    // 不透明度を上げてマス目を明確に
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth   = 1;
    for (let x = 0; x <= map.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, map.height * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= map.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(map.width * cellSize, y * cellSize);
      ctx.stroke();
    }
  }
}

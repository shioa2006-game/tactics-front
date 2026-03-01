// 1手先読みAI（最も近い敵に向かって移動し、射程内なら攻撃）
class GreedyAI extends BaseAI {
  constructor(owner, gameState) {
    super(owner, gameState);
  }

  // 行動決定ロジック:
  // 1. 生存ユニットを順番に処理
  // 2. Clericは傷ついた味方を優先して回復。回復対象がなければ最近傷ついた味方に近づく
  // 3. Cleric以外は最も近い敵に接近し、HP最小の敵を攻撃
  decideActions() {
    return this._planOnClone((clonedState, clonedResolver) => {
      const actions = [];
      const units   = clonedState.getAliveUnits(this.owner);

      for (const unit of units) {
        if (unit.type === 'Cleric') {
          // Clericは移動してから回復を試みる
          const wounded = clonedState.getAliveUnits(this.owner)
            .filter(u => u.id !== unit.id && u.hp < u.maxHp);
          const healTarget = wounded.length > 0
            ? wounded.reduce((a, b) => a.hp < b.hp ? a : b)
            : null;

          // まず回復対象に近づく
          if (healTarget) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              const bestPos = this._findBestMoveToward(movable, healTarget);
              clonedResolver.moveUnit(unit.id, bestPos.x, bestPos.y);
              actions.push({ type: 'move', unitId: unit.id, toX: bestPos.x, toY: bestPos.y });
            }
          }

          // 隣接した味方を回復
          const healable = clonedResolver.getHealableTargets(unit.id);
          if (healable.length > 0) {
            const target = healable.reduce((a, b) => a.hp < b.hp ? a : b);
            clonedResolver.healUnit(unit.id, target.id);
            actions.push({ type: 'heal', unitId: unit.id, targetId: target.id });
          }
        } else {
          // 最も近い敵を特定
          const enemies = clonedState.getAliveUnits().filter(u => u.owner !== this.owner);
          if (enemies.length === 0) continue;

          const nearestEnemy = this._findNearestEnemy(unit, enemies);

          // 移動：最も近い敵に近づく方向の移動先を選ぶ
          const movable = clonedResolver.getMovablePositions(unit.id);
          if (movable.length > 0) {
            const bestPos = this._findBestMoveToward(movable, nearestEnemy);
            clonedResolver.moveUnit(unit.id, bestPos.x, bestPos.y);
            actions.push({ type: 'move', unitId: unit.id, toX: bestPos.x, toY: bestPos.y });
          }

          // 攻撃：HP最小の敵を攻撃
          const attackable = clonedResolver.getAttackableTargets(unit.id);
          if (attackable.length > 0) {
            const weakest = attackable.reduce((min, u) => u.hp < min.hp ? u : min);
            clonedResolver.attackUnit(unit.id, weakest.id);
            actions.push({ type: 'attack', unitId: unit.id, targetId: weakest.id });
          }
        }
      }

      return actions;
    });
  }

  // マンハッタン距離で最も近い敵を返す
  _findNearestEnemy(unit, enemies) {
    return enemies.reduce((nearest, enemy) => {
      const distNearest = this._manhattan(unit.position, nearest.position);
      const distEnemy   = this._manhattan(unit.position, enemy.position);
      return distEnemy < distNearest ? enemy : nearest;
    });
  }

  // 移動候補の中で指定ユニットに最も近い位置を返す
  _findBestMoveToward(positions, targetUnit) {
    return positions.reduce((best, pos) => {
      const distBest = this._manhattan(pos, targetUnit.position);
      const distCurr = this._manhattan(best, targetUnit.position);
      return distBest < distCurr ? pos : best;
    });
  }

  // マンハッタン距離を計算する
  _manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

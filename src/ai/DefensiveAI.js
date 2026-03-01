// 守備重視AI
// 基本戦略: 陣地確保と安全な範囲での行動。
// - 序盤: 最寄りの陣地を確実に占拠
// - 中盤: 陣地内で防衛ラインを構築し、射程内の敵のみ攻撃
// - Archerは攻撃優先（BaseAI._planArcherActions）、Clericは回復優先（BaseAI._planClericActions）
class DefensiveAI extends BaseAI {
  constructor(owner, gameState) {
    super(owner, gameState);
  }

  decideActions() {
    return this._planOnClone((clonedState, clonedResolver) => {
      const actions          = [];
      const units            = clonedState.getAliveUnits(this.owner);
      const attackedTargetIds = new Set(); // 集中攻撃: 今ターン攻撃済みターゲットのID

      for (const unit of units) {
        if (unit.type === 'Cleric') {
          // Clericは回復最優先。フォールバックは最寄りの陣地
          const fallback = this._findNearestTerritoryCenter(unit.position, clonedState);
          this._planClericActions(unit, clonedState, clonedResolver, actions, fallback);

        } else if (unit.type === 'Archer') {
          // Archerは攻撃優先、移動先は最寄りの防衛目標陣地
          const defensiveTarget = this._findBestDefensiveTarget(unit.position, clonedState);

          // 集中攻撃: 攻撃可能な対象から集中攻撃ターゲットを選ぶ
          if (!unit.hasAttacked) {
            const attackable = clonedResolver.getAttackableTargets(unit.id);
            if (attackable.length > 0) {
              const target = this._selectFocusTarget(unit, attackable, attackedTargetIds);
              clonedResolver.attackUnit(unit.id, target.id);
              actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
              attackedTargetIds.add(target.id);
              continue; // 攻撃後は移動しない
            }
          }
          if (!unit.hasMoved && defensiveTarget) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              const best = movable.reduce((a, b) =>
                this._manhattan(a, defensiveTarget) < this._manhattan(b, defensiveTarget) ? a : b
              );
              clonedResolver.moveUnit(unit.id, best.x, best.y);
              actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
            }
          }

        } else {
          // Knight / Scout: 最寄りの未占拠陣地へ向かい、射程内の敵のみ攻撃
          const targetPos = this._findBestDefensiveTarget(unit.position, clonedState);

          if (targetPos && !unit.hasMoved) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              // 挟み撃ちボーナスを考慮して移動先を選ぶ
              const best = movable.reduce((a, b) => {
                const sa = -this._manhattan(a, targetPos) + this._getFlankingBonus(a, clonedState);
                const sb = -this._manhattan(b, targetPos) + this._getFlankingBonus(b, clonedState);
                return sa > sb ? a : b;
              });
              clonedResolver.moveUnit(unit.id, best.x, best.y);
              actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
            }
          }

          if (!unit.hasAttacked) {
            const attackable = clonedResolver.getAttackableTargets(unit.id);
            if (attackable.length > 0) {
              const target = this._selectFocusTarget(unit, attackable, attackedTargetIds);
              clonedResolver.attackUnit(unit.id, target.id);
              actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
              attackedTargetIds.add(target.id);
            }
          }
        }
      }

      return actions;
    });
  }

  // 未占拠または手薄な最寄りの陣地の中心座標を返す
  _findBestDefensiveTarget(pos, state) {
    const territories = state.map.territories;
    let best     = null;
    let bestDist = Infinity;

    for (const [name, { x: ox, y: oy }] of Object.entries(territories)) {
      const center = { x: ox + 1, y: oy + 1 }; // 3×3の中心
      // 自軍が完全占拠していない陣地を優先
      const myUnitsIn = state.getAliveUnits(this.owner).filter(u =>
        u.position.x >= ox && u.position.x < ox + 3 &&
        u.position.y >= oy && u.position.y < oy + 3
      ).length;
      // 自軍ユニットが少ない陣地ほど行きたい
      const dist = this._manhattan(pos, center) + myUnitsIn * 3;
      if (dist < bestDist) {
        bestDist = dist;
        best = center;
      }
    }

    return best;
  }

  // 最寄りの陣地の中心座標を返す
  _findNearestTerritoryCenter(pos, state) {
    const territories = state.map.territories;
    let best     = null;
    let bestDist = Infinity;

    for (const { x: ox, y: oy } of Object.values(territories)) {
      const center = { x: ox + 1, y: oy + 1 };
      const dist   = this._manhattan(pos, center);
      if (dist < bestDist) {
        bestDist = dist;
        best = center;
      }
    }

    return best;
  }
}

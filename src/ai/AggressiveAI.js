// 攻撃重視AI
// 基本戦略: 敵ユニット撃破を最優先。敵に向かって一直線に突進し、HP最小の敵を集中攻撃。
// Archerは攻撃優先（BaseAI._planArcherActions）、Clericは回復優先（BaseAI._planClericActions）
class AggressiveAI extends BaseAI {
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
          // Clericは回復最優先。フォールバックは最近の敵方向（前線サポート）
          const enemies = clonedState.getAliveUnits().filter(u => u.owner !== this.owner);
          const fallback = enemies.length > 0
            ? enemies.reduce((a, b) =>
                this._manhattan(unit.position, a.position) < this._manhattan(unit.position, b.position) ? a : b
              ).position
            : null;
          this._planClericActions(unit, clonedState, clonedResolver, actions, fallback);

        } else if (unit.type === 'Archer') {
          // Archerは攻撃優先、移動先は最近の敵
          const enemies = clonedState.getAliveUnits().filter(u => u.owner !== this.owner);
          const moveTarget = enemies.length > 0
            ? enemies.reduce((a, b) =>
                this._manhattan(unit.position, a.position) < this._manhattan(unit.position, b.position) ? a : b
              ).position
            : null;
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
          if (!unit.hasMoved && moveTarget) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              const best = movable.reduce((a, b) =>
                this._manhattan(a, moveTarget) < this._manhattan(b, moveTarget) ? a : b
              );
              clonedResolver.moveUnit(unit.id, best.x, best.y);
              actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
            }
          }

        } else {
          // Knight / Scout: 最近の敵に突進、集中攻撃
          const enemies = clonedState.getAliveUnits().filter(u => u.owner !== this.owner);
          if (enemies.length === 0) continue;

          const nearest = enemies.reduce((a, b) =>
            this._manhattan(unit.position, a.position) < this._manhattan(unit.position, b.position) ? a : b
          );

          if (!unit.hasMoved) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              // 挟み撃ちボーナスを考慮して移動先を選ぶ
              const best = movable.reduce((a, b) => {
                const sa = -this._manhattan(a, nearest.position) + this._getFlankingBonus(a, clonedState);
                const sb = -this._manhattan(b, nearest.position) + this._getFlankingBonus(b, clonedState);
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
}

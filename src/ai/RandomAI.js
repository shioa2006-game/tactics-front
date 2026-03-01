// ランダム行動AI
class RandomAI extends BaseAI {
  constructor(owner, gameState) {
    super(owner, gameState);
  }

  // 行動決定ロジック:
  // 1. 生存ユニットをランダムな順序で処理
  // 2. 各ユニットについて移動可能マスがあればランダムに1つ選んで移動
  // 3. 攻撃可能なターゲットがあればランダムに1つ選んで攻撃
  //    Clericの場合は回復可能な味方をランダムに選んで回復
  decideActions() {
    return this._planOnClone((clonedState, clonedResolver) => {
      const actions  = [];
      const units    = clonedState.getAliveUnits(this.owner);
      const shuffled = this._shuffle([...units]);

      for (const unit of shuffled) {
        // 移動
        const movable = clonedResolver.getMovablePositions(unit.id);
        if (movable.length > 0) {
          const target = movable[Math.floor(Math.random() * movable.length)];
          clonedResolver.moveUnit(unit.id, target.x, target.y);
          actions.push({ type: 'move', unitId: unit.id, toX: target.x, toY: target.y });
        }

        if (unit.type === 'Cleric') {
          // Clericは回復
          const healable = clonedResolver.getHealableTargets(unit.id);
          if (healable.length > 0) {
            const target = healable[Math.floor(Math.random() * healable.length)];
            clonedResolver.healUnit(unit.id, target.id);
            actions.push({ type: 'heal', unitId: unit.id, targetId: target.id });
          }
        } else {
          // 攻撃
          const attackable = clonedResolver.getAttackableTargets(unit.id);
          if (attackable.length > 0) {
            const target = attackable[Math.floor(Math.random() * attackable.length)];
            clonedResolver.attackUnit(unit.id, target.id);
            actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
          }
        }
      }

      return actions;
    });
  }

  // 配列をFisher-Yatesシャッフル
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

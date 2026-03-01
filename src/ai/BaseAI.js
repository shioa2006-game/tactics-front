// AIの基底クラス
class BaseAI {
  constructor(owner, gameState) {
    this.owner     = owner;     // "player" または "cpu"
    this.gameState = gameState;
  }

  // 全ユニットの行動リストを返す（サブクラスで実装）
  // 戻り値: [{ type: "move", unitId, toX, toY }, { type: "attack", unitId, targetId }, ...]
  // 注意: クローンを使って計画し、実際の適用はTurnManagerが行う
  decideActions() {
    return [];
  }

  // GameStateのクローン上でActionResolverを使って行動を計画するヘルパー
  _planOnClone(planFn) {
    const clonedState    = this.gameState.clone();
    const clonedResolver = new ActionResolver(clonedState);
    return planFn(clonedState, clonedResolver);
  }

  // ──────────────────────────────────────────────────────────────
  // Archer行動ヘルパー
  // 優先順序: 現在位置から攻撃可能 → 攻撃（移動なし）、不可 → moveTargetへ移動
  // @param unit        - Archerユニット（クローンから取得）
  // @param clonedState - クローン状態
  // @param resolver    - クローンリゾルバー
  // @param actions     - 行動リスト（pushで追記）
  // @param moveTarget  - 攻撃できない場合の移動目標座標（nullなら最近の敵を自動選択）
  // ──────────────────────────────────────────────────────────────
  _planArcherActions(unit, clonedState, resolver, actions, moveTarget = null) {
    // 1. 現在位置から攻撃可能な敵がいるか確認（移動前に優先）
    if (!unit.hasAttacked) {
      const attackable = resolver.getAttackableTargets(unit.id);
      if (attackable.length > 0) {
        const target = attackable.reduce((a, b) => a.hp < b.hp ? a : b);
        resolver.attackUnit(unit.id, target.id);
        actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
        return; // 攻撃したら移動しない（Archerは移動後攻撃不可のため、攻撃を優先）
      }
    }

    // 2. 攻撃できない場合は目標に向かって移動（挟み撃ちボーナスを考慮）
    if (!unit.hasMoved) {
      let target = moveTarget;
      if (!target) {
        // デフォルト: 最近の敵
        const enemies = clonedState.getAliveUnits().filter(u => u.owner !== this.owner);
        if (enemies.length > 0) {
          target = enemies.reduce((a, b) =>
            this._manhattan(unit.position, a.position) < this._manhattan(unit.position, b.position) ? a : b
          ).position;
        }
      }
      if (target) {
        const movable = resolver.getMovablePositions(unit.id);
        if (movable.length > 0) {
          const best = movable.reduce((a, b) => {
            const sa = -this._manhattan(a, target) + this._getFlankingBonus(a, clonedState);
            const sb = -this._manhattan(b, target) + this._getFlankingBonus(b, clonedState);
            return sa > sb ? a : b;
          });
          resolver.moveUnit(unit.id, best.x, best.y);
          actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Cleric行動ヘルパー
  // 優先順序: 現在位置から回復可能 → 即回復（移動なし）、不可 → 最重傷の味方へ移動して回復試行
  // @param unit           - Clericユニット（クローンから取得）
  // @param clonedState    - クローン状態
  // @param resolver       - クローンリゾルバー
  // @param actions        - 行動リスト（pushで追記）
  // @param fallbackTarget - 負傷味方がいない場合のフォールバック移動先座標（nullなら移動しない）
  // ──────────────────────────────────────────────────────────────
  _planClericActions(unit, clonedState, resolver, actions, fallbackTarget = null) {
    // 1. 現在位置から回復可能な味方がいるか確認（移動前に優先）
    if (!unit.hasHealed) {
      const healable = resolver.getHealableTargets(unit.id)
        .filter(t => t.hp < t.maxHp);
      if (healable.length > 0) {
        const target = healable.reduce((a, b) => a.hp < b.hp ? a : b);
        resolver.healUnit(unit.id, target.id);
        actions.push({ type: 'heal', unitId: unit.id, targetId: target.id });
        return; // 回復したら移動なし（このターンは回復を優先）
      }
    }

    // 2. 回復対象がいなければ最重傷の味方に向かって移動
    if (!unit.hasMoved) {
      const wounded = clonedState.getAliveUnits(this.owner)
        .filter(u => u.id !== unit.id && u.hp < u.maxHp);

      let moveTarget = null;
      if (wounded.length > 0) {
        moveTarget = wounded.reduce((a, b) => a.hp < b.hp ? a : b).position;
      } else {
        moveTarget = fallbackTarget;
      }

      if (moveTarget) {
        const movable = resolver.getMovablePositions(unit.id);
        if (movable.length > 0) {
          // 傷ついた味方へ向かう場合は距離を優先（隊形ボーナスを無効化）
          // 誰も傷ついていない場合（フォールバック移動）のみ隊形ボーナスを適用
          const best = movable.reduce((a, b) => {
            const bonusA = wounded.length > 0 ? 0 : this._getFormationBonus(a, clonedState);
            const bonusB = wounded.length > 0 ? 0 : this._getFormationBonus(b, clonedState);
            const sa = -this._manhattan(a, moveTarget) + bonusA;
            const sb = -this._manhattan(b, moveTarget) + bonusB;
            return sa > sb ? a : b;
          });
          resolver.moveUnit(unit.id, best.x, best.y);
          actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
        }
      }

      // 移動後に回復できるか再確認
      if (!unit.hasHealed) {
        const healable = resolver.getHealableTargets(unit.id)
          .filter(t => t.hp < t.maxHp);
        if (healable.length > 0) {
          const target = healable.reduce((a, b) => a.hp < b.hp ? a : b);
          resolver.healUnit(unit.id, target.id);
          actions.push({ type: 'heal', unitId: unit.id, targetId: target.id });
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 集中攻撃: 今ターン既に攻撃されたターゲットを優先（撃破狙い）
  // @param unit              - 攻撃ユニット
  // @param attackable        - 攻撃可能なターゲット一覧
  // @param attackedTargetIds - 今ターン既に攻撃されたターゲットIDの集合（Set）
  // ──────────────────────────────────────────────────────────────
  _selectFocusTarget(unit, attackable, attackedTargetIds) {
    if (attackable.length === 0) return null;

    // 撃破できそうな敵を最優先（HPが攻撃力以下）
    const killable = attackable.filter(t => t.hp <= unit.attack);
    if (killable.length > 0) {
      return killable.reduce((a, b) => a.hp < b.hp ? a : b);
    }

    // 既に攻撃されたターゲットを優先（集中攻撃で早期撃破）
    if (attackedTargetIds && attackedTargetIds.size > 0) {
      const alreadyHit = attackable.filter(t => attackedTargetIds.has(t.id));
      if (alreadyHit.length > 0) {
        return alreadyHit.reduce((a, b) => a.hp < b.hp ? a : b);
      }
    }

    // それ以外はHP最小の敵
    return attackable.reduce((a, b) => a.hp < b.hp ? a : b);
  }

  // ──────────────────────────────────────────────────────────────
  // 挟み撃ちボーナス: 味方Knightが隣接している敵の反対側にいる場合 +5点
  // @param pos   - 評価する座標
  // @param state - クローン状態
  // ──────────────────────────────────────────────────────────────
  _getFlankingBonus(pos, state) {
    let bonus = 0;
    const oppOwner = this.owner === 'player' ? 'cpu' : 'player';
    const myKnights = state.getAliveUnits(this.owner).filter(u => u.type === 'Knight');
    const enemies   = state.getAliveUnits(oppOwner);

    for (const knight of myKnights) {
      for (const enemy of enemies) {
        const kx = knight.position.x, ky = knight.position.y;
        const ex = enemy.position.x,  ey = enemy.position.y;
        // KnightがこのEnemyに隣接しているか（チェビシェフ距離1）
        if (Math.max(Math.abs(kx - ex), Math.abs(ky - ey)) <= 1) {
          // 敵の反対側の座標（挟み撃ちポジション）
          const flankX = ex + (ex - kx);
          const flankY = ey + (ey - ky);
          if (pos.x === flankX && pos.y === flankY) {
            bonus += 5;
          }
        }
      }
    }
    return bonus;
  }

  // ──────────────────────────────────────────────────────────────
  // 隊形維持ボーナス（Cleric用）: 最も近い味方が2マス以内なら +3点
  // @param pos   - 評価する座標
  // @param state - クローン状態
  // ──────────────────────────────────────────────────────────────
  _getFormationBonus(pos, state) {
    const allies = state.getAliveUnits(this.owner).filter(u => u.type !== 'Cleric');
    if (allies.length === 0) return 0;
    const minDist = allies.reduce((min, u) => {
      const d = Math.max(Math.abs(pos.x - u.position.x), Math.abs(pos.y - u.position.y));
      return d < min ? d : min;
    }, Infinity);
    return minDist <= 2 ? 3 : 0;
  }

  _manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

// MinMax AI（順次MinMax方式）
// 【Phase 3 作り直し】ユニットを1体ずつ順番に処理し、前のユニットの行動結果を次に引き継ぐ
//
// 処理フロー:
//   1. ユニットを優先度順にソート: Knight → Archer → Scout → Cleric
//   2. 各ユニットについて:
//      - 移動候補を即時スコアで上位10手に絞る
//      - 各候補をクローン上で評価（_evaluate()で採点）
//      - 最善手を選択してベース状態に適用
//   3. Archer/Clericは BaseAI ヘルパーの行動優先ロジックを利用
//
// 評価関数改善:
//   - Archerが高地にいる場合 +5点
//   - Clericが味方の近くにいる場合 +3点
class MinMaxAI extends BaseAI {
  constructor(owner, gameState) {
    super(owner, gameState);
    this.oppOwner = owner === 'player' ? 'cpu' : 'player';
    // ユニット種別ごとの評価基準値
    this.unitBaseValues = { Knight: 10, Scout: 6, Archer: 8, Cleric: 5 };
  }

  decideActions() {
    return this._planOnClone((baseState, baseResolver) => {
      const actions = [];

      // ユニットを優先度順にソート: Knight → Archer → Scout → Cleric
      const allUnits = baseState.getAliveUnits(this.owner);
      const prioritized = this._prioritizeUnits(allUnits);
      const attackedTargetIds  = new Set(); // 集中攻撃: 今ターン攻撃済みターゲットのID
      const assignedTerrCounts = {};        // 部隊分散: 陣地別の割り当て済みユニット数

      for (const unit of prioritized) {
        // 反撃で死んでいる場合はスキップ
        if (!unit.isAlive) continue;

        if (unit.type === 'Cleric') {
          // Clericは回復優先（BaseAIヘルパー）。フォールバックは分散を考慮した最適目標
          const fallback = this._getBestMoveTarget(unit, baseState, this.owner, assignedTerrCounts);
          this._planClericActions(unit, baseState, baseResolver, actions, fallback);
          // 移動先の陣地をカウントに記録
          this._recordTerrAssignment(actions, baseState, assignedTerrCounts);

        } else if (unit.type === 'Archer') {
          // Archerは攻撃優先（移動後攻撃不可のため）
          if (!unit.hasAttacked) {
            const attackable = baseResolver.getAttackableTargets(unit.id);
            if (attackable.length > 0) {
              const target = this._selectFocusTarget(unit, attackable, attackedTargetIds);
              baseResolver.attackUnit(unit.id, target.id);
              actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
              attackedTargetIds.add(target.id);
              continue; // 攻撃後は移動しない
            }
          }
          // 攻撃できない場合: 撤退 or lookahead最善移動（分散考慮）
          if (!unit.hasMoved) {
            let movePos;
            if (this._needsRetreat(unit, baseState, this.owner)) {
              movePos = this._getRetreatMovePos(unit, baseState, baseResolver);
            } else {
              movePos = this._chooseBestMove(unit, baseState, baseResolver, assignedTerrCounts);
            }
            if (movePos) {
              baseResolver.moveUnit(unit.id, movePos.x, movePos.y);
              actions.push({ type: 'move', unitId: unit.id, toX: movePos.x, toY: movePos.y });
              const t = baseState.map.getTerritoryAt(movePos.x, movePos.y);
              if (t) assignedTerrCounts[t] = (assignedTerrCounts[t] || 0) + 1;
            }
          }

        } else {
          // Knight / Scout: 撤退 or lookahead最善移動（分散考慮）→ 集中攻撃
          if (!unit.hasMoved) {
            let movePos;
            if (this._needsRetreat(unit, baseState, this.owner)) {
              movePos = this._getRetreatMovePos(unit, baseState, baseResolver);
            } else {
              movePos = this._chooseBestMove(unit, baseState, baseResolver, assignedTerrCounts);
            }
            if (movePos) {
              baseResolver.moveUnit(unit.id, movePos.x, movePos.y);
              actions.push({ type: 'move', unitId: unit.id, toX: movePos.x, toY: movePos.y });
              const t = baseState.map.getTerritoryAt(movePos.x, movePos.y);
              if (t) assignedTerrCounts[t] = (assignedTerrCounts[t] || 0) + 1;
            }
          }

          // 集中攻撃（撃破狙い・既攻撃済みターゲット優先）
          if (!unit.hasAttacked) {
            const attackable = baseResolver.getAttackableTargets(unit.id);
            if (attackable.length > 0) {
              const target = this._selectFocusTarget(unit, attackable, attackedTargetIds);
              baseResolver.attackUnit(unit.id, target.id);
              actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
              attackedTargetIds.add(target.id);
            }
          }
        }
      }

      return actions;
    });
  }

  // 直近のmoveアクションの移動先陣地をassignedTerrCountsに記録する
  _recordTerrAssignment(actions, state, assignedTerrCounts) {
    for (let i = actions.length - 1; i >= 0; i--) {
      const a = actions[i];
      if (a.type === 'move') {
        const t = state.map.getTerritoryAt(a.toX, a.toY);
        if (t) assignedTerrCounts[t] = (assignedTerrCounts[t] || 0) + 1;
        break;
      }
      if (a.type !== 'heal') break; // healの前まで遡る
    }
  }

  // ──────────────────────────────────────────────────────────────
  // ユニット優先度順ソート: Knight → Archer → Scout → Cleric
  // ──────────────────────────────────────────────────────────────
  _prioritizeUnits(units) {
    const order = { Knight: 0, Archer: 1, Scout: 2, Cleric: 3 };
    return [...units].sort((a, b) => (order[a.type] ?? 4) - (order[b.type] ?? 4));
  }

  // ──────────────────────────────────────────────────────────────
  // lookaheadで最善の移動先を選択（部隊分散を考慮）
  // 即時スコアで上位10手に絞り、各候補をクローン上でevaluate
  // @param assignedTerrCounts 陣地別の割り当て済みユニット数（輻輳ペナルティ用）
  // ──────────────────────────────────────────────────────────────
  _chooseBestMove(unit, state, resolver, assignedTerrCounts = {}) {
    const moves = resolver.getMovablePositions(unit.id);
    if (moves.length === 0) return null;

    // ホールディング判定: 自軍支配中の陣地に守備として留まる
    // ownCount <= 1: 自分1体のみなら守備継続（2体以上いれば1体は前進してよい）
    const currentTerr = state.map.getTerritoryAt(unit.position.x, unit.position.y);
    if (currentTerr) {
      const terManager = new TerritoryManager(state);
      const cs = terManager.getTerritoryStatus(currentTerr);
      const ownCount = this.owner === 'player' ? cs.playerSquares : cs.cpuSquares;
      if (cs.controller === this.owner && ownCount <= 1) return null;
    }

    // 即時スコア（陣地価値 + 挟み撃ちボーナス - 輻輳ペナルティ）で上位10手に絞る
    const scored = moves.map(pos => {
      const terrName = state.map.getTerritoryAt(pos.x, pos.y);
      const crowdPenalty = terrName ? (assignedTerrCounts[terrName] || 0) * 20 : 0;
      return {
        pos,
        immediateScore: this._scoreMoveAction(unit, pos, state)
                      + this._getFlankingBonus(pos, state)
                      - crowdPenalty,
      };
    });
    scored.sort((a, b) => b.immediateScore - a.immediateScore);
    const top10 = scored.slice(0, 10);

    // 各候補をクローン上でevaluate（lookahead）
    let bestScore = -Infinity;
    let bestPos   = top10[0].pos;

    for (const { pos } of top10) {
      const simState    = state.clone();
      const simResolver = new ActionResolver(simState);
      simResolver.moveUnit(unit.id, pos.x, pos.y);
      const score = this._evaluate(simState);
      if (score > bestScore) {
        bestScore = score;
        bestPos   = pos;
      }
    }

    return bestPos;
  }

  // 撤退時の移動先座標を返す
  _getRetreatMovePos(unit, state, resolver) {
    const retreatTarget = this._getRetreatTarget(unit, state, this.owner);
    if (!retreatTarget) return null;
    const moves = resolver.getMovablePositions(unit.id);
    if (moves.length === 0) return null;
    return moves.reduce((a, b) =>
      this._manhattan(a, retreatTarget) < this._manhattan(b, retreatTarget) ? a : b
    );
  }

  // ──────────────────────────────────────────────────────────────
  // スコアリング（移動先評価）
  // ──────────────────────────────────────────────────────────────

  // 移動先の即時スコア（陣地優先）
  // - 未支配/敵支配陣地: 100（奪取最優先）
  // - 自軍支配で守備1体以下: 50（増援価値あり）
  // - 自軍支配で守備2体以上: 0（既に安定）
  _scoreMoveAction(unit, pos, state) {
    const territory = state.map.getTerritoryAt(pos.x, pos.y);
    if (territory) {
      const terManager = new TerritoryManager(state);
      const status = terManager.getTerritoryStatus(territory);
      if (status.controller !== this.owner) return 100;
      // 自軍支配中でも守備が薄い場合は増援価値を付与
      const ownCount = this.owner === 'player' ? status.playerSquares : status.cpuSquares;
      if (ownCount <= 1) return 30;
      return 0;
    }

    const terManager = new TerritoryManager(state);
    let bestTerScore = null;
    for (const [name, { x: ox, y: oy }] of Object.entries(state.map.territories)) {
      const status = terManager.getTerritoryStatus(name);
      if (status.controller === this.owner) continue;
      const center = { x: ox + 1, y: oy + 1 };
      const dist   = this._manhattan(pos, center);
      const score  = 60 - dist;
      if (bestTerScore === null || score > bestTerScore) bestTerScore = score;
    }
    if (bestTerScore !== null) return bestTerScore;

    const enemies = state.getAliveUnits(this.oppOwner);
    if (enemies.length === 0) return 0;
    const nearest = enemies.reduce((a, b) =>
      this._manhattan(pos, a.position) < this._manhattan(pos, b.position) ? a : b
    );
    return -this._manhattan(pos, nearest.position) - 50;
  }

  // ──────────────────────────────────────────────────────────────
  // 状態評価関数（自分有利が正）
  // 陣地支配: ±30点 + 占有マス差×5点、ユニット価値: HP割合×基準値
  // Phase 3追加: Archer高地 +5点、Cleric隊形維持 +3点
  // ──────────────────────────────────────────────────────────────
  _evaluate(state) {
    let score = 0;

    // 陣地スコア（支配ボーナス＋占有マス数差）
    const terManager = new TerritoryManager(state);
    for (const name of Object.keys(state.map.territories)) {
      const status   = terManager.getTerritoryStatus(name);
      const myCount  = this.owner === 'player' ? status.playerSquares : status.cpuSquares;
      const oppCount = this.owner === 'player' ? status.cpuSquares : status.playerSquares;

      if (status.controller === this.owner)         score += 30;
      else if (status.controller === this.oppOwner) score -= 30;

      score += (myCount - oppCount) * 5;
    }

    // ユニット価値スコア（HP割合×基準値）
    for (const unit of state.getAliveUnits()) {
      const baseVal = this.unitBaseValues[unit.type] || 5;
      const value   = (unit.hp / unit.maxHp) * baseVal;
      if (unit.owner === this.owner) score += value;
      else                           score -= value;
    }

    // 撃破ボーナス: 敵ユニット撃破 +20点、味方損失 -20点
    const deadEnemies = state.units.filter(u => u.owner === this.oppOwner && !u.isAlive).length;
    const deadAllies  = state.units.filter(u => u.owner === this.owner    && !u.isAlive).length;
    score += (deadEnemies - deadAllies) * 20;

    // Archerが高地にいる場合 +5点（高地ボーナスを受けやすい位置取り）
    for (const archer of state.getAliveUnits(this.owner).filter(u => u.type === 'Archer')) {
      if (state.map.isHighGround(archer.position.x, archer.position.y)) {
        score += 5;
      }
    }

    // Clericが味方の近く（チェビシェフ距離2以内）にいる場合 +3点（隊形維持）
    for (const cleric of state.getAliveUnits(this.owner).filter(u => u.type === 'Cleric')) {
      score += this._getFormationBonus(cleric.position, state);
    }

    return score;
  }

  // ──────────────────────────────────────────────────────────────
  // ユーティリティ
  // ──────────────────────────────────────────────────────────────

  // 撤退判定: HP60%以下 かつ チェビシェフ距離2以内に敵が存在する
  _needsRetreat(unit, state, owner) {
    if (unit.hp / unit.maxHp > 0.6) return false;
    const oppOwner = owner === 'player' ? 'cpu' : 'player';
    return state.getAliveUnits(oppOwner).some(e =>
      Math.max(Math.abs(e.position.x - unit.position.x),
               Math.abs(e.position.y - unit.position.y)) <= 2
    );
  }

  // 撤退目標: 最も近い味方Cleric → なければホーム陣地中心
  _getRetreatTarget(unit, state, owner) {
    const allies  = state.getAliveUnits(owner);
    const clerics = allies.filter(a => a.type === 'Cleric' && a.id !== unit.id);
    if (clerics.length > 0) {
      return clerics.reduce((a, b) =>
        this._manhattan(unit.position, a.position) < this._manhattan(unit.position, b.position) ? a : b
      ).position;
    }
    const homeTerr = owner === 'player' ? 'territory_C' : 'territory_B';
    const { x: ox, y: oy } = state.map.territories[homeTerr];
    return { x: ox + 1, y: oy + 1 };
  }

  // 移動目標を返す: 陣地価値・距離・輻輳ペナルティで最適陣地を選ぶ（Clericフォールバック用）
  _getBestMoveTarget(unit, state, owner, assignedCounts = {}) {
    const terManager = new TerritoryManager(state);
    const oppOwner   = owner === 'player' ? 'cpu' : 'player';

    const currentTerr = state.map.getTerritoryAt(unit.position.x, unit.position.y);
    if (currentTerr) {
      const cs       = terManager.getTerritoryStatus(currentTerr);
      const ownCount = owner === 'player' ? cs.playerSquares : cs.cpuSquares;
      if (cs.controller === owner && ownCount <= 1) return null;
    }

    let bestTarget = null;
    let bestScore  = -Infinity;

    for (const [name, { x: ox, y: oy }] of Object.entries(state.map.territories)) {
      const status   = terManager.getTerritoryStatus(name);
      const ownCount = owner === 'player' ? status.playerSquares : status.cpuSquares;
      if (status.controller === owner && ownCount >= 2) continue;

      const terrVal  = status.controller === oppOwner ? 12
                     : status.controller === owner    ? 8
                     :                                  10;
      const assigned = assignedCounts[name] || 0;
      const center   = { x: ox + 1, y: oy + 1 };
      const dist     = this._manhattan(unit.position, center);
      const score    = terrVal * 5 - dist * 2 - assigned * 20;

      if (score > bestScore) {
        bestScore  = score;
        bestTarget = center;
      }
    }

    if (!bestTarget) {
      const enemies = state.getAliveUnits(oppOwner);
      if (enemies.length > 0) {
        bestTarget = enemies.reduce((a, b) =>
          this._manhattan(unit.position, a.position) < this._manhattan(unit.position, b.position) ? a : b
        ).position;
      }
    }

    return bestTarget;
  }

  // アクションをクローン状態に適用する
  _applyAction(action, state, resolver) {
    if (action.type === 'move')        resolver.moveUnit(action.unitId, action.toX, action.toY);
    else if (action.type === 'attack') resolver.attackUnit(action.unitId, action.targetId);
    else if (action.type === 'heal')   resolver.healUnit(action.unitId, action.targetId);
  }
}

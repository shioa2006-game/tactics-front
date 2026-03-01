// 陣地重視AI（Phase 4改良版）
// 基本戦略: 複数陣地への分散占拠でポイントを効率的に稼ぐ。
// 改良点:
//   - スティッキー割り当て: ユニット→陣地の割り当てをターン跨ぎで保持し、振動を防止
//   - 安全確保済み陣地の余剰ユニットを未確保陣地へ自動再配置
//   - Clericは前線ユニットへ追従し、負傷者が出たら即座に駆けつける
class TerritorialAI extends BaseAI {
  constructor(owner, gameState) {
    super(owner, gameState);
    this._stickyAssignments = {}; // unitId → terrName（ターン跨ぎで保持）
  }

  decideActions() {
    return this._planOnClone((clonedState, clonedResolver) => {
      const actions     = [];
      const units       = clonedState.getAliveUnits(this.owner);
      const oppOwner    = this.owner === 'player' ? 'cpu' : 'player';
      const territories = clonedState.map.territories;

      // スティッキー割り当てを更新（死亡クリア・再配置・新規割り当て）
      this._refreshStickyAssignments(units, territories, clonedState, oppOwner);

      const attackedTargetIds = new Set(); // 集中攻撃: 今ターン攻撃済みターゲットのID

      for (const unit of units) {
        // Clericはスティッキー割り当て対象外（動的に前線追従）
        const terrName    = unit.type !== 'Cleric' ? (this._stickyAssignments[unit.id] || null) : null;
        const terrEntry   = terrName ? territories[terrName] : null;
        const assignedPos = terrEntry ? { x: terrEntry.x + 1, y: terrEntry.y + 1 } : null;
        const assignedTerr = terrName;

        if (unit.type === 'Cleric') {
          // フォールバック: 前線ユニット（非Clericで最もマップ中心に近いユニット）の位置
          // 負傷者がいない場合でも前線付近に留まり、すぐに回復できる態勢を維持する
          const mapCenter = { x: 16, y: 16 };
          const frontline = clonedState.getAliveUnits(this.owner)
            .filter(u => u.id !== unit.id && u.type !== 'Cleric')
            .reduce((best, u) => {
              if (!best) return u;
              return this._manhattan(u.position, mapCenter) < this._manhattan(best.position, mapCenter)
                ? u : best;
            }, null);
          const fallbackPos = frontline ? frontline.position : null;
          this._planClericActions(unit, clonedState, clonedResolver, actions, fallbackPos);

        } else if (unit.type === 'Archer') {
          // Archerは攻撃優先（割り当て陣地内の敵を優先）、移動先は割り当て陣地
          if (!unit.hasAttacked) {
            const attackable = clonedResolver.getAttackableTargets(unit.id);
            if (attackable.length > 0) {
              // 割り当て陣地内の敵を優先してから集中攻撃判定
              const inTerritory = attackable.filter(u => {
                if (!assignedTerr) return false;
                const { x: ox, y: oy } = territories[assignedTerr];
                return u.position.x >= ox && u.position.x < ox + 3 &&
                       u.position.y >= oy && u.position.y < oy + 3;
              });
              const candidates = inTerritory.length > 0 ? inTerritory : attackable;
              const target = this._selectFocusTarget(unit, candidates, attackedTargetIds);
              clonedResolver.attackUnit(unit.id, target.id);
              actions.push({ type: 'attack', unitId: unit.id, targetId: target.id });
              attackedTargetIds.add(target.id);
              continue; // 攻撃後は移動しない
            }
          }
          if (assignedPos && !unit.hasMoved) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              const best = movable.reduce((a, b) =>
                this._manhattan(a, assignedPos) < this._manhattan(b, assignedPos) ? a : b
              );
              clonedResolver.moveUnit(unit.id, best.x, best.y);
              actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
            }
          }

        } else {
          // Knight / Scout: 割り当て陣地に向かいながら集中攻撃（挟み撃ちボーナスを考慮）
          if (assignedPos && !unit.hasMoved) {
            const movable = clonedResolver.getMovablePositions(unit.id);
            if (movable.length > 0) {
              const best = movable.reduce((a, b) => {
                const sa = -this._manhattan(a, assignedPos) + this._getFlankingBonus(a, clonedState);
                const sb = -this._manhattan(b, assignedPos) + this._getFlankingBonus(b, clonedState);
                return sa > sb ? a : b;
              });
              clonedResolver.moveUnit(unit.id, best.x, best.y);
              actions.push({ type: 'move', unitId: unit.id, toX: best.x, toY: best.y });
            }
          }

          if (!unit.hasAttacked) {
            const attackable = clonedResolver.getAttackableTargets(unit.id);
            if (attackable.length > 0) {
              // 割り当て陣地内の敵を優先してから集中攻撃判定
              const inTerritory = attackable.filter(u => {
                if (!assignedTerr) return false;
                const { x: ox, y: oy } = territories[assignedTerr];
                return u.position.x >= ox && u.position.x < ox + 3 &&
                       u.position.y >= oy && u.position.y < oy + 3;
              });
              const candidates = inTerritory.length > 0 ? inTerritory : attackable;
              const target = this._selectFocusTarget(unit, candidates, attackedTargetIds);
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

  // スティッキー割り当てを更新する
  // 1. 死亡ユニットのクリア
  // 2. 陣地を敵に奪われたユニット → 強制再割り当て
  // 3. 安全確保済み陣地内の余剰ユニット → 1ターン1体ずつ漸次再配置（ガリソン2体維持）
  // 4. 未割り当て戦闘ユニットへの新規割り当て
  _refreshStickyAssignments(units, territories, state, oppOwner) {
    const terManager = new TerritoryManager(state);

    // 1. 死亡ユニットの割り当てをクリア
    const aliveNonClericIds = new Set(
      units.filter(u => u.type !== 'Cleric').map(u => u.id)
    );
    for (const id of Object.keys(this._stickyAssignments)) {
      if (!aliveNonClericIds.has(id)) delete this._stickyAssignments[id];
    }

    // 2 & 3. 既存割り当ての有効性チェック
    const combatUnits = units.filter(u => u.type !== 'Cleric');
    // 3用: 1ターンに1陣地から離脱させるユニットは1体まで（全員一斉離脱による陣地空白を防ぐ）
    const redirectedFrom = new Set();
    for (const unit of combatUnits) {
      const terrName = this._stickyAssignments[unit.id];
      if (!terrName) continue;

      const { x: ox, y: oy } = territories[terrName];
      const status   = terManager.getTerritoryStatus(terrName);
      const ownCount = this.owner === 'player' ? status.playerSquares : status.cpuSquares;

      // 2. 陣地が敵に奪われた → 強制再割り当て
      if (status.controller === oppOwner) {
        delete this._stickyAssignments[unit.id];
        continue;
      }

      // 3. 自軍支配かつownCount>=3の陣地内にいる余剰ユニット → 1ターン1体ずつ漸次再配置
      // ownCount>=3 を条件にして、離脱後も最低2体のガリソンを確保する
      if (status.controller === this.owner && ownCount >= 3 && !redirectedFrom.has(terrName)) {
        const inTerritory = unit.position.x >= ox && unit.position.x < ox + 3 &&
                            unit.position.y >= oy && unit.position.y < oy + 3;
        if (inTerritory) {
          const hasUnsecured = Object.keys(territories).some(name => {
            if (name === terrName) return false;
            return terManager.getTerritoryStatus(name).controller !== this.owner;
          });
          if (hasUnsecured) {
            delete this._stickyAssignments[unit.id];
            redirectedFrom.add(terrName); // このターンはこの陣地から1体のみ離脱
          }
        }
      }
    }

    // 4. 未割り当て戦闘ユニットに新規割り当て
    const unassigned = combatUnits.filter(u => !this._stickyAssignments[u.id]);
    if (unassigned.length === 0) return;

    const territoryScores = this._scoreTerritories(territories, state, oppOwner);

    // 既割り当て分のカウント
    const assignedCount = {};
    for (const unit of combatUnits) {
      const name = this._stickyAssignments[unit.id];
      if (name) assignedCount[name] = (assignedCount[name] || 0) + 1;
    }

    for (const unit of unassigned) {
      // 安全確保済みの現在陣地は除外（そこから出るべきユニットなので）
      const currentTerr = this._getTerrNameAtPos(unit.position, territories);

      let bestTerr  = null;
      let bestScore = -Infinity;
      for (const [name, { x: ox, y: oy }] of Object.entries(territories)) {
        // 安全確保済みの現在陣地は除外
        if (name === currentTerr) {
          const st = terManager.getTerritoryStatus(name);
          const oc = this.owner === 'player' ? st.playerSquares : st.cpuSquares;
          if (st.controller === this.owner && oc >= 2) continue;
        }
        const center = { x: ox + 1, y: oy + 1 };
        const dist   = this._manhattan(unit.position, center);
        const crowd  = assignedCount[name] || 0;
        const score  = territoryScores[name] * 5 - dist * 2 - crowd * 20;
        if (score > bestScore) { bestScore = score; bestTerr = name; }
      }
      if (bestTerr) {
        this._stickyAssignments[unit.id] = bestTerr;
        assignedCount[bestTerr] = (assignedCount[bestTerr] || 0) + 1;
      }
    }
  }

  // 各陣地の重要度を計算する（TerritoryManagerによる正確な支配判定）
  _scoreTerritories(territories, state, oppOwner) {
    const scores     = {};
    const terManager = new TerritoryManager(state);
    for (const [name] of Object.entries(territories)) {
      const status   = terManager.getTerritoryStatus(name);
      const ownCount = this.owner === 'player' ? status.playerSquares : status.cpuSquares;
      let score;
      if (status.controller === this.owner) {
        // 自軍支配: 守備が十分(2マス以上)なら低優先、手薄なら維持優先
        score = ownCount >= 2 ? 2 : 8;
      } else if (status.controller === oppOwner) {
        // 敵支配: 奪還最優先
        score = 12;
      } else {
        // 中立: 標準優先度
        score = 10;
      }
      scores[name] = score;
    }
    return scores;
  }

  // 指定位置が含まれる陣地名を返す（territories はプレーンオブジェクト）
  _getTerrNameAtPos(pos, territories) {
    if (!pos) return null;
    for (const [name, { x: ox, y: oy }] of Object.entries(territories)) {
      if (pos.x >= ox && pos.x < ox + 3 && pos.y >= oy && pos.y < oy + 3) return name;
    }
    return null;
  }
}

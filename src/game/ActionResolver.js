// 移動・攻撃の処理を行うクラス
class ActionResolver {
  constructor(gameState) {
    this.gameState = gameState;
  }

  // ユニットを指定座標へ移動する。成功したらtrueを返す
  moveUnit(unitId, toX, toY) {
    const unit = this.gameState.getUnit(unitId);
    if (!unit || !unit.isAlive || unit.hasMoved) return false;

    const reachable = this.getMovablePositions(unitId);
    const canReach  = reachable.some(p => p.x === toX && p.y === toY);
    if (!canReach) return false;

    const from = { ...unit.position };
    unit.position = { x: toX, y: toY };
    unit.hasMoved = true;

    this.gameState.logs.push({
      turn:   this.gameState.currentTurn,
      player: unit.owner,
      type:   'move',
      unitId,
      from,
      to: { x: toX, y: toY },
    });

    return true;
  }

  // attackerIdのユニットがtargetIdを攻撃する。成功したらtrueを返す
  attackUnit(attackerId, targetId) {
    const attacker = this.gameState.getUnit(attackerId);
    const target   = this.gameState.getUnit(targetId);
    if (!attacker || !target)           return false;
    if (!attacker.isAlive || !target.isAlive) return false;
    if (!attacker.canAttack(target))    return false;

    const damage = this._calcAttackPower(attacker);
    target.takeDamage(damage);
    attacker.hasAttacked = true;

    this.gameState.logs.push({
      turn:         this.gameState.currentTurn,
      player:       attacker.owner,
      type:         'attack',
      unitId:       attackerId,
      targetId,
      damage,
      targetHpAfter: target.hp,
      targetKilled:  !target.isAlive,
    });

    // 反撃処理: 攻撃を受けたユニットが生存しており反撃可能な場合
    if (target.isAlive && this._canCounterAttack(target, attacker)) {
      const counterDamage = Math.floor(target.attack * 0.5);
      attacker.takeDamage(counterDamage);
      this.gameState.logs.push({
        turn:          this.gameState.currentTurn,
        player:        target.owner,
        type:          'counter_attack',
        unitId:        targetId,
        targetId:      attackerId,
        damage:        counterDamage,
        targetHpAfter: attacker.hp,
        targetKilled:  !attacker.isAlive,
      });
    }

    return true;
  }

  // 反撃可能かどうかを判定する
  _canCounterAttack(counterUnit, originalAttacker) {
    // Knight・Scoutのみ反撃可能
    if (!['Knight', 'Scout'].includes(counterUnit.type)) return false;
    // 攻撃者がチェビシェフ距離1以内にいること（Archerの射程外攻撃には反撃不可）
    const dx = Math.abs(counterUnit.position.x - originalAttacker.position.x);
    const dy = Math.abs(counterUnit.position.y - originalAttacker.position.y);
    return Math.max(dx, dy) <= 1;
  }

  // Clericが味方ユニットを回復する。成功したらtrueを返す
  healUnit(clericId, targetId) {
    const cleric = this.gameState.getUnit(clericId);
    const target = this.gameState.getUnit(targetId);
    if (!cleric || !target)                   return false;
    if (!cleric.isAlive || !target.isAlive)   return false;
    if (cleric.type !== 'Cleric')             return false;
    if (cleric.hasHealed)                     return false;
    if (cleric.id === targetId)               return false; // 自分自身は回復不可
    if (cleric.owner !== target.owner)        return false; // 味方のみ対象

    const dx = Math.abs(cleric.position.x - target.position.x);
    const dy = Math.abs(cleric.position.y - target.position.y);
    if (Math.max(dx, dy) > 1) return false; // チェビシェフ距離1マス以内

    const healAmount    = 4;
    target.hp           = Math.min(target.hp + healAmount, target.maxHp);
    cleric.hasHealed    = true;

    this.gameState.logs.push({
      turn:        this.gameState.currentTurn,
      player:      cleric.owner,
      type:        'heal',
      unitId:      clericId,
      targetId,
      healAmount,
      targetHpAfter: target.hp,
    });

    return true;
  }

  // 回復可能な味方ユニット一覧を返す（Cleric専用）
  getHealableTargets(unitId) {
    const unit = this.gameState.getUnit(unitId);
    if (!unit || !unit.isAlive) return [];
    if (unit.type !== 'Cleric') return [];
    if (unit.hasHealed) return [];

    return this.gameState.getAliveUnits().filter(u => {
      if (u.id === unitId) return false;          // 自分自身は対象外
      if (u.owner !== unit.owner) return false;  // 敵は対象外
      const dx = Math.abs(unit.position.x - u.position.x);
      const dy = Math.abs(unit.position.y - u.position.y);
      return Math.max(dx, dy) <= 1;
    });
  }

  // 攻撃力を計算する（高地ボーナスを含む）
  _calcAttackPower(attacker) {
    let power = attacker.attack;
    if (attacker.type === 'Archer' &&
        this.gameState.map.isHighGround(attacker.position.x, attacker.position.y)) {
      power += 2;
    }
    return power;
  }

  // Dijkstraで移動可能マスの一覧を返す
  getMovablePositions(unitId) {
    const unit = this.gameState.getUnit(unitId);
    if (!unit || !unit.isAlive || unit.hasMoved) return [];

    const map       = this.gameState.map;
    const { x: sx, y: sy } = unit.position;
    const moveRange = unit.moveRange;

    // 敵・味方の位置セットを構築
    const enemyPos = new Set();
    const allyPos  = new Set();
    for (const u of this.gameState.getAliveUnits()) {
      if (u.id === unitId) continue;
      const key = `${u.position.x},${u.position.y}`;
      if (u.owner === unit.owner) allyPos.add(key);
      else                        enemyPos.add(key);
    }

    // Dijkstra（コストが1か2しかないため高速に動作する）
    // 距離を2次元配列で管理（new Map()とクラス名が衝突しないよう配列を使用）
    const dist = Array.from({ length: map.height }, () =>
      Array(map.width).fill(Infinity)
    );
    dist[sy][sx] = 0;

    // [cost, x, y] のキュー（単純な配列 + sort で実装、小マップ向け）
    const queue    = [[0, sx, sy]];
    const reachable = [];

    const dx4 = [0, 0, 1, -1];
    const dy4 = [1, -1, 0, 0];

    while (queue.length > 0) {
      // 最小コスト要素を取り出す
      queue.sort((a, b) => a[0] - b[0]);
      const [cost, x, y] = queue.shift();

      // 既により短い経路で処理済みならスキップ
      if (dist[y][x] < cost) continue;

      // スタート以外で停止可能なマスとして追加
      if (!(x === sx && y === sy)) {
        const key = `${x},${y}`;
        if (!enemyPos.has(key) && !allyPos.has(key)) {
          reachable.push({ x, y });
        }
      }

      for (let d = 0; d < 4; d++) {
        const nx = x + dx4[d];
        const ny = y + dy4[d];
        if (!map.isInBounds(nx, ny)) continue;

        const moveCost = map.getMoveCost(nx, ny);
        if (!isFinite(moveCost)) continue; // 壁は通過不可

        if (enemyPos.has(`${nx},${ny}`)) continue; // 敵のいるマスは通過不可

        const newCost = cost + moveCost;
        if (newCost > moveRange) continue;

        if (dist[ny][nx] > newCost) {
          dist[ny][nx] = newCost;
          queue.push([newCost, nx, ny]);
        }
      }
    }

    return reachable;
  }

  // 攻撃可能なターゲット一覧を返す
  getAttackableTargets(unitId) {
    const unit = this.gameState.getUnit(unitId);
    if (!unit || !unit.isAlive || unit.hasAttacked) return [];
    return this.gameState.getAliveUnits()
      .filter(u => u.owner !== unit.owner && unit.canAttack(u));
  }
}

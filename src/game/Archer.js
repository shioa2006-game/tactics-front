// Archerユニット
// 特殊能力:
//   - 射程3〜4マス（チェビシェフ距離、近すぎると攻撃不可）
//   - 高地ボーナス: 高地マスにいると攻撃力+2（ActionResolverで計算）
//   - 移動後攻撃不可: 同一ターン内に移動した場合はcanAttack()がfalseを返す
class Archer extends Unit {
  constructor(id, owner, x, y) {
    super(id, owner, x, y);
    this.type        = 'Archer';
    this.hp          = 8;
    this.maxHp       = 8;
    this.attack      = 6;  // 基本攻撃力（高地ボーナス時は+2で合計8）
    this.moveRange   = 3;
    this.attackRange = 4;  // チェビシェフ距離の最大射程（最小は3）
  }

  // 攻撃可能か判定（Archerは射程3〜4 かつ移動後攻撃不可）
  canAttack(target) {
    if (!this.isAlive || !target.isAlive) return false;
    if (this.owner === target.owner) return false;
    if (this.hasAttacked) return false;
    if (this.hasMoved) return false; // 移動後は攻撃不可
    const dx = Math.abs(this.position.x - target.position.x);
    const dy = Math.abs(this.position.y - target.position.y);
    const dist = Math.max(dx, dy);
    return dist >= 3 && dist <= this.attackRange; // 射程3〜4
  }
}

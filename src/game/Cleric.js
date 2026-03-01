// Clericユニット（回復専用）
// 特殊能力:
//   - 攻撃行動を持たない（canAttack()は常にfalse）
//   - 回復魔法: チェビシェフ距離1マス以内の味方ユニット1体のHPを4回復
//   - 移動と回復を同一ターン内に両方実行可能
//   - 行動フラグは hasAttacked の代わりに hasHealed を使用
class Cleric extends Unit {
  constructor(id, owner, x, y) {
    super(id, owner, x, y);
    this.type        = 'Cleric';
    this.hp          = 6;
    this.maxHp       = 6;
    this.attack      = 0;  // 攻撃力なし
    this.moveRange   = 2;
    this.attackRange = 0;  // 射程なし
  }

  // Clericは攻撃不可
  canAttack(target) {
    return false;
  }
}

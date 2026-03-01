// ユニットの基底クラス
class Unit {
  constructor(id, owner, x, y) {
    this.id          = id;      // ユニット固有ID
    this.owner       = owner;   // "player" または "cpu"
    this.position    = { x, y };
    this.type        = 'Unit';  // サブクラスで上書き
    this.hp          = 0;       // サブクラスで設定
    this.maxHp       = 0;
    this.attack      = 0;       // 攻撃力（固定値）
    this.moveRange   = 0;       // 移動力（マス数）
    this.attackRange = 0;       // 射程（チェビシェフ距離）
    this.isAlive     = true;
    this.hasMoved    = false;   // このターンに移動済みフラグ
    this.hasAttacked = false;   // このターンに攻撃済みフラグ
    this.hasHealed   = false;   // このターンに回復済みフラグ（Cleric専用）
  }

  // ダメージを受ける。HPが0以下でisAliveをfalseに
  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
    }
  }

  // 指定ユニットを攻撃可能か判定（チェビシェフ距離）
  canAttack(target) {
    if (!this.isAlive || !target.isAlive) return false;
    if (this.owner === target.owner) return false;
    if (this.hasAttacked) return false;
    const dx = Math.abs(this.position.x - target.position.x);
    const dy = Math.abs(this.position.y - target.position.y);
    return Math.max(dx, dy) <= this.attackRange;
  }

  // ターンフラグをリセット
  resetTurnFlags() {
    this.hasMoved    = false;
    this.hasAttacked = false;
    this.hasHealed   = false;
  }
}

// Knightユニット（騎士）
class Knight extends Unit {
  constructor(id, owner, x, y) {
    super(id, owner, x, y);
    this.type        = 'Knight';
    this.maxHp       = 13;
    this.hp          = 13;
    this.attack      = 9;
    this.moveRange   = 3;
    this.attackRange = 1;
  }
}

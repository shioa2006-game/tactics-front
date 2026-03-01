// Scoutユニット（斥候）
class Scout extends Unit {
  constructor(id, owner, x, y) {
    super(id, owner, x, y);
    this.type        = 'Scout';
    this.maxHp       = 5;
    this.hp          = 5;
    this.attack      = 4;
    this.moveRange   = 6;
    this.attackRange = 1;
  }
}

// 陣地の状態判定とポイント計算を行うクラス
class TerritoryManager {
  constructor(gameState) {
    this.gameState = gameState;
  }

  // 指定陣地の占拠状況を返す
  // 戻り値: { controller: "player"/"cpu"/"contested"/"none", playerSquares, cpuSquares }
  getTerritoryStatus(territoryName) {
    const squares = this.gameState.map.getTerritorySquares(territoryName);
    let playerSquares = 0;
    let cpuSquares    = 0;

    for (const { x, y } of squares) {
      const units = this.gameState.getUnitsAt(x, y);
      for (const unit of units) {
        if (unit.owner === 'player') playerSquares++;
        else if (unit.owner === 'cpu') cpuSquares++;
      }
    }

    let controller = 'none';
    if      (playerSquares > 0 && cpuSquares === 0) controller = 'player';
    else if (cpuSquares > 0 && playerSquares === 0) controller = 'cpu';
    else if (playerSquares > 0 && cpuSquares > 0)   controller = 'contested';

    return { controller, playerSquares, cpuSquares };
  }

  // 全陣地のポイントを計算してGameStateのscoresに反映する
  calculatePoints() {
    for (const territoryName of Object.keys(this.gameState.map.territories)) {
      const status = this.getTerritoryStatus(territoryName);

      if (status.controller === 'player') {
        this.gameState.scores.player++;
        this.gameState.logs.push({
          turn:           this.gameState.currentTurn,
          player:         this.gameState.currentPlayer,
          type:           'territory',
          territoryName,
          controller:     'player',
          pointsAwarded:  1,
        });
      } else if (status.controller === 'cpu') {
        this.gameState.scores.cpu++;
        this.gameState.logs.push({
          turn:           this.gameState.currentTurn,
          player:         this.gameState.currentPlayer,
          type:           'territory',
          territoryName,
          controller:     'cpu',
          pointsAwarded:  1,
        });
      }
    }
  }

  // 全陣地の状態を返す
  getAllTerritoryStatuses() {
    const result = {};
    for (const territoryName of Object.keys(this.gameState.map.territories)) {
      result[territoryName] = this.getTerritoryStatus(territoryName);
    }
    return result;
  }
}

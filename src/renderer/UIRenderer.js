// スコア・ターン数などのUI描画を担当するクラス（ゲーム状態を変更しない）
class UIRenderer {
  constructor(gameState) {
    this.gameState = gameState;
  }

  // DOM上のUI要素をゲーム状態に合わせて更新する
  render() {
    const gs = this.gameState;

    document.getElementById('turn-display').textContent =
      `Turn ${gs.currentTurn} / 50`;

    document.getElementById('player-display').textContent =
      gs.isGameOver
        ? `Game Over: ${this._winnerText(gs.winner)}`
        : gs.currentPlayer === 'player' ? 'Player Turn' : 'CPU Turn';

    document.getElementById('score-display').textContent =
      `Player: ${gs.scores.player}  CPU: ${gs.scores.cpu}`;

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
      endTurnBtn.disabled =
        gs.currentPlayer !== 'player' || gs.isGameOver;
    }
  }

  // 勝者の表示文字列を返す
  _winnerText(winner) {
    if (winner === 'player') return 'Player Wins!';
    if (winner === 'cpu')    return 'CPU Wins!';
    return 'Draw!';
  }
}

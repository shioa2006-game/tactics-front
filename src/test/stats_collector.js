// 対戦結果の収集・集計クラス
class StatsCollector {
  constructor() {
    this.results = [];
  }

  // 1戦分の結果を記録する
  // result: { winner: "player"/"cpu"/"draw", turns: Number, scores: {player, cpu} }
  record(result) {
    this.results.push(result);
  }

  // 集計サマリーを返す
  getSummary() {
    const total = this.results.length;
    if (total === 0) return null;

    const playerWins     = this.results.filter(r => r.winner === 'player').length;
    const cpuWins        = this.results.filter(r => r.winner === 'cpu').length;
    const draws          = this.results.filter(r => r.winner === 'draw').length;
    const avgTurns       = this.results.reduce((s, r) => s + r.turns, 0) / total;
    // 50ターン完走 = currentTurnが51になってゲーム終了
    const completed      = this.results.filter(r => r.turns >= 50).length;

    // 平均スコア
    const avgPlayerScore = this.results.reduce((s, r) => s + r.scores.player, 0) / total;
    const avgCpuScore    = this.results.reduce((s, r) => s + r.scores.cpu, 0) / total;

    // バランス判定（引き分け除外の勝率が35〜65%ならバランス良）
    const nonDraws        = playerWins + cpuWins;
    const playerWinRateEx = nonDraws > 0 ? playerWins / nonDraws : 0.5;
    const isBalanced      = Math.abs(playerWinRateEx - 0.5) <= 0.15;

    // AIの組み合わせ名（複数の組み合わせが混在しないケースを想定）
    const playerAI = this.results[0]?.playerAI || '-';
    const cpuAI    = this.results[0]?.cpuAI    || '-';

    return {
      total,
      playerWins,
      cpuWins,
      draws,
      playerWinRate:  playerWins / total,
      cpuWinRate:     cpuWins    / total,
      drawRate:       draws      / total,
      avgTurns:       Math.round(avgTurns * 10) / 10,
      completionRate: completed  / total,
      avgPlayerScore: Math.round(avgPlayerScore * 10) / 10,
      avgCpuScore:    Math.round(avgCpuScore * 10) / 10,
      isBalanced,
      playerAI,
      cpuAI,
    };
  }

  // 結果をリセットする
  reset() {
    this.results = [];
  }
}

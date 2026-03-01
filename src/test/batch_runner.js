// バッチ対戦の制御クラス（Phase 2: 対戦組み合わせを選択可能に拡張）
class BatchRunner {
  constructor(onProgress, onComplete) {
    this.onProgress   = onProgress;  // (done, total) => void
    this.onComplete   = onComplete;  // (summary)     => void
    this.collector    = new StatsCollector();
    this.running      = false;
    // デフォルトのAI組み合わせ
    this.playerAIName = 'MinMaxAI';
    this.cpuAIName    = 'AggressiveAI';
  }

  // 対戦組み合わせを設定する
  setMatchup(playerAIName, cpuAIName) {
    this.playerAIName = playerAIName;
    this.cpuAIName    = cpuAIName;
  }

  // numGames戦のバッチ実行を開始する（setTimeoutで非同期に1戦ずつ処理）
  run(numGames) {
    this.running = true;
    this.collector.reset();
    let played = 0;

    const runNext = () => {
      if (!this.running || played >= numGames) {
        this.running = false;
        this.onComplete(this.collector.getSummary());
        return;
      }

      const result = this._runSingleGame();
      this.collector.record(result);
      played++;
      this.onProgress(played, numGames);
      setTimeout(runNext, 0); // UIスレッドをブロックしないよう1戦ごとに yield
    };

    runNext();
  }

  // 実行を中断する
  stop() {
    this.running = false;
  }

  // 1戦を同期で実行し結果を返す
  _runSingleGame() {
    const gameState   = new GameState();
    const playerAI    = this._createAI(this.playerAIName, 'player', gameState);
    const cpuAI       = this._createAI(this.cpuAIName,    'cpu',    gameState);
    const turnManager = new TurnManager(gameState, playerAI, cpuAI);

    turnManager.runFullGame();

    return {
      winner:    gameState.winner,
      turns:     gameState.currentTurn - 1, // インクリメント後の値なので -1
      scores:    { ...gameState.scores },
      playerAI:  this.playerAIName,
      cpuAI:     this.cpuAIName,
    };
  }

  // AI名からインスタンスを生成する
  _createAI(name, owner, gameState) {
    switch (name) {
      case 'RandomAI':      return new RandomAI(owner, gameState);
      case 'GreedyAI':      return new GreedyAI(owner, gameState);
      case 'AggressiveAI':  return new AggressiveAI(owner, gameState);
      case 'DefensiveAI':   return new DefensiveAI(owner, gameState);
      case 'TerritorialAI': return new TerritorialAI(owner, gameState);
      case 'MinMaxAI':      return new MinMaxAI(owner, gameState);
      default:              return new GreedyAI(owner, gameState);
    }
  }
}

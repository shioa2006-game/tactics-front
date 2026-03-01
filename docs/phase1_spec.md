# Phase 1 実装仕様書

## 目標

基本ゲームが最初から最後まで動作すること。手動プレイとAI自動対戦の両方が動く状態を作る。

## 成功指標

- ゲーム完走率: 100%（50ターンで必ず終了する）
- AI思考時間: 1秒以内
- 基本ルール動作: 正常
- 手動プレイ: クリック操作でユニットを動かせる
- 自動対戦: RandomAI vs GreedyAI が100戦完走する

---

## ファイル構成

```
/
├── index.html
├── test.html
└── src/
    ├── game/
    │   ├── GameState.js       ← ゲーム全体の状態管理
    │   ├── Map.js             ← マップデータ・地形管理
    │   ├── Unit.js            ← ユニットの基底クラス
    │   ├── Knight.js          ← Knightユニット
    │   ├── Scout.js           ← Scoutユニット
    │   ├── TurnManager.js     ← ターン進行管理
    │   ├── ActionResolver.js  ← 移動・攻撃の処理
    │   └── TerritoryManager.js← 陣地判定・ポイント計算
    ├── renderer/
    │   ├── GameRenderer.js    ← Canvas描画の統括
    │   ├── MapRenderer.js     ← マップ・地形の描画
    │   ├── UnitRenderer.js    ← ユニットの描画
    │   └── UIRenderer.js      ← スコア・ターン数などのUI描画
    ├── ai/
    │   ├── BaseAI.js          ← AIの基底クラス
    │   ├── RandomAI.js        ← ランダム行動AI
    │   └── GreedyAI.js        ← 1手先読みAI
    └── test/
        ├── batch_runner.js    ← バッチ実行の制御
        └── stats_collector.js ← データ収集・集計
```

---

## ゲームルール（Phase 1確定事項）

- ターン上限: 50ターン
- 勝利条件: 50ターン終了時のポイント数が多い方が勝利（同点は引き分け）
- ポイント獲得: 陣地を完全占拠したターンの終了時に1ポイント獲得
- 陣地ルール: 9マス（3×3）の陣地に敵ユニットが1マスでもいると占拠無効
- 編成: プレイヤー・CPU各4ユニット（Knight×2、Scout×2）

---

## マップ仕様

### 基本情報

- サイズ: 32×32グリッド（1024マス）
- 座標系: 左上を(0,0)とし、右方向にx、下方向にy
- セルサイズ: 20px（表示上）

### 地形種別

Phase 1では以下の3種のみ実装する。

| 種別 | 定数名 | 移動コスト | 備考 |
|---|---|---|---|
| 平地 | TERRAIN_PLAIN | 1 | 基本地形 |
| 森 | TERRAIN_FOREST | 2 | 移動コスト増加 |
| 壁 | TERRAIN_WALL | 移動不可 | 通過不可 |

### マップ生成

Phase 1では固定マップを使用する（ランダム生成は Phase 2以降）。
マップデータは Map.js 内に2次元配列として定義する。

### 陣地配置

4箇所に3×3の陣地を配置する。座標は以下の通り（左上隅の座標で定義）。

| 陣地名 | 左上座標 |
|---|---|
| territory_A | (3, 3) |
| territory_B | (26, 3) |
| territory_C | (3, 26) |
| territory_D | (26, 26) |

---

## ユニット仕様

### 共通仕様

全ユニットに共通するプロパティとメソッドを BaseUnit クラス（Unit.js）で定義する。

**共通プロパティ**
```
id          : ユニット固有ID（例: "player_knight_1"）
owner       : 所有者（"player" または "cpu"）
position    : 現在位置 {x, y}
hp          : 現在HP
maxHp       : 最大HP
attack      : 攻撃力（固定値）
moveRange   : 移動力（マス数）
attackRange : 射程（マス数）
isAlive     : 生存フラグ
hasMoved    : このターンに移動済みフラグ
hasAttacked : このターンに攻撃済みフラグ
```

**共通メソッド**
```
takeDamage(amount)  : ダメージを受ける。HPが0以下でisAliveをfalseに
canMoveTo(x, y)     : 指定マスに移動可能か判定
canAttack(target)   : 指定ユニットを攻撃可能か判定
getMovablePositions(): 移動可能なマス一覧を返す
getAttackableTargets(): 攻撃可能なユニット一覧を返す
resetTurnFlags()    : hasMoved・hasAttacked をfalseにリセット
```

### Knight（騎士）

```
攻撃力: 9（固定値）
最大HP: 13
移動力: 3マス
射程: 1マス（隣接のみ）
```

Phase 1では特殊能力なし。移動と攻撃は同一ターンに両方可能（移動後に攻撃できる）。

### Scout（斥候）

```
攻撃力: 4（固定値）
最大HP: 5
移動力: 6マス
射程: 1マス（隣接のみ）
```

Phase 1では特殊能力なし。移動と攻撃は同一ターンに両方可能。

---

## 移動システム仕様

- 移動はマンハッタン距離ではなく、実際の経路コストで計算する
- 経路探索: BFS（幅優先探索）で移動コスト内の到達可能マスを列挙する
- 壁（TERRAIN_WALL）は通過不可
- 敵ユニットが存在するマスは通過不可・停止不可
- 味方ユニットが存在するマスは通過可能だが停止不可
- 移動コストの合計が moveRange 以下のマスに移動できる

---

## 攻撃システム仕様

- 攻撃は移動後に実行可能（同一ターン内）
- 攻撃力は固定値（乱数なし）
- 攻撃対象のHPを攻撃力分減少させる
- HPが0以下になったユニットは除去し、マップから消える
- 反撃はなし（攻撃側のみダメージを与える）
- 射程はチェビシェフ距離（斜め方向も1マスとして計算）で判定する

---

## ターン進行仕様

### ターン構造

```
1. ターン開始
   - 全ユニットのturnFlagsをリセット
   - 陣地ポイント計算（前ターンの占拠状況を評価）

2. 行動フェーズ（現在のプレイヤーが全ユニットを操作）
   - 各ユニットは「移動」「攻撃」をそれぞれ1回ずつ実行可能
   - 行動順序はプレイヤーが任意に選択できる
   - 全ユニットが行動済みになるか、プレイヤーがターン終了を宣言したらフェーズ終了

3. ターン終了
   - ターン数をインクリメント
   - 50ターンに達した場合はゲーム終了
   - 次のプレイヤーのターンへ
```

### プレイヤー交互制

- プレイヤー → CPU の順でターンを交互に行う
- プレイヤーのターン: 手動操作（クリック）
- CPUのターン: AI が自動で全ユニットの行動を決定・実行

---

## クラス設計

### GameState.js

ゲーム全体の状態を保持する。描画処理・AI処理は行わない。

```javascript
class GameState {
  constructor()
  // プロパティ
  map          // Map インスタンス
  units        // Unit インスタンスの配列（全ユニット）
  currentTurn  // 現在のターン数（1始まり）
  currentPlayer// 現在の手番（"player" または "cpu"）
  scores       // { player: 0, cpu: 0 }
  isGameOver   // ゲーム終了フラグ
  winner       // 勝者（"player" / "cpu" / "draw" / null）
  logs         // ターンごとの行動ログ（配列）

  // メソッド
  getUnit(id)              // IDでユニットを取得
  getUnitsAt(x, y)         // 指定マスのユニットを取得
  getAliveUnits(owner)     // 生存ユニット一覧を取得
  applyAction(action)      // 行動を受け取って状態を更新
  checkGameOver()          // ゲーム終了判定
  getWinner()              // 勝者を返す
  clone()                  // 状態をディープコピー（AI用）
  toLog()                  // ログ出力用データを返す
}
```

### TurnManager.js

ターン進行を管理する。GameState を受け取って状態を変化させる。

```javascript
class TurnManager {
  constructor(gameState, playerAI, cpuAI)

  startGame()          // ゲーム開始
  nextTurn()           // 次のターンへ進める
  endPlayerTurn()      // プレイヤーのターン終了を宣言
  executeCpuTurn()     // CPUのターンを実行
  isGameOver()         // ゲーム終了か判定
}
```

### ActionResolver.js

移動・攻撃の処理を行う。GameState を更新する。

```javascript
class ActionResolver {
  constructor(gameState)

  moveUnit(unitId, toX, toY)         // ユニットを移動
  attackUnit(attackerId, targetId)   // ユニットが攻撃
  getMovablePositions(unitId)        // 移動可能マス一覧を返す
  getAttackableTargets(unitId)       // 攻撃可能ユニット一覧を返す
}
```

### TerritoryManager.js

陣地の状態判定とポイント計算を行う。

```javascript
class TerritoryManager {
  constructor(gameState)

  getTerritoryStatus(territoryName)  // 陣地の占拠状況を返す
  // 戻り値: { controller: "player"/"cpu"/"contested"/"none", playerSquares: 0, cpuSquares: 0 }
  calculatePoints()                  // ポイントを計算してGameStateに反映
  getAllTerritoryStatuses()           // 全陣地の状態を返す
}
```

---

## AI仕様

### BaseAI.js

全AIの基底クラス。

```javascript
class BaseAI {
  constructor(owner, gameState)
  // ownerは "player" または "cpu"

  decideActions()  // 全ユニットの行動リストを返す（サブクラスで実装）
  // 戻り値: [{ type: "move", unitId, toX, toY }, { type: "attack", unitId, targetId }, ...]
}
```

### RandomAI.js

全ユニットについてランダムに移動・攻撃を選択する。

```
行動決定ロジック:
1. 生存ユニットをランダムな順序で処理
2. 各ユニットについて移動可能マスがあればランダムに1つ選んで移動
3. 攻撃可能なターゲットがあればランダムに1つ選んで攻撃
```

### GreedyAI.js

最も近い敵ユニットに向かって移動し、射程内なら攻撃する。

```
行動決定ロジック:
1. 生存ユニットを順番に処理
2. 最も近い敵ユニットをマンハッタン距離で特定
3. その敵に最も近づく方向に移動
4. 攻撃可能なターゲットがあればHP最小の敵を攻撃
```

---

## 描画仕様

### index.html の構成

```html
- Canvasエリア（640px × 640px、32×32マス × 20px）
- ターン数表示
- 現在の手番表示（プレイヤー / CPU）
- スコア表示（プレイヤー / CPU）
- ターン終了ボタン（プレイヤーのターン中のみ有効）
- ゲームログ表示エリア（直近10件）
```

### GameRenderer.js

描画の統括。requestAnimationFrame でループする。

```javascript
class GameRenderer {
  constructor(canvas, gameState)

  render()          // 全描画処理を呼び出す
  startLoop()       // 描画ループ開始
  stopLoop()        // 描画ループ停止
}
```

### MapRenderer.js

```
描画内容:
- 各マスを地形種別に応じた色で塗りつぶす
  - 平地: #90EE90（薄緑）
  - 森: #228B22（濃緑）
  - 壁: #696969（グレー）
- 陣地エリアを半透明のオレンジで強調表示
- グリッド線を描画
- 選択中ユニットの移動可能マスをハイライト（薄青）
- 攻撃可能マスをハイライト（薄赤）
```

### UnitRenderer.js

```
描画内容:
- プレイヤーユニット: 青色の円
- CPUユニット: 赤色の円
- ユニット種別を円内にテキストで表示（K: Knight, S: Scout）
- HPバーをユニット下部に表示
- 行動済みユニットは半透明で表示
```

### UIRenderer.js

```
描画内容:
- ターン数（例: "Turn 12 / 50"）
- 現在の手番（例: "Player Turn"）
- スコア（例: "Player: 3  CPU: 2"）
```

---

## 操作仕様（手動プレイ）

プレイヤーのターン中のみ操作可能。CPUのターン中はクリック操作を無効にする。

```
1. ユニット選択
   - プレイヤーユニットをクリックで選択
   - 選択中は移動可能マスをハイライト表示

2. 移動
   - ハイライトされたマスをクリックで移動
   - 移動済みのユニットは移動不可（ハイライトなし）

3. 攻撃
   - 移動後、攻撃可能な敵ユニットをクリックで攻撃
   - 攻撃済みのユニットは攻撃不可

4. ターン終了
   - 「ターン終了」ボタンをクリックでプレイヤーターンを終了
   - CPUのターンが自動で実行される
```

---

## ログ仕様

ゲーム中に発生した行動を配列に記録する。test.htmlでのバッチ分析に使用する。

### 行動ログの形式

```json
{
  "turn": 15,
  "player": "cpu",
  "type": "move",
  "unitId": "cpu_knight_1",
  "from": {"x": 15, "y": 20},
  "to": {"x": 16, "y": 21}
}
```

```json
{
  "turn": 15,
  "player": "cpu",
  "type": "attack",
  "unitId": "cpu_knight_1",
  "targetId": "player_scout_2",
  "damage": 9,
  "targetHpAfter": 0,
  "targetKilled": true
}
```

```json
{
  "turn": 15,
  "player": "cpu",
  "type": "territory",
  "territoryName": "territory_A",
  "controller": "cpu",
  "pointsAwarded": 1
}
```

---

## test.html の仕様（Phase 1）

バッチテスト専用画面。ゲームの描画は行わない。

```
表示項目:
- 実行ボタン（「100戦実行」）
- 進捗表示（例: "50 / 100 完了"）
- 結果サマリー
  - 総対戦数
  - RandomAI 勝率
  - GreedyAI 勝率
  - 引き分け率
  - 平均ターン数
  - ゲーム完走率（50ターン到達率）
```

バッチ実行中はUIが固まらないよう、setTimeout を使って1戦ごとに非同期で処理する。

---

## 実装の優先順位

以下の順番で実装する。

1. Map.js（マップデータ定義）
2. Unit.js / Knight.js / Scout.js（ユニット定義）
3. GameState.js（状態管理）
4. ActionResolver.js（移動・攻撃処理）
5. TerritoryManager.js（陣地判定）
6. TurnManager.js（ターン進行）
7. RandomAI.js / GreedyAI.js（AI実装）
8. MapRenderer.js / UnitRenderer.js / UIRenderer.js（描画）
9. GameRenderer.js（描画統括）
10. index.html（操作・イベント処理）
11. batch_runner.js / stats_collector.js（バッチテスト）
12. test.html（バッチテスト画面）

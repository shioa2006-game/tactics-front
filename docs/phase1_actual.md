# Phase 1 実装実績ドキュメント

仕様書（docs/phase1_spec.md）と実際の実装（src/ 配下全ファイル + index.html）を照合した記録。

作成日: 2026-02-28

---

## 1. 仕様通りに実装された項目

### ゲームルール
- ターン上限: 50ターン（TurnManager: `currentTurn > 50` でゲーム終了）
- 勝利条件: ポイント数による勝敗・同点引き分け
- ポイント獲得: ターン終了時に陣地を占拠していれば1ポイント加算
- 陣地ルール: 9マス（3×3）に敵ユニットが1体でもいると占拠無効（controller = "contested"）
- 編成: プレイヤー・CPU各4ユニット（Knight×2、Scout×2）

### マップ仕様
- サイズ: 32×32グリッド（1024マス）
- 座標系: 左上(0,0)、右方向x、下方向y
- 地形3種: `TERRAIN_PLAIN(0)`/`TERRAIN_FOREST(1)`/`TERRAIN_WALL(2)` と定数名・移動コストすべて仕様通り
- 固定マップ（Map.js 内に `_createMap()` で定義）
- 陣地4箇所の座標: territory_A(3,3)、territory_B(26,3)、territory_C(3,26)、territory_D(26,26) すべて仕様通り
- 陣地エリアは必ず平地に強制（壁・森を上書き）

### ユニット仕様
- 共通プロパティ全9項目: `id`, `owner`, `position`, `hp`, `maxHp`, `attack`, `moveRange`, `attackRange`, `isAlive`, `hasMoved`, `hasAttacked`（すべて実装済み）
- `takeDamage(amount)`: HP減少・0以下で `isAlive = false`
- `canAttack(target)`: チェビシェフ距離での射程判定（斜め込み）
- `resetTurnFlags()`: `hasMoved`・`hasAttacked` をfalseにリセット
- Knight: HP13、ATK9、MV3、RNG1（仕様通り）
- Scout: HP5、ATK4、MV6、RNG1（仕様通り）
- 移動と攻撃は同一ターン内に両方可能

### 移動システム
- 実際の経路コストで計算（マンハッタン距離ではない）
- 壁（TERRAIN_WALL）は通過不可
- 敵ユニットが存在するマスは通過不可・停止不可
- 味方ユニットが存在するマスは通過可能・停止不可
- 移動コストの合計が `moveRange` 以下のマスに移動できる

### 攻撃システム
- 攻撃は移動後に実行可能（同一ターン内）
- 攻撃力は固定値（乱数なし）
- HPが0以下になったユニットは `isAlive = false` になりマップから消える
- 反撃なし（攻撃側のみダメージを与える）
- 射程判定: チェビシェフ距離（斜め方向も1マス）

### ターン進行
- プレイヤー → CPU の交互制
- CPUのターン: AIが自動で全ユニットの行動を決定・実行
- ターン終了ボタンでプレイヤーターン終了、CPUターンが自動実行される

### クラス設計
- GameState: `map`, `units`, `currentTurn`, `currentPlayer`, `scores`, `isGameOver`, `winner`, `logs` を保持
- GameState: `getUnit()`, `getUnitsAt()`, `getAliveUnits()`, `checkGameOver()`, `getWinner()`, `clone()`, `toLog()` を実装
- ActionResolver: `moveUnit()`, `attackUnit()`, `getMovablePositions()`, `getAttackableTargets()` を実装
- TerritoryManager: `getTerritoryStatus()`, `calculatePoints()`, `getAllTerritoryStatuses()` を実装
- TurnManager: `startGame()`, `endPlayerTurn()`, `executeCpuTurn()`, `isGameOver()` を実装

### AI仕様
- BaseAI: `decideActions()` インターフェース（サブクラスで実装）
- RandomAI: Fisher-Yatesシャッフルでランダム順処理、ランダム移動・攻撃
- GreedyAI: マンハッタン距離で最近敵に接近、HP最小の敵を攻撃（仕様通り）

### 描画仕様
- MapRenderer: 地形色（平地/森/壁）、陣地半透明オレンジ、グリッド線、移動可能マス薄青、攻撃可能マス薄赤
- UIRenderer: ターン数表示（"Turn N / 50"）、手番表示、スコア表示（DOMへの反映）
- UIRenderer: ターン終了ボタンの有効/無効切り替え
- GameRenderer: `requestAnimationFrame` ループ、`startLoop()`, `stopLoop()`

### ログ仕様
- move / attack / territory の3種類のログ形式をすべて仕様通りに実装
- `gameState.logs` に配列として蓄積

### バッチテスト（test.html）
- 100戦実行ボタン
- 進捗表示（"N / 100 完了"）
- 結果サマリー: 総対戦数・RandomAI勝率・GreedyAI勝率・引き分け率・平均ターン数・ゲーム完走率
- `setTimeout` による非同期ループ（UIスレッドをブロックしない）

---

## 2. 仕様から変更された項目

### セルサイズ・Canvasサイズ
| 項目 | 仕様 | 実装 |
|---|---|---|
| セルサイズ | 20px | **25px** |
| Canvasサイズ | 640×640px | **800×800px** |

**理由:** ユーザーからの変更要望。

---

### ユニットの初期配置（分散 → 1か所集結）
| 項目 | 仕様 | 実装 |
|---|---|---|
| プレイヤー配置 | 記載なし（暗黙的に分散） | **左下・陣地C に4体集結**（(3,27), (4,27), (5,26), (5,28)）|
| CPU配置 | 記載なし | **右上・陣地B に4体集結**（(26,4), (27,4), (28,3), (28,5)）|

**理由:** ユーザーからの変更要望（「1か所に集結、プレイヤーは左下、CPUは右上」）。

---

### 移動計算アルゴリズム（BFS → Dijkstra）
| 項目 | 仕様 | 実装 |
|---|---|---|
| アルゴリズム | BFS（幅優先探索） | **Dijkstra（コスト順優先）** |

**理由:** BFSは全辺コストが均一な場合にのみ正確に動作する。このゲームでは平地(コスト1)と森(コスト2)が混在するため、コスト順に展開するDijkstraを採用した。実装は小マップ向けにnaive sort（O(n log n)）で済ませている。

**補足:** `new Map()` のクラス名衝突を避けるため、距離管理に `new Map()` ではなく2次元配列を使用。

---

### UnitRenderer の描画方式（円+テキスト → 背景色マス+画像）
| 項目 | 仕様 | 実装 |
|---|---|---|
| 描画方式 | 青/赤の円 + 種別テキスト（K/S） | **背景色マス（青/赤）+ キャラクター画像（Knight.png/Scout.png）** |

**理由:** ユーザーからの変更要望（「/assets に画像を格納したので画像を使ってほしい」）。
画像ロード失敗時はテキスト（K/S）でフォールバック表示する。

---

### GameState.applyAction() の役割変更
| 項目 | 仕様 | 実装 |
|---|---|---|
| `applyAction(action)` | GameState のメソッドとして行動を受け取って状態を更新 | **メソッドなし**。代わりに ActionResolver が直接 GameState を更新する |

**理由:** 移動の妥当性チェック（到達可能マス判定）にはマップと他ユニット情報が必要で、ActionResolver にそのロジックをまとめる方が凝集度が高い。

---

### Unit クラスの移動・攻撃メソッドを ActionResolver に移動
| 仕様（Unit の共通メソッド） | 実装 |
|---|---|
| `canMoveTo(x, y)` | **未実装**（ActionResolver.getMovablePositions に統合） |
| `getMovablePositions()` | **未実装**（ActionResolver.getMovablePositions に移動） |
| `getAttackableTargets()` | **未実装**（ActionResolver.getAttackableTargets に移動） |

**理由:** これらのメソッドはマップデータや他ユニットの配置情報を参照する必要があり、GameState を持つ ActionResolver に実装する方が自然な設計。Unit クラスは純粋にユニットの属性のみを持つ形にした。

---

### TurnManager.nextTurn() の非公開化
| 仕様 | 実装 |
|---|---|
| `nextTurn()` を公開メソッドとして定義 | `_finishCurrentTurn()` というプライベートメソッドに統合（直接呼び出し不可）|

**理由:** プレイヤーターン終了・CPUターン終了・バッチ実行の3経路すべてで同一処理が必要なため、内部共通処理として `_finishCurrentTurn()` にまとめた。

---

## 3. 仕様にはなかったが追加実装された項目

### TurnManager.runFullGame()
AIとAIの対戦を最後まで同期的に実行するメソッド。バッチテスト（BatchRunner._runSingleGame）から呼び出される。仕様のバッチテスト動作を実現するために必要であったため追加。

---

### BatchRunner.stop() による中断機能
test.html に「中断ボタン」と対応する `stop()` メソッドを実装。バッチ実行中にいつでも中断できる。

---

### BaseAI._planOnClone() ヘルパー
AI の `decideActions()` はクローン上でシミュレーションしながら行動を決定し、実際の適用は TurnManager が行う設計を採用した。この仕組みを共通化するヘルパーとして BaseAI に追加。

```javascript
_planOnClone(planFn) {
  const clonedState    = this.gameState.clone();
  const clonedResolver = new ActionResolver(clonedState);
  return planFn(clonedState, clonedResolver);
}
```

**効果:** 複数ユニットを順番に処理する際、前のユニットの移動結果が次のユニットの判断に正しく反映される。

---

### GameRenderer.clearSelection()
選択状態（selectedUnitId / movablePositions / attackableTargets）を一括クリアするメソッド。index.html のイベントハンドラから頻繁に呼ばれるため追加。

---

### Map クラスの追加メソッド
仕様に記載されていないが実装上必要だったため追加：
- `isWalkable(x, y)`: 指定座標が移動可能か返す
- `isInBounds(x, y)`: 座標がマップ範囲内か返す（ActionResolver が多用）
- `getTerritorySquares(territoryName)`: 陣地の全マス座標を配列で返す（TerritoryManager が使用）

---

### index.html のサイドパネル追加要素
| 追加項目 | 内容 |
|---|---|
| Selected Unit パネル | 選択中ユニットのID・HP・ATK・MV・RNG・行動フラグをリアルタイム表示 |
| Legend パネル | 地形・ハイライト色の凡例（平地/森/壁/陣地/移動可能/攻撃可能） |
| CPU thinking... ログ | CPUターン開始時にログエリアへメッセージを追加 |

---

### UIRenderer のゲーム終了表示
ゲーム終了時に手番表示が "Game Over: Player Wins!" / "CPU Wins!" / "Draw!" に切り替わる。仕様には記載なし。

---

### UnitRenderer の画像フォールバック
画像が未ロードまたはロード失敗の場合、テキスト（K/S）でフォールバック描画する。

---

### StatsCollector.reset()
バッチを複数回実行する際に結果をリセットするメソッド。

---

## 4. 仕様には書かれていたが未実装の項目

### GameState.applyAction(action)
仕様では「行動を受け取って状態を更新する」メソッドとして定義されているが実装なし。
→ ActionResolver が直接 GameState を更新する設計で代替。

---

### Unit.canMoveTo(x, y)
仕様の共通メソッドとして定義されているが Unit クラスには実装なし。
→ ActionResolver.getMovablePositions() で代替（マップ参照が必要なため）。

---

### Unit.getMovablePositions()
仕様の共通メソッドとして定義されているが Unit クラスには実装なし。
→ ActionResolver.getMovablePositions() で代替。

---

### Unit.getAttackableTargets()
仕様の共通メソッドとして定義されているが Unit クラスには実装なし。
→ ActionResolver.getAttackableTargets() で代替。

---

### TurnManager.nextTurn()（公開メソッドとして）
仕様では公開メソッドとして定義されているが、実装では `_finishCurrentTurn()` という内部メソッドに統合されており、外部から直接呼び出せない。

---

### ゲームログ表示の件数（直近10件）
仕様: 「ゲームログ表示エリア（直近10件）」
実装: 最大50件を保持（スクロール表示）。

---

## まとめ

| カテゴリ | 件数 |
|---|---|
| 仕様通りに実装 | 大部分（ゲームルール・ユニット・AI・描画・バッチテスト） |
| 仕様から変更 | 7項目 |
| 追加実装 | 9項目 |
| 未実装 | 5項目（すべて代替手段あり） |

未実装の5項目はすべて「仕様で定義されたクラスのメソッド」であり、機能としては別クラスで代替実装されている。
ゲームの動作として欠落している機能はない。

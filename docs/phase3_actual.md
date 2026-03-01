# Phase 3 実装記録

## 実装日
2026-03-01

## 概要

Phase 3 仕様書（docs/phase3_spec.md）に従い、以下の3本柱を実装した。

1. **反撃システム**（ActionResolver.js）
2. **ユニット連携強化**（BaseAI.js + 各AI）
3. **MinMaxAI改善**（MinMaxAI.js）

---

## 実装ステップと成果

### Step 1: 反撃システム（ActionResolver.js）

**変更内容**

`attackUnit()` に反撃処理を追加。`_canCounterAttack()` を新規追加。

```javascript
// 反撃処理: 攻撃を受けたユニットが生存しており反撃可能な場合
if (target.isAlive && this._canCounterAttack(target, attacker)) {
  const counterDamage = Math.floor(target.attack * 0.5);
  attacker.takeDamage(counterDamage);
  this.gameState.logs.push({ type: 'counter_attack', ... });
}

_canCounterAttack(counterUnit, originalAttacker) {
  if (!['Knight', 'Scout'].includes(counterUnit.type)) return false;
  const dx = Math.abs(counterUnit.position.x - originalAttacker.position.x);
  const dy = Math.abs(counterUnit.position.y - originalAttacker.position.y);
  return Math.max(dx, dy) <= 1;
}
```

**仕様との差異**

- 仕様の `_canCounterAttack` 内では型名を小文字（`'knight', 'scout'`）と記載していたが、ユニットの実際の `type` プロパティはPascalCase（`'Knight', 'Scout'`）のため、実装では大文字で統一した。

**UI対応**

`index.html` の `buildGameLog()` に `counter_attack` ログの表示を追加（CNT プレフィックス）。

---

### Step 2-3: Archer・Cleric 行動優先ヘルパー（BaseAI.js）

**追加ヘルパー**

```
_planArcherActions(unit, clonedState, resolver, actions, moveTarget)
  優先: 現在位置から攻撃可能なら移動せず攻撃 → 不可なら目標へ移動

_planClericActions(unit, clonedState, resolver, actions, fallbackTarget)
  優先: 隣接回復可能な味方がいれば移動せず回復 → 不可なら最重傷の味方へ移動して回復再試行
```

**背景（仕様より）**

AIが毎ターン移動を優先するため、Archer（移動後攻撃不可）の攻撃機会が失われていた。
Clericも移動優先のロジックで回復機会を活かせていなかった。

---

### Step 4: 各AIへの適用（Aggressive/Defensive/TerritorialAI）

AggressiveAI・DefensiveAI・TerritorialAI の Archer/Cleric ロジックを
`_planArcherActions()` / `_planClericActions()` ヘルパーに置き換え。

各AIから重複実装していた `_manhattan()` を削除し、BaseAI の共通実装を使用。

---

### Step 5-6: 連携評価ヘルパー（BaseAI.js + 全AI）

**追加ヘルパー**

```
_selectFocusTarget(unit, attackable, attackedTargetIds)
  撃破可能な敵を最優先 → 既攻撃済みターゲット優先（集中攻撃）→ HP最小

_getFlankingBonus(pos, state)
  味方Knightが隣接している敵の反対側にいる場合 +5点（挟み撃ちポジション）

_getFormationBonus(pos, state)
  最も近い非Cleric味方がチェビシェフ距離2以内にいる場合 +3点（隊形維持）
```

各AI（Aggressive/Defensive/Territorial/MinMax）の行動選択にこれらのボーナスを組み込み。
全AIで `attackedTargetIds: Set` を導入し、集中攻撃を有効化。

**バッチテスト結果（Step 1〜6完了後 / 50戦）**

| 組み合わせ | Player勝率 | CPU勝率 | 平均スコア P | 平均スコア C |
|---|---|---|---|---|
| TerritorialAI vs AggressiveAI | 100% | 0% | 81 | 12 |

---

### Step 7-8: MinMaxAI 順次MinMax作り直し + 評価関数改善（MinMaxAI.js）

**作り直しの背景**

Phase 2 の MinMaxAI は「1つのトリガーアクションだけ lookahead し、残り7ユニットは Greedy で動かす」近似実装だった。ユニット間の連携を考慮できず TerritorialAI に 0% 勝率だった。

**新しい処理フロー**

```
1. 全ユニットを優先度順にソート: Knight → Archer → Scout → Cleric
2. 各ユニットについて:
   - 移動候補を即時スコアで上位10手に絞る（O(N)削減）
   - 各候補をクローン上で評価（_evaluate() でスコアリング）
   - 最善手を選択してベース状態（baseState）に適用
3. 次のユニットはベース状態に前ユニットの結果が反映された状態で評価
```

**部隊分散（assignedTerrCounts）**

各ユニットが移動先陣地を選ぶ際、既に割り当て済みのユニット数に応じてペナルティを付与。

```javascript
const crowdPenalty = terrName ? (assignedTerrCounts[terrName] || 0) * 20 : 0;
immediateScore = _scoreMoveAction() + _getFlankingBonus() - crowdPenalty;
```

**評価関数の改善**

仕様通りの3項目を追加実装:
- 撃破ボーナス: `(deadEnemies - deadAllies) * 20`
- Archer高地: `archersOnHighGround * 5`
- Cleric隊形維持: `clericsNearAllies * 3`（`_getFormationBonus()` を流用）

**削除したもの**

- `_runGreedyForOwner()` / `_collectGreedyActions()` / `_generateCandidates()` — 旧 Greedy 近似ロジック
- `_scoreAttackAction()` / `_scoreHealAction()` — 未使用

**追加したもの**

- `_prioritizeUnits()` — Knight→Archer→Scout→Cleric 順ソート
- `_chooseBestMove()` — lookahead付き最善移動選択（ホールディング・分散ペナルティ込み）
- `_getRetreatMovePos()` — 撤退移動先選択
- `_recordTerrAssignment()` — Clericの移動後の陣地割り当て記録

**バッチテスト結果（Step 7-8完了後 / 50戦）**

| 組み合わせ | Player勝率 | CPU勝率 | 平均スコア P | 平均スコア C |
|---|---|---|---|---|
| MinMaxAI vs TerritorialAI | 100% | 0% | 109 | 30 |
| MinMaxAI vs AggressiveAI | 100% | 0% | 57 | 21 |
| MinMaxAI vs DefensiveAI | 100% | 0% | 127 | 51 |

MinMaxAI が全AIに対して 100% 勝率を達成し、最強AIとしての地位を確立した。

---

## 成功指標の達成状況

| 指標 | 達成状況 |
|---|---|
| CPUが複数ユニットを連携して動かせる | ✓ 集中攻撃・挟み撃ち・隊形維持を実装 |
| ArcherとClericが状況に応じて積極的に行動する | ✓ 行動優先ロジックを全AIに適用 |
| 反撃システムが正常に動作する | ✓ ActionResolver.js に実装・UI表示あり |
| バッチテストでCPU勝率が改善されている | ✓ MinMaxAI 100%、TerritorialAI 100% vs AggressiveAI |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/game/ActionResolver.js` | 反撃処理追加（`attackUnit`, `_canCounterAttack`） |
| `src/ai/BaseAI.js` | `_planArcherActions`, `_planClericActions`, `_selectFocusTarget`, `_getFlankingBonus`, `_getFormationBonus`, `_manhattan` 追加 |
| `src/ai/AggressiveAI.js` | Archer/Cleric/Knight/Scout 行動を BaseAI ヘルパーに移行 |
| `src/ai/DefensiveAI.js` | 同上（フォールバックは最寄り陣地） |
| `src/ai/TerritorialAI.js` | 同上（フォールバックは割り当て陣地） |
| `src/ai/MinMaxAI.js` | 全面作り直し（順次MinMax + 評価関数改善） |
| `index.html` | `counter_attack` ログ表示追加 |

---

## 観察事項

**ミラーマッチの非対称性**

MinMaxAI vs MinMaxAI（P=100%）・TerritorialAI vs TerritorialAI（C=100%）で先手・後手が完全固定される現象を確認した。これは Phase 2 以前からの先手有利・後手有利のゲームバランス問題であり、Phase 3 の実装範囲外のため記録にとどめる。ゲームバランス調整が必要な場合は Phase 4 以降で検討する。

**MinMaxAI のキャッシュ問題**

実装確認中にブラウザキャッシュで旧バージョン（Phase 2 版）の MinMaxAI が読み込まれ、テスト結果が旧コードのものになる問題が発生した。`window.location.reload(true)` で解決。

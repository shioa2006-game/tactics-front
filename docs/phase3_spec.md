# Phase 3 実装仕様書

## 目標

プレイヤーが手強い相手と戦える楽しさの実現。反撃システムの導入とCPU AIの改善を通じて、戦闘の駆け引きと戦略的な面白さを高める。

## 前提

Phase 2の実装（docs/phase2_actual.md）をベースに拡張する。
既存クラスの設計（ActionResolver中心、ロジックと描画の分離）を維持すること。

## 成功指標

- CPUが複数ユニットを連携して動かせる
- ArcherとClericが状況に応じて積極的に行動する
- 反撃システムが正常に動作する
- バッチテスト50〜100戦でCPU勝率が改善されている

---

## Phase 3での変更・追加一覧

1. 反撃システム導入
2. ユニット連携強化（Archer・Clericの活躍機会改善を含む）
3. MinMaxAI改善

---

## 1. 反撃システム

### 仕様

- 反撃可能ユニット: Knight・Scout のみ
- 反撃ダメージ: 攻撃力の50%（端数切り捨て）
- 反撃条件: 攻撃を受けた後、対象ユニットが生存していれば即座に反撃
- Archerは射程外から攻撃されるため反撃不可
- Clericは攻撃行動を持たないため反撃なし

### ActionResolver.jsの変更

`attackUnit()` に反撃処理を追加する。

```javascript
attackUnit(attackerId, targetId) {
  // 既存: 攻撃処理
  const attacker = this.gameState.getUnit(attackerId);
  const target = this.gameState.getUnit(targetId);
  const damage = this._calcAttackPower(attacker);
  target.takeDamage(damage);
  // ログ記録

  // 追加: 反撃処理
  if (target.isAlive && this._canCounterAttack(target, attacker)) {
    const counterDamage = Math.floor(target.attack * 0.5);
    attacker.takeDamage(counterDamage);
    // 反撃ログ記録
  }
}

_canCounterAttack(counterUnit, originalAttacker) {
  // Knight・Scoutのみ反撃可能
  if (!['knight', 'scout'].includes(counterUnit.type)) return false;
  // 反撃対象が射程内にいること（チェビシェフ距離1以内）
  const dx = Math.abs(counterUnit.position.x - originalAttacker.position.x);
  const dy = Math.abs(counterUnit.position.y - originalAttacker.position.y);
  return Math.max(dx, dy) <= 1;
}
```

### ログ形式の追加

```json
{
  "turn": 5,
  "player": "cpu",
  "type": "counter_attack",
  "unitId": "cpu_knight_1",
  "targetId": "player_scout_2",
  "damage": 4
}
```

### UIへの反映

攻撃ログの直後に反撃ログを表示する。表示例:

```
T05 [cpu] ATK  cpu_knight_1 → player_scout_2  -9dmg (HP残:0) 【撃破】
T05 [cpu] CNT  player_scout_2 → cpu_knight_1  -2dmg (HP残:11) ← 反撃
```

---

## 2. ユニット連携強化

以下の改善をMinMaxAI・AggressiveAI・DefensiveAI・TerritorialAI全てに適用する。
共通処理はBaseAI.jsにまとめ、各AIで重複実装しないこと。

### Archerの活躍機会改善

ログ分析から、AIが毎ターン移動を優先するためArcherが攻撃できない場面が多い。
「移動後攻撃不可」ルールを持つArcherは、攻撃できる状況では移動せずに攻撃することを優先する。

```
Archerの行動優先順序:
1. 現在位置から射程3〜4マス以内に攻撃可能な敵がいるか確認
2. いる場合 → 移動せずに攻撃する
3. いない場合 → 射程内に入れるマスへ移動する（そのターンの攻撃は諦める）
```

### Clericの活躍機会改善

ログ分析から、AIがClericを他のユニットと同じ移動ロジックで動かしており、
回復の機会を活かせていない。Clericは常に回復を最優先に行動させる。

```
Clericの行動優先順序:
1. チェビシェフ距離1以内に回復可能な味方がいるか確認
2. いる場合 → 移動せずに回復する（HPが最も低い味方を優先）
3. いない場合 → HPが最も低い味方ユニットに隣接するマスへ移動する
```

### 集中攻撃

同一ターン内で複数ユニットが同じ敵を攻撃するように優先順位を設定する。

```
ロジック:
- 前のユニットが攻撃した敵ターゲットを記録する
- 次のユニットが攻撃する際、HPが低い敵を優先（撃破を狙う）
- HPが0以下になりそうな敵がいれば最優先で攻撃する
```

### 挟み撃ち

Knightが敵に隣接しているとき、ScoutやArcherが反対側に回り込む動きを評価する。

```
ロジック:
- 味方Knightが敵に隣接している場合
- その敵の反対側のマスを「挟み撃ちポジション」として評価に加点する
- 加点値: +5点（移動先評価時）
```

### 隊形維持（Clericの護衛）

ClericをKnightやArcherの近くに配置する動きを評価する。

```
ロジック:
- Clericの移動先評価時、最も近い味方ユニットとの距離が2マス以内なら加点
- 加点値: +3点
- 孤立したClericが単独で敵陣に突入する行動を抑制する
```

---

## 3. MinMaxAI改善

### 現状の問題

phase2_actual.mdに記載の通り、現在のMinMaxAIは「1つのトリガーアクションだけをlookaheadして、残り7ユニットはGreedyで動かす」近似実装。ユニット同士の連携を考慮できていない。

### 改善方針: ユニットごとに順番にMinMaxを適用

全ユニットを一括で評価するのではなく、ユニットを1体ずつ順番に処理し、前のユニットの行動結果を次のユニットの判断に反映させる。

```
改善後の処理フロー:

1. ユニットを優先度順に並べる
   （Knight → Archer → Scout → Clericの順）

2. 最初のユニット（Knight_1）について:
   - クローン上で全行動候補を評価
   - 最善の行動を選択して実行

3. 次のユニット（Knight_2）について:
   - Knight_1の行動結果を反映したクローン上で評価
   - 最善の行動を選択して実行

4. 以降、全ユニットについて順番に繰り返す
```

### 評価関数の改善

各ユニットの行動評価に以下を追加する。

```javascript
_evaluate(gameState) {
  let score = 0;

  // 既存: 陣地占拠ボーナス（±30点/陣地）
  // 既存: ユニット価値（HP割合×基準値）

  // 追加: 撃破ボーナス（敵ユニットが減った場合）
  score += enemiesKilled * 20;

  // 追加: Archerの高地ボーナス評価
  // Archerが高地にいる場合+5点
  score += archersOnHighGround * 5;

  // 追加: Clericの位置評価
  // Clericが味方の近くにいる場合+3点
  score += clericsNearAllies * 3;

  return score;
}
```

### 思考時間の目標

現在と同様に2〜5秒以内を目標とする。超過する場合はユニットごとの候補手を上位10手に絞る。

---

## 変更するファイル

```
src/game/ActionResolver.js   ← 反撃処理（attackUnit・_canCounterAttack追加）
src/ai/BaseAI.js             ← Archer/Cleric行動優先処理・連携評価ヘルパー追加
src/ai/MinMaxAI.js           ← ユニットごとの順次MinMaxに作り直し・評価関数改善
src/ai/AggressiveAI.js       ← Archer/Cleric行動優先処理・連携ロジック追加
src/ai/DefensiveAI.js        ← Archer/Cleric行動優先処理・連携ロジック追加
src/ai/TerritorialAI.js      ← Archer/Cleric行動優先処理・連携ロジック追加
```

---

## 実装の優先順位

1. ActionResolver.jsの反撃処理
2. BaseAI.jsのArcher行動優先処理
3. BaseAI.jsのCleric行動優先処理
4. 各AI（Aggressive/Defensive/Territorial）へのArcher・Cleric処理適用
5. BaseAI.jsの連携評価ヘルパー（集中攻撃・挟み撃ち・隊形維持）
6. 各AIへの連携ロジック適用
7. MinMaxAI.jsの順次MinMax作り直し
8. MinMaxAIの評価関数改善

---

## 注意事項

- Archer/Clericの行動優先処理はBaseAI.jsにまとめ、各AIで重複実装しないこと
- 反撃処理はActionResolver.jsのattackUnit()内に実装し、AI側では意識しない設計にすること
- MinMaxAIの作り直しは既存のGameState.clone()をそのまま活用すること
- 各改善後にバッチテスト50戦を実行して効果を確認しながら進めること
- 実装完了後にdocs/phase3_actual.mdを作成すること

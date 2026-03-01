# Phase 2 実装仕様書

## 目標

4種ユニット・地形高さ・陣地システムの完全実装と、戦略的AIの導入。バッチテストで戦略間のバランスを数値的に検証できる状態を作る。

## 前提

Phase 1の実装（docs/phase1_actual.md）をベースに拡張する。
既存クラスの設計（ActionResolver中心、ロジックと描画の分離）を維持すること。

## 成功指標

- 4種ユニットが正常に動作する
- AI思考時間: 2〜5秒以内（MinMaxAI深度2）
- 3種AIの戦略的差異が結果に現れる
- 100〜200戦のバッチテストが完走する
- バランス問題の発見・記録ができる

---

## Phase 2での変更・追加一覧

1. ユニット追加: Archer、Cleric
2. 地形拡張: 高さ（低地・高地）の追加
3. AI追加: MinMaxAI（深度2）、AggressiveAI、DefensiveAI、TerritorialAI
4. バッチテスト拡張: 対戦組み合わせ追加、統計項目追加

---

## ユニット仕様

### 変更なし（Phase 1から継続）

**Knight**
```
攻撃力: 9（固定）
最大HP: 13
移動力: 3マス
射程: 1マス（隣接のみ、チェビシェフ距離）
特殊能力: なし
行動制限: 移動と攻撃を同一ターン内に両方実行可能
```

**Scout**
```
攻撃力: 4（固定）
最大HP: 5
移動力: 6マス
射程: 1マス（隣接のみ、チェビシェフ距離）
特殊能力: なし
行動制限: 移動と攻撃を同一ターン内に両方実行可能
```

### 新規追加

**Archer**
```
攻撃力: 6（固定）/ 高地ボーナス時: 8
最大HP: 8
移動力: 3マス
射程: 3〜4マス（チェビシェフ距離）
  ※ 射程1〜2マスは攻撃不可（近すぎると攻撃できない）
特殊能力:
  - 高地ボーナス: 高地マスに立っているとき攻撃力+2（合計8）
  - 移動後攻撃不可: 同一ターン内に移動した場合は攻撃できない
    （攻撃するターンは移動しないこと）
行動制限: 移動か攻撃どちらか一方のみ（両方は不可）
```

**Cleric（回復専用）**
```
攻撃力: なし（攻撃不可）
最大HP: 6
移動力: 2マス
射程: なし（攻撃行動を持たない）
特殊能力:
  - 回復魔法: 隣接する（チェビシェフ距離1マス以内の）味方ユニット1体のHPを回復する
    回復量: 4（固定）
    対象: 味方ユニットのみ（自分自身は対象外）
    同一ターン内に移動と回復の両方が可能
行動制限: 攻撃行動を持たない。「回復」が攻撃の代わりの行動となる
```

### 編成

各プレイヤー: Knight×2、Scout×2、Archer×2、Cleric×2 = 8ユニット
合計: 16ユニット

---

## 地形仕様の拡張

### 高さの概念

高さを2段階で管理する。

| 高さ | 定数名 | 内容 |
|---|---|---|
| 低地 | HEIGHT_LOW | デフォルト。特別な効果なし |
| 高地 | HEIGHT_HIGH | Archerの攻撃力ボーナスが発生する |

### 高さの効果

- Archerが高地マスにいる場合、攻撃力+2
- 高さは移動コストに影響しない（Phase 2ではシンプルに実装）
- Archer以外のユニットへの高さ効果はなし

### Map.jsの拡張

既存の `_createMap()` に加えて、高さデータ（`heightMap`）を2次元配列で追加する。

```javascript
// 既存
this.terrainMap[y][x] = TERRAIN_PLAIN / TERRAIN_FOREST / TERRAIN_WALL

// 追加
this.heightMap[y][x] = HEIGHT_LOW / HEIGHT_HIGH
```

追加メソッド:
```javascript
getHeight(x, y)  // 指定マスの高さを返す
isHighGround(x, y)  // 高地かどうかを返す
```

### マップ上の高地配置

高地マスをマップ内に適切に配置する。
配置方針: 陣地付近と中央付近に高地エリアを設ける（具体的な座標はClaudeCodeが設計）。
Archerが高地を活かした戦術を取れる配置にすること。

---

## ActionResolverの拡張

### Archerの攻撃処理

```javascript
// 攻撃力の計算
_calcAttackPower(attacker) {
  let power = attacker.attack;
  if (attacker.type === 'archer' && this.gameState.map.isHighGround(attacker.position.x, attacker.position.y)) {
    power += 2;
  }
  return power;
}
```

Archerの射程判定: チェビシェフ距離が3以上4以下のユニットのみ対象。

### Clericの回復処理

攻撃（`attackUnit`）の代わりに回復（`healUnit`）を追加する。

```javascript
healUnit(clericId, targetId)  // ClericがtargetのHPを回復する
getHealableTargets(unitId) // 回復可能な味方ユニット一覧を返す
```

回復の制約:
- Cleric自身は回復対象外
- 対象はチェビシェフ距離1マス以内の味方ユニット
- 回復後にHPが最大HPを超えない

### ターンフラグの扱い

Archerは `hasMoved` が true の場合 `getAttackableTargets()` が空を返すこと。
Clericは `hasAttacked` の代わりに `hasHealed` フラグを追加して管理する。

---

## AI仕様

### MinMaxAI（深度2）

```
アルゴリズム: MinMax + Alpha-Beta枝刈り
深度: 2（自分の手→相手の手）
評価関数:
  - 陣地占拠状況: +15点（占拠中の陣地1つあたり）
  - ユニット価値: ユニットごとに残りHP割合 × 基準値
    Knight: 基準値10、Scout: 基準値6、Archer: 基準値8、Cleric: 基準値5
  - 敵ユニット撃破: +20点
手数フィルタリング: 全ユニットの行動候補から上位15手のみ評価
思考時間目標: 2〜5秒
```

### AggressiveAI

```
基本戦略: 敵ユニット撃破を最優先
評価重み:
  - 陣地占拠: 5点
  - 敵ユニット撃破: 30点
  - 自軍ユニット生存: 10点
  - 敵への接近: -3点（距離ペナルティ）
行動方針:
  - 序盤: 敵に向かって一直線
  - 中盤: HPの低い敵ユニットを集中攻撃
  - Clericは味方が瀕死のときのみ回復、それ以外は接近
```

### DefensiveAI

```
基本戦略: 陣地確保と安全な範囲での行動
評価重み:
  - 陣地占拠: 20点
  - 自軍ユニット生存: 25点
  - 敵ユニット撃破: 10点
  - 陣地安全度: 15点
行動方針:
  - 序盤: 最寄りの陣地を確実に占拠
  - 中盤: 防御ラインを構築し、陣地から離れない
  - Clericは常に味方の回復を優先
```

### TerritorialAI

```
基本戦略: 効率的な陣地占拠でポイント稼ぎ
評価重み:
  - 陣地占拠: 30点
  - 陣地占拠効率: 20点
  - ユニット生存: 15点
  - 戦闘: 5点
  - 陣地間移動効率: 10点
行動方針:
  - 序盤: 複数陣地への同時攻略
  - 中盤: 陣地争奪戦での戦術的優位
  - Clericは陣地内の味方を優先して回復
```

### BaseAI.jsの拡張

Clericの回復行動を `decideActions()` の戻り値に追加する。

```javascript
// Phase 1の行動タイプ
{ type: "move", unitId, toX, toY }
{ type: "attack", unitId, targetId }

// Phase 2で追加
{ type: "heal", unitId, targetId }
```

---

## ファイル構成の変更

### 新規追加ファイル

```
src/game/
├── Archer.js          ← Archerユニット
└── Cleric.js            ← Clericユニット

src/ai/
├── MinMaxAI.js        ← MinMax + Alpha-Beta
├── AggressiveAI.js    ← 攻撃重視AI
├── DefensiveAI.js     ← 守備重視AI
└── TerritorialAI.js   ← 陣地重視AI
```

### UnitRenderer.jsの画像描画仕様

Archer/ClericはKnight/Scoutと同じ画像描画方式で実装する。

```
使用画像ファイル（/assets に格納）:
  - Archer.png  ← Archerユニット用画像
  - Cleric.png  ← Clericユニット用画像

描画方式:
  - 背景色マス（プレイヤー: 青、CPU: 赤）の上に画像を重ねて描画
  - 画像ロード失敗時のフォールバック: テキスト表示（A: Archer、C: Cleric）
  - 実装はphase1_actual.mdのUnitRenderer描画方式変更を参照すること
```

### 変更するファイル

```
src/game/Map.js              ← heightMap追加、getHeight/isHighGround追加
src/game/GameState.js        ← Archer/Clericのユニット生成追加
src/game/ActionResolver.js   ← healUnit/getHealableTargets追加、攻撃力計算の拡張
src/game/Unit.js             ← hasHealed フラグ追加
src/renderer/UnitRenderer.js ← Archer/Clericの描画追加（画像使用、詳細は下記）
src/renderer/MapRenderer.js  ← 高地マスの描画追加
src/test/batch_runner.js     ← 対戦組み合わせ追加
src/test/stats_collector.js  ← 統計項目追加
test.html                    ← 表示項目追加
```

---

## バッチテスト拡張

### 対戦組み合わせ（各100〜200戦）

| Player側 | CPU側 |
|---|---|
| MinMaxAI | AggressiveAI |
| MinMaxAI | DefensiveAI |
| MinMaxAI | TerritorialAI |
| AggressiveAI | DefensiveAI |
| AggressiveAI | TerritorialAI |
| DefensiveAI | TerritorialAI |

### test.htmlの追加表示項目

- 対戦組み合わせ選択（ドロップダウン）
- 対戦数入力（100 / 200 を選択）
- 組み合わせ別の勝率一覧テーブル
- ユニット別使用率・生存率・平均撃破数
- バランス判定テキスト（評価指標との比較）

---

## 実装の優先順位

1. Map.js の拡張（heightMap追加）
2. Archer.js の実装
3. Cleric.js の実装
4. ActionResolver.js の拡張（healUnit、高地ボーナス、Archer射程）
5. Unit.js の拡張（hasHealedフラグ）
6. GameState.js の拡張（8ユニット編成）
7. AggressiveAI.js の実装
8. DefensiveAI.js の実装
9. TerritorialAI.js の実装
10. MinMaxAI.js の実装
11. UnitRenderer.js の拡張（Archer/Cleric描画）
12. MapRenderer.js の拡張（高地描画）
13. batch_runner.js / stats_collector.js の拡張
14. test.html の拡張

---

## 注意事項

- Phase 1の実装（docs/phase1_actual.md）との差分を意識して実装すること
- 既存クラスの設計（ActionResolver中心、ロジックと描画の分離）を崩さないこと
- Clericは `hasAttacked` ではなく `hasHealed` フラグで行動管理すること
- Archerの「移動後攻撃不可」は `hasMoved` フラグで判定すること
- MinMaxAIのclone処理はPhase 1のGameState.clone()をそのまま利用すること

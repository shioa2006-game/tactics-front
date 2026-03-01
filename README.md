# ターン制戦略ゲーム

32×32マップ上で行うターン制戦略ゲーム。プレイヤーとCPUがそれぞれユニットを使って陣地を争奪し、規定ターン終了時のポイントで勝敗を決める。ゲームバランス調整を目的とした自動対戦テストシステムを並行して開発する。

---

## 現在の状態

現在のPhase: Phase 1（未着手）

---

## ゲームの起動方法

index.html をブラウザで直接開く。サーバーは不要。

---

## バッチテストの起動方法

test.html をブラウザで直接開く。

---

## ファイル構成

```
/
├── CLAUDE.md              ← ClaudeCode向け制約・構造定義
├── README.md              ← このファイル
├── roadmap.md             ← 全体計画・進捗
├── docs/
│   ├── phase1_spec.md     ← Phase 1 実装仕様
│   ├── phase2_spec.md     ← Phase 2 実装仕様（Phase 1完了後に作成）
│   ├── phase3_spec.md     ← Phase 3 実装仕様（Phase 2完了後に作成）
│   └── test_spec.md       ← 自動テスト仕様
├── src/
│   ├── game/              ← ゲームロジック（描画に依存しないピュアJS）
│   ├── renderer/          ← Canvas描画
│   ├── ai/                ← AI実装
│   └── test/              ← 自動テスト・バッチ実行
├── index.html             ← ゲーム本体
└── test.html              ← バッチテスト画面
```

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| roadmap.md | Phase構成・成功指標・進捗管理 |
| docs/phase1_spec.md | Phase 1の実装仕様詳細 |
| docs/test_spec.md | 自動テストの設計・仕様 |
| CLAUDE.md | 技術スタック・設計ルール・コーディング規約 |

---

## 開発環境

- ブラウザ: Chrome推奨
- エディタ: ClaudeCode（デスクトップ版）
- バージョン管理: GitHub（手動同期）

---

## GitHub運用メモ

- ローカルPCで作業後、手動でGitHubにプッシュして同期する
- ClaudeCode Web版でGitHub上のファイルを変更した場合は、ローカルにプルして同期する
- 各Phaseの完了時にこのREADMEの「現在の状態」を更新する

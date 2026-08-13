# Contributing to glossary-match

[English](#english) | [日本語](#日本語)

## English

Bug fixes, matching edge cases, tests, documentation improvements, and focused performance work are welcome.

### Before you start

- Search existing issues before opening a new one.
- Use minimal synthetic input and glossary data. Do not include confidential text, credentials, or personal information.
- Open a feature request before investing in a substantial API or matching-semantics change.
- Keep the project deterministic and offline. Translation APIs, AI inference, morphological analyzers, and new glossary file formats are outside the initial scope.

### Development setup

Node.js 20 or newer is required. The `.nvmrc` selects Node.js 24 for local development.

```bash
nvm use
npm install
npm run check
npm pack --dry-run
```

### Pull requests

1. Fork the repository and create a focused branch.
2. Add or update regression tests when behavior changes.
3. Keep public API and CLI changes backward-compatible when practical.
4. Update both READMEs for user-facing changes.
5. Explain what changed, why it changed, and how it was verified.

By contributing, you agree that your contribution is licensed under the project's MIT License.

## 日本語

不具合修正、照合の境界条件、テスト、文書改善、目的を絞った性能改善を歓迎します。

### 作業を始める前に

- 新しいIssueを作る前に同じ内容がないか検索してください。
- 入力文と用語集には最小限の合成データを使い、機密文書、認証情報、個人情報を含めないでください。
- 公開APIや照合仕様を大きく変える場合は、実装前にFeature Requestで相談してください。
- 決定論的かつオフラインで動作する設計を維持してください。翻訳API、AI推論、形態素解析、新しい用語集ファイル形式は初期スコープ外です。

### 開発環境

Node.js 20以上が必要です。`.nvmrc`ではローカル開発用にNode.js 24を選択します。

```bash
nvm use
npm install
npm run check
npm pack --dry-run
```

### Pull Request

1. リポジトリをForkし、目的を絞ったブランチを作ります。
2. 動作を変更した場合は回帰テストを追加・更新します。
3. 可能な限り公開APIとCLIの後方互換性を保ちます。
4. 利用者向けの変更では英語・日本語のREADMEを更新します。
5. 変更内容、理由、確認方法を説明します。

コントリビューションは、このプロジェクトのMITライセンスで提供されることに同意したものとします。

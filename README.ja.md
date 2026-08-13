# glossary-match

[![CI](https://github.com/kiyohara1021/glossary-match/actions/workflows/ci.yml/badge.svg)](https://github.com/kiyohara1021/glossary-match/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/glossary-match.svg)](https://www.npmjs.com/package/glossary-match)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md)

翻訳処理やLLMのプロンプトへ渡す前に、用語集を決定論的に照合するCJK対応のTypeScriptライブラリ／CLIです。

日本語を分かち書きせず、明示された用語を文字列として検索します。日本語・中国語・韓国語などは部分一致、ラテン文字と数字は単語境界付きで照合し、同じ位置で長い用語に完全に含まれる短い用語を除外します。

```text
入力：黒龍討伐戦が始まる

修正前：黒龍       → Black Dragon
        黒龍討伐戦 → Black Dragon Hunt

修正後：黒龍討伐戦 → Black Dragon Hunt
```

AIや翻訳APIには接続しません。用語の採用・除外理由を構造化して返すため、翻訳エンジンに依存せず、速く、再現可能で、調査しやすいのが特徴です。

## 主な機能

- 形態素解析辞書を必要としないCJK向け部分一致
- ラテン文字・数字の単語境界判定（`TAC`は`attack`に一致しない）
- 出現位置ごとの長い用語優先
- 短い用語が文中の別の場所に単独で現れた場合は残す
- 既定でNFKC正規化と大文字・小文字の吸収
- 除外理由と競合の出力
- 重複ID、重複用語、包含用語のLint
- 実行時依存なし
- TypeScript APIとCLI

## セットアップ

```bash
npm install glossary-match
```

Node.js 20以上が必要です。実行時依存パッケージはありません。

## 30秒Quick Start

リポジトリを取得済みなら、同梱のサンプルですぐに試せます。

```bash
npm install
npm run build
node dist/cli.js match \
  --glossary examples/glossary.json \
  --text "黒龍討伐戦が始まる" \
  --locale en
```

出力：

```text
Terms:
- 黒龍討伐戦 → Black Dragon Hunt
  Context: A limited-time game event, not a generic dragon hunt.
Suppressed: 黒龍 (contained by 黒龍討伐戦)
```

インストール済みのパッケージでは、`node dist/cli.js`の代わりに`glossary-match`コマンドを使えます。

## CLI

用語を照合するには、JSON用語集、入力文、出力先ロケールを指定します。

```bash
glossary-match match \
  --glossary examples/glossary.json \
  --text "黒龍討伐戦が始まる" \
  --locale en
```

`--json`を追加すると、採用・除外・競合と正規化後のオフセットを含む構造化結果を出力します。

用語集のID、エイリアス、包含関係を検査するには次を実行します。

```bash
glossary-match lint --glossary examples/glossary.json
```

Lintのエラーがあれば終了コード`1`、警告だけなら`0`です。CLI引数の誤りは`2`になります。

## ライブラリとして使う

```ts
import { formatPromptSection, matchGlossary } from "glossary-match";

const result = matchGlossary("黒龍討伐戦の後、黒龍が現れた", glossary);

console.log(result.matches.map(({ entry }) => entry.id));
// ["black-dragon", "black-dragon-hunt"]

console.log(formatPromptSection(result, "en"));
```

`start`と`end`は`result.normalizedText`内のUTF-16オフセットです。NFKCによって元の文字列長が変わる場合があるため、正規化後の文字列を基準にしています。

オプションで照合方法を変更できます。

```ts
matchGlossary(text, glossary, {
  normalization: "NFKC",      // NFC、NFD、NFKC、NFKD、false
  caseSensitive: false,
  includeTranslations: true,   // translationsの値も入力語として照合
  boundaryMode: "auto",        // "substring"ならすべて部分一致
});
```

## 照合仕様

1. 既定では入力文と用語をUnicode NFKCで正規化し、大文字・小文字を区別せず比較します。
2. `aliases`に加えて`translations`の値も既定の候補です。同じエントリ内で正規化後に重複する候補は一度だけ処理します。
3. 日本語・中国語・韓国語・アラビア語などは、正規表現ではなくリテラルな部分文字列として検索します。
4. 用語の先頭または末尾がラテン文字・数字なら、隣接するUnicode Latin Script・Numberとの境界を確認します。
5. 長い出現位置に完全に含まれる短い出現だけを除外します。別位置に単独で現れた短い用語は残ります。
6. 異なるエントリが同じ範囲に一致した場合は`conflicts`へ両方を残し、勝者を自動選択しません。

包含関係はLintエラーではなく警告です。意図的な包含もあるため実行を止めず、実行時に長い用語が優先されることを管理者へ知らせます。

## 分かち書きをしない理由

ゲーム名・商品名・専門用語は、一般的な形態素解析器に登録されていないことが多くあります。用語集で一語として保持したい固有名詞を、分かち書きによって壊す可能性があるためです。

このツールは、用語集に明示された別名を正として重なりを解決します。意味的な言い換えは推測しません。例えば用語集の`撃退`は`撃退する`に部分一致しますが、`追い払う`を同義語とは判断しません。

## できないこと

- 翻訳そのものや、OpenAI・DeepLなど外部APIへの接続
- 形態素解析、分かち書き、同義語や文脈の推測
- 競合する用語の意味的な優先順位付け
- YAML・CSV用語集の読み込み（CLIはJSON対応）
- Web UIやエディタ拡張の提供

外部通信は行わず、APIキーや環境変数も必要ありません。

## 開発

```bash
npm install
npm run typecheck
npm test
npm run build
npm run check
npm pack --dry-run
```

Node.js 20以上をサポートします。CIではNode.js 20・22・24を使い、`npm ci`と`npm run check`を実行します。

変更を提案する前に[CONTRIBUTING.md](CONTRIBUTING.md)をご確認ください。脆弱性の疑いは[SECURITY.md](SECURITY.md)に従って非公開で報告してください。

## ライセンス

[MIT](LICENSE)

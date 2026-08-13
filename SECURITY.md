# Security Policy

[English](#english) | [日本語](#日本語)

## English

### Supported versions

Only the latest release and the latest version on the `main` branch receive security updates.

### Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's **Security → Report a vulnerability** flow for this repository. Include affected versions, reproduction steps using synthetic data, impact, and any suggested mitigation.

You should receive an initial response within seven days. Please allow time for investigation and a coordinated fix before public disclosure.

### Security model

glossary-match performs literal, local string matching. It does not evaluate glossary terms as regular expressions, execute glossary content, make network requests, require credentials, or intentionally persist input text. A vulnerability that violates these guarantees is considered high priority.

## 日本語

### サポート対象

最新リリースと`main`ブランチの最新版だけをセキュリティ更新の対象とします。

### 脆弱性の報告

脆弱性の疑いがある場合は公開Issueを作らず、このリポジトリの **Security → Report a vulnerability** から非公開で報告してください。影響するバージョン、合成データを使った再現手順、想定される影響、対策案があれば記載してください。

7日以内の初回返信を目標とします。調査と修正の公開準備が整うまで、情報公開をお待ちください。

### セキュリティモデル

glossary-matchはローカルでリテラルな文字列照合だけを行います。用語を正規表現として評価せず、用語集の内容を実行せず、外部通信や認証情報を必要とせず、入力文を意図的に保存しません。この保証を破る脆弱性は優先度を高く扱います。

# grnrngr 取得ソース

## ファイル

| ファイル | URL | 用途 |
|----------|-----|------|
| errata.html | faq/errata.html | 公式エラッタ 6件 |
| faq-card-1.html | faq/card_1.html | 第1弾カードFAQ |
| faq-card-2.html | faq/card_2.html | 第2弾カードFAQ |

## 同期

```bash
node docs/wiki/scripts/sync-cards-from-grnrngr-faq.mjs
```

RS-001〜RS-122 の `docs/wiki/cards/*.md` に公式 Q&A セクションを追加。

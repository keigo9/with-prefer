#　好み画像の学習方法

project/
├── images/
│ ├── preferred/ # 好みの顔画像を配置
│ └── others/ # その他の顔画像を配置
├── train_from_directory.js

### モデルの生成

```
node train_from_directory.js
```

### サーバーの起動

~~npm install -g http-server
http-server . --cors -p 8080~~

```
node server.js
```

ブラウザの開発者ツールで、favorite_analyzer.js を貼り付け実行

### Chrome 拡張機能としてインストール

1. Chrome ブラウザで chrome://extensions を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. 作成したフォルダ（favorite-analyzer-extension）を選択
   デバッグ方法

- バックグラウンドページのデバッグ：
  - 拡張機能ページで「サービスワーカー」をクリック
- コンテンツスクリプトのデバッグ：
  - with.is ページで DevTools を開き、Console タブを確認
    更新方法
- コードを変更した場合：
  - 拡張機能ページで「更新」ボタンをクリック
  - または拡張機能ページをリロード
    注意点：
- モデルファイルは拡張機能のフォルダ内に配置
- manifest.json のパーミッションが適切に設定されているか確認
- 開発中は console.log でデバッグ情報を出力すると便利

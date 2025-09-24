### firebase ローカル確認

firebase emulators:start --only hosting,functions

### フロントの環境

- npm run dev: メインのアプリ
  - ログイン画面をSPAで移動できるようにしているが本番と環境が違うので /app/login パスになる
- npm run dev:login ログイン画面だけ立ち上げる
- npm run build で両環境ビルド


## dev環境のバックエンドとの通信

- エージェントサーバ：Dockerで立ち上げる
- 認証functions：emulatorsで立ち上げる

ただしサービスアカウントキーがローカルで必要、、
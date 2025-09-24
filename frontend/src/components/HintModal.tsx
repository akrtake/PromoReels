import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const hintMarkdown = `
## Promo Reelsの使い方

- このアプリケーションは、簡単なテキスト指示でプロモーションビデオを作成するためのツールです。
- エラーについても記載しています。

### 0. ログイン

- 認証を入れています。ユーザIDとパスワードが必要です。
- Veoの料金が下がりましたが、まだまだ高価ですので不特定多数の人にたくさん動画作られないように制限しています。。。。

### 1. ビデオ作成の開始

- 最初の画面で、作成したい動画のイメージをテキストで入力し、「スタートする」ボタンを押してください。
- 例：「香川県坂出市のプロモーションビデオを作りたい」

### 2. シーンの調整

- AIがあなたの指示に基づいて、ビデオのシーン構成と各シーンのパラメータ（説明、雰囲気、カメラワークなど）を自動で生成します。
- チャット欄横のOKボタンやおまかせボタンを活用するとほとんどお任せで動画を作成できます。
- **パラメータの確認と修正**:
  - 左側の「Video Parameter」パネルで、各シーンのパラメータを確認できます。
  - 内容を修正したい場合は、テキストエリアを直接編集し、「パラメータ修正」ボタンを押すと、AIに修正指示が送られます。
  - 画像を選択できます。選択した画像は動画生成に使われます。あまりにもプロンプト内容とかけ離れていると使われません。
- **シーンの追加と削除**:
  - 「+」ボタンで新しいシーンを追加するようAIに指示できます。
  - 「ゴミ箱」ボタンで現在選択中のシーンを削除するようAIに指示できます。

### 3. ビデオの生成

- **シーンごと**: 「Scene X ビデオ作成」ボタンを押すと、現在選択しているシーンのビデオだけを生成します。
- **全シーン**: 「全ビデオ作成」ボタンを押すと、すべてのシーンのビデオを一括で生成します。

### 4. プレビューとダウンロード

- ビデオが完成すると、ヘッダーの「動画」アイコンが有効になります。
- アイコンをクリックすると、ビデオプレビュー画面が開き、生成されたビデオを再生・確認できます。
- 各シーンのビデオは個別にダウンロードすることも可能です。

### 5. その他
- **チャット**: 右側のチャット画面で、AIと対話しながらより細かい指示を出すこともできます。
- **履歴**: ヘッダーの「履歴」アイコンから、過去のセッションを呼び出すことができます。

### たまにあるエラー
- プロンプト内容でVeoに不適切と判断されて動画作成が失敗する場合があります。内容を変えるか、手でプロンプト修正すると作成できることがあります。
- 動画作成中にセッションが切れる
  - サーバとSSE接続していますが、動画作成完了前に切られることがあります。切らないでと念押しして再度作成したらうまくいくことがあります。
- シーンを選択しての動画作成した際に、別のシーン番号として生成動画が扱われることがあります。ご機嫌次第で発生します。。。
- サイドバーのメニューはビデオ以外オフしています。

`;

const HintModal = ({ isOpen, onClose }: HintModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center">
      <div className="bg-surface-dark-300 p-6 rounded-lg shadow-lg w-full max-w-4/5 h-4/5 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-text-light">How to Use</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-light"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="prose prose-invert max-w-none flex-grow overflow-y-auto pr-4 text-left no-scrollbar">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {hintMarkdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default HintModal;

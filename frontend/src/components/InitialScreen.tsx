// src/components/InitialScreen.tsx
import React, { useState } from "react";

interface InitialScreenProps {
  onStart: (prompt: string) => Promise<void>;
}

const InitialScreen: React.FC<InitialScreenProps> = ({ onStart }) => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const examplePrompt = "香川県坂出市のプロモーションビデオを作りたい";

  const handleStart = async () => {
    setIsLoading(true);
    try {
      // 入力された値を渡す
      await onStart(prompt.trim());
    } catch (error) {
      console.error("Failed to start session:", error);
      setIsLoading(false); // エラーが発生した場合はローディングを解除
    }
    // 成功時は画面が切り替わるため、ローディング解除は不要
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-text-light">
      <h1 className="text-4xl font-bold mb-4">
        作成したい動画のイメージを教えてください
      </h1>
      <div className="w-full max-w-2xl">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-32 p-4 bg-surface-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none disabled:opacity-50"
          placeholder={examplePrompt}
          disabled={isLoading}
        />
        <p className="text-sm text-text-muted mt-2">
          あとから調整できるのでざっくりでOK
        </p>
      </div>
      <div className="mt-6 flex items-center space-x-4 h-12">
        <button
          onClick={handleStart}
          disabled={isLoading || !prompt.trim()}
          className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          スタートする
        </button>
        {isLoading && (
          <div className="w-6 h-6 border-4 border-t-transparent border-brand-primary rounded-full animate-spin"></div>
        )}
      </div>
    </div>
  );
};

export default InitialScreen;

// src/components/InitialScreen.tsx
import React, { useState } from "react";

interface InitialScreenProps {
  onStart: (prompt: string) => void;
}

const InitialScreen: React.FC<InitialScreenProps> = ({ onStart }) => {
  const [prompt, setPrompt] = useState("");
  const examplePrompt =
    "A cinematic video of a futuristic city at sunset, with flying cars and neon lights.";

  const handleStart = () => {
    // 入力があればその値を、なければプレースホルダーの値を渡す
    onStart(prompt.trim() || examplePrompt);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-text-light">
      <h1 className="text-4xl font-bold mb-4">
        動画のイメージを教えてください
      </h1>
      <div className="w-full max-w-2xl">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-32 p-4 bg-surface-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          placeholder={examplePrompt}
        />
        <p className="text-sm text-text-muted mt-2">入力例: {examplePrompt}</p>
      </div>
      <button
        onClick={handleStart}
        className="mt-6 bg-brand-primary text-white font-bold py-3 px-8 rounded-full hover:bg-brand-primary-dark transition-colors"
      >
        スタートする
      </button>
    </div>
  );
};

export default InitialScreen;

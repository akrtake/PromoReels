// src/components/VideoParameters.tsx
import React, { useState, useEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  scenesAtom,
  type Scene,
  defaultScene,
  promptQueueAtom,
} from "../atoms";

const VideoParameters = () => {
  const [scenes, setScenes] = useAtom(scenesAtom);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isParametersOpen, setIsParametersOpen] = useState(true);
  const setPromptQueue = useSetAtom(promptQueueAtom);
  const parametersContainerRef = useRef<HTMLDivElement>(null);

  const handleAddScene = () => {
    const newScene = { ...defaultScene };
    setScenes((prevScenes) => [...prevScenes, newScene]);
    // 新しく追加したシーンをアクティブにする
    setActiveSceneIndex(scenes.length);
  };

  const handleDeleteActiveScene = () => {
    // シーンが1つしかない場合は削除しない
    if (scenes.length <= 1) {
      return;
    }

    const newScenes = scenes.filter((_, index) => index !== activeSceneIndex);
    setScenes(newScenes);

    // アクティブなインデックスを調整
    if (activeSceneIndex >= newScenes.length) {
      setActiveSceneIndex(Math.max(0, newScenes.length - 1));
    }
  };

  const handleParameterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // テキストエリアの高さを自動調整
    const textarea = e.target;
    textarea.style.height = "auto"; // 高さを一度リセットして縮小に対応
    textarea.style.height = `${textarea.scrollHeight}px`;

    const { name, value } = e.target;
    console.log(name, value);
    setScenes((prevScenes) => {
      const newScenes = [...prevScenes];
      const activeScene = { ...newScenes[activeSceneIndex] };

      if (name === "elements" || name === "keywords") {
        activeScene[name] = value.split(",").map((s) => s.trim());
      } else {
        (activeScene as any)[name] = value;
      }

      newScenes[activeSceneIndex] = activeScene;
      return newScenes;
    });
  };

  const handleGenerateVideo = () => {
    const prompt = `下記の設定で動画を作成してください
\`\`\`json
${JSON.stringify(activeScene, null, 2)}
\`\`\``;
    setPromptQueue(prompt);
    // 必要であれば、チャットボックスにフォーカスを移動するなどの処理を追加
  };

  useEffect(() => {
    // isParametersOpen が true で、ref が存在する場合にのみ実行
    if (isParametersOpen && parametersContainerRef.current) {
      const textareas =
        parametersContainerRef.current.querySelectorAll("textarea");
      textareas.forEach((textarea) => {
        // 高さを一度リセットして、内容が減った場合にも対応
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
    }
    // activeSceneIndex, scenes, isParametersOpen が変更されたときに実行
  }, [activeSceneIndex, scenes, isParametersOpen]);

  const activeScene = scenes[activeSceneIndex] || defaultScene;

  const toggleParametersAccordion = () => {
    setIsParametersOpen(!isParametersOpen);
  };

  return (
    <div
      className="w-1/2 bg-surface-dark-200 p-4 rounded-lg shadow-lg flex flex-col h-full"
      style={{
        height: "calc(100vh - var(--header-height) - 3rem - 1rem)",
      }}
    >
      <div className="flex justify-between items-center mb-2 h-9">
        <h2 className="text-lg font-semibold text-text-light">
          Video Parameter
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddScene}
            className="bg-surface-dark-300 text-text-light px-3 py-1 rounded text-sm hover:bg-surface-dark-400 transition-colors"
          >
            + Add Scene
          </button>
          <button
            onClick={handleDeleteActiveScene}
            disabled={scenes.length <= 1}
            className="bg-surface-dark-300 text-text-light px-3 py-1 rounded text-sm hover:bg-surface-dark-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            - Delete Scene
          </button>
        </div>
      </div>

      <div className="flex items-center mb-4">
        <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {scenes.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSceneIndex(index)}
              className={`px-4 py-2 rounded flex-shrink-0 whitespace-nowrap transition-colors ${
                activeSceneIndex === index
                  ? "bg-brand-secondary text-text-light font-semibold"
                  : "bg-surface-dark-300 text-text-muted hover:bg-surface-dark-400"
              }`}
            >
              Scene {index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto no-scrollbar pr-2">
        <div className="bg-surface-dark-300 rounded-md">
          <button
            onClick={toggleParametersAccordion}
            className="w-full flex justify-between items-center p-2 text-left"
          >
            <span className="text-sm font-medium text-text-light capitalize">
              Scene {activeSceneIndex + 1} Parameters
            </span>
            <svg
              className={`w-5 h-5 text-text-muted transform transition-transform ${
                isParametersOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {isParametersOpen && (
            <div className="p-2 pt-0" ref={parametersContainerRef}>
              <div className="space-y-3">
                {(Object.keys(activeScene) as Array<keyof Scene>).map((key) => (
                  <div key={key} className="text-start">
                    <label className="text-sm font-medium text-text-muted capitalize">
                      {key}
                    </label>
                    <textarea
                      name={key}
                      value={
                        Array.isArray(activeScene[key])
                          ? (activeScene[key] as string[]).join(", ")
                          : activeScene[key]
                      }
                      onChange={handleParameterChange}
                      rows={1}
                      className="w-full bg-surface-dark-400 text-text-light p-2 rounded-md mt-1 text-sm resize-none overflow-hidden"
                      placeholder={
                        key === "elements" || key === "keywords"
                          ? "カンマ区切りで入力"
                          : `Enter ${key}...`
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <button
          onClick={handleGenerateVideo}
          className="w-full bg-brand-primary text-white font-bold py-3 px-4 rounded-md hover:bg-brand-primary-dark transition-colors"
        >
          Generate Video with this Scene
        </button>
      </div>
    </div>
  );
};

export default VideoParameters;

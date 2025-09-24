// src/components/VideoParameters.tsx
import React, { useState, useEffect, useRef } from "react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import {
  scenesAtom,
  type Scene,
  defaultScene,
  sessionStateAtom,
  promptQueueAtom,
  sceneThemesAtom,
  userIdAtom,
  sessionTokenAtom,
} from "../atoms";

const parameterLabels: Record<keyof Scene, string> = {
  description: "概要",
  style: "動画の雰囲気",
  camera: "カメラ",
  lens: "レンズ",
  lighting: "ライティング",
  environment: "動画内の環境",
  audio: "音楽のイメージ",
  elements: "要素",
  motion: "動画の動き",
  ending: "エンディング",
  text: "テキスト",
  keywords: "キーワード",
  imageUrl: "画像",
};

const parameterOrder: Array<keyof Scene> = [
  "description",
  "style",
  "camera",
  "lens",
  "lighting",
  "environment",
  "audio",
  "elements",
  "motion",
  "ending",
  "text",
  "keywords",
  "imageUrl",
];

const VideoParameters = () => {
  const [scenes, setScenes] = useAtom(scenesAtom);
  const [sceneThemes, setSceneThemes] = useAtom(sceneThemesAtom);
  const sessionState = useAtomValue(sessionStateAtom);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isThemeOpen, setIsThemeOpen] = useState(true);
  const [isImageOpen, setIsImageOpen] = useState(true);
  const [isParametersOpen, setIsParametersOpen] = useState(true);
  const [isModified, setIsModified] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [cloudImages, setCloudImages] = useState<
    {
      gs_url: string;
      name: string;
      signedUrl: string;
    }[]
  >([]);
  const [isCloudImagesLoading, setIsCloudImagesLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "uploading" | "success" | "error" | null
  >(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [incompleteSceneIndexes, setIncompleteSceneIndexes] = useState<
    Set<number>
  >(new Set());
  const [modifiedKeys, setModifiedKeys] = useState<Set<keyof Scene>>(new Set());
  const setPromptQueue = useSetAtom(promptQueueAtom);
  const userId = useAtomValue(userIdAtom);
  const sessionToken = useAtomValue(sessionTokenAtom);
  const parametersContainerRef = useRef<HTMLDivElement>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // sessionState.scene_config からシーンのパラメータを復元
    if (sessionState?.scene_config) {
      const sceneConfig = sessionState.scene_config;
      // scene1, scene2, ... のキーでソート
      const sortedScenes = Object.keys(sceneConfig)
        .sort()
        .map((key) => sceneConfig[key]);

      if (sortedScenes.length > 0) {
        setScenes(sortedScenes);
      } else {
        // scene_configはあるが空の場合
        setScenes([defaultScene]);
      }
    } else {
      // scene_configがない場合
      setScenes([defaultScene]);
    }

    // console.log("sessionState: ", sessionState);
    // sessionState.theme_list からシーンのテーマを復元
    if (sessionState?.theme_list) {
      // console.log("sessionState.theme_list", sessionState.theme_list);
      const themeList = sessionState.theme_list;
      // scene1, scene2, ... のキーでソート
      const sortedThemes = Object.keys(themeList)
        .sort()
        .map((key) => themeList[key]);
      // console.log("sortedThemes", sortedThemes);
      setSceneThemes(sortedThemes);
    } else {
      setSceneThemes([""]); // テーマがない場合でも、シーン1を表示するために空のテーマをセット
    }
  }, [sessionState, setScenes, setSceneThemes]);

  useEffect(() => {
    const newModifiedKeys = new Set<keyof Scene>();
    const currentScene = scenes[activeSceneIndex];

    if (!currentScene) {
      setIsModified(false);
      setModifiedKeys(new Set());
      return;
    }

    // 比較元のシーンを決定する。sessionStateにconfigがあればそれ、なければdefaultScene
    const originalScene =
      sessionState?.scene_config?.[`scene${activeSceneIndex + 1}`] ||
      defaultScene;

    let hasModification = false;
    for (const key of parameterOrder) {
      const originalValue = originalScene[key as keyof Scene];
      const currentValue = currentScene[key as keyof Scene];

      // 配列の場合はソートしてJSON文字列で比較
      const isSame = Array.isArray(originalValue)
        ? JSON.stringify([...(originalValue as string[])].sort()) ===
          JSON.stringify([...(currentValue as string[])].sort())
        : originalValue === currentValue;

      if (!isSame) {
        newModifiedKeys.add(key as keyof Scene);
        hasModification = true;
      }
    }

    setModifiedKeys(newModifiedKeys);
    setIsModified(hasModification);
  }, [scenes, activeSceneIndex, sessionState]);

  // sceneThemesの長さに合わせてscenesの長さを同期させる
  useEffect(() => {
    if (sceneThemes.length > scenes.length) {
      const diff = sceneThemes.length - scenes.length;
      // 不足している分のデフォルトシーンを作成
      const scenesToAppend = Array(diff).fill(defaultScene);
      // 既存のシーン配列に新しいデフォルトシーンを追加
      setScenes((prevScenes) => [...prevScenes, ...scenesToAppend]);
    }
    // scenes.length > sceneThemes.length のケースは、テーマがまだ生成されていない途中段階の可能性があるため、
    // scenesを切り詰める処理は行わない。
  }, [scenes.length, sceneThemes.length, setScenes]);

  useEffect(() => {
    const newIncompleteIndexes = new Set<number>();
    scenes.forEach((scene, index) => {
      // 必須パラメータを 'description' のみに変更
      const isIncomplete = (["description"] as (keyof Scene)[]).some((key) => {
        const value = scene[key] as string | string[];
        if (Array.isArray(value)) {
          return (
            value.length === 0 || value.every((item) => item.trim() === "")
          );
        }
        return !value;
      });
      if (isIncomplete) {
        newIncompleteIndexes.add(index);
      }
    });
    setIncompleteSceneIndexes(newIncompleteIndexes);
  }, [scenes]);

  const handleAddScene = () => {
    const prompt = `シーンを追加してください。`;
    setPromptQueue(prompt);
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
    const prompt = `scene${activeSceneIndex + 1} のシーンを削除してください。`;
    setPromptQueue(prompt);
  };

  useEffect(() => {
    const getDisplayUrl = async () => {
      const currentImageUrl = scenes[activeSceneIndex]?.imageUrl;
      if (currentImageUrl && currentImageUrl.startsWith("gs://")) {
        setDisplayImageUrl(null); // 古い画像をクリア
        const signedUrl = await getSignedUrl(currentImageUrl);
        setDisplayImageUrl(signedUrl);
      } else {
        setDisplayImageUrl(currentImageUrl || null);
      }
    };

    getDisplayUrl();
  }, [scenes, activeSceneIndex, sessionToken]);

  const handleParameterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // テキストエリアの高さを自動調整
    const textarea = e.target;
    textarea.style.height = "auto"; // 高さを一度リセットして縮小に対応
    textarea.style.height = `${textarea.scrollHeight}px`;

    const { name, value } = e.target;
    const key = name as keyof Scene;
    setScenes((prevScenes) => {
      const newScenes = [...prevScenes];
      const activeScene = { ...newScenes[activeSceneIndex] };

      if (key === "elements" || key === "keywords") {
        activeScene[key] = value.split(",").map((s) => s.trim());
      } else {
        // 'elements'と'keywords'以外のキーはstring型またはundefined
        (activeScene as Record<string, any>)[key] = value;
      }

      newScenes[activeSceneIndex] = activeScene;
      return newScenes;
    });
  };

  const handleModifyParameters = () => {
    const prompt = `scene${
      activeSceneIndex + 1
    } のプロンプトを下記の内容で更新してください。
\`\`\`json
${JSON.stringify(activeScene, null, 2)}
\`\`\``;
    setPromptQueue(prompt);
  };

  const handleGenerateSingleSceneVideo = () => {
    const sceneNumber = activeSceneIndex + 1;
    const sceneData = scenes[activeSceneIndex];
    const promptPayload = {
      [`scene${sceneNumber}`]: sceneData,
    };
    const prompt = `scene${sceneNumber}の動画を作成してください。プロンプトは下記です。
\`\`\`json
${JSON.stringify(promptPayload, null, 2)}
\`\`\``;
    setPromptQueue(prompt);
  };
  const handleGenerateAllScenesVideo = () => {
    const promptPayload = scenes.reduce((acc, scene, index) => {
      acc[`scene${index + 1}`] = scene;
      return acc;
    }, {} as Record<string, Scene>);
    const prompt = `全てのシーンの動画を作成してください。プロンプトは下記です。
\`\`\`json
${JSON.stringify(promptPayload, null, 2)}
\`\`\``;
    setPromptQueue(prompt);
  };

  useEffect(() => {
    const fetchCloudImages = async () => {
      if (!isImageModalOpen || !userId || !sessionToken) return;

      setIsCloudImagesLoading(true);
      setCloudImages([]); // Clear previous images

      try {
        const response = await fetch(
          "https://asia-northeast1-aiagenthackathon-469114.cloudfunctions.net/list_files",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ user_folder: `${userId}/` }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to list files from cloud.");
        }

        const data = await response.json();
        const files: { gs_url: string; name: string }[] = data.files || [];

        // Get signed URLs for all images
        const imagesWithSignedUrls = await Promise.all(
          files
            .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)) // Filter for image files
            .map(async (file) => {
              const signedUrl = await getSignedUrl(file.gs_url);
              return signedUrl ? { ...file, signedUrl } : null;
            })
        );

        setCloudImages(
          imagesWithSignedUrls.filter(
            (img): img is { gs_url: string; name: string; signedUrl: string } =>
              !!img
          )
        );
      } catch (error) {
        console.error("Error fetching cloud images:", error);
      } finally {
        setIsCloudImagesLoading(false);
      }
    };

    fetchCloudImages();
  }, [isImageModalOpen, userId, sessionToken]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const getSignedUrl = async (gcsUri: string): Promise<string | null> => {
    if (!sessionToken) {
      console.error("Cannot get signed URL: session token is missing.");
      return null;
    }
    try {
      const uriParts = gcsUri.replace("gs://", "").split("/");
      const bucketName = uriParts.shift();
      const fileName = uriParts.join("/");

      if (!bucketName || !fileName) {
        throw new Error("Invalid GCS URI format");
      }

      const response = await fetch(
        "https://asia-northeast1-aiagenthackathon-469114.cloudfunctions.net/create_signed_url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ bucketName, fileName }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get signed URL: ${response.statusText}`);
      }
      const data = await response.json();
      return data.signedUrl;
    } catch (error) {
      console.error("Error fetching signed URL:", error);
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !sessionToken) {
      if (!userId || !sessionToken) {
        console.error("Upload failed: User ID or session token is missing.");
      }
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage("画像をアップロードしています...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];
        const fileName = `${userId}/${file.name}`;

        const response = await fetch(
          "https://asia-northeast1-aiagenthackathon-469114.cloudfunctions.net/upload_file",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              file_name: fileName,
              data: base64String,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        const gcsUri = result.gs_url;

        // console.log(gcsUri);

        setScenes((prevScenes) => {
          const newScenes = [...prevScenes];
          newScenes[activeSceneIndex] = {
            ...newScenes[activeSceneIndex],
            // GCS URIをセットする
            imageUrl: gcsUri,
          };
          return newScenes;
        });

        setUploadStatus("success");
        setUploadMessage("アップロードが成功しました！");
      } catch (error) {
        console.error("Error uploading file:", error);
        setUploadStatus("error");
        setUploadMessage(
          `アップロードに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`
        );
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
    };
  };

  const handleImageRemove = () => {
    setScenes((prevScenes) => {
      const newScenes = [...prevScenes];
      const activeScene = { ...newScenes[activeSceneIndex], imageUrl: "" };
      newScenes[activeSceneIndex] = activeScene;
      return newScenes;
    });
  };

  const handleImageSelectFromCloud = (gcsUrl: string) => {
    setScenes((prevScenes) => {
      const newScenes = [...prevScenes];
      newScenes[activeSceneIndex] = {
        ...newScenes[activeSceneIndex],
        imageUrl: gcsUrl,
      };
      return newScenes;
    });
    // モーダルを閉じる
    setIsImageModalOpen(false);
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

  // 必須パラメータを 'description' のみに変更
  const isCurrentSceneIncomplete = (["description"] as (keyof Scene)[]).some(
    (key) => {
      const value = activeScene[key] as string | string[];
      if (Array.isArray(value)) {
        // 配列の場合、空であるか、空文字列のみを含む場合に不完全とみなす
        return value.length === 0 || value.every((item) => item.trim() === "");
      }
      // 文字列の場合、null, undefined, または空文字列の場合に不完全とみなす
      return !value;
    }
  );

  const toggleParametersAccordion = () => {
    setIsParametersOpen(!isParametersOpen);
  };
  const toggleThemeAccordion = () => {
    setIsThemeOpen(!isThemeOpen);
  };
  const toggleImageAccordion = () => {
    setIsImageOpen(!isImageOpen);
  };

  return (
    <div
      className="w-1/2 bg-surface-dark-200 px-4 py-3 rounded-lg shadow-lg flex flex-col h-full"
      style={{
        height: "calc(100vh - var(--header-height) - 2rem)",
      }}
    >
      {/* <div className="flex justify-between items-center mb-2 h-9">
        <h2 className="text-lg font-semibold text-text-light">
          Video Parameter
        </h2>
      </div> */}
      <div className="flex justify-between items-center">
        <div className="flex mr-3 space-x-2 overflow-x-auto no-scrollbar">
          {sceneThemes.map((_, index) => {
            const isActive = activeSceneIndex === index;
            const isIncomplete = incompleteSceneIndexes.has(index);
            return (
              <button
                key={`scene-button-${index}`}
                onClick={() => setActiveSceneIndex(index)}
                className={`px-4 py-1 rounded flex-shrink-0 whitespace-nowrap transition-colors border-2 ${
                  isActive
                    ? "bg-brand-secondary text-text-light font-semibold"
                    : "bg-surface-dark-300 text-text-muted hover:bg-surface-dark-400"
                } ${
                  isIncomplete
                    ? "border-red-400 border-2"
                    : isActive
                    ? "border-brand-secondary" // アクティブ時は背景と同じ色
                    : "border-transparent" // 非アクティブ時は透明
                }`}
              >
                Scene {index + 1}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 w-[80px]">
          <div className="relative">
            <button
              onClick={handleAddScene}
              className="group bg-surface-dark-300 text-text-light p-2 rounded-md hover:bg-surface-dark-400 transition-colors"
              aria-label="Add Scene"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap invisible group-hover:visible bg-surface-dark-400 text-text-light text-xs rounded py-1 px-2 z-10">
                Add Scene
              </span>
            </button>
          </div>
          <div className="relative">
            <button
              onClick={handleDeleteActiveScene}
              disabled={scenes.length <= 1}
              className="group bg-surface-dark-300 text-text-light p-2 rounded-md hover:bg-surface-dark-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Delete Scene"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap invisible group-hover:visible bg-surface-dark-400 text-text-light text-xs rounded py-1 px-2 z-10">
                Delete Scene
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="my-3 border-b border-surface-dark-300"></div>

      <div className="flex-grow overflow-y-auto no-scrollbar">
        <div className="mb-4  bg-surface-dark-300 rounded-md text-left w-full">
          <button
            onClick={toggleThemeAccordion}
            className="w-full flex justify-between items-center p-2 text-left"
          >
            <span className="text-sm font-semibold text-white capitalize">
              Scene {activeSceneIndex + 1} Theme
            </span>
            <svg
              className={`w-5 h-5 text-text-muted transform transition-transform ${
                isThemeOpen ? "rotate-180" : ""
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
          {isThemeOpen && (
            <div className="p-2 pt-0">
              <p className="text-sm text-text-light whitespace-pre-wrap">
                {sceneThemes[activeSceneIndex] ?? ""}
              </p>
            </div>
          )}
        </div>

        <div className="mb-4 bg-surface-dark-300 rounded-md">
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
                {parameterOrder
                  .filter((key) => key !== "imageUrl")
                  .map((key) => {
                    const value = activeScene[key];
                    // 'description' のみが必須項目のため、それだけをチェック
                    const isItemIncomplete =
                      key === "description" &&
                      (Array.isArray(value)
                        ? value.length === 0 ||
                          value.every((item) => item.trim() === "")
                        : !value);

                    return (
                      <div key={key} className="text-start">
                        <label
                          className={`text-sm font-medium capitalize ${
                            isItemIncomplete
                              ? "text-red-400"
                              : modifiedKeys.has(key)
                              ? "text-yellow-400"
                              : "text-text-light"
                          }`}
                        >
                          {parameterLabels[key]}
                          {key === "description" && (
                            <span className="text-red-400 ml-1">*</span>
                          )}
                        </label>
                        <textarea
                          name={key}
                          value={
                            Array.isArray(activeScene[key])
                              ? (activeScene[key] as string[]).join(", ")
                              : activeScene[key] || ""
                          }
                          onChange={handleParameterChange}
                          rows={1}
                          className="w-full bg-surface-dark-400 text-text-light p-2 rounded-md mt-1 text-sm resize-none overflow-hidden"
                          placeholder={
                            key === "elements" || key === "keywords"
                              ? "カンマ区切りで入力"
                              : `${parameterLabels[key]}を入力...`
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        <div className="bg-surface-dark-300 rounded-md text-left w-full">
          <button
            onClick={toggleImageAccordion}
            className="w-full flex justify-between items-center p-2 text-left"
          >
            <div className="flex items-baseline space-x-2">
              <span className="text-sm font-semibold text-text-light capitalize">
                Image
              </span>
              <span className="text-xs text-text-muted">
                シーンの最初のフレームを指定
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-text-muted transform transition-transform ${
                isImageOpen ? "rotate-180" : ""
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
          {isImageOpen && (
            <div className="p-2 pt-0">
              {displayImageUrl ? (
                <div className="relative group">
                  <img
                    src={displayImageUrl}
                    alt={`Scene ${activeSceneIndex + 1}`}
                    className="w-full h-auto rounded-md"
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={handleImageRemove}
                      className="p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-opacity opacity-0 group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                activeScene.imageUrl && (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-4 border-t-transparent border-brand-primary rounded-full animate-spin"></div>
                  </div>
                )
              )}
              {!activeScene.imageUrl && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsImageModalOpen(true)}
                    className="w-full bg-surface-dark-400 text-text-light text-sm py-2 px-3 rounded-md hover:bg-surface-dark-500 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                    </svg>
                    <span>クラウドから選択</span>
                  </button>
                  <button
                    onClick={handleUploadClick}
                    className="w-full bg-surface-dark-400 text-text-light text-sm py-2 px-3 rounded-md hover:bg-surface-dark-500 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                    <span>アップロードして使う</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {uploadStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-surface-dark-300 p-6 rounded-lg shadow-lg w-96 text-center">
            <h3 className="text-lg font-semibold text-text-light mb-4">
              {uploadStatus === "uploading" && "アップロード中"}
              {uploadStatus === "success" && "アップロード成功"}
              {uploadStatus === "error" && "アップロード失敗"}
            </h3>
            <div className="h-24 flex items-center justify-center">
              {uploadStatus === "uploading" && (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-t-transparent border-brand-primary rounded-full animate-spin mb-3"></div>
                  <p className="text-text-muted">{uploadMessage}</p>
                </div>
              )}
              {uploadStatus === "success" && (
                <div className="flex flex-col items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-green-400 mb-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-text-light">{uploadMessage}</p>
                </div>
              )}
              {uploadStatus === "error" && (
                <div className="flex flex-col items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-red-400 mb-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-text-light break-all">{uploadMessage}</p>
                </div>
              )}
            </div>
            {uploadStatus !== "uploading" && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setUploadStatus(null);
                    setUploadMessage(null);
                  }}
                  className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-primary-dark"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-surface-dark-300 p-6 rounded-lg shadow-lg w-3/4 max-w-4xl h-3/4 flex flex-col">
            <h3 className="text-lg font-semibold text-text-light mb-4">
              画像を選択
            </h3>
            <div className="flex-grow overflow-y-auto border-2 border-dashed border-surface-dark-400 rounded-md p-4">
              {isCloudImagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-t-transparent border-brand-primary rounded-full animate-spin"></div>
                  <p className="ml-4 text-text-muted">
                    画像を読み込んでいます...
                  </p>
                </div>
              ) : cloudImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {cloudImages.map((image) => (
                    <div
                      key={image.gs_url}
                      className="relative group cursor-pointer"
                      onClick={() => handleImageSelectFromCloud(image.gs_url)}
                    >
                      <img
                        src={image.signedUrl}
                        alt={image.name}
                        className="w-full h-32 object-cover rounded-md group-hover:opacity-70 transition-opacity"
                      />
                      <p
                        className="text-xs text-text-muted truncate mt-1"
                        title={image.name}
                      >
                        {image.name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-text-muted">
                    アップロードされた画像はありません。
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="bg-surface-dark-400 text-text-light py-2 px-4 rounded-md hover:bg-surface-dark-500"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-auto pt-3">
        <div className="flex flex-row space-x-3">
          <button
            onClick={handleModifyParameters}
            disabled={!isModified}
            className={`w-full bg-brand-primary text-white text-sm font-bold py-1 px-4 rounded-md hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isModified ? "ring-2 ring-yellow-400" : ""
            }`}
          >
            パラメータ修正
          </button>
          <button
            onClick={handleGenerateSingleSceneVideo}
            disabled={isCurrentSceneIncomplete}
            className="w-full bg-brand-primary text-white text-sm font-bold py-1 px-4 rounded-md hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Scene {activeSceneIndex + 1} ビデオ作成
          </button>
          <button
            onClick={handleGenerateAllScenesVideo}
            disabled={incompleteSceneIndexes.size > 0}
            className="w-full bg-brand-primary text-white text-sm font-bold py-1 px-4 rounded-md hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            全ビデオ作成
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoParameters;

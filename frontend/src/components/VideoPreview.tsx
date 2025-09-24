// src/components/VideoPreview.tsx
import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { useAtomValue } from "jotai";
import { sessionStateAtom, sessionTokenAtom } from "../atoms";

interface VideoPreviewProps {
  isOpen: boolean;
  onClose: () => void;
}

const VideoPreview = ({ isOpen, onClose }: VideoPreviewProps) => {
  const sessionState = useAtomValue(sessionStateAtom);
  const sessionToken = useAtomValue(sessionTokenAtom);
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSignedUrls = async () => {
      if (!sessionState?.movie_urls || !sessionToken) {
        setSignedUrls([]);
        return;
      }

      setIsLoading(true);
      const urlsToFetch: string[] = [];
      const movieUrls = sessionState.movie_urls;

      // 各シーンの最後の動画URLを取得し、シーンキーでソート
      Object.keys(movieUrls)
        .sort()
        .forEach((sceneKey) => {
          const sceneUrls = movieUrls[sceneKey];
          if (sceneUrls && sceneUrls.length > 0) {
            urlsToFetch.push(sceneUrls[sceneUrls.length - 1]);
          }
        });

      if (urlsToFetch.length === 0) {
        setSignedUrls([]);
        setIsLoading(false);
        return;
      }

      try {
        const signedUrlPromises = urlsToFetch.map(async (gcsUri) => {
          const uriParts = gcsUri.replace("gs://", "").split("/");
          const bucketName = uriParts.shift();
          const fileName = uriParts.join("/");

          if (!bucketName || !fileName) return null;

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
            console.error(`Failed to get signed URL for ${gcsUri}`);
            return null;
          }
          const data = await response.json();
          return data.signedUrl;
        });

        const resolvedUrls = (await Promise.all(signedUrlPromises)).filter(
          (url): url is string => url !== null
        );
        setSignedUrls(resolvedUrls);
      } catch (error) {
        console.error("Error fetching signed URLs:", error);
        setSignedUrls([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchSignedUrls();
    } else {
      // サイドバーが閉じられたら再生を停止
      setIsPlaying(false);
    }
  }, [sessionState, sessionToken, isOpen]);

  const [playingIndex, setPlayingIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoUrls = signedUrls;

  const handleNext = () => {
    setPlayingIndex((prevIndex) => (prevIndex + 1) % videoUrls.length);
    setIsPlaying(true); // 次の動画を自動再生
  };

  const handleThumbnailClick = (index: number) => {
    setPlayingIndex(index);
    setIsPlaying(true);
  };

  const handleDownload = async () => {
    const url = videoUrls[playingIndex];
    if (!url) return;
    await downloadFile(url, `video_scene_${playingIndex + 1}.mp4`);
  };

  const handleDownloadScene = async (url: string, index: number) => {
    if (!url) return;
    await downloadFile(url, `video_scene_${index + 1}.mp4`);
  };

  // ダウンロードを処理する共通関数
  const downloadFile = async (url: string, filename: string) => {
    if (!sessionToken) {
      console.error("Download failed: sessionToken is not available.");
      return;
    }

    try {
      // GCSの署名付きURLからバケット名とファイル名を抽出
      const urlObject = new URL(url);
      const path = urlObject.pathname; // /bucket-name/path/to/file.mp4
      const parts = path.split("/");
      if (parts.length < 3) {
        console.error("Invalid GCS URL format:", url);
        return;
      }
      const bucketName = parts[1];
      const fileName = parts.slice(2).join("/");

      // Cloud FunctionのエンドポイントにPOSTリクエストを送信
      const response = await fetch(
        "https://asia-northeast1-aiagenthackathon-469114.cloudfunctions.net/create_signed_url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ bucketName, fileName, download: true }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get download URL: ${response.statusText}`);
      }

      const data = await response.json();
      const downloadUrl = data.signedUrl;

      // 取得したダウンロード用URLを新しいタブで開く
      window.open(downloadUrl, "_blank");
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const currentUrl = videoUrls.length > 0 ? videoUrls[playingIndex] : null;

  return (
    <aside
      className={`absolute bg-surface-dark-400 w-1/2 px-6 py-3 my-3 shadow-lg flex flex-col transform transition-transform duration-300 ease-in-out z-10 right-0 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ height: "calc(100vh - var(--header-height) - 2rem)" }}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-text-light">Video Preview</h2>
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
      <div className="flex flex-col justify-center my-auto mx-0">
        {/* Main Video Player */}
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center text-text-muted">
          {isLoading ? (
            <p>Loading videos...</p>
          ) : videoUrls.length > 0 ? (
            videoUrls.map((url, index) => (
              <div
                key={index}
                className="absolute top-0 left-0 w-full h-full"
                style={{
                  visibility: index === playingIndex ? "visible" : "hidden",
                }}
              >
                <ReactPlayer
                  src={url}
                  playing={index === playingIndex && isPlaying}
                  controls
                  width="100%"
                  height="100%"
                  onEnded={() => {
                    if (index === playingIndex) handleNext();
                  }}
                  onPlay={() => {
                    if (index === playingIndex) setIsPlaying(true);
                  }}
                  onPause={() => {
                    if (index === playingIndex) setIsPlaying(false);
                  }}
                  preload="auto"
                  onProgress={(state) => {
                    // console.log(state);
                  }}
                />
              </div>
            ))
          ) : (
            <p>No videos generated yet.</p>
          )}
        </div>

        {/* Timeline with thumbnails */}
        <div className="flex items-center space-x-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
          {videoUrls.map((url, index) => (
            <div key={index} className="flex flex-col items-center">
              <button
                onClick={() => handleThumbnailClick(index)}
                className={`flex-shrink-0 w-24 h-14 rounded-md overflow-hidden relative border-2 ${
                  playingIndex === index
                    ? "border-brand-primary"
                    : "border-transparent"
                }`}
              >
                <video
                  src={`${url}#t=2`} // 0.1秒時点をサムネイルとして表示
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                />
              </button>
              <div className="mt-1 flex items-center justify-center space-x-2">
                <span className="text-text-light font-bold text-sm">
                  Scene {index + 1}
                </span>
                <button
                  onClick={() => handleDownloadScene(url, index)}
                  className="text-text-muted hover:text-text-light"
                  aria-label={`Download Scene ${index + 1}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      {/* <div className="flex justify-start items-center mt-auto pt-4 space-x-4">
        <button
          onClick={handleDownload}
          disabled={!currentUrl}
          className="bg-surface-dark-300 text-text-light px-6 py-2 rounded-md font-bold hover:bg-surface-dark-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Download
        </button>
      </div> */}
    </aside>
  );
};

export default VideoPreview;

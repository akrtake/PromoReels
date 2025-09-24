// src/App.tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./App.css";
import Header from "./components/Header";
import ChatBox from "./components/ChatBox";
import VideoParameters from "./components/VideoParameter";
import VideoPreview from "./components/VideoPreview";
import Sidebar from "./components/Sidebar";
import HintModal from "./components/HintModal"; // HintModalをインポート
import InitialScreen from "./components/InitialScreen";
import {
  userIdAtom,
  userEmailAtom,
  sessionTokenAtom,
  sessionStateAtom,
  scenesAtom,
  sceneThemesAtom,
  defaultScene,
} from "./atoms";
import HistorySidebar from "./components/HistorySidebar";
import { APP_URL, AGENT_NAME } from "./config";
import { useSetAtom, useAtomValue } from "jotai";
const mode = import.meta.env.MODE;

const SESSION_CHECK_URL = `${window.location.origin}/api/checkSession`;
const APP_BASE_URL =
  mode === "development" ? "http://localhost:8080" : `https://${APP_URL}`;
const App = () => {
  const [isSessionChecked, setIsSessionChecked] = useState(false); //必要があればここで制御するs
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [isHintModalOpen, setIsHintModalOpen] = useState(false); // Hintモーダルの状態を追加
  const [isStarted, setIsStarted] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const setSessionToken = useSetAtom(sessionTokenAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setUserEmail = useSetAtom(userEmailAtom); // Add setter for email
  const setSessionState = useSetAtom(sessionStateAtom);
  const setScenes = useSetAtom(scenesAtom);
  const setSceneThemes = useSetAtom(sceneThemesAtom);
  const sessionToken = useAtomValue(sessionTokenAtom);
  const userId = useAtomValue(userIdAtom);

  useEffect(() => {
    const checkAndSetCookie = async () => {
      try {
        // 1. SESSION_CHECK_URLにアクセスしてsessionCookieを取得
        const sessionCheckResponse = await fetch(SESSION_CHECK_URL, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!sessionCheckResponse.ok) {
          throw new Error("Session check failed.");
        }

        const sessionData = await sessionCheckResponse.json();
        const sessionTokenValue = sessionData.sessionToken; // Assuming backend returns 'sessionToken'
        const userIdValue = sessionData.userId; // Assuming backend returns 'userId'
        const userEmailValue = sessionData.email; // Assuming backend returns 'email'

        if (!sessionTokenValue) {
          throw new Error("Session token not found in response.");
        }
        if (!userIdValue) {
          throw new Error("User ID not found in response.");
        }
        if (!userEmailValue) {
          // You might want to make this non-fatal depending on your backend guarantees
          console.warn("User email not found in session response.");
        }

        setUserId(userIdValue); // Store userId in Jotai
        setUserEmail(userEmailValue || null); // Store email in Jotai

        // 2. 取得したセッショントークンをJotai atomに保存
        setSessionToken(sessionTokenValue); // Store sessionToken in Jotai
        // 3. 処理が成功したらisSessionCheckedをtrueに設定
        setIsSessionChecked(true);
      } catch (error) {
        console.error("Session check and set failed:", error);
        // エラーが発生した場合は、isSessionCheckedをfalseのままにするか、
        // ログインページにリダイレクトするなどの処理を検討
        setIsSessionChecked(false);
      }
    };

    checkAndSetCookie();
  }, []);

  useEffect(() => {
    const checkExistingSession = async () => {
      if (!isSessionChecked || !userId || !sessionToken) return;

      const sessionIdFromQuery = searchParams.get("sessionId");
      if (sessionIdFromQuery) {
        setIsStarted(true);
        const isValidUrl = (urlString: string | undefined | null): boolean => {
          if (!urlString) return false;
          try {
            // 簡単なチェックとして、http, https, gs, blob, data スキームを許可
            return /^(https?:\/\/|gs:\/\/|blob:|data:)/.test(urlString);
          } catch (e) {
            return false;
          }
        };
        const sanitizeSceneConfig = (state: any) => {
          if (!state?.scene_config) return state;
          const newSceneConfig = { ...state.scene_config };
          for (const key in newSceneConfig) {
            const scene = newSceneConfig[key];
            if (scene && !isValidUrl(scene.imageUrl)) {
              scene.imageUrl = "";
            }
          }
          return { ...state, scene_config: newSceneConfig };
        };
        try {
          const API_ENDPOINT = `${APP_BASE_URL}/apps/${AGENT_NAME}/users/${userId}/sessions/${sessionIdFromQuery}`;
          const response = await fetch(API_ENDPOINT, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          if (response.ok) {
            setIsStarted(true); // 既存セッションが見つかったので初期画面をスキップ
            const data = await response.json();
            // console.log("Existing session data:", data);
            if (data.state) {
              const sanitizedState = sanitizeSceneConfig(data.state);
              setSessionState(sanitizedState);
            }
          } else {
            // セッションが見つからない、またはエラー
            setIsStarted(false);
            console.warn(
              `Session ${sessionIdFromQuery} not found, removing from URL.`
            );
            searchParams.delete("sessionId");
            setSearchParams(searchParams, { replace: true });
          }
        } catch (error) {
          console.error("Error validating existing session:", error);
        }
      }
    };
    checkExistingSession();
  }, [
    isSessionChecked,
    userId,
    sessionToken,
    searchParams,
    setSearchParams,
    setSessionState,
  ]);

  const handleMenuClick = (item: string) => {
    if (item === "History") {
      setIsHistorySidebarOpen((prev) => !prev);
      setIsSidebarOpen(false); // 他のサイドバーは閉じる
      setIsVideoPreviewOpen(false); // VideoPreviewを閉じる
    } else {
      // メニュー項目がクリックされたらサイドバーを閉じる
      setIsSidebarOpen(false);
    }
  };

  const handleOpenHintModal = () => {
    setIsHintModalOpen(true);
    // Hintモーダルを開く際は、他のサイドバーを閉じる
    setIsSidebarOpen(false);
    setIsHistorySidebarOpen(false);
  };

  const handleChatViewClick = () => {
    setIsVideoPreviewOpen(false);
  };

  const handleVideoPreviewToggle = () => {
    setIsVideoPreviewOpen((prev) => !prev);
    // 他のサイドバーは閉じる
    setIsHistorySidebarOpen(false);
    setIsSidebarOpen(false);
  };

  const handleStart = async (prompt: string): Promise<void> => {
    if (!userId || !sessionToken) {
      console.error(
        "Cannot start new session: userId or sessionToken is missing."
      );
      // ここでユーザーにエラーを通知することもできます
      return;
    }
    try {
      // 1. 新規セッションを作成
      const API_ENDPOINT = `${APP_BASE_URL}/apps/${AGENT_NAME}/users/${userId}/sessions`;
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) throw new Error("Failed to create a new session.");

      const data = await response.json();
      const newSessionId = data.id;

      // 2. URLに新しいsessionIdを設定し、画面を遷移
      setSearchParams({ sessionId: newSessionId });
      setInitialPrompt(prompt);
      setIsStarted(true);
    } catch (error) {
      console.error("Error starting new chat:", error);
    }
  };

  const handleNewChat = () => {
    setIsVideoPreviewOpen(false); // VideoPreviewを閉じる
    setSessionState(null); // セッションの状態をクリア
    setScenes([defaultScene]); // シーンのパラメータをデフォルトにリセット
    setSceneThemes([]); // シーンのテーマをクリア
    setInitialPrompt(null); // 初期プロンプトをクリア
    navigate("/app", { replace: true }); // URLからsessionIdを削除
    setIsStarted(false); // 初期画面に戻す
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/sessionLogout", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      // ログアウト成功後、ログインページにリダイレクト
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // セッションチェックが完了するまでローディング画面を表示
  if (!isSessionChecked) {
    return (
      <div className="absolute inset-0 bg-background-dark flex items-center justify-center z-50">
        {/* ここにローディングスピナーなどを表示できます */}
      </div>
    );
  }

  return (
    <div className="h-screen bg-background-dark text-text-light flex flex-col overflow-hidden">
      <Header
        onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
        onHistoryClick={() => handleMenuClick("History")}
        onVideoPreviewClick={handleVideoPreviewToggle}
        // onOpenHintModal={() => setIsHintModalOpen(true)} // HeaderにはHintがないので不要
        onChatViewClick={handleChatViewClick}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
        isVideoPreviewOpen={isVideoPreviewOpen}
        isStarted={isStarted}
      />
      <div className="flex flex-grow overflow-hidden relative">
        <Sidebar
          isOpen={isSidebarOpen}
          onMenuClick={handleMenuClick}
          onOpenHintModal={handleOpenHintModal} // SidebarにHintモーダルを開く関数を渡す
          onClose={() => setIsSidebarOpen(false)}
        />
        <HistorySidebar
          isOpen={isHistorySidebarOpen}
          isAuthReady={isSessionChecked}
          onClose={() => setIsHistorySidebarOpen(false)}
        />
        <VideoPreview
          isOpen={isVideoPreviewOpen}
          onClose={() => setIsVideoPreviewOpen(false)}
        />
        <HintModal // HintModalをApp.tsxのルートレベルでレンダリング
          isOpen={isHintModalOpen}
          onClose={() => setIsHintModalOpen(false)}
        />
        <div
          className="flex-grow overflow-y-auto no-scrollbar"
          onClick={() => {
            if (isHistorySidebarOpen) {
              setIsHistorySidebarOpen(false);
            }
            if (isSidebarOpen) {
              setIsSidebarOpen(false);
            }
          }}
        >
          <main
            className={`px-6 py-3 flex flex-col transition-all duration-300 ${
              isHistorySidebarOpen || isSidebarOpen
                ? "blur-sm pointer-events-none"
                : ""
            }`}
          >
            {isStarted ? (
              <>
                <div
                  className="flex space-x-4"
                  style={{
                    height: "calc(100vh - var(--header-height) - 2rem)",
                  }}
                >
                  <VideoParameters />
                  <ChatBox
                    isAuthReady={isSessionChecked}
                    initialPrompt={initialPrompt}
                  />
                </div>
              </>
            ) : (
              <div
                style={{ height: "calc(100vh - var(--header-height) - 2rem)" }}
              >
                <InitialScreen onStart={handleStart} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;

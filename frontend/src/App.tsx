// src/App.tsx
import { useState, useEffect } from "react";
import "./App.css";
import Header from "./components/Header";
import ChatBox from "./components/ChatBox";
import VideoParameters from "./components/VideoParameter";
import VideoPreview from "./components/VideoPreview";
import Sidebar from "./components/Sidebar";
import { userIdAtom, userEmailAtom } from "./atoms"; // Import userEmailAtom
import HistorySidebar from "./components/HistorySidebar";
import { APP_URL } from "./config";
import { useSetAtom } from "jotai";
import { sessionTokenAtom } from "./atoms";
const mode = import.meta.env.MODE;

const SESSION_CHECK_URL = `${window.location.origin}/api/checkSession`;

const App = () => {
  const [isSessionChecked, setIsSessionChecked] = useState(false); //必要があればここで制御するs
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const setSessionToken = useSetAtom(sessionTokenAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setUserEmail = useSetAtom(userEmailAtom); // Add setter for email

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

  const handleMenuClick = (item: string) => {
    if (item === "History") {
      setIsHistorySidebarOpen((prev) => !prev);
    } else {
      setIsHistorySidebarOpen(false);
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
      <Header />
      <div className="flex flex-grow overflow-hidden relative">
        <Sidebar onMenuClick={handleMenuClick} />
        <HistorySidebar
          isOpen={isHistorySidebarOpen}
          isAuthReady={isSessionChecked}
          onClose={() => setIsHistorySidebarOpen(false)}
        />
        <div
          className="flex-grow overflow-y-auto no-scrollbar"
          onClick={() => {
            if (isHistorySidebarOpen) {
              setIsHistorySidebarOpen(false);
            }
          }}
        >
          <main
            className={`p-6 flex flex-col transition-all duration-300 ${
              isHistorySidebarOpen ? "blur-sm pointer-events-none" : ""
            }`}
          >
            <div
              className="flex space-x-4"
              style={{
                height: "calc(100vh - var(--header-height) - 3rem - 1rem)",
              }}
            >
              <VideoParameters />
              <ChatBox isAuthReady={isSessionChecked} />
            </div>
            <div className="mt-4">
              <VideoPreview />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;

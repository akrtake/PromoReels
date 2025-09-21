// src/components/ChatBox.tsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AGENT_NAME, APP_URL } from "../config";
import robotIcon from "../assets/robot.svg";
import { useAtomValue } from "jotai"; // Removed useSetAtom as it's not used here
import { sessionTokenAtom, userIdAtom } from "../atoms"; // Import userIdAtom

interface Message {
  sender: "user" | "ai";
  senderAgent?: string;
  text: string;
}

interface ChatBoxProps {
  isAuthReady: boolean;
}
const mode = import.meta.env.MODE;
const APP_BASE_URL =
  mode === "development" ? "http://localhost:8080" : `https://${APP_URL}`;

const ChatBox = ({ isAuthReady }: ChatBoxProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionToken = useAtomValue(sessionTokenAtom);
  const userId = useAtomValue(userIdAtom); // Get userId from Jotai

  useEffect(() => {
    if (!userId && isAuthReady) {
      // Check userId only if auth is ready
      console.error(
        "User ID is not available from Jotai. This might indicate an issue with session initialization."
      );
      // Depending on the desired behavior, you might want to redirect to login or show an error message.
    }
  }, []);

  // 画面ロード時にセッションIDを生成し、セッションを開始する
  useEffect(() => {
    const initializeSession = async () => {
      setIsLoading(true);
      const querySessionId = searchParams.get("sessionId");

      if (!userId || !sessionToken) {
        console.warn(
          "Cannot initialize session: userId or sessionToken is missing. Waiting for authentication."
        );
        setIsLoading(false);
        return;
      }

      let sessionInitialized = false;

      // 1. URLクエリにsessionIdがある場合、既存セッションの取得を試みる
      if (querySessionId) {
        try {
          const API_ENDPOINT = `${APP_BASE_URL}/apps/${AGENT_NAME}/users/${userId}/sessions/${querySessionId}`;
          const response = await fetch(API_ENDPOINT, {
            method: "GET", // GETでセッション情報を取得
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            // 履歴を復元
            const historyMessages: Message[] = (data.events || [])
              .filter((event: any) => event.content?.parts?.[0]?.text) // テキストを持つイベントのみフィルタリング
              .map((event: any) => ({
                sender: event.content.role === "user" ? "user" : "ai",
                senderAgent: event.author,
                text: event.content.parts
                  .map((part: any) => part.text)
                  .join(""),
              }));
            setMessages(historyMessages);
            setSessionId(querySessionId);
            sessionInitialized = true;
          } else {
            console.warn(
              `Session ${querySessionId} not found or failed to load, creating a new session.`
            );
          }
        } catch (error) {
          console.error(`Error fetching session ${querySessionId}:`, error);
        }
      }

      // 2. URLクエリにsessionIdがない、または取得に失敗した場合、新規セッションを作成
      if (!sessionInitialized) {
        try {
          const API_ENDPOINT = `${APP_BASE_URL}/apps/${AGENT_NAME}/users/${userId}/sessions`;
          const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`APIエラー: ${response.status} ${errorData}`);
          }

          const data = await response.json();
          const newSessionId = data.id;
          setSessionId(newSessionId);
          setSearchParams({ sessionId: newSessionId }); // URLにsessionIdを追加
          setMessages([]); // 新しいセッションなのでメッセージは空
        } catch (error) {
          console.error("セッションの初期化に失敗しました:", error);
          const errorMessage: Message = {
            sender: "ai",
            text: `セッションの初期化中にエラーが発生しました: ${
              error instanceof Error ? error.message : "不明なエラー"
            }`,
          };
          setMessages([errorMessage]);
        }
      }

      setIsLoading(false);
    };

    console.log("isAuthReady:", isAuthReady);
    if (isAuthReady && sessionToken && userId) {
      // Ensure userId is also ready before initializing session
      initializeSession();
    }
  }, [isAuthReady, searchParams, setSearchParams, sessionToken, userId]); // Add sessionToken and userId to dependencies

  useEffect(() => {
    // メッセージが追加されたら一番下までスクロールする
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (
      !inputValue.trim() ||
      isLoading ||
      !sessionId ||
      !userId ||
      !sessionToken
    )
      return; // Add checks for userId and sessionToken

    const userMessage: Message = { sender: "user", text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);

    // AIの応答をリアルタイムに表示するためのプレースホルダーを追加
    setMessages((prev) => [...prev, { sender: "ai", text: "..." }]);
    try {
      // 動的に生成されたセッションIDを使用
      const API_ENDPOINT = `${APP_BASE_URL}/run_sse`;
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          app_name: AGENT_NAME,
          user_id: userId,
          session_id: sessionId,
          new_message: {
            role: "user",
            parts: [{ text: currentInput }],
          },
          streaming: true, // ストリーミングを有効にする
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`APIエラー: ${response.status} ${errorData}`);
      }

      // ストリーミングレスポンスの処理
      if (!response.body) {
        throw new Error("レスポンスボディがありません。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        console.log("Raw SSE chunk:", chunk); // 生のチャンクをコンソールに出力

        // SSEのデータ形式 (data: {...}) をパース
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonData = line.substring(6);
            try {
              const parsedData = JSON.parse(jsonData);
              console.log("Parsed SSE data:", parsedData); // パースしたJSONをコンソールに出力

              if (
                parsedData?.partial !== true &&
                parsedData.content.parts.length > 0
              ) {
                for (let i = 0; i < parsedData.content.parts.length; i++) {
                  if (parsedData.content.parts[i].text)
                    accumulatedText += parsedData.content.parts[i].text;
                }
                // accumulatedText += parsedData.output;
                setMessages((prev) =>
                  prev.map((msg, index) =>
                    index === prev.length - 1
                      ? {
                          ...msg,
                          text: accumulatedText ?? "...",
                          senderAgent: parsedData.author,
                        }
                      : msg
                  )
                );
              }
            } catch (e) {
              // JSONパースエラーは無視（ストリームの途中で不完全なJSONが来ることがあるため）
            }
          }
        }
      }
    } catch (error) {
      console.error("メッセージの送信に失敗しました:", error);
      const errorMessage: Message = {
        sender: "ai",
        text: `エラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="w-3/5 flex flex-col bg-surface-dark-200 p-4 rounded-lg shadow-lg h-full"
      style={{
        height: "calc(100vh - var(--header-height) - 3rem - 1rem)",
      }}
    >
      <div
        ref={chatContainerRef}
        className="flex-grow space-y-4 overflow-y-auto pr-2 no-scrollbar"
      >
        {messages.map((msg, index) => (
          <div key={index} className="flex flex-col">
            {msg.sender === "ai" ? (
              <div className="flex flex-col">
                <div className="text-left text-xs text-text-muted">
                  {msg?.senderAgent ? msg.senderAgent : ""}
                </div>
                <div className="flex items-start space-x-2 self-start mt-1">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                    <img src={robotIcon} alt="AI" className="w-8 h-8" />
                  </div>
                  <div className="py-2 px-4 rounded-xl max-w-full w-fit min-w-[20%] bg-surface-dark-400 text-text-light rounded-tl-none">
                    {msg.text === "..." ? (
                      <div className="flex items-center space-x-1 p-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-left wrap-anywhere">
                        {msg.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 px-4 rounded-xl self-end ml-auto max-w-[80%] w-fit min-w-[20%] bg-surface-dark-300 text-text-light rounded-tr-none">
                <p className="whitespace-pre-wrap text-left">{msg.text}</p>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="text-text-muted">AIが応答を生成中です...</div>
        )}
      </div>

      <div className="mt-4 flex space-x-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          className="flex-grow bg-surface-dark-300 text-text-light p-4 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
          placeholder={
            isLoading ? "応答を待っています..." : "メッセージを入力..."
          }
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          className="bg-brand-primary text-white p-4 rounded-full hover:bg-brand-primary-dark disabled:bg-surface-dark-400 disabled:cursor-not-allowed"
          disabled={isLoading || !inputValue.trim()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 transform rotate-90"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatBox;

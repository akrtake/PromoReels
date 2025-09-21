// src/components/ChatBox.tsx
import React, { useState, useEffect, useRef, type HTMLAttributes } from "react";
import { useSearchParams } from "react-router-dom";
import { AGENT_NAME, APP_URL } from "../config";
import robotIcon from "../assets/robot.svg";
import { useAtom, useAtomValue } from "jotai";
import {
  sessionTokenAtom,
  userIdAtom,
  scenesAtom,
  type Scene,
  promptQueueAtom,
} from "../atoms";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  sender: "user" | "ai";
  senderAgent?: string;
  text: string;
}

interface ChatBoxProps {
  isAuthReady: boolean;
  initialPrompt?: string | null;
}

interface CustomCodeProps extends HTMLAttributes<HTMLElement> {
  node?: any;
  inline?: boolean;
}

const mode = import.meta.env.MODE;
const APP_BASE_URL =
  mode === "development" ? "http://localhost:8080" : `https://${APP_URL}`;

const ChatBox = ({ isAuthReady, initialPrompt }: ChatBoxProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionToken = useAtomValue(sessionTokenAtom);
  const userId = useAtomValue(userIdAtom); // Get userId from Jotai
  const [scenes, setScenes] = useAtom(scenesAtom);
  const [promptQueue, setPromptQueue] = useAtom(promptQueueAtom);

  // initialPromptが渡されたら、それを最初のメッセージとして送信する
  useEffect(() => {
    if (initialPrompt && sessionId && !isLoading && messages.length === 0) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt, sessionId]);

  // VideoParameterから渡されたプロンプトを監視して送信する
  useEffect(() => {
    if (promptQueue && !isLoading) {
      handleSendMessage(promptQueue);
      setPromptQueue(null); // 送信後にキューをクリア
    }
  }, [promptQueue]);

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
      const querySessionId = searchParams.get("sessionId");

      if (!userId || !sessionToken || !querySessionId) {
        console.warn(
          "Cannot initialize session: userId, sessionToken, or sessionId is missing."
        );
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

  const handleApplyParameters = (jsonString: string) => {
    try {
      const parsedJson = JSON.parse(jsonString);
      // director_agentは単一のオブジェクトを返すので、配列でラップする
      // VideoParameterコンポーネントはScene[]を期待している
      if (Array.isArray(parsedJson)) {
        setScenes(parsedJson as Scene[]);
      } else {
        setScenes([parsedJson as Scene]);
      }
      // TODO: ユーザーへの成功通知（例: トーストメッセージ）
    } catch (error) {
      console.error("Failed to parse JSON and apply parameters:", error);
      // TODO: ユーザーへのエラー通知
    }
  };
  const handleSendMessage = async (prompt?: string) => {
    const messageToSend = prompt || inputValue;
    if (
      !messageToSend.trim() ||
      isLoading ||
      !sessionId ||
      !userId ||
      !sessionToken
    )
      return; // Add checks for userId and sessionToken

    const userMessage: Message = { sender: "user", text: messageToSend };
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
            parts: [{ text: messageToSend }],
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
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // ストリームの最後にバッファに残っているデータを処理
          if (buffer.startsWith("data: ")) {
            const jsonData = buffer.substring(6);
            if (jsonData) {
              try {
                JSON.parse(jsonData); // ここでパースを試みる
              } catch (e) {
                console.warn(
                  "Stream ended with incomplete JSON data in buffer:",
                  jsonData
                );
              }
            }
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        console.log("Raw SSE chunk received, buffer is now:", buffer); // 生のチャンクとバッファの状態をコンソールに出力

        console.log("改行インデックス", buffer.indexOf("\n"));
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);

          if (line.startsWith("data: ")) {
            const jsonData = line.substring(6);
            if (!jsonData) continue; // 空のdata行はスキップ

            try {
              const parsedData = JSON.parse(jsonData);
              console.log("Parsed SSE data:", parsedData); // パースしたJSONをコンソールに出力

              if (
                parsedData?.partial !== true &&
                parsedData.content?.parts?.length > 0
              ) {
                parsedData.content.parts.forEach((part: any) => {
                  if (part.text) {
                    accumulatedText += part.text;
                  }
                });
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage && lastMessage.sender === "ai") {
                    lastMessage.text = accumulatedText;
                    lastMessage.senderAgent = parsedData.author;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.warn(
                "JSON parse error, probably incomplete JSON. Waiting for more chunks.",
                jsonData
              );
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
      className="w-1/2 flex flex-col bg-surface-dark-200 p-4 rounded-lg shadow-lg h-full"
      style={{
        height: "calc(100vh - var(--header-height) - 3rem - 1rem)",
      }}
    >
      {/* <div className="flex justify-between items-center mb-2 h-9">
        <h2 className="text-lg font-semibold text-text-light">Chat</h2>
      </div> */}
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
                      <div className="prose text-text-light text-start prose-pre:whitespace-pre-wrap prose-pre:break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code(props: CustomCodeProps) {
                              const {
                                node,
                                inline,
                                className,
                                children,
                                ...rest
                              } = props;
                              console.log(props);
                              const match = /language-(\w+)/.exec(
                                className || ""
                              );
                              const lang = match ? match[1] : "";
                              const codeString = String(children).replace(
                                /\n$/,
                                ""
                              );

                              return !inline && lang === "json" ? (
                                <div className="relative group">
                                  <pre
                                    {...rest}
                                    className={`${className} p-0 mt-0 mb-0`}
                                  >
                                    <code>{children}</code>
                                  </pre>
                                  <button
                                    onClick={() =>
                                      handleApplyParameters(codeString)
                                    }
                                    className="absolute bottom-2 left-2 bg-brand-primary text-white text-xs font-bold py-1 px-2 rounded hover:bg-brand-primary-dark transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    Apply to Parameters
                                  </button>
                                </div>
                              ) : (
                                <code className={className} {...rest}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
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
          onClick={() => handleSendMessage()}
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

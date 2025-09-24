// src/components/ChatBox.tsx
import React, { useState, useEffect, useRef, type HTMLAttributes } from "react";
import { useSearchParams } from "react-router-dom";
import { AGENT_NAME, APP_URL } from "../config";
import robotIcon from "../assets/robot.svg"; // useSetAtom をインポート
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  sessionTokenAtom,
  userIdAtom,
  sessionStateAtom,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionToken = useAtomValue(sessionTokenAtom);
  const userId = useAtomValue(userIdAtom); // Get userId from Jotai
  const setSessionState = useSetAtom(sessionStateAtom); // sessionState を更新するための setter を取得
  const [historyRestoredFromState, setHistoryRestoredFromState] =
    useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false); // クイック返信リストの表示状態
  const quickReplyRef = useRef<HTMLDivElement>(null); // クイック返信エリアのref
  const [promptQueue, setPromptQueue] = useAtom(promptQueueAtom);
  const quickReplies = ["OKです", "おまかせでお願い！", "返事は？"];

  const toggleQuickReplies = () => {
    setShowQuickReplies((prev) => !prev);
  };

  // initialPromptが渡されたら、それを最初のメッセージとして送信する
  useEffect(() => {
    if (initialPrompt && sessionId && !isLoading && messages.length === 0) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt, sessionId]);

  // クイック返信リストの外側をクリックしたときに閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickReplyRef.current &&
        !quickReplyRef.current.contains(event.target as Node)
      ) {
        setShowQuickReplies(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // テキストエリアの高さ自動調整
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // 高さを一度リセット
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight}px`; // 内容に合わせた高さに設定
    }
  }, [inputValue]);

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
        // console.log("Raw SSE chunk received, buffer is now:", buffer); // 生のチャンクとバッファの状態をコンソールに出力

        // console.log("改行インデックス", buffer.indexOf("\n"));
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);

          if (line.startsWith("data: ")) {
            const jsonData = line.substring(6);
            if (!jsonData) continue; // 空のdata行はスキップ

            try {
              const parsedData = JSON.parse(jsonData);
              // console.log("Parsed SSE data:", parsedData); // パースしたJSONをコンソールに出力

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
                    lastMessage.text = accumulatedText || "...";
                    lastMessage.senderAgent = parsedData.author;
                    // console.log("Updated AI message:", lastMessage);
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
      // AIの応答が完了したら、セッション情報を再取得して sessionState を更新する
      if (sessionId && userId && sessionToken) {
        try {
          const isValidUrl = (
            urlString: string | undefined | null
          ): boolean => {
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

          const API_ENDPOINT = `${APP_BASE_URL}/apps/${AGENT_NAME}/users/${userId}/sessions/${sessionId}`;
          const response = await fetch(API_ENDPOINT, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.state) {
              const sanitizedState = sanitizeSceneConfig(data.state);
              setSessionState(sanitizedState);
            }
          } else {
            console.error("Failed to fetch session state after message send.");
          }
        } catch (error) {
          console.error(
            "Error fetching session state after message send:",
            error
          );
        }
      }
      setIsLoading(false);
    }
  };

  const handleQuickReplyClick = (replyText: string) => {
    handleSendMessage(replyText); // 返信テキストを直接送信
    setShowQuickReplies(false); // リストを閉じる
  };

  return (
    <div
      className="w-1/2 flex flex-col bg-surface-dark-200 px-4 py-3 rounded-lg shadow-lg h-full"
      style={{
        height: "calc(100vh - var(--header-height) - 2rem)",
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
                              // console.log(props);

                              return !inline ? (
                                <pre
                                  {...rest}
                                  className={`${className} p-0 mt-0 mb-0`}
                                >
                                  <code>{children}</code>
                                </pre>
                              ) : (
                                <code className={className} {...rest}>
                                  {children}
                                </code>
                              );
                            },
                            strong: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <strong
                                  className="font-extrabold text-text-light"
                                  {...rest}
                                >
                                  {children}
                                </strong>
                              );
                            },
                            h1: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <h1 className="text-white" {...rest}>
                                  {children}
                                </h1>
                              );
                            },
                            h2: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <h2
                                  className="text-white text-xl mb-[0.5em]"
                                  {...rest}
                                >
                                  {children}
                                </h2>
                              );
                            },
                            h3: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <h3
                                  className="text-white text-lg mb-[0.5em]"
                                  {...rest}
                                >
                                  {children}
                                </h3>
                              );
                            },
                            h4: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <h4 className="text-white mb-[0.5em]" {...rest}>
                                  {children}
                                </h4>
                              );
                            },
                            a: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <a className="text-text-muted" {...rest}>
                                  {children}
                                </a>
                              );
                            },
                            li: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <li className="my-[0.5em]" {...rest}>
                                  {children}
                                </li>
                              );
                            },
                            ul: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <ul className="my-[0.5em]" {...rest}>
                                  {children}
                                </ul>
                              );
                            },
                            p: (props: CustomCodeProps) => {
                              const { children, ...rest } = props;
                              return (
                                <p className="mt-[0.75em] mb-0" {...rest}>
                                  {children}
                                </p>
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

      <div className="mt-1">
        <div className="flex items-end px-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              // Shift+Enterで改行、Enterのみで送信
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-grow bg-surface-dark-300 text-text-light px-4 py-3 rounded-3xl focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 resize-none overflow-y-auto "
            placeholder={
              isLoading ? "応答を待っています..." : "メッセージを入力..."
            }
            disabled={isLoading}
          />
          <div className="relative" ref={quickReplyRef}>
            {/* クイック返信ボタン */}
            <button
              type="button"
              onClick={toggleQuickReplies}
              className="p-2 rounded-full text-text-light bg-brand-primary hover:bg-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed ml-2 mb-1"
              aria-label="クイック返信"
              disabled={isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </button>

            {/* クイック返信リスト */}
            {showQuickReplies && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-surface-dark-300 border-brand-primary border-2 rounded-lg shadow-lg z-20">
                <ul className="py-1">
                  {quickReplies.map((reply, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handleQuickReplyClick(reply)}
                        className="block w-full text-left px-4 py-2 text-sm text-text-light hover:bg-surface-dark-400"
                      >
                        {reply}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        {/* <button
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
        </button> */}
      </div>
    </div>
  );
};

export default ChatBox;

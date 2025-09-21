import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AGENT_NAME, APP_URL } from "../config";
import { useAtomValue } from "jotai";
import { sessionTokenAtom, userIdAtom } from "../atoms"; // Import userIdAtom

interface Session {
  id: string;
  lastUpdateTime: number;
}

interface HistorySidebarProps {
  isOpen: boolean;
  isAuthReady: boolean;
  onClose: () => void;
}

const HistorySidebar = ({
  isOpen,
  isAuthReady,
  onClose,
}: HistorySidebarProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionToken = useAtomValue(sessionTokenAtom); // Get sessionToken from Jotai
  const userId = useAtomValue(userIdAtom); // Get userId from Jotai

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);

      if (!sessionToken || !userId) {
        console.warn(
          "Cannot fetch sessions: sessionToken or userId is missing. Waiting for authentication."
        );
        setIsLoading(false);
        return;
      }

      try {
        const API_ENDPOINT = `https://${APP_URL}/apps/${AGENT_NAME}/users/${userId}/sessions`;

        const response = await fetch(API_ENDPOINT, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionToken}`, // Use sessionToken from Jotai
            "Content-Type": "application/json",
          },
          // Removed credentials: "include" as sessionToken is used for authorization
        });

        if (!response.ok) {
          throw new Error("Failed to fetch sessions");
        }

        const data: Session[] = await response.json();
        data.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
        setSessions(data);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthReady && sessionToken && userId) {
      // Fetch only if auth is ready and tokens are available
      fetchSessions();
    }
  }, [isAuthReady, sessionToken, userId]); // Add sessionToken and userId to dependencies

  const currentSessionId = searchParams.get("sessionId");

  const handleSessionClick = (sessionId: string) => {
    // 別のセッションがクリックされた場合のみ、URLを更新してサイドバーを閉じる
    if (sessionId !== currentSessionId) {
      setSearchParams({ sessionId });
      onClose();
    }
  };

  return (
    <aside
      className={`absolute bg-surface-dark-300 w-64 p-4 flex-shrink-0 transform transition-transform duration-300 ease-in-out z-10 left-48 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ height: "calc(100vh - var(--header-height))" }}
    >
      <h2 className="text-lg font-bold mb-4 text-text-light">History</h2>
      {isLoading ? (
        <p className="text-text-muted">Loading sessions...</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto h-full no-scrollbar pb-10">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                onClick={() => handleSessionClick(session.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors truncate ${
                  session.id === currentSessionId
                    ? "bg-brand-secondary text-text-light font-semibold"
                    : "text-text-muted hover:bg-surface-dark-400 hover:text-text-light"
                }`}
              >
                {session.id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};

export default HistorySidebar;

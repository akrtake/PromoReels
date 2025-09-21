import React, { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { userEmailAtom } from "../atoms";

interface HeaderProps {
  onMenuToggle: () => void;
  onHistoryClick: () => void;
  onVideoPreviewClick: () => void;
  onChatViewClick: () => void;
  onNewChat: () => void;
  isVideoPreviewOpen: boolean;
}

const Header = ({
  onMenuToggle,
  onHistoryClick,
  onChatViewClick,
  onVideoPreviewClick,
  onNewChat,
  isVideoPreviewOpen,
}: HeaderProps) => {
  const userEmail = useAtomValue(userEmailAtom);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Effect to handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex justify-between items-center py-2 px-6 border-b border-surface-dark-300">
      <div className="flex items-center space-x-2">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-md text-text-light hover:bg-surface-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          aria-label="Toggle menu"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <img src="/app_icon.png" alt="Aether Reels Logo" className="h-8 w-8" />
        <span className="text-2xl font-bold">Aether Reels</span>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onVideoPreviewClick}
          className={`p-2 rounded-full transition-colors ${
            isVideoPreviewOpen
              ? "text-text-light bg-brand-primary hover:bg-brand-primary-dark hover:text-text-light"
              : "hover:text-text-light hover:bg-surface-dark-300"
          }`}
          aria-label="Show Video Preview"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
        </button>
        <button
          onClick={onChatViewClick}
          className={`p-2 rounded-full transition-colors ${
            !isVideoPreviewOpen
              ? "text-text-light bg-brand-primary hover:bg-brand-primary-dark"
              : "text-text-muted hover:text-text-light hover:bg-surface-dark-300"
          }`}
          aria-label="Show Chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-full text-text-muted hover:bg-surface-dark-300 hover:text-text-light transition-colors"
          aria-label="New Chat"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
        <button
          onClick={onHistoryClick}
          className="p-2 rounded-full text-text-muted hover:bg-surface-dark-300 hover:text-text-light transition-colors"
          aria-label="Show History"
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="flex items-center justify-center h-10 w-10 bg-surface-dark-400 rounded-full text-text-light hover:bg-surface-dark-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-brand-primary"
            aria-haspopup="true"
            aria-expanded={isDropdownOpen}
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 top-10 mt-2 w-auto bg-surface-dark-300 rounded-md shadow-lg py-2 px-4 z-50">
              <span className="text-sm text-text-light whitespace-nowrap">
                {userEmail || "Loading..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;

import React, { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { userEmailAtom } from "../atoms";

const Header = () => {
  const userEmail = useAtomValue(userEmailAtom);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleDropdown = () => {
    // ドロップダウンが現在開いている場合（これから閉じる場合）
    if (isDropdownOpen) {
      buttonRef.current?.blur(); // ボタンからフォーカスを外す
    }
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
        <img src="/app_icon.png" alt="Aether Reels Logo" className="h-8 w-8" />
        <span className="text-2xl font-bold">Aether Reels</span>
      </div>
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
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
          <div className="absolute right-0 mt-2 w-auto bg-surface-dark-300 rounded-md shadow-lg py-2 px-4 z-50">
            <span className="text-sm text-text-light whitespace-nowrap">
              {userEmail || "Loading..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;

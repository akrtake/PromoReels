import React, { useState } from "react";

const menuItems = ["Create Image", "Create Video", "Assets", "Gallery", "Hint"];

interface SidebarProps {
  onMenuClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenHintModal: () => void; // Hintモーダルを開くためのプロパティを追加
}

const Sidebar = ({
  onMenuClick,
  isOpen,
  onClose,
  onOpenHintModal,
}: SidebarProps) => {
  const [activeItem, setActiveItem] = useState("Create Video");

  const handleClick = (item: string) => {
    if (item === "Hint") {
      onOpenHintModal(); // Hintモーダルを開く関数を呼び出す
    } else {
      setActiveItem(item);
      onMenuClick(item);
      // メニュー項目をクリックしたらサイドバーを閉じる
      onClose();
    }
  };

  return (
    <aside
      className={`absolute bg-surface-dark-200 w-48 p-4 flex-shrink-0 pt-6 transform transition-transform duration-300 ease-in-out z-20 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ height: "calc(100vh - var(--header-height))" }}
    >
      <nav>
        <ul>
          {menuItems.map((item) => {
            const isEnabled = item === "Create Video" || item === "Hint";
            return (
              <li key={item} className="mb-2">
                <button
                  onClick={() => handleClick(item)}
                  disabled={!isEnabled}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors duration-200 ${
                    activeItem === item && isEnabled
                      ? "bg-brand-secondary text-text-light font-semibold"
                      : "text-text-muted"
                  } ${
                    isEnabled
                      ? "hover:bg-surface-dark-300 hover:text-text-light"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  {item}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

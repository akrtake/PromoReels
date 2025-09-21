import React, { useState } from "react";

const menuItems = [
  "Create Image",
  "Create Video",
  "Assets",
  "Gallery",
  "Howto",
];

interface SidebarProps {
  onMenuClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ onMenuClick, isOpen, onClose }: SidebarProps) => {
  const [activeItem, setActiveItem] = useState("Create Video");

  const handleClick = (item: string) => {
    setActiveItem(item);
    onMenuClick(item);
    // メニュー項目をクリックしたらサイドバーを閉じる
    onClose();
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
          {menuItems.map((item) => (
            <li key={item} className="mb-2">
              <button
                onClick={() => handleClick(item)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors duration-200 ${
                  activeItem === item
                    ? "bg-brand-secondary text-text-light font-semibold"
                    : "text-text-muted hover:bg-surface-dark-300 hover:text-text-light"
                }`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

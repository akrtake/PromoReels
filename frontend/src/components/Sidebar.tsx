import React, { useState } from "react";

const menuItems = [
  "Create Image",
  "Create Video",
  "History",
  "Assets",
  "Gallery",
  "Howto",
];

interface SidebarProps {
  onMenuClick: (item: string) => void;
}

const Sidebar = ({ onMenuClick }: SidebarProps) => {
  const [activeItem, setActiveItem] = useState("Create Video");

  const handleClick = (item: string) => {
    setActiveItem(item);
    onMenuClick(item);
  };

  return (
    <aside className="w-48 bg-surface-dark-200 p-4 flex-shrink-0 pt-6 z-20 relative">
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

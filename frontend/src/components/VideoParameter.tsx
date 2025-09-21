// src/components/VideoParameters.tsx
import React from "react";

const VideoParameters = () => {
  const scenes = [
    "Scene 1",
    "Scene 2",
    "Scene 3",
    "Scene 4",
    "Scene 5",
    "Scene 6",
    "Scene 7",
  ];
  return (
    <div
      className="w-2/5 bg-surface-dark-200 p-6 rounded-lg shadow-lg flex flex-col h-full"
      style={{
        height: "calc(100vh - var(--header-height) - 3rem - 1rem)",
      }}
    >
      <div className="flex items-center mb-4">
        <h2 className="text-lg font-semibold mr-4">Scenes</h2>
        <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {scenes.map((scene, index) => (
            <button
              key={index}
              className="bg-surface-dark-300 hover:bg-surface-dark-400 px-4 py-2 rounded flex-shrink-0 whitespace-nowrap"
            >
              {scene}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {/* Row 1 */}
        <div className="flex items-center space-x-4">
          <span className="text-text-muted">Duration:</span>
          <select className="bg-surface-dark-300 text-text-light px-2 py-1 rounded w-32">
            <option>30 seconds</option>
          </select>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-text-muted">Style:</span>
          <select className="bg-surface-dark-300 text-text-light px-2 py-1 rounded w-32">
            <option>1920x1080</option>
          </select>
        </div>

        {/* Row 2 */}
        <div className="flex items-center space-x-4">
          {/* <span className="text-text-muted">Resolution:</span> */}
          <select className="bg-surface-dark-300 text-text-light px-2 py-1 rounded w-32">
            <option>1920x1080</option>
          </select>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-text-muted">Music:</span>
          <select className="bg-surface-dark-300 text-text-light px-2 py-1 rounded w-32">
            <option>Ambient Synthwave</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <span className="text-text-muted">Description:</span>
        <textarea
          className="w-full h-24 bg-surface-dark-300 text-text-light p-4 rounded-lg mt-2 resize-none"
          placeholder="Description here..."
          defaultValue="Description: Sleek a the tksitles city..."
        ></textarea>
      </div>
    </div>
  );
};

export default VideoParameters;

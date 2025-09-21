// src/components/VideoPreview.tsx
import React from "react";

const VideoPreview: React.FC = () => {
  return (
    <div className="bg-surface-dark-200 p-6 rounded-lg shadow-lg flex-grow flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Video Preview / Results</h2>

      {/* Main Video Player */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src="https://googleusercontent.com/image_generation_content/0"
          alt="Video Preview"
          className="w-full h-full object-cover"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-20 w-20 text-white opacity-80 cursor-pointer"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>

      {/* Timeline with thumbnails */}
      <div className="flex items-center space-x-2 mt-4">
        <div className="w-12 h-12 bg-gray-500 rounded-md"></div>
        <div className="w-12 h-12 bg-gray-500 rounded-md"></div>
        <div className="w-12 h-12 bg-gray-500 rounded-md"></div>
        <div className="w-12 h-12 bg-gray-500 rounded-md"></div>
        {/* ... More thumbnails */}
      </div>

      <div className="flex items-center space-x-4 mt-4">
        <div className="bg-surface-dark-300 rounded-full w-full h-2">
          <div className="bg-brand-primary h-2 rounded-full w-1/2"></div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center mt-6">
        <div className="flex space-x-4">
          <button className="bg-brand-primary text-text-light px-6 py-2 rounded-md font-bold hover:bg-brand-secondary transition-colors">
            Generate Video
          </button>
          <button className="bg-surface-dark-300 text-text-light px-6 py-2 rounded-md font-bold hover:bg-surface-dark-400 transition-colors">
            Download
          </button>
        </div>
        <button className="bg-surface-dark-300 text-text-light px-6 py-2 rounded-md font-bold hover:bg-surface-dark-400 transition-colors">
          Share
        </button>
      </div>
    </div>
  );
};

export default VideoPreview;

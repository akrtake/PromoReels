import { atom } from "jotai";

// 各シーンのパラメータの型定義
export interface Scene {
  description: string;
  style: string;
  camera: string;
  lens: string;
  lighting: string;
  environment: string;
  audio: string;
  elements: string[];
  motion: string;
  ending: string;
  text: string;
  keywords: string[];
  imageUrl?: string;
}

// デフォルトの空のシーン
export const defaultScene: Scene = {
  description: "",
  style: "",
  camera: "",
  lens: "",
  lighting: "",
  environment: "",
  audio: "",
  elements: [],
  motion: "",
  ending: "",
  text: "none",
  keywords: [],
  imageUrl: "",
};

export interface SessionState {
  scene_config?: Record<string, Scene> | null;
  theme_list?: Record<string, string> | null;
  movie_urls?: Record<string, string[]> | null;
  // 他のstateプロパティも必要に応じて追加
}

export const sessionTokenAtom = atom<string | null>(null);
export const userIdAtom = atom<string | null>(null);
export const userEmailAtom = atom<string | null>(null);
export const scenesAtom = atom<Scene[]>([defaultScene]);
export const sceneThemesAtom = atom<string[]>([]);
export const promptQueueAtom = atom<string | null>(null);
export const sessionStateAtom = atom<SessionState | null>(null);

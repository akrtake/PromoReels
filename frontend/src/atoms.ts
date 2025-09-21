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
}

// デフォルトの空のシーン
export const defaultScene: Scene = {
  description: "Initial scene description",
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
};

export const sessionTokenAtom = atom<string | null>(null);
export const userIdAtom = atom<string | null>(null);
export const userEmailAtom = atom<string | null>(null);
export const scenesAtom = atom<Scene[]>([defaultScene]);
export const promptQueueAtom = atom<string | null>(null);

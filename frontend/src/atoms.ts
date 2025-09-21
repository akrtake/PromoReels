import { atom } from "jotai";

export const sessionTokenAtom = atom<string | null>(null);
export const userIdAtom = atom<string | null>(null);
export const userEmailAtom = atom<string | null>(null);

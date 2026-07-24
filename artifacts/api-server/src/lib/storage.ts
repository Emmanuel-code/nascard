import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readStore<T>(name: string): Map<string, T> {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return new Map();
  try {
    const raw = fs.readFileSync(fp, "utf-8");
    const obj = JSON.parse(raw) as Record<string, T>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function writeStore<T>(name: string, store: Map<string, T>): void {
  const fp = filePath(name);
  const obj = Object.fromEntries(store.entries());
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), "utf-8");
}

export function readList<T>(name: string): Map<string, T[]> {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return new Map();
  try {
    const raw = fs.readFileSync(fp, "utf-8");
    const obj = JSON.parse(raw) as Record<string, T[]>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function writeList<T>(name: string, store: Map<string, T[]>): void {
  const fp = filePath(name);
  const obj = Object.fromEntries(store.entries());
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), "utf-8");
}

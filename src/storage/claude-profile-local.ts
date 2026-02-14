import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import type {
  ClaudeProfileStorage,
  ModelProfileInfo,
} from "./claude-profile-interface.js";

const DEFAULT_CLAUDE_DIR = join(homedir(), ".claude", "claude");

/**
 * Local filesystem storage for Claude self-profiles.
 * Storage path: ~/.claude/claude/{modelId}.md
 */
export class LocalClaudeProfileStorage implements ClaudeProfileStorage {
  private readonly baseDir: string;

  constructor(baseDir: string = DEFAULT_CLAUDE_DIR) {
    this.baseDir = baseDir;
  }

  private getFilePath(modelId: string): string {
    return join(this.baseDir, `${modelId}.md`);
  }

  async read(modelId: string): Promise<string | null> {
    const filePath = this.getFilePath(modelId);
    if (!existsSync(filePath)) {
      return null;
    }
    return await readFile(filePath, "utf-8");
  }

  async write(modelId: string, content: string): Promise<void> {
    const filePath = this.getFilePath(modelId);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
  }

  async exists(modelId: string): Promise<boolean> {
    return existsSync(this.getFilePath(modelId));
  }

  async list(): Promise<ModelProfileInfo[]> {
    if (!existsSync(this.baseDir)) {
      return [];
    }

    const files = await readdir(this.baseDir);
    const profiles: ModelProfileInfo[] = [];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const modelId = file.slice(0, -3);
      const filePath = join(this.baseDir, file);
      const fileStat = await stat(filePath);

      profiles.push({
        modelId,
        size: fileStat.size,
        lastModified: fileStat.mtime,
      });
    }

    return profiles;
  }

  getLocation(modelId: string): string {
    return this.getFilePath(modelId);
  }
}

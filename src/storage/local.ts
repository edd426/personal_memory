import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import type { ProfileStorage } from "./interface.js";

const DEFAULT_PROFILE_PATH = join(homedir(), ".claude", "me.md");

/**
 * Local filesystem storage for profiles.
 * Used for local Claude Code sessions.
 */
export class LocalProfileStorage implements ProfileStorage {
  private readonly profilePath: string;

  constructor(profilePath: string = DEFAULT_PROFILE_PATH) {
    this.profilePath = profilePath;
  }

  async read(): Promise<string | null> {
    if (!existsSync(this.profilePath)) {
      return null;
    }
    return await readFile(this.profilePath, "utf-8");
  }

  async write(content: string): Promise<void> {
    await mkdir(dirname(this.profilePath), { recursive: true });
    await writeFile(this.profilePath, content, "utf-8");
  }

  async exists(): Promise<boolean> {
    return existsSync(this.profilePath);
  }

  getLocation(): string {
    return this.profilePath;
  }
}

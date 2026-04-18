import https from "node:https";
import type { V0Design } from "../types/index.js";
import { logger } from "../observability/logger.js";

interface V0File {
  name: string;
  content: string;
}

interface V0Version {
  id: string;
  files?: V0File[];
  createdAt?: string;
}

interface V0ChatDetail {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
  latestVersion?: V0Version;
  /** First user message, if any */
  initialMessage?: string;
}

/**
 * Shape of one message returned by GET /v1/chats/:id/messages.
 * The `content` field is either plain text or JSON-encoded MessageBinaryFormat.
 */
interface V0Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface V0MessagesResponse {
  data: V0Message[];
}

export interface V0Chat {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
}

interface V0ChatsResponse {
  data: V0Chat[];
}

/**
 * The v0 Platform API returns message content as a
 * MessageBinaryFormat: an array of [type, payload] tuples.
 * Type 0 = rich content rows (markdown, code blocks, etc.)
 * Code blocks appear as ['Codeblock', { lang: string }, 'source code']
 * inside the payload array.
 */
type MBFTuple = [string | number, ...unknown[]];
type MessageBinaryFormat = MBFTuple[];

/** Returns true when a file's content is a v0 streaming placeholder, not real code. */
function isPlaceholder(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed === "GENERATING" ||
    trimmed === "" ||
    trimmed === "..." ||
    trimmed.startsWith("GENERATING")
  );
}

/**
 * Fetches the latest code from an existing v0.app chat by URL or chat ID.
 * Uses the v0 Platform API at https://api.v0.dev.
 *
 * Strategy (in order):
 *  1. GET /v1/chats/:id  → latestVersion.files  (preferred — no format parsing)
 *  2. GET /v1/chats/:id/messages → walk MessageBinaryFormat for Codeblock tuples
 */
export class V0ChatFetcher {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env["V0_API_KEY"] ?? "";
    this.baseUrl = "https://api.v0.dev";
  }

  /**
   * Given a v0.app chat URL (e.g. https://v0.app/chat/my-design-abc123)
   * or a bare chat ID, fetch the last generated code and return a V0Design.
   */
  async fetchFromUrl(urlOrId: string): Promise<V0Design> {
    if (!this.apiKey) {
      throw new Error(
        "V0_API_KEY environment variable is not set. " +
          "Please set it before using --design-url."
      );
    }

    const chatId = this.extractChatId(urlOrId);
    logger.info("Fetching design from v0 chat", { chatId });

    // ── Strategy 1: GET /v1/chats/:id → latestVersion.files ─────────────────
    const chat = await this.getJson<V0ChatDetail>(`/v1/chats/${encodeURIComponent(chatId)}`);
    const files = chat.latestVersion?.files ?? [];

    const realFiles = files.filter((f) => !isPlaceholder(f.content));

    if (realFiles.length > 0) {
      logger.info("Loaded design from chat latestVersion.files", {
        chatId,
        fileCount: realFiles.length,
      });
      const code = realFiles.map((f) => `// ${f.name}\n${f.content}`).join("\n\n");
      return {
        id: chatId,
        prompt: chat.title ?? chat.initialMessage ?? "",
        code,
        framework: "nextjs",
        createdAt: chat.latestVersion?.createdAt ?? chat.updatedAt ?? new Date().toISOString(),
      };
    }

    if (files.length > 0 && realFiles.length === 0) {
      throw new Error(
        `Chat "${chatId}" is still generating. ` +
          "Wait for v0 to finish, then run the command again."
      );
    }

    // ── Strategy 2: GET /v1/chats/:id/messages → parse MessageBinaryFormat ──
    logger.info("No files in latestVersion, falling back to message parsing", { chatId });
    const msgResponse = await this.getJson<V0MessagesResponse>(
      `/v1/chats/${encodeURIComponent(chatId)}/messages`
    );
    const messages: V0Message[] = msgResponse.data ?? [];
    const code = this.extractLatestCode(messages);

    if (!code) {
      throw new Error(
        `No generated code found in chat "${chatId}". ` +
          "Make sure the chat has at least one assistant response with code."
      );
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    return {
      id: chatId,
      prompt: chat.title ?? this.extractUserPrompt(messages),
      code,
      framework: "nextjs",
      createdAt: lastAssistant?.createdAt ?? new Date().toISOString(),
    };
  }

  /** Extract the chat ID from a v0.app URL or return the input as-is.
   *
   * v0.app URL slugs have the form: /chat/<human-title>-<id>
   * The actual API chat ID is the final hyphen-delimited segment, e.g.:
   *   porsche-boxster-listings-pd42rZVczaW  →  pd42rZVczaW
   *   tarporley-mechanic-website-yotfFLYfeIJ  →  yotfFLYfeIJ
   */
  extractChatId(urlOrId: string): string {
    // Pull the path segment out of a full URL
    const urlMatch = urlOrId.match(/https?:\/\/v0\.[a-z]+\/chat\/([^/?#]+)/);
    const slug = urlMatch?.[1] ?? urlOrId.trim();

    // The ID is the last dash-separated token (mixed-case alphanumeric)
    const parts = slug.split("-");
    const lastPart = parts[parts.length - 1];
    // Only treat it as an ID suffix when it looks like a random token (≥8 chars, mixed case)
    if (parts.length > 1 && /^[A-Za-z0-9]{8,}$/.test(lastPart)) {
      return lastPart;
    }

    return slug;
  }

  /** Walk MessageBinaryFormat and collect all Codeblock source strings. */
  private extractLatestCode(messages: V0Message[]): string | null {
    // Walk from last message backwards, return first assistant message with code
    for (const msg of [...messages].reverse()) {
      if (msg.role !== "assistant") continue;

      let parsed: MessageBinaryFormat;
      try {
        parsed = JSON.parse(msg.content) as MessageBinaryFormat;
      } catch {
        continue;
      }

      const blocks = this.collectCodeBlocks(parsed);
      if (blocks.length > 0) {
        return blocks.join("\n\n");
      }
    }
    return null;
  }

  /** Recursively collect code strings from Codeblock tuples in MBF. */
  private collectCodeBlocks(mbf: unknown): string[] {
    const results: string[] = [];

    if (!Array.isArray(mbf)) return results;

    for (const item of mbf) {
      if (!Array.isArray(item)) continue;

      // A Codeblock tuple: ['Codeblock', { lang }, 'source']
      if (item[0] === "Codeblock" && typeof item[2] === "string") {
        results.push(item[2] as string);
        continue;
      }

      // Type-0 content tuple: [0, [rows...]]
      if ((item[0] === 0 || item[0] === "0") && Array.isArray(item[1])) {
        results.push(...this.collectCodeBlocks(item[1]));
        continue;
      }

      // Recurse into any nested arrays
      for (const child of item) {
        if (Array.isArray(child)) {
          results.push(...this.collectCodeBlocks(child));
        }
      }
    }

    return results;
  }

  /** Pull the first user message text as the prompt. */
  private extractUserPrompt(messages: V0Message[]): string {
    const first = messages.find((m) => m.role === "user");
    if (!first) return "";
    try {
      const parsed = JSON.parse(first.content) as MessageBinaryFormat;
      return this.extractText(parsed).trim();
    } catch {
      return first.content;
    }
  }

  /** Collect plain text from MBF for use as prompt. */
  private extractText(mbf: unknown): string {
    if (!Array.isArray(mbf)) return "";
    const parts: string[] = [];
    for (const item of mbf) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (Array.isArray(item)) {
        parts.push(this.extractText(item));
      }
    }
    return parts.join(" ");
  }

  /** List all chats accessible with the current API key. */
  async listChats(): Promise<V0Chat[]> {
    if (!this.apiKey) {
      throw new Error(
        "V0_API_KEY environment variable is not set. " +
          "Please set it before running list-chats."
      );
    }
    const response = await this.getJson<V0ChatsResponse>("/v1/chats");
    return response.data ?? [];
  }

  private getJson<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`v0 API error ${res.statusCode}: ${data}`));
              return;
            }
            resolve(JSON.parse(data) as T);
          } catch (err) {
            reject(new Error(`Failed to parse v0 API response: ${String(err)}`));
          }
        });
      });

      req.on("error", reject);
      req.end();
    });
  }
}

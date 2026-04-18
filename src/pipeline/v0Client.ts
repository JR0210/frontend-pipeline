import https from "node:https";
import http from "node:http";
import type { V0Design } from "../types/index.js";
import { logger } from "../observability/logger.js";

/** Minimal shape returned by the v0 API. */
interface V0APIResponse {
  id: string;
  code: string;
  framework?: string;
}

/**
 * Client for the Vercel v0 code-generation API.
 *
 * Requires the environment variable `V0_API_KEY` to be set.
 * The base URL can be overridden via `V0_API_BASE_URL` (useful for tests).
 */
export class V0Client {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env["V0_API_KEY"] ?? "";
    this.baseUrl = baseUrl ?? process.env["V0_API_BASE_URL"] ?? "https://v0.dev/api";
  }

  /**
   * Send a natural-language prompt to v0 and return a V0Design.
   * @throws {Error} when the API key is missing or the request fails.
   */
  async generateDesign(prompt: string): Promise<V0Design> {
    if (!this.apiKey) {
      throw new Error(
        "V0_API_KEY environment variable is not set. " +
          "Please set it before running the pipeline."
      );
    }

    logger.info("Sending prompt to Vercel v0…", { promptLength: prompt.length });

    const body = JSON.stringify({ prompt, framework: "nextjs" });
    const response = await this.post("/generate", body);

    const design: V0Design = {
      id: response.id,
      prompt,
      code: response.code,
      framework: response.framework === "react" ? "react" : "nextjs",
      createdAt: new Date().toISOString(),
    };

    logger.info("Design received from v0", { designId: design.id });
    return design;
  }

  /** Perform an HTTPS POST and return the parsed JSON body. */
  private post(path: string, body: string): Promise<V0APIResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === "https:";
      const transport = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${this.apiKey}`,
        },
      };

      const req = transport.request(options, (res) => {
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
            const parsed = JSON.parse(data) as Record<string, unknown>;
            if (typeof parsed.id !== "string" || typeof parsed.code !== "string") {
              reject(
                new Error(
                  `Unexpected v0 API response shape — expected { id: string, code: string }, got: ${JSON.stringify(Object.keys(parsed))}`
                )
              );
              return;
            }
            resolve(parsed as unknown as V0APIResponse);
          } catch (err) {
            reject(new Error(`Failed to parse v0 response: ${String(err)}`));
          }
        });
      });

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

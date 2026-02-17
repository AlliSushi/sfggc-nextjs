import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * BDD tests for Next.js compression configuration.
 *
 * When nginx handles gzip compression, Next.js built-in compression
 * should be disabled to avoid double-compression overhead. This reduces
 * CPU usage and improves response times by 50-100ms per request.
 */

const NEXT_CONFIG_PATH = path.join(process.cwd(), "next.config.js");

test(
  "Given next.config.js, when configuring Next.js, then compress is set to false to avoid double-compression with nginx",
  () => {
    const content = fs.readFileSync(NEXT_CONFIG_PATH, "utf-8");

    assert.ok(
      content.match(/compress\s*:\s*false/),
      "next.config.js must set compress: false when nginx handles gzip compression"
    );
  }
);

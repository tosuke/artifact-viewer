import { beforeEach, describe, expect } from "vitest";
import { readFile } from "node:fs/promises";

import { ZipReader } from "./zip";

describe("ZipReader", (test) => {
  let reader: ZipReader;

  beforeEach(async () => {
    const body = await readFile("src/fixture/test.zip").then(
      (buf) => buf.buffer as ArrayBuffer
    );
    reader = new ZipReader(new DataView(body));
  });

  test("list files", () => {
    expect(reader.files.map((f) => f.fileName)).toMatchInlineSnapshot(`
      [
        "assets/",
        "assets/index.86ef73a2.js",
        "index.html",
      ]
    `);
  });

  test("decompress file", () => {
    const file = reader.files[2];

    expect(new TextDecoder().decode(file.decompress())).toMatchInlineSnapshot(
      `
      "<!DOCTYPE html>
      <html lang=\\"en\\">
        <head>
          <meta charset=\\"UTF-8\\" />
          <meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1.0\\" />
          <title>Fixture Page</title>
          <script type=\\"module\\" crossorigin src=\\"./assets/index.86ef73a2.js\\"></script>
        </head>
        <body>
          <div id=\\"app\\"></div>
          
        </body>
      </html>
      "
    `
    );
  });

  test("detect which is a directory or not", () => {
    expect(reader.files[0].isDirectory).toBe(true);
    expect(reader.files[1].isDirectory).toBe(false);
  });
});

import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";

import { ZipReader } from "./zip";

test("read zip file", async () => {
  const body = await readFile("src/fixture/test.zip").then(
    (buf) => buf.buffer as ArrayBuffer
  );

  const reader = new ZipReader(new DataView(body));

  expect(reader.files.length).toBe(3);
  expect(reader.files.map((f) => f.fileName)).toMatchInlineSnapshot(`
    [
      "assets/",
      "assets/index.86ef73a2.js",
      "index.html",
    ]
  `);

  const content = reader.files[2].decompress();
  expect(new TextDecoder().decode(content)).toMatchInlineSnapshot(`
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
  `);
});

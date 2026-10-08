import { fileURLToPath } from "node:url";
export const meetingBuild = {
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: [fileURLToPath(new URL("./meeting/main.jsx", import.meta.url))],
  bundle: true,
  outfile: fileURLToPath(new URL("../dist/meeting.js", import.meta.url)),
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  minify: true,
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
  external: ["/assets/*"],
  logLevel: "info",
};

import { context } from "esbuild";
import { meetingBuild } from "./meeting-build.config.mjs";
const buildContext = await context(meetingBuild);
await buildContext.rebuild();
await buildContext.watch();
await import("./server.mjs");

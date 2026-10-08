import { build } from "esbuild";
import { meetingBuild } from "./meeting-build.config.mjs";
await build(meetingBuild);

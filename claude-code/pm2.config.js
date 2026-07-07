import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

const dir = dirname(fileURLToPath(import.meta.url)); // claude-code/

export const apps = [
    {
        name: "claudeCode",
        cwd: dir,
        script: "npm",
        args: "start",
        max_memory_restart: "300M",
        log_file: resolve(dir, "claudeCode.log"),
        time: true,
        wait_ready: true,
    },
];

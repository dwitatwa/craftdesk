import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const packageJson = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
	version: string;
};

const config = defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version),
	},
	plugins: [
		devtools(),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart(),
		nitro(),
		viteReact(),
	],
});

export default config;

import react from "@vitejs/plugin-react";
import path, {resolve} from "path";
import {defineConfig} from "vite";
import {analyzer} from "vite-bundle-analyzer";
import svgrPlugin from "vite-plugin-svgr";
import viteTsconfigPaths from "vite-tsconfig-paths";

const isDev = process.env.NODE_ENV === "development";
const plugins = [react(), viteTsconfigPaths(), svgrPlugin()];

if (isDev) {
	plugins.push(analyzer());
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins,
	server: {
		open: true,
		port: 3000,
	},
	build: {
		rollupOptions: {
			input: {
				StargateWebClient: resolve(__dirname, "index.html"),
			},
			output: {
				// Specifies the format of the output, e.g., 'es', 'cjs', or 'iife'.
				//format: "iife", // or 'iife' if you want a self-executing bundle
				// Specifies the entry point file.
				//entryFileNames: "entry.js", // Your custom filename here
				// Ensures all output is bundled into a single file
				manualChunks: undefined, // Disable code-splitting to bundle everything in one file
			},
		},
		sourcemap: true,
	},
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "./src"),
		},
	},
});

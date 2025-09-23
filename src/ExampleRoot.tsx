import React from "react";
import ReactDOM from "react-dom/client";
import App from "~/ExampleBase";

const root = ReactDOM.createRoot(
	document.getElementById("root") as HTMLElement,
);

/**
 * Note: Activate strict mode during development to detect potential bugs.
 * @see https://react.dev/reference/react/StrictMode
 */
const useStrictMode = false;

root.render(
	useStrictMode ? (
		<React.StrictMode>
			<App />
		</React.StrictMode>
	) : (
		<App />
	),
);

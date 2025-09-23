import React from "react";
import {HashRouter, Route, Routes} from "react-router-dom";
import HomePage from "./pages/HomePage";
import NoMatchPage from "./pages/NoMatchPage";

export default function App() {
	return (
		<HashRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="*" element={<NoMatchPage />} />
			</Routes>
		</HashRouter>
	);
}

import React from "react";
import useShapeDiverAuth from "~/hooks/useShapeDiverAuth";

export default function HomePage() {
	const {
		error,
		errorDescription,
		accessToken,
		refreshToken,
		initiateShapeDiverAuth,
	} = useShapeDiverAuth({ autoLogin: true });

	return (
		<>
			{error && <h1>Error: {error}</h1>}
			{errorDescription && <p>Error description: {errorDescription}</p>}
			{accessToken && <p>Access Token: {accessToken}</p>}
			{refreshToken && <div>Refresh Token: {refreshToken}</div>}
			<p>
				<button onClick={initiateShapeDiverAuth}>
					Start ShapeDiver Auth
				</button>
			</p>
		</>
	);
}

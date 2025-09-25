import React from "react";
import useShapeDiverAuth from "~/hooks/useShapeDiverAuth";

export default function HomePage() {
	const {
		error,
		errorDescription,
		accessToken,
		refreshToken,
		initiateShapeDiverAuth,
		authUsingRefreshToken,
		authState,
	} = useShapeDiverAuth({ autoLogin: true });

	return (
		<>
			{error && <h1>Error: {error}</h1>}
			{errorDescription && <p>Error description: {errorDescription}</p>}
			<p>Authentication state: {authState}</p>
			{accessToken && <p>Access Token: {accessToken}</p>}
			{refreshToken && <div>Refresh Token: {refreshToken}</div>}
			<p>
				{authState === "not_authenticated" ? (
					<button onClick={initiateShapeDiverAuth}>
						Start ShapeDiver Auth
					</button>
				) : undefined}
				{authState === "refresh_token_present" ? (
					<button onClick={authUsingRefreshToken}>
						Login using refresh token
					</button>
				) : undefined}
			</p>
		</>
	);
}

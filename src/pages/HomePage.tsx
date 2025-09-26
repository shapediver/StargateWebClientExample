import React from "react";
import useShapeDiverAuth from "~/hooks/useShapeDiverAuth";
import useShapeDiverStargate from "~/hooks/useShapeDiverStargate";
import useStargateHandlers from "~/hooks/useStargateHandlers";

export default function HomePage() {
	// call hook used to manage authentication with ShapeDiver via OAuth2 Authorization Code Flow with PKCE
	const {
		error,
		errorDescription,
		accessToken,
		initiateShapeDiverAuth,
		authUsingRefreshToken,
		authState,
		platformSdk,
	} = useShapeDiverAuth({ autoLogin: true });

	// example handlers for the ShapeDiver Stargate service
	const handlers = useStargateHandlers();

	// call hook used to register as a client for the ShapeDiver Stargate service, using the example handlers
	const { stargateSdk, isActive } = useShapeDiverStargate({
		accessToken,
		platformSdk,
		...handlers,
	});

	return (
		<>
			{error && <h1>Error: {error}</h1>}
			{errorDescription && <p>Error description: {errorDescription}</p>}
			<p>Authentication state: {authState}</p>
			{stargateSdk && (
				<p>
					Stargate SDK initialized {isActive ? "(active)" : undefined}
				</p>
			)}
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

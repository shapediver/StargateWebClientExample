import React from "react";
import useShapeDiverAuth from "~/hooks/useShapeDiverAuth";
import useShapeDiverStargate from "~/hooks/useShapeDiverStargate";
import useStargateHandlers from "~/hooks/useStargateHandlers";

export default function HomePage() {
	const {
		error,
		errorDescription,
		accessToken,
		initiateShapeDiverAuth,
		authUsingRefreshToken,
		authState,
		platformSdk,
	} = useShapeDiverAuth({ autoLogin: true });
	const handlers = useStargateHandlers();
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

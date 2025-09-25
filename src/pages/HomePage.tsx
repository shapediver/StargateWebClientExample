import { ISdStargateGetSupportedDataReplyDto } from "@shapediver/sdk.stargate-sdk-v1";
import React from "react";
import useShapeDiverAuth from "~/hooks/useShapeDiverAuth";
import useShapeDiverStargate from "~/hooks/useShapeDiverStargate";

const supportedData: Partial<ISdStargateGetSupportedDataReplyDto> = {
	contentTypes: ["application/json"],
	fileExtensions: ["json"],
	parameterTypes: ["File"],
};

export default function HomePage() {
	const {
		error,
		errorDescription,
		accessToken,
		refreshToken,
		initiateShapeDiverAuth,
		authUsingRefreshToken,
		authState,
		platformSdk,
	} = useShapeDiverAuth({ autoLogin: true });
	const { stargateSdk } = useShapeDiverStargate({
		accessToken,
		platformSdk,
		supportedData,
	});

	return (
		<>
			{error && <h1>Error: {error}</h1>}
			{errorDescription && <p>Error description: {errorDescription}</p>}
			<p>Authentication state: {authState}</p>
			{accessToken && <p>Access Token: {accessToken}</p>}
			{refreshToken && <p>Refresh Token: {refreshToken}</p>}
			{stargateSdk && <p>Stargate SDK initialized</p>}
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

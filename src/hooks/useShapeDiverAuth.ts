import {
	create,
	isPBInvalidGrantOAuthResponseError,
	isPBInvalidRequestOAuthResponseError,
} from "@shapediver/sdk.platform-api-sdk-v1";
import {useCallback, useEffect, useState} from "react";

const refreshTokenKey = "shapediver_refresh_token";
const codeVerifierKey = "shapediver_code_verifier";
const oauthStateKey = "shapediver_oauth_state";
const authBaseUrl = "https://dev-wwwcdn.us-east-1.shapediver.com";
const authEndPoint = `${authBaseUrl}/oauth/authorize`;
const tokenEndPoint = `${authBaseUrl}/oauth/token`;
const clientId = "660310c8-50f4-4f47-bd78-9c7ede8e659b";

async function sha256(buffer: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
	return await crypto.subtle.digest("SHA-256", buffer);
}

function base64UrlEncode(buffer: ArrayBuffer) {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	// see https://developer.mozilla.org/en-US/docs/Glossary/Base64#url_and_filename_safe_base64
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function generateRandomString(length: number) {
	const charset =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const values = new Uint8Array(length);
	crypto.getRandomValues(values);
	let result = "";
	for (let i = 0; i < length; i++) {
		result += charset[values[i] % charset.length];
	}
	return result;
}

function clearBrowserStorage() {
	window.localStorage.removeItem(refreshTokenKey);
	window.localStorage.removeItem(codeVerifierKey);
	window.localStorage.removeItem(oauthStateKey);
}

function getRedirectUri() {
	return window.location.origin + "/";
}

interface Props {
	/** Log in automatically if a refresh token is available. */
	autoLogin?: boolean;
}

/**
 * Hook to manage authentication with ShapeDiver via OAuth2 Authorization Code Flow with PKCE.
 * @returns
 */
export default function useShapeDiverAuth(props?: Props) {
	const {autoLogin = false} = props || {};

	// check for error and error description in URL parameters
	const params = new URLSearchParams(window.location.search);
	const [error, setError] = useState(params.get("error"));
	const [errorDescription, setErrorDescription] = useState(
		params.get("error_description"),
	);
	const [codeData, setCodeData] = useState<{
		code: string;
		verifier: string;
	} | null>(null);
	// check whether local storage has a token stored
	const [accessToken, setAccessToken] = useState<string | undefined>();
	const [refreshToken, setRefreshToken_] = useState(
		window.localStorage.getItem(refreshTokenKey),
	);
	const setRefreshToken = useCallback((token: string | null) => {
		if (token) {
			window.localStorage.setItem(refreshTokenKey, token);
		} else {
			window.localStorage.removeItem(refreshTokenKey);
		}
		setRefreshToken_(token);
	}, []);

	// if there is an error, clear the local storage
	if (error) {
		clearBrowserStorage();
	} else {
		// check if we got a code and state in the URL parameters
		const code = params.get("code");
		const state = params.get("state");
		if (state && code) {
			// remove code and state from URL to avoid re-processing
			params.delete("code");
			params.delete("state");
			const url = new URL(window.location.href);
			url.searchParams.delete("code");
			url.searchParams.delete("state");
			window.history.replaceState({}, document.title, url.toString());
			// verify state
			const storedState = window.localStorage.getItem(oauthStateKey);
			const storedVerifier = window.localStorage.getItem(codeVerifierKey);
			if (storedState === null) {
				setError("missing stored state");
				setErrorDescription(
					"No stored state found, please initiate the authentication flow again.",
				);
			} else if (storedVerifier === null) {
				setError("missing stored verifier");
				setErrorDescription(
					"No stored code verifier found, please initiate the authentication flow again.",
				);
			} else if (state === window.localStorage.getItem(oauthStateKey)) {
				// state is valid, now exchange the code for a token (handled in useEffect below)
				setCodeData({code, verifier: storedVerifier});
			} else {
				// state is invalid, clear local storage and return error
				setError("state mismatch");
				setErrorDescription(
					"The returned state does not match the stored state.",
				);
			}
			window.localStorage.removeItem(oauthStateKey);
			window.localStorage.removeItem(codeVerifierKey);
		}
	}

	// exchange code for token
	useEffect(() => {
		if (codeData) {
			const getToken = async () => {
				const response = await fetch(tokenEndPoint, {
					method: "POST",
					body: JSON.stringify({
						grant_type: "authorization_code",
						client_id: clientId,
						code: codeData.code,
						redirect_uri: getRedirectUri(),
						code_verifier: codeData.verifier,
					}),
					headers: {
						"Content-Type": "application/json",
					},
				});
				if (response.ok) {
					const data = (await response.json()) as {
						access_token: string;
						refresh_token: string;
					};
					setAccessToken(data.access_token);
					setRefreshToken(data.refresh_token);
				} else {
					const data = (await response.json()) as {
						error?: string;
						error_description?: string;
					};
					setError(data.error ?? null);
					setErrorDescription(data.error_description ?? null);
				}
			};
			setCodeData(null);
			getToken();
		}
	}, [codeData]);

	// callback for auth using refresh token
	const authUsingRefreshToken = useCallback(async () => {
		if (refreshToken) {
			// reset state
			setError(null);
			setErrorDescription(null);
			setCodeData(null);
			// create SDK
			const client = create({clientId, baseUrl: authBaseUrl});
			try {
				// TODO: pass refresh token
				const data = await client.authorization.refreshToken();
				setAccessToken(data.access_token);
				setRefreshToken(data.refresh_token ?? null);
			} catch (error) {
				if (
					isPBInvalidRequestOAuthResponseError(error) || // <-- thrown if the refresh token is not valid anymore or there is none
					isPBInvalidGrantOAuthResponseError(error) // <-- thrown if the refresh token is generally invalid
				) {
					setRefreshToken(null);
					setError("invalid refresh token");
					setErrorDescription(
						"The stored refresh token is invalid, please log in again.",
					);
					throw error;
				} else {
					setRefreshToken(null);
					setError("refresh token login failed");
					setErrorDescription(
						"The refresh token login failed, please log in again.",
					);
					throw error;
				}
			}
		}
	}, [refreshToken]);

	// optionally automatically log in
	useEffect(() => {
		if (autoLogin && refreshToken && !accessToken) authUsingRefreshToken();
	}, [autoLogin, refreshToken, accessToken]);

	// callback for initiating the authorization code flow via the ShapeDiver platform
	const initiateShapeDiverAuth = useCallback(async () => {
		// reset state
		setError(null);
		setErrorDescription(null);
		setCodeData(null);
		setAccessToken(undefined);
		setRefreshToken(null);
		// clear previous tokens and state
		clearBrowserStorage();
		// Create a 64 character random string (from characters a-zA-Z0-9), we call this the secret code verifier.
		const codeVerifier = generateRandomString(64);
		window.localStorage.setItem(codeVerifierKey, codeVerifier);
		// get unix timestamp in seconds
		const timestamp = Math.floor(Date.now() / 1000);
		// create state
		const _state = `${codeVerifier}:${authEndPoint}:${clientId}:${timestamp}`;
		const encoder = new TextEncoder();
		const state = base64UrlEncode(await sha256(encoder.encode(_state)));
		window.localStorage.setItem(oauthStateKey, state);
		const code_challenge = base64UrlEncode(
			await sha256(encoder.encode(codeVerifier)),
		);

		// construct the redirection URL
		const params = new URLSearchParams();
		params.append("state", state);
		params.append("response_type", "code");
		params.append("client_id", clientId);
		params.append("code_challenge", code_challenge);
		params.append("code_challenge_method", "S256");
		params.append("redirect_uri", getRedirectUri());
		const redirectUrl = `${authEndPoint}?${params.toString()}`;

		// redirect to the authorization endpoint
		window.location.href = redirectUrl;
	}, []);

	return {
		accessToken,
		refreshToken,
		initiateShapeDiverAuth,
		error,
		errorDescription,
		authUsingRefreshToken,
	};
}

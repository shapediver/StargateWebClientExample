import {
	Configuration,
	ResCreateSessionByTicket,
	SessionApi,
} from "@shapediver/sdk.geometry-api-sdk-v2";
import {
	SdPlatformModelGetEmbeddableFields,
	SdPlatformSdk,
} from "@shapediver/sdk.platform-api-sdk-v1";
import {
	createSdk,
	ISdStargateGetSupportedDataReplyDto,
	ISdStargatePrepareModelCommandDto,
	ISdStargatePrepareModelReplyDto,
	ISdStargatePrepareModelResultEnum,
	ISdStargateSdk,
	ISdStargateStatusReplyDto,
	SdStargateGetSupportedDataCommand,
	SdStargatePrepareModelCommand,
	SdStargateStatusCommand,
} from "@shapediver/sdk.stargate-sdk-v1";
import {useEffect, useState} from "react";
import packagejson from "../../package.json";

const firstActivity = Math.floor(Date.now() / 1000);
const modelIdSessionMap: {
	[key: string]: {config: Configuration; session: ResCreateSessionByTicket};
} = {};

interface Props {
	/** The access token to use. */
	accessToken: string | undefined;
	/** The platform SDK to use. */
	platformSdk: SdPlatformSdk;
	/** Supported data. */
	supportedData: Partial<ISdStargateGetSupportedDataReplyDto>;
	/** Handler for command messages for which no handler is registered. */
	serverCommandHandler?: (payload: unknown) => void;
	/**
	 * Handler for connection errors, called if an error message has been
	 * received from the Stargate server.
	 */
	connectionErrorHandler?: (msg: string) => void;
	/**
	 * Handler called when the established connection is closed by the Stargate server
	 * or other external circumstances
	 */
	disconnectHandler?: (msg: string) => void;
}

/**
 * Hook to manage authentication with ShapeDiver via OAuth2 Authorization Code Flow with PKCE.
 * @returns
 */
export default function useShapeDiverStargate(props?: Props): {
	/** The platform SDK. In case no access token is present, an unauthenticated SDK will be returned. */
	stargateSdk: ISdStargateSdk | null;
} {
	const {
		accessToken,
		platformSdk,
		supportedData,
		serverCommandHandler,
		connectionErrorHandler,
		disconnectHandler,
	} = props || {};

	const [stargateSdk, setStargateSdk] = useState<ISdStargateSdk | null>(null);

	useEffect(() => {
		const init = async (jwt: string, platformSdk: SdPlatformSdk) => {
			// get Stargate endpoint to use
			const endpoints = (await platformSdk.stargate.getConfig())?.data
				.endpoint;
			const endpoint = endpoints
				? endpoints[Object.keys(endpoints)[0]]
				: "prod-sg.eu-central-1.shapediver.com";
			// create and configure the SDK
			const sdk = await createSdk()
				.setBaseUrl(endpoint)
				.setServerCommandHandler(
					serverCommandHandler ??
						((payload: unknown) => {
							console.log("Received Stargate command:", payload);
						}),
				)
				.setConnectionErrorHandler(
					connectionErrorHandler ??
						((msg: string) =>
							console.error(`Stargate connection error: ${msg}`)),
				)
				.setDisconnectHandler(
					disconnectHandler ??
						((msg: string) =>
							console.error(`Stargate disconnected: ${msg}`)),
				)
				.build();
			// register the client
			await sdk.register(
				jwt,
				"Stargate Web Client",
				packagejson.version,
				navigator.platform || "",
				window.location.hostname,
				"",
			);
			// register a handler for the status command
			new SdStargateStatusCommand(sdk).registerHandler(
				async (): Promise<ISdStargateStatusReplyDto> => ({
					firstActivity,
					latestActivity: Math.floor(Date.now() / 1000),
				}),
			);
			// register a handler for the get supported data command
			new SdStargateGetSupportedDataCommand(sdk).registerHandler(
				async (): Promise<ISdStargateGetSupportedDataReplyDto> => ({
					parameterTypes: [],
					typeHints: [],
					contentTypes: [],
					fileExtensions: [],
					...supportedData,
				}),
			);
			// register a handler for the prepare model command
			new SdStargatePrepareModelCommand(sdk).registerHandler(
				async (
					data: ISdStargatePrepareModelCommandDto,
				): Promise<ISdStargatePrepareModelReplyDto> => {
					// create a session for the model if none exists yet
					if (!modelIdSessionMap[data.model.id]) {
						const model = (
							await platformSdk.models.get(data.model.id, [
								SdPlatformModelGetEmbeddableFields.BackendSystem,
								SdPlatformModelGetEmbeddableFields.Ticket,
								SdPlatformModelGetEmbeddableFields.TokenExport,
							])
						).data;
						const config = new Configuration({
							accessToken: model.access_token,
							basePath: model.backend_system!.model_view_url,
						});
						const session = (
							await new SessionApi(config).createSessionByTicket(
								model.ticket!.ticket!,
							)
						).data;
						modelIdSessionMap[data.model.id] = {config, session};
					}

					return {
						info: {
							result: ISdStargatePrepareModelResultEnum.SUCCESS,
						},
					};
				},
			);
			// store the SDK in state
			setStargateSdk(sdk);
		};
		if (accessToken && platformSdk) init(accessToken, platformSdk);
	}, [
		accessToken,
		platformSdk,
		supportedData,
		serverCommandHandler,
		connectionErrorHandler,
		disconnectHandler,
	]);

	return {
		stargateSdk,
	};
}

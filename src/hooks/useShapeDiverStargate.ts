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
	ISdStargateBakeDataCommandDto,
	ISdStargateBakeDataReplyDto,
	ISdStargateBakeDataResultEnum,
	ISdStargateExportFileCommandDto,
	ISdStargateExportFileReplyDto,
	ISdStargateExportFileResultEnum,
	ISdStargateGetDataCommandDto,
	ISdStargateGetDataReplyDto,
	ISdStargateGetDataResultEnum,
	ISdStargateGetSupportedDataReplyDto,
	ISdStargatePrepareModelCommandDto,
	ISdStargatePrepareModelReplyDto,
	ISdStargatePrepareModelResultEnum,
	ISdStargateSdk,
	ISdStargateStatusReplyDto,
	SdStargateBakeDataCommand,
	SdStargateExportFileCommand,
	SdStargateGetDataCommand,
	SdStargateGetSupportedDataCommand,
	SdStargatePrepareModelCommand,
	SdStargateStatusCommand,
} from "@shapediver/sdk.stargate-sdk-v1";
import {useCallback, useEffect, useRef, useState} from "react";
import packagejson from "../../package.json";

const firstActivity = Math.floor(Date.now() / 1000);

export type SessionData = {
	config: Configuration;
	session: ResCreateSessionByTicket;
};

type ModelIdSessionMapType = {
	[key: string]: Promise<SessionData>;
};

interface Props {
	/** The access token to use. */
	accessToken: string | undefined;
	/** The platform SDK to use. */
	platformSdk: SdPlatformSdk;
	/**
	 * Supported data. Use this to specify which ShapeDiver parameter types,
	 * file endings, and content types are supported by the handlers.
	 */
	supportedData: Partial<ISdStargateGetSupportedDataReplyDto>;
	/**
	 * Handler for command messages for which no handler is registered.
	 * Typically there is no need to provide this handler.
	 * The default handler logs to the browser console.
	 */
	serverCommandHandler?: (payload: unknown) => void;
	/**
	 * Handler for connection errors, called if an error message has been
	 * received from the Stargate server.
	 * The default handler logs to the browser console.
	 */
	connectionErrorHandler?: (msg: string) => void;
	/**
	 * Handler called when the established connection is closed by the Stargate server
	 * or other external circumstances.
	 * The default handler logs to the browser console.
	 */
	disconnectHandler?: (msg: string) => void;
	/**
	 * Handler for the GET DATA command. The GET DATA command handler
	 * is called whenever the user requests data for an input (for a parameter)
	 * from a client application, by clicking on the corresponding UI element.
	 * @see https://help.shapediver.com/doc/inputs-and-outputs
	 *
	 * This extends the default handler by providing session data,
	 * which can be used to interact with the corresponding
	 * ShapeDiver model via the Geometry API.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	getDataCommandHandler?: (
		data: ISdStargateGetDataCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateGetDataReplyDto>;
	/**
	 * Handler for the BAKE DATA command. The BAKE DATA command handler
	 * is called whenever the user requests baking of data from an output
	 * to a client application, by clicking on the corresponding UI element.
	 * @see https://help.shapediver.com/doc/shapediver-output#ShapeDiverOutput-clientUsagewithdesktopclients
	 *
	 * This extends the default handler by providing session data,
	 * which can be used to interact with the corresponding
	 * ShapeDiver model via the Geometry API.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	bakeDataCommandHandler?: (
		data: ISdStargateBakeDataCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateBakeDataReplyDto>;
	/**
	 * Handler for the EXPORT FILE command. The EXPORT FILE command handler
	 * is called whenever the user requests the export of a file
	 * via a client application, by clicking on the corresponding UI element.
	 *
	 * This extends the default handler by providing session data,
	 * which can be used to interact with the corresponding
	 * ShapeDiver model via the Geometry API.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	exportFileCommandHandler?: (
		data: ISdStargateExportFileCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateExportFileReplyDto>;
}

/**
 * Hook providing a ShapeDiver Stargate Client implementation.
 * @returns
 */
export default function useShapeDiverStargate(props: Props): {
	/**
	 * The Stargate SDK. Typically there is no need to register further
	 * command handlers, as this is already taken care of by this hook.
	 */
	stargateSdk: ISdStargateSdk | null;
	/**
	 * True if this Stargate client is currently being used by the user
	 * from a ShapeDiver App. This is based on the STATUS command,
	 * which is sent by the App every 30 seconds. If no STATUS command
	 * has been received for 35 seconds, this property will be set to false.
	 */
	isActive: boolean;
} {
	const {
		accessToken,
		platformSdk,
		supportedData,
		serverCommandHandler,
		connectionErrorHandler,
		disconnectHandler,
		getDataCommandHandler,
		bakeDataCommandHandler,
		exportFileCommandHandler,
	} = props;

	const [stargateSdk, setStargateSdk] = useState<ISdStargateSdk | null>(null);
	const [isActive, setIsActive_] = useState(false);
	const timeoutRef = useRef<number | undefined>();
	const setIsActive = useCallback(() => {
		if (typeof timeoutRef.current === "number")
			clearTimeout(timeoutRef.current);
		setIsActive_(true);
		timeoutRef.current = window.setTimeout(
			() => setIsActive_(false),
			35000,
		);
	}, []);
	const modelIdSessionMapRef = useRef<ModelIdSessionMapType>({});

	const getSessionDataForModelId = useCallback(
		async (modelId: string) => {
			const get = async (modelId: string) => {
				const model = (
					await platformSdk.models.get(modelId, [
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

				return {config, session};
			};

			// create a session for the model if none exists yet
			if (!modelIdSessionMapRef.current[modelId]) {
				modelIdSessionMapRef.current[modelId] = get(modelId);
			}

			return modelIdSessionMapRef.current[modelId];
		},
		[platformSdk],
	);

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
				async (): Promise<ISdStargateStatusReplyDto> => {
					setIsActive();
					return {
						firstActivity,
						latestActivity: Math.floor(Date.now() / 1000),
					};
				},
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
					await getSessionDataForModelId(data.model.id);

					return {
						info: {
							result: ISdStargatePrepareModelResultEnum.SUCCESS,
						},
					};
				},
			);
			// register a handler for the get data command
			new SdStargateGetDataCommand(sdk).registerHandler(
				async (
					data: ISdStargateGetDataCommandDto,
				): Promise<ISdStargateGetDataReplyDto> => {
					const sessionData = await getSessionDataForModelId(
						data.model.id,
					);
					if (getDataCommandHandler) {
						return getDataCommandHandler(data, sessionData);
					}
					console.warn(
						"Received get data command, but no handler is registered.",
						data,
					);
					return {
						info: {
							message: "No handler registered.",
							result: ISdStargateGetDataResultEnum.NOTHING,
							count: 0,
						},
					};
				},
			);
			// register a handler for the bake data command
			new SdStargateBakeDataCommand(sdk).registerHandler(
				async (
					data: ISdStargateBakeDataCommandDto,
				): Promise<ISdStargateBakeDataReplyDto> => {
					const sessionData = await getSessionDataForModelId(
						data.model.id,
					);
					if (bakeDataCommandHandler) {
						return bakeDataCommandHandler(data, sessionData);
					}
					console.warn(
						"Received bake data command, but no handler is registered.",
						data,
					);
					return {
						info: {
							message: "No handler registered.",
							result: ISdStargateBakeDataResultEnum.NOTHING,
							count: 0,
						},
					};
				},
			);
			// register a handler for the export file command
			new SdStargateExportFileCommand(sdk).registerHandler(
				async (
					data: ISdStargateExportFileCommandDto,
				): Promise<ISdStargateExportFileReplyDto> => {
					const sessionData = await getSessionDataForModelId(
						data.model.id,
					);
					if (exportFileCommandHandler) {
						return exportFileCommandHandler(data, sessionData);
					}
					console.warn(
						"Received export file command, but no handler is registered.",
						data,
					);
					return {
						info: {
							message: "No handler registered.",
							result: ISdStargateExportFileResultEnum.NOTHING,
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
		getDataCommandHandler,
		bakeDataCommandHandler,
		exportFileCommandHandler,
	]);

	return {
		stargateSdk,
		isActive,
	};
}

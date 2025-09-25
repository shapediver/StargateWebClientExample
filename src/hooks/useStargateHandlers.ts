import {FileApi, UtilsApi} from "@shapediver/sdk.geometry-api-sdk-v2";
import {
	ISdStargateBakeDataCommandDto,
	ISdStargateBakeDataReplyDto,
	ISdStargateExportFileCommandDto,
	ISdStargateExportFileReplyDto,
	ISdStargateGetDataCommandDto,
	ISdStargateGetDataReplyDto,
	ISdStargateGetDataResultEnum,
	ISdStargateGetSupportedDataReplyDto,
} from "@shapediver/sdk.stargate-sdk-v1";
import {useCallback} from "react";
import {SessionData} from "./useShapeDiverStargate";

const exampleJsonFile = new Blob([JSON.stringify({hello: "world"}, null, 2)], {
	type: "application/json",
});

const supportedData: Partial<ISdStargateGetSupportedDataReplyDto> = {
	contentTypes: ["application/json"],
	fileExtensions: ["json"],
	parameterTypes: ["File"],
};

/**
 * Hook providing example Stargate handlers.
 * @returns
 */
export default function useStargateHandlers(): {
	/**
	 * Types of parameters, content types, and file endings supported by the handlers.
	 */
	supportedData: Partial<ISdStargateGetSupportedDataReplyDto>;
	/**
	 * Handler for the get data command.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	getDataCommandHandler?: (
		data: ISdStargateGetDataCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateGetDataReplyDto>;
	/**
	 * Handler for the bake data command.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	bakeDataCommandHandler?: (
		data: ISdStargateBakeDataCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateBakeDataReplyDto>;
	/**
	 * Handler for the export file command.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	exportFileCommandHandler?: (
		data: ISdStargateExportFileCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateExportFileReplyDto>;
} {
	// example handler for the get data command
	const getDataCommandHandler = useCallback(
		async (
			data: ISdStargateGetDataCommandDto,
			sessionData: SessionData,
		): Promise<ISdStargateGetDataReplyDto> => {
			// get the definition of the parameter for which data is requested
			const paramDefinition =
				sessionData.session.parameters![data.parameter.id];
			// in this example we handle "File" parameters with "application/json" format
			if (paramDefinition.type === "File") {
				if (paramDefinition.format?.includes("application/json")) {
					// request a file upload URL from the Geometry API
					const response = await new FileApi(
						sessionData.config,
					).uploadFile(sessionData.session.sessionId, {
						[data.parameter.id]: {
							size: exampleJsonFile.size,
							filename: "example.json",
							format: "application/json",
						},
					});
					// extract the data for the file to be uploaded
					const fileData =
						response.data.asset.file[data.parameter.id];
					// upload the file
					await new UtilsApi(sessionData.config).upload(
						fileData.href,
						exampleJsonFile,
						"application/json",
						"example.json",
					);
					// return the id of the uploaded file
					return {
						info: {
							message: "File uploaded successfully.",
							result: ISdStargateGetDataResultEnum.SUCCESS,
							count: 1,
						},
						asset: {
							id: fileData.id,
						},
					};
				}
			}
			// if we cannot handle the request, return a "nothing" response
			return {
				info: {
					message: "No data available.",
					result: ISdStargateGetDataResultEnum.NOTHING,
					count: 0,
				},
			};
		},
		[],
	);

	return {getDataCommandHandler, supportedData};
}

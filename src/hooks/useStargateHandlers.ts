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

/**
 * Example files that can be used by the handlers.
 */
const exampleFiles: {filename: string; contentType: string; href: string}[] = [
	{
		filename: "test.json",
		contentType: "application/json",
		href: window.location.origin + "/test.json",
	},
	{
		filename: "test.3dm",
		contentType: "model/vnd.3dm",
		href: window.location.origin + "/test.3dm",
	},
	{
		filename: "test.dwg",
		contentType: "application/dwg",
		href: window.location.origin + "/test.dwg",
	},
];

/**
 * Which content types, file extensions, and parameter types are supported by the handlers.
 */
const supportedData: Partial<ISdStargateGetSupportedDataReplyDto> = {
	contentTypes: ["application/json", "application/dwg", "model/vnd.3dm"],
	fileExtensions: ["json", "3dm", "dwg"],
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
	 * Handler for the GET DATA command.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	getDataCommandHandler?: (
		data: ISdStargateGetDataCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateGetDataReplyDto>;
	/**
	 * Handler for the BAKE DATA command.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	bakeDataCommandHandler?: (
		data: ISdStargateBakeDataCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateBakeDataReplyDto>;
	/**
	 * Handler for the EXPORT FILE command.
	 * @param data
	 * @param sessionData
	 * @returns
	 */
	exportFileCommandHandler?: (
		data: ISdStargateExportFileCommandDto,
		sessionData: SessionData,
	) => Promise<ISdStargateExportFileReplyDto>;
} {
	// example handler for the GET DATA command
	const getDataCommandHandler = useCallback(
		async (
			{parameter: {id: parameterId}}: ISdStargateGetDataCommandDto,
			{config, session}: SessionData,
		): Promise<ISdStargateGetDataReplyDto> => {
			// get the definition of the parameter for which data is requested
			const paramDef = session.parameters![parameterId];
			// in this example we handle "File" parameters with "application/json" format
			if (paramDef.type === "File") {
				// try to find a suitable test file
				const testFile = exampleFiles.find((f) =>
					paramDef.format?.includes(f.contentType),
				);
				if (testFile) {
					// download the file
					const downloadedFile = await new UtilsApi(config).download(
						testFile.href,
						{responseType: "arraybuffer"},
					);
					// request a file upload URL from the Geometry API
					const response = await new FileApi(config).uploadFile(
						session.sessionId,
						{
							[parameterId]: {
								size: (
									downloadedFile.data as unknown as ArrayBuffer
								).byteLength,
								filename: testFile.filename,
								format: testFile.contentType,
							},
						},
					);
					// extract the data for the file to be uploaded
					const fileData = response.data.asset.file[parameterId];
					// upload the file to the URL provided by the Geometry API
					await new UtilsApi(config).upload(
						fileData.href,
						downloadedFile.data,
						testFile.contentType,
						testFile.filename,
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

import {
	ExportApi,
	FileApi,
	ResComputationStatus,
	ResExport,
	ResExportDefinitionType,
	UtilsApi,
} from "@shapediver/sdk.geometry-api-sdk-v2";
import {
	ISdStargateBakeDataCommandDto,
	ISdStargateBakeDataReplyDto,
	ISdStargateExportFileCommandDto,
	ISdStargateExportFileReplyDto,
	ISdStargateExportFileResultEnum,
	ISdStargateGetDataCommandDto,
	ISdStargateGetDataReplyDto,
	ISdStargateGetDataResultEnum,
	ISdStargateGetSupportedDataReplyDto,
} from "@shapediver/sdk.stargate-sdk-v1";
import {fetchFileWithToken} from "@shapediver/viewer.utils.mime-type";
import {useCallback} from "react";
import {SessionData} from "./useShapeDiverStargate";

/**
 * Example files that can be used by the handlers.
 */
const exampleFiles: {filename: string; contentType: string; href: string}[] = [
	{
		filename: "test.json",
		contentType: "application/json",
		href: window.location.origin + window.location.pathname + "test.json",
	},
	{
		filename: "test.3dm",
		contentType: "model/vnd.3dm",
		href: window.location.origin + window.location.pathname + "test.3dm",
	},
	{
		filename: "test.dwg",
		contentType: "application/dwg",
		href: window.location.origin + window.location.pathname + "test.dwg",
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

	// example handler for the EXPORT FILE command
	const exportFileCommandHandler = useCallback(
		async (
			{parameters, export: {id, index}}: ISdStargateExportFileCommandDto,
			{config, session}: SessionData,
		): Promise<ISdStargateExportFileReplyDto> => {
			// get the definition of the export which should be downloaded
			const exportDef = session.exports![id];
			if (exportDef.type !== ResExportDefinitionType.DOWNLOAD)
				return {
					info: {
						message: "Export is not of type DOWNLOAD.",
						result: ISdStargateExportFileResultEnum.NOTHING,
					},
				};
			// request the export
			const {
				data: {exports: exportResults},
			} = await new ExportApi(config).computeExports(session.sessionId, {
				parameters,
				exports: [id],
			});
			const exportResult = exportResults![id] as ResExport;
			if (
				exportResult.status_collect !== ResComputationStatus.SUCCESS ||
				exportResult.status_computation !== ResComputationStatus.SUCCESS
			)
				return {
					info: {
						message: "Export computation was not successful.",
						result: ISdStargateExportFileResultEnum.NOTHING,
					},
				};
			// fetch the exported file
			const {href, size} = exportResult.content![index];
			await fetchFileWithToken(
				href,
				exportResult.filename!,
				config.accessToken as string,
			);
			return {
				info: {
					message: `File ${exportResult.filename} downloaded successfully (${size} bytes).`,
					result: ISdStargateExportFileResultEnum.SUCCESS,
				},
			};
		},
		[],
	);

	return {getDataCommandHandler, exportFileCommandHandler, supportedData};
}

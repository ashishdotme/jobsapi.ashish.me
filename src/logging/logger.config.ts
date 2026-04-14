import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Options } from 'pino-http';

type LoggerConfigInput = {
	nodeEnv: string;
	logLevel: string;
	serviceName: string;
};

const REDACT_PATHS = ['req.headers.authorization', 'req.headers.cookie', 'req.headers.apikey', 'req.headers.x-api-key'];

export const REQUEST_ID_HEADER = 'x-request-id';

const readHeaderValue = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export function assignRequestId(req: IncomingMessage, res: ServerResponse): string {
	if (typeof req.id === 'string' && req.id.trim()) {
		res.setHeader(REQUEST_ID_HEADER, req.id);
		return req.id;
	}

	const existingRequestId = readHeaderValue(req.headers?.[REQUEST_ID_HEADER]);
	const requestId = existingRequestId?.trim() || randomUUID();

	req.id = requestId;
	res.setHeader(REQUEST_ID_HEADER, requestId);

	return requestId;
}

export function buildPinoHttpConfig(input: LoggerConfigInput): Options {
	return {
		level: input.logLevel,
		autoLogging: false,
		base: undefined,
		formatters: {
			level(label) {
				return { level: label };
			},
		},
		quietReqLogger: true,
		genReqId: assignRequestId,
		redact: {
			paths: REDACT_PATHS,
			remove: true,
		},
	};
}

import { ConsoleLogger, LogLevel } from '@nestjs/common';

const VALID_LOG_LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

type LoggingEnvironment = Partial<Record<'LOG_LEVELS' | 'NODE_ENV', string>>;
const DEFAULT_ENVIRONMENT = process.env as LoggingEnvironment;

export const resolveLogLevels = (environment: LoggingEnvironment = DEFAULT_ENVIRONMENT): LogLevel[] => {
	const configuredLevels = environment.LOG_LEVELS?.split(',')
		.map(level => level.trim())
		.filter((level): level is LogLevel => VALID_LOG_LEVELS.includes(level as LogLevel));

	if (configuredLevels?.length) {
		return configuredLevels;
	}

	if (environment.NODE_ENV === 'production') {
		return ['log', 'warn', 'error'];
	}

	return ['log', 'warn', 'error', 'debug', 'verbose'];
};

export const createAppLogger = (environment: LoggingEnvironment = DEFAULT_ENVIRONMENT): ConsoleLogger =>
	new ConsoleLogger('JobsApi', {
		logLevels: resolveLogLevels(environment),
	});

const serializeLogValue = (value: unknown): string => {
	if (typeof value === 'string') {
		return JSON.stringify(value);
	}

	try {
		return JSON.stringify(value);
	} catch {
		return JSON.stringify(String(value));
	}
};

export const formatLogMessage = (event: string, details: Record<string, unknown> = {}): string => {
	const context = Object.entries(details)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${serializeLogValue(value)}`);

	return context.length ? `${event} ${context.join(' ')}` : event;
};

export const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
};

export const getErrorStack = (error: unknown): string | undefined => {
	if (error instanceof Error) {
		return error.stack;
	}

	return undefined;
};

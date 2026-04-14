import { buildPinoHttpConfig } from './logger.config';

describe('buildPinoHttpConfig', () => {
	it('uses raw JSON in production', () => {
		const config = buildPinoHttpConfig({
			nodeEnv: 'production',
			logLevel: 'info',
			serviceName: 'jobsapi.ashish.me',
		});

		expect(config.transport).toBeUndefined();
		expect(config.autoLogging).toBe(false);
	});

	it('uses raw JSON outside production', () => {
		const config = buildPinoHttpConfig({
			nodeEnv: 'development',
			logLevel: 'info',
			serviceName: 'jobsapi.ashish.me',
		});

		expect(config.transport).toBeUndefined();
		expect(config.autoLogging).toBe(false);
	});

	it('keeps request-scoped logs quiet', () => {
		const config = buildPinoHttpConfig({
			nodeEnv: 'production',
			logLevel: 'info',
			serviceName: 'jobsapi.ashish.me',
		});

		expect(config.quietReqLogger).toBe(true);
	});

	it('does not include service metadata in base log fields', () => {
		const config = buildPinoHttpConfig({
			nodeEnv: 'production',
			logLevel: 'info',
			serviceName: 'jobsapi.ashish.me',
		});

		expect(Object.prototype.hasOwnProperty.call(config, 'base')).toBe(true);
		expect(config.base).toBeUndefined();
	});

	it('uses string log levels', () => {
		const config = buildPinoHttpConfig({
			nodeEnv: 'production',
			logLevel: 'info',
			serviceName: 'jobsapi.ashish.me',
		});

		expect(config.formatters?.level?.('error', 50)).toEqual({ level: 'error' });
	});
});

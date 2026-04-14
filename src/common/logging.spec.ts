import { resolveLogLevels } from './logging';

describe('resolveLogLevels', () => {
	it('returns production defaults when NODE_ENV is production', () => {
		expect(resolveLogLevels({ NODE_ENV: 'production' })).toEqual(['log', 'warn', 'error']);
	});

	it('includes debug levels outside production', () => {
		expect(resolveLogLevels({ NODE_ENV: 'development' })).toEqual(['log', 'warn', 'error', 'debug', 'verbose']);
	});

	it('uses LOG_LEVELS when explicitly configured', () => {
		expect(resolveLogLevels({ LOG_LEVELS: 'error, warn ,debug' })).toEqual(['error', 'warn', 'debug']);
	});
});

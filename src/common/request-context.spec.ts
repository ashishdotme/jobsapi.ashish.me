import { getRequestId, runWithRequestContext } from './request-context';

describe('request context', () => {
	it('returns the request id inside the active context', () => {
		let resolved: string | undefined;

		runWithRequestContext({ requestId: 'req-123' }, () => {
			resolved = getRequestId();
		});

		expect(resolved).toBe('req-123');
	});
});

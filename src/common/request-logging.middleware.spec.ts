import { getRequestId } from './request-context';
import { requestLoggingMiddleware } from './request-logging.middleware';

describe('requestLoggingMiddleware', () => {
	it('runs request handling inside request context', () => {
		const req = {
			method: 'GET',
			url: '/',
			originalUrl: '/',
			headers: {
				'x-request-id': 'req-123',
			},
		} as any;
		const res = {
			setHeader: jest.fn(),
			on: jest.fn(),
			statusCode: 200,
		} as any;
		let resolvedRequestId: string | undefined;

		requestLoggingMiddleware(req, res, () => {
			resolvedRequestId = getRequestId();
		});

		expect(resolvedRequestId).toBe('req-123');
	});
});

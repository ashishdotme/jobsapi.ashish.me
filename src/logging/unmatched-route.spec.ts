import { isSuppressedUnmatchedRoute } from './unmatched-route';

describe('isSuppressedUnmatchedRoute', () => {
	it('returns true for framework unmatched-route 404s', () => {
		const result = isSuppressedUnmatchedRoute({
			method: 'GET',
			path: '/.info.php',
			routeMatched: false,
			statusCode: 404,
			exceptionResponse: {
				statusCode: 404,
				message: 'Cannot GET /.info.php',
				error: 'Not Found',
			},
		});

		expect(result).toBe(true);
	});

	it('returns true for framework unmatched-route 404s when route metadata is present', () => {
		const result = isSuppressedUnmatchedRoute({
			method: 'GET',
			path: '/favicon.ico',
			routeMatched: true,
			statusCode: 404,
			exceptionResponse: {
				statusCode: 404,
				message: 'Cannot GET /favicon.ico',
				error: 'Not Found',
			},
		});

		expect(result).toBe(true);
	});

	it('returns false for matched routes that return 404', () => {
		const result = isSuppressedUnmatchedRoute({
			method: 'GET',
			path: '/movies/123',
			routeMatched: true,
			statusCode: 404,
			exceptionResponse: {
				statusCode: 404,
				message: 'Movie not found',
				error: 'Not Found',
			},
		});

		expect(result).toBe(false);
	});
});

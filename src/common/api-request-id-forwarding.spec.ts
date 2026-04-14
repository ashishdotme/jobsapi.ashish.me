import axios from 'axios';
import { applyApiRequestIdForwarding } from './api-request-id-forwarding';
import { runWithRequestContext } from './request-context';

describe('api request id forwarding', () => {
	it('adds x-request-id for api.ashish.me requests when request context exists', async () => {
		applyApiRequestIdForwarding();

		const handlers = (axios.interceptors.request as any).handlers;
		const interceptor = handlers[handlers.length - 1]?.fulfilled;

		let config: any;
		runWithRequestContext({ requestId: 'req-123' }, () => {
			config = interceptor?.({
				url: 'https://api.ashish.me/movies',
				headers: {},
			});
		});

		expect(config.headers['x-request-id']).toBe('req-123');
	});

	it('does not add x-request-id when no request context exists', () => {
		applyApiRequestIdForwarding();

		const handlers = (axios.interceptors.request as any).handlers;
		const interceptor = handlers[handlers.length - 1]?.fulfilled;
		const config = interceptor?.({
			url: 'https://api.ashish.me/movies',
			headers: {},
		});

		expect(config.headers['x-request-id']).toBeUndefined();
	});

	it('does not add x-request-id for non api.ashish.me hosts', () => {
		applyApiRequestIdForwarding();

		const handlers = (axios.interceptors.request as any).handlers;
		const interceptor = handlers[handlers.length - 1]?.fulfilled;

		let config: any;
		runWithRequestContext({ requestId: 'req-123' }, () => {
			config = interceptor?.({
				url: 'https://imdb.ashish.me/title/tt123',
				headers: {},
			});
		});

		expect(config.headers['x-request-id']).toBeUndefined();
	});
});

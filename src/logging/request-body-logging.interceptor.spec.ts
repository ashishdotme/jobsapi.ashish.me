import { CallHandler, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { RequestBodyLoggingInterceptor } from './request-body-logging.interceptor';

describe('RequestBodyLoggingInterceptor', () => {
	const createContext = (overrides?: { method?: string; url?: string; body?: unknown; id?: string; statusCode?: number }) => {
		const request = {
			method: overrides?.method ?? 'POST',
			originalUrl: overrides?.url ?? '/movies',
			url: overrides?.url ?? '/movies',
			body: overrides?.body ?? { title: 'The Matrix', apiKey: 'secret' },
			id: overrides?.id ?? 'req-123',
		};
		const response = {
			statusCode: overrides?.statusCode ?? 201,
		};

		const context = {
			switchToHttp: () => ({
				getRequest: () => request,
				getResponse: () => response,
			}),
		} as ExecutionContext;

		return { context, request, response };
	};

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('logs sanitized request and response bodies on success', async () => {
		const interceptor = new RequestBodyLoggingInterceptor();
		const { context } = createContext({ url: '/movies?apikey=secret' });
		const callHandler: CallHandler = {
			handle: () => of({ id: 1, apiKey: 'response-secret' }),
		};
		const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

		const result = await lastValueFrom(interceptor.intercept(context, callHandler));

		expect(result).toEqual({ id: 1, apiKey: 'response-secret' });
		expect(loggerSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'http.request.handled',
				method: 'POST',
				path: '/movies?apikey=%5BRedacted%5D',
				requestId: 'req-123',
				statusCode: 201,
				requestBody: { title: 'The Matrix', apiKey: '[Redacted]' },
				responseBody: { id: 1, apiKey: '[Redacted]' },
				durationMs: expect.any(Number),
			}),
			'request handled',
		);
	});

	it('logs sanitized request and error response bodies on failure', async () => {
		const interceptor = new RequestBodyLoggingInterceptor();
		const { context } = createContext({
			method: 'POST',
			url: '/metrics',
			body: { apiKey: 'secret', payload: { value: 1 } },
			statusCode: 400,
		});
		const exception = new HttpException({ message: 'Invalid payload', apiKey: 'response-secret' }, HttpStatus.BAD_REQUEST);
		const callHandler: CallHandler = {
			handle: () => throwError(() => exception),
		};
		const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

		await expect(lastValueFrom(interceptor.intercept(context, callHandler))).rejects.toBe(exception);

		expect(loggerSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'http.request.error',
				method: 'POST',
				path: '/metrics',
				requestId: 'req-123',
				statusCode: 400,
				requestBody: { apiKey: '[Redacted]', payload: { value: 1 } },
				responseBody: { message: 'Invalid payload', apiKey: '[Redacted]' },
				err: exception,
				durationMs: expect.any(Number),
			}),
			'request failed',
		);
	});
});

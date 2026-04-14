import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
	it('does not log matched request failures because the interceptor owns error logging', () => {
		const filter = new AllExceptionsFilter();
		const status = jest.fn().mockReturnThis();
		const json = jest.fn();
		const getResponse = jest.fn(() => ({ status, json }));
		const getRequest = jest.fn(() => ({
			method: 'GET',
			url: '/broken',
			id: 'req-123',
		}));

		const host = {
			switchToHttp: () => ({ getResponse, getRequest }),
		} as unknown as ArgumentsHost;

		const exception = new HttpException('boom', HttpStatus.BAD_REQUEST);

		filter.catch(exception, host);

		expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
		expect(json).toHaveBeenCalledWith(
			expect.objectContaining({
				statusCode: HttpStatus.BAD_REQUEST,
				message: 'boom',
				timestamp: expect.any(String),
			}),
		);
	});

	it('does not log unmatched-route 404s', () => {
		const filter = new AllExceptionsFilter();
		const status = jest.fn().mockReturnThis();
		const json = jest.fn();
		const getResponse = jest.fn(() => ({ status, json }));
		const getRequest = jest.fn(() => ({
			method: 'GET',
			url: '/.info.php',
			id: 'req-123',
		}));

		const host = {
			switchToHttp: () => ({ getResponse, getRequest }),
		} as unknown as ArgumentsHost;

		const exception = new HttpException(
			{
				statusCode: 404,
				message: 'Cannot GET /.info.php',
				error: 'Not Found',
			},
			HttpStatus.NOT_FOUND,
		);

		filter.catch(exception, host);

		expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
		expect(json).toHaveBeenCalled();
	});

	it('does not log browser unmatched-route 404s like /login', () => {
		const filter = new AllExceptionsFilter();
		const status = jest.fn().mockReturnThis();
		const json = jest.fn();
		const getResponse = jest.fn(() => ({ status, json }));
		const getRequest = jest.fn(() => ({
			method: 'GET',
			url: '/login',
			id: 'req-123',
			route: { path: '*' },
		}));

		const host = {
			switchToHttp: () => ({ getResponse, getRequest }),
		} as unknown as ArgumentsHost;

		const exception = new HttpException(
			{
				statusCode: 404,
				message: 'Cannot GET /login',
				error: 'Not Found',
			},
			HttpStatus.NOT_FOUND,
		);

		filter.catch(exception, host);

		expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
		expect(json).toHaveBeenCalled();
	});
});

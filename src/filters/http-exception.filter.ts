import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { isSuppressedUnmatchedRoute } from '../logging/unmatched-route';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();

		const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
		const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

		if (
			isSuppressedUnmatchedRoute({
				method: request.method,
				path: request.originalUrl || request.url,
				routeMatched: Boolean((request as Request & { route?: unknown }).route),
				statusCode: status,
				exceptionResponse: message,
			})
		) {
			response.status(status).json({
				statusCode: status,
				message: typeof message === 'string' ? message : (message as Record<string, unknown>).message || message,
				timestamp: new Date().toISOString(),
			});
			return;
		}

		response.status(status).json({
			statusCode: status,
			message: typeof message === 'string' ? message : (message as Record<string, unknown>).message || message,
			timestamp: new Date().toISOString(),
		});
	}
}

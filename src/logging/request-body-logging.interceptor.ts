import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { normalizeLogBody, sanitizeLogPath } from './body-log-sanitizer';

@Injectable()
export class RequestBodyLoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(RequestBodyLoggingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const http = context.switchToHttp();
		const request = http.getRequest<Request>();
		const response = http.getResponse<Response>();
		const startedAt = Date.now();
		const method = request.method;
		const path = sanitizeLogPath(request.originalUrl || request.url);
		const requestId = request.id;
		const requestBody = normalizeLogBody(request.body);

		return next.handle().pipe(
			tap(body => {
				this.logger.log(
					{
						event: 'http.request.handled',
						method,
						path,
						requestId,
						statusCode: response.statusCode,
						durationMs: Date.now() - startedAt,
						requestBody,
						responseBody: normalizeLogBody(body),
					},
					'request handled',
				);
			}),
			catchError((exception: unknown) => {
				const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
				const responseBody = exception instanceof HttpException ? normalizeLogBody(exception.getResponse()) : normalizeLogBody({ message: 'Internal server error' });

				this.logger.error(
					{
						event: 'http.request.error',
						method,
						path,
						requestId,
						statusCode,
						durationMs: Date.now() - startedAt,
						requestBody,
						responseBody,
						err: exception instanceof Error ? exception : undefined,
					},
					'request failed',
				);

				return throwError(() => exception);
			}),
		);
	}
}

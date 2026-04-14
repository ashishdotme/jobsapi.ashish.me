import { NextFunction, Request, Response } from 'express';
import { assignRequestId } from '../logging/logger.config';
import { runWithRequestContext } from './request-context';

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	const requestId = assignRequestId(req, res);
	runWithRequestContext({ requestId }, next);
};

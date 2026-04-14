import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
	requestId: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, callback: () => T): T => requestContextStorage.run(context, callback);

export const getRequestContext = (): RequestContext | undefined => requestContextStorage.getStore();

export const getRequestId = (): string | undefined => getRequestContext()?.requestId;

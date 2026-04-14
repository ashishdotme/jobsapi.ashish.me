type SuppressedUnmatchedRouteInput = {
	method?: string;
	path: string;
	routeMatched?: boolean;
	statusCode: number;
	exceptionResponse?: unknown;
};

export function isSuppressedUnmatchedRoute(input: SuppressedUnmatchedRouteInput): boolean {
	if (input.method === 'GET' && input.path === '/') {
		return true;
	}

	if (input.statusCode !== 404) {
		return false;
	}

	const response = typeof input.exceptionResponse === 'object' && input.exceptionResponse ? (input.exceptionResponse as Record<string, unknown>) : null;
	const expectedMethod = input.method || 'GET';

	return response?.error === 'Not Found' && response?.message === `Cannot ${expectedMethod} ${input.path}`;
}

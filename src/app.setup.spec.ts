import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { applyApiRequestIdForwarding } from './common/api-request-id-forwarding';
import { configureApp } from './app.setup';
import { RequestBodyLoggingInterceptor } from './logging/request-body-logging.interceptor';

jest.mock('node:fs', () => ({
	existsSync: jest.fn(() => false),
}));

jest.mock('./common/api-request-id-forwarding', () => ({
	applyApiRequestIdForwarding: jest.fn(),
}));

jest.mock('@nestjs/swagger', () => ({
	DocumentBuilder: jest.fn().mockImplementation(() => ({
		addApiKey: jest.fn().mockReturnThis(),
		setTitle: jest.fn().mockReturnThis(),
		setVersion: jest.fn().mockReturnThis(),
		addTag: jest.fn().mockReturnThis(),
		build: jest.fn().mockReturnValue({}),
	})),
	SwaggerModule: {
		createDocument: jest.fn(() => ({})),
		setup: jest.fn(),
	},
}));

describe('configureApp', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('registers the request body logging interceptor globally', () => {
		const app = {
			enableCors: jest.fn(),
			use: jest.fn(),
			useGlobalFilters: jest.fn(),
			useGlobalInterceptors: jest.fn(),
			useStaticAssets: jest.fn(),
			useGlobalPipes: jest.fn(),
			getHttpAdapter: jest.fn(() => ({ get: jest.fn() })),
		};

		configureApp(app as any);

		expect(app.useGlobalInterceptors).toHaveBeenCalledWith(expect.any(RequestBodyLoggingInterceptor));
		expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
		expect(applyApiRequestIdForwarding).toHaveBeenCalled();
		expect(SwaggerModule.createDocument).toHaveBeenCalled();
		expect(SwaggerModule.setup).toHaveBeenCalled();
	});
});

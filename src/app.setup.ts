import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyApiRequestIdForwarding } from './common/api-request-id-forwarding';
import { requestLoggingMiddleware } from './common/request-logging.middleware';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { RequestBodyLoggingInterceptor } from './logging/request-body-logging.interceptor';

const resolveDashboardDirectory = (): string | null => {
	const candidates = [join(process.cwd(), 'dist', 'dashboard'), join(process.cwd(), 'dashboard', 'dist')];
	for (const path of candidates) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
};

export const configureApp = (app: NestExpressApplication): void => {
	const logger = new Logger('Bootstrap');
	applyApiRequestIdForwarding();
	app.enableCors({
		origin: '*',
	});
	app.use(requestLoggingMiddleware);
	app.useGlobalFilters(new AllExceptionsFilter());
	app.useGlobalInterceptors(new RequestBodyLoggingInterceptor());

	const dashboardDirectory = resolveDashboardDirectory();
	if (dashboardDirectory) {
		app.useStaticAssets(dashboardDirectory, {
			prefix: '/dashboard/',
		});
		app.getHttpAdapter().get('/dashboard*', (_req: any, res: any) => {
			res.sendFile(join(dashboardDirectory, 'index.html'));
		});
		logger.log(`Dashboard available at /dashboard (serving ${dashboardDirectory})`);
	} else {
		logger.warn('Dashboard assets not found. Run `npm run build` to bundle dashboard UI.');
	}

	const config = new DocumentBuilder().addApiKey({ type: 'apiKey', name: 'apiKey', in: 'header' }, 'apiKey').setTitle('Jobs API').setVersion('1.0').addTag('jobs').build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api', app, document);
	app.useGlobalPipes(new ValidationPipe());
};

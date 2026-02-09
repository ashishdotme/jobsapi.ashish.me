import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const resolveDashboardDirectory = (): string | null => {
	const candidates = [join(process.cwd(), 'dist', 'dashboard'), join(process.cwd(), 'dashboard', 'dist')];
	for (const path of candidates) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
};

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bufferLogs: true,
	});
	const logger = new Logger('JobsApi');
	app.useLogger(logger);

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
	await app.listen(3000);
}
bootstrap();

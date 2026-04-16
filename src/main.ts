import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.setup';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bufferLogs: true,
	});
	app.useLogger(app.get(Logger));
	configureApp(app);
	const port = Number(process.env.PORT ?? 3000);
	await app.listen(Number.isFinite(port) ? port : 3000);
}
bootstrap();

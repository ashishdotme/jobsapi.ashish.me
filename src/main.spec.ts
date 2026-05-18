describe('bootstrap', () => {
	afterEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
	});

	it('listens on the fixed workspace port', async () => {
		const app = {
			get: jest.fn(),
			listen: jest.fn().mockResolvedValue(undefined),
			useLogger: jest.fn(),
		};
		const create = jest.fn().mockResolvedValue(app);

		jest.doMock('@nestjs/core', () => ({
			NestFactory: { create },
		}));
		jest.doMock('./app.module', () => ({
			AppModule: class AppModule {},
		}));
		jest.doMock('./app.setup', () => ({
			configureApp: jest.fn(),
		}));
		jest.doMock('nestjs-pino', () => ({
			Logger: class Logger {},
		}));

		await import('./main');
		await new Promise((resolve) => setImmediate(resolve));

		expect(app.listen).toHaveBeenCalledWith(4123);
	});
});

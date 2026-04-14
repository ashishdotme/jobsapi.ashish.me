import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpdatesBridgeRepository } from './updates-bridge.repository';
import { ThreadsClientService } from './threads-client.service';

@Injectable()
export class ThreadsAuthService {
	constructor(
		private readonly repository: UpdatesBridgeRepository,
		private readonly threadsClient: ThreadsClientService,
		private readonly configService: ConfigService,
	) {}

	async createAuthorizationUrl(returnTo?: string | null): Promise<string> {
		const validatedReturnTo = this.validateReturnTo(returnTo ?? null);
		const stateRecord = await this.repository.saveOAuthState(validatedReturnTo);
		return this.threadsClient.buildAuthorizationUrl({
			state: stateRecord.state,
			redirectUri: this.configService.get<string>('THREADS_REDIRECT_URI') ?? '',
		});
	}

	async handleCallback(code: string, state: string): Promise<string> {
		const stateRecord = await this.repository.getOAuthState(state);
		if (!stateRecord) {
			throw new BadRequestException('Invalid OAuth state');
		}
		if (new Date(stateRecord.expiresAt).getTime() < Date.now()) {
			await this.repository.deleteOAuthState(state);
			throw new BadRequestException('Expired OAuth state');
		}

		const shortLived = await this.threadsClient.exchangeCodeForToken({
			code,
			redirectUri: this.configService.get<string>('THREADS_REDIRECT_URI') ?? '',
		});
		const longLived = await this.threadsClient.exchangeForLongLivedToken({
			shortLivedToken: shortLived.accessToken,
		});
		const identity = await this.threadsClient.fetchIdentity(longLived.accessToken);
		await this.repository.saveIntegration({
			threadsUserId: identity.id,
			threadsUsername: identity.username,
			accessToken: longLived.accessToken,
			accessTokenExpiresAt: new Date(Date.now() + longLived.expiresIn * 1000).toISOString(),
		});
		await this.repository.deleteOAuthState(state);

		return `${stateRecord.returnTo ?? '/dashboard'}?threads=connected`;
	}

	private validateReturnTo(returnTo: string | null): string | null {
		if (!returnTo) {
			return null;
		}
		if (returnTo.startsWith('/')) {
			return returnTo;
		}

		const appUrl = this.configService.get<string>('APP_URL');
		if (!appUrl) {
			throw new BadRequestException('Invalid returnTo');
		}

		const parsed = new URL(returnTo);
		const allowedOrigin = new URL(appUrl).origin;
		if (parsed.origin !== allowedOrigin) {
			throw new BadRequestException('Invalid returnTo');
		}

		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	}
}

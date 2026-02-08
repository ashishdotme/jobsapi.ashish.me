import { Controller, Request, Post, Body, Query, Get } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { API_KEY_MISSING_MESSAGE, extractApiKey } from '../common/auth';

@Controller('transactions')
export class TransactionsController {
	constructor(private readonly transactionsService: TransactionsService) {}

	@Post()
	create(@Request() req, @Body() createTransactionDto: CreateTransactionDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.transactionsService.create(createTransactionDto, apiKey);
	}

	@Get('total')
	getTotal(@Request() req, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: API_KEY_MISSING_MESSAGE };
		}
		return this.transactionsService.getTotal(apiKey);
	}
}

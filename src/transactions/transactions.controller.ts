import { Controller, Request, Post, Body, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
	constructor(private readonly transactionsService: TransactionsService) {}

	@Post()
	create(@Request() req, @Body() createTransactionDto: CreateTransactionDto, @Query('apikey') apiKeyParam: string) {
		const apiKey = apiKeyParam || req.headers.apikey;
		if (!apiKey) {
			return { error: 'Apikey cannot be blank' };
		}
		return this.transactionsService.create(createTransactionDto, apiKey);
	}
}

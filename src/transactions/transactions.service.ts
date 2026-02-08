import { Injectable, Logger } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { transactionCategories } from '../data/categories';
import axios from 'axios';
import { sendEvent } from 'src/common/utils';
import * as _ from 'remeda';

@Injectable()
export class TransactionsService {
	private readonly logger = new Logger(TransactionsService.name);

	private parseTransaction(rawTransaction: string): { amount: number; merchant: string } | null {
		if (!rawTransaction?.trim()) {
			return null;
		}

		const [amountToken, ...merchantTokens] = rawTransaction.trim().split(/\s+/);
		const amount = Number(amountToken);
		const merchant = merchantTokens.join(' ').trim();

		if (!Number.isFinite(amount) || !merchant) {
			return null;
		}

		return { amount, merchant };
	}

	async getTotal(apiKey: any) {
		const transactions = await this.getTransactions(apiKey);
		let total = 0;
		transactions.forEach(x => {
			total += Number(x.amount);
		});
		const categories = {};
		transactions.forEach(x => {
			if (categories[x.category]) {
				categories[x.category] += Number(x.amount);
			} else {
				categories[x.category] = Number(x.amount);
			}
		});

		return { total: total.toFixed(2), categories };
	}

	async create(createTransactionDto: CreateTransactionDto, apikey: string) {
		try {
			const transaction = this.parseTransaction(createTransactionDto.transaction);
			if (!transaction) {
				await sendEvent('create_transaction_failed', createTransactionDto.transaction);
				this.logger.warn(`Transaction parsing failed for input "${createTransactionDto.transaction}"`);
				return { error: `Failed to create transaction` };
			}

			const normalizedMerchant = transaction.merchant.replace(/\s+/g, '').toLowerCase();
			let category = transactionCategories.find(x => x.keywords.find(y => normalizedMerchant.includes(y.replace(/\s+/g, '').toLowerCase())))?.name;

			if (!category) {
				category = 'Miscellaneous';
			}

			const payload = {
				amount: transaction.amount,
				merchant: _.capitalize(transaction.merchant),
				category: _.capitalize(category),
				date: createTransactionDto.date || new Date(),
			};

			return await this.postNewTransaction(payload, apikey);
		} catch (e) {
			await sendEvent('create_transaction_failed', createTransactionDto.transaction);
			this.logger.error(`Transaction creation failed: ${e.message}`, e.stack);
			return { error: `Failed to create transaction - ${e.message}` };
		}
	}

	private async postNewTransaction(newTransaction: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/transactions', newTransaction, config);
		return response.data;
	}

	private async getTransactions(apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.get('https://api.ashish.me/transactions', config);
		return response.data;
	}
}

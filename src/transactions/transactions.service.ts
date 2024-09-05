import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { transactionCategories } from '../data/categories';
import axios from 'axios';
import { sendEvent } from 'src/common/utils';
import * as _ from 'remeda';

@Injectable()
export class TransactionsService {
  async create(createTransactionDto: CreateTransactionDto, apikey: string) {
    try {
      const amount = createTransactionDto.transaction.slice(
        0,
        createTransactionDto.transaction.indexOf(' '),
      );
      const merchant = createTransactionDto.transaction
        .slice(
          createTransactionDto.transaction.indexOf(' '),
          createTransactionDto.transaction.length,
        )
        .trim();

      if (!merchant || !amount) {
        await sendEvent(
          'create_transaction_failed',
          createTransactionDto.transaction,
        );
        return { error: `Failed to create transaction` };
      }

      let category = transactionCategories.find((x) =>
        x.keywords.includes(merchant),
      ).name;

      if (!category) {
        category = 'Miscellaneous';
      }

      const payload = {
        amount: Number(amount),
        merchant: _.capitalize(merchant),
        category: _.capitalize(category),
        date: createTransactionDto.date || new Date(),
      };
      return await this.postNewTransaction(payload, apikey);
    } catch (e) {
      await sendEvent(
        'create_transaction_failed',
        createTransactionDto.transaction,
      );
      return { error: `Failed to create transaction - ${e.message}` };
    }
  }

  private buildNewTransactionPayload(
    createTransactionDto: CreateTransactionDto,
    category: string,
  ): any {
    return {
      amount: createTransactionDto.amount,
      merchant: _.capitalize(createTransactionDto.merchant),
      category: _.capitalize(category),
      date: createTransactionDto.date || new Date(),
    };
  }

  private async postNewTransaction(
    newTransaction: any,
    apikey: string,
  ): Promise<any> {
    const config = {
      headers: {
        apiKey: apikey,
      },
    };
    const response = await axios.post(
      'https://api.ashish.me/transactions',
      newTransaction,
      config,
    );
    return response.data;
  }
}

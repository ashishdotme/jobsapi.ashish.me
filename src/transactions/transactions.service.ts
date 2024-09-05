import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { transactionCategories } from '../data/categories';
import axios from 'axios';
import { sendEvent } from 'src/common/utils';

@Injectable()
export class TransactionsService {
  async create(createTransactionDto: CreateTransactionDto, apikey: string) {
    try {
      const category = transactionCategories.find((x) =>
        x.keywords.includes(createTransactionDto.merchant),
      );
      if(!category){
        await sendEvent(
          'create_transaction_failed',
          createTransactionDto.merchant,
        );
        return { error: `Failed to create transaction - ${e.message}` };
      }
      const payload = this.buildNewTransactionPayload(
        createTransactionDto,
        category.name,
      );
      return await this.postNewTransaction(payload, apikey);
    } catch (e) {
      await sendEvent(
        'create_transaction_failed',
        createTransactionDto.merchant,
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
      merchant: createTransactionDto.merchant,
      category: category,
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

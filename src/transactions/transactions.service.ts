import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { transactionCategories } from '../data/categories'
@Injectable()
export class TransactionsService {
  create(createTransactionDto: CreateTransactionDto, apikey: string) {
    // "Charity":        0,
    // "Saving":         1,
    // "Housing":        2,
    // "Utilities":      3,
    // "Food":           4,
    // "Clothing":       5,
    // "Transportation": 6,
    // "Medical/Health": 7,
    // "Insurance":      8,
    // "Personal":       9,
    // "Recreation":     10,
    // "Debts":          11,
    const category = transactionCategories.find(x => x.keywords.includes(createTransactionDto.))
    return 'This action adds a new transaction';
  }

  
}

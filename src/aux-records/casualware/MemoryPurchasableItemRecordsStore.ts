import { PurchasableItem, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { MemoryCrudRecordsStore } from '../MemoryCrudRecordsStore';

export class MemoryPurchasableItemRecordsStore extends MemoryCrudRecordsStore<PurchasableItem> implements PurchasableItemRecordsStore {}
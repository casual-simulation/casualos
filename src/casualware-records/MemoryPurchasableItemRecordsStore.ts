import { PurchasableItem, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { MemoryCrudRecordsStore } from '@casual-simulation/aux-records/MemoryCrudRecordsStore';

export class MemoryPurchasableItemRecordsStore extends MemoryCrudRecordsStore<PurchasableItem> implements PurchasableItemRecordsStore {}
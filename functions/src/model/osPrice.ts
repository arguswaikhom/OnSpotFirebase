import { OSDiscount } from './osDiscount';

export class OSPrice {
  price: number
  tax: number
  discount: OSDiscount
  unit: string
  quantity: number
}
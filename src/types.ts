/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ShopSetup {
  shopName: string;
  shopAddress: string;
  phone: string;
  whatsapp: string;
  gstEnabled: boolean;
  gstNumber: string;
  invoicePrefix: string;
  currency: string;
  logoUrl: string | null;
  signatureUrl: string | null;
}

export interface InvoiceItem {
  id: string;
  name: string;
  category: string;
  size: string;
  quantity: number;
  rate: number;
  discountPercent: number; // item-level discount %
  discountAmount: number;   // calculated
  gstPercent: number;        // item-level GST %
  gstAmount: number;         // calculated
  cgstAmount: number;        // calculated split (half of GST)
  sgstAmount: number;        // calculated split (half of GST)
  total: number;             // final rate * qty - discount + GST
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string; // ISO String
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;          // sum of rate * qty
  itemDiscountTotal: number; // sum of item-level discount amounts
  flatDiscountPercent: number; // invoice-level flat discount %
  flatDiscountAmount: number;  // invoice-level calculated or flat amount
  totalDiscount: number;   // total combined discounts
  gstEnabled: boolean;
  totalGstAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Pending';
  notes: string;
  syncedToSheets: boolean;
}

export interface CustomerHistory {
  phone: string;
  name: string;
  address: string;
  totalInvoicesCount: number;
  totalSpent: number;
  lastVisitDate: string;
}

export interface GoogleSheetsConfig {
  sheetUrl: string;
  scriptUrl: string;
  connected: boolean;
}

export interface ShareLog {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  phone: string;
  timestamp: string;
  type: 'WhatsApp' | 'PDF_Download' | 'TXT_Print' | 'SMS';
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice, InvoiceItem, ShopSetup } from './types';

/**
 * Format currency to Indian Rupees system or specified currency
 */
export function formatCurrency(amount: number, symbol: string = '₹'): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `${symbol}${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Re-calculate totals for an entire list of draft items
 */
export function calculateInvoiceTotals(
  items: InvoiceItem[],
  flatDiscountPercent: number,
  flatDiscountAmountInput: number,
  gstEnabled: boolean
) {
  // 1. Calculate base sum & item-level discounts
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let rawGstTotal = 0;

  const processedItems = items.map((item) => {
    const rawTotalQty = item.rate * item.quantity;
    
    // Item-level discount
    const discountAmount = Math.round(((rawTotalQty * item.discountPercent) / 100 + Number.EPSILON) * 100) / 100;
    const afterDiscount = Math.max(0, rawTotalQty - discountAmount);

    // Item-level GST (applied optionally if shop GST is enabled)
    let gstAmount = 0;
    if (gstEnabled) {
      gstAmount = Math.round(((afterDiscount * item.gstPercent) / 100 + Number.EPSILON) * 100) / 100;
    }
    const cgstAmount = Math.round((gstAmount / 2 + Number.EPSILON) * 100) / 100;
    const sgstAmount = Math.round((gstAmount - cgstAmount + Number.EPSILON) * 100) / 100;

    const total = Math.round((afterDiscount + gstAmount + Number.EPSILON) * 100) / 100;

    subtotal += rawTotalQty;
    itemDiscountTotal += discountAmount;
    rawGstTotal += gstAmount;

    return {
      ...item,
      discountAmount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      total,
    };
  });

  // Calculate invoice-level flat discount (applied on subtotal after item-level discounts)
  const baseForFlatDiscount = Math.max(0, subtotal - itemDiscountTotal);
  let flatDiscountAmount = flatDiscountAmountInput;
  if (flatDiscountPercent > 0) {
    flatDiscountAmount = Math.round(((baseForFlatDiscount * flatDiscountPercent) / 100 + Number.EPSILON) * 100) / 100;
  }

  const finalDiscountTotal = itemDiscountTotal + flatDiscountAmount;
  
  // Re-calculate GST if overall totals change or just accumulate
  const totalGstAmount = gstEnabled ? rawGstTotal : 0;
  const totalCgstAmount = Math.round((totalGstAmount / 2 + Number.EPSILON) * 100) / 100;
  const totalSgstAmount = Math.round((totalGstAmount - totalCgstAmount + Number.EPSILON) * 100) / 100;

  const rawGrandTotal = Math.max(0, subtotal - finalDiscountTotal + totalGstAmount);
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal + Number.EPSILON) * 100) / 100;

  return {
    items: processedItems,
    subtotal,
    itemDiscountTotal,
    flatDiscountAmount,
    totalDiscount: finalDiscountTotal,
    totalGstAmount,
    totalCgstAmount,
    totalSgstAmount,
    roundOff,
    grandTotal: roundedGrandTotal,
  };
}

/**
 * Generate standard WhatsApp trigger link with pre-composed text message
 */
export function buildWhatsAppLink(invoice: Invoice, shop: ShopSetup): string {
  const currencySymbol = shop.currency || '₹';
  const cleanPhone = invoice.customerPhone.replace(/\D/g, '');
  
  // Composing a beautiful retail-friendly WhatsApp Invoice message
  const billSummary = invoice.items
    .map((item) => `• ${item.name} (${item.size})` + (item.quantity > 1 ? ` x${item.quantity}` : ''))
    .slice(0, 5)
    .join('\n');

  const moreItemsCount = invoice.items.length - 5;
  const itemsText = billSummary + (moreItemsCount > 0 ? `\n...and ${moreItemsCount} more items` : '');

  const textMessage = 
`Dear *${invoice.customerName || 'Customer'}*,

Thank you for shopping at *${shop.shopName || 'Our Boutique'}*! ❤️

Here is your purchase summary:
-----------------------------
*Invoice No*: ${invoice.invoiceNumber}
*Date*: ${new Date(invoice.date).toLocaleDateString('en-IN')}
*Total Amount*: ${currencySymbol}${invoice.grandTotal.toLocaleString('en-IN')}
*Payment Method*: ${invoice.paymentMethod}

*Items Purchased*:
${itemsText}

-----------------------------
Exchange allowed within 7 days with original compulsory bill copy.

Visit us again! ✨
_Generated securely via AI Retail POS_`;

  const encodedText = encodeURIComponent(textMessage);
  
  // Format for Indian region default if phone is 10 digit, prefix with 91
  let formattedPhone = cleanPhone;
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`;
  }

  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
}

/**
 * Generate text representation of the Invoice (suitable for draft TXT thermal-printing)
 */
export function buildTextReceipt(invoice: Invoice, shop: ShopSetup): string {
  const pad = (text: string, length: number, align: 'left' | 'right' = 'left') => {
    const spaces = ' '.repeat(Math.max(0, length - text.length));
    return align === 'left' ? text + spaces : spaces + text;
  };

  const centerPad = (text: string, length: number) => {
    if (text.length >= length) return text.substring(0, length);
    const leftSpaces = ' '.repeat(Math.floor((length - text.length) / 2));
    const rightSpaces = ' '.repeat(length - text.length - leftSpaces.length);
    return leftSpaces + text + rightSpaces;
  };

  const hr = '='.repeat(32);
  const thinHr = '-'.repeat(32);
  
  // Use 'Rs.' as safe default for text receipts to avoid unicode encoding bugs like â‚¹ on various POS terminals
  let curSymbol = shop.currency || 'Rs.';
  if (curSymbol === '₹') {
    curSymbol = 'Rs.';
  }

  const formatReceiptCurrency = (amount: number, symbol: string) => {
    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
    return `${symbol}${rounded.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  let txt = '';
  
  // Centered Shop Header Block
  txt += centerPad(shop.shopName.toUpperCase(), 32) + '\n';
  
  // Clean split for address lines
  const addressLines = shop.shopAddress.split(',').map(s => s.trim()).filter(Boolean);
  addressLines.forEach(line => {
    txt += centerPad(line, 32) + '\n';
  });
  
  txt += centerPad(`Phone: ${shop.phone}`, 32) + '\n';
  if (shop.gstNumber) {
    txt += centerPad(`GSTIN: ${shop.gstNumber}`, 32) + '\n';
  }
  
  txt += hr + '\n';
  txt += `Receipt: ${invoice.invoiceNumber}\n`;
  txt += `Date   : ${new Date(invoice.date).toLocaleString('en-IN')}\n`;
  txt += `Cust   : ${invoice.customerName}\n`;
  if (invoice.customerPhone) {
    txt += `Mobile : ${invoice.customerPhone}\n`;
  }
  txt += hr + '\n';
  
  // Table columns: ITEM (12-char), QTY (4-char), RATE (7-char), TOTAL (9-char)
  txt += pad('ITEM', 12) + pad('QTY', 4, 'right') + pad('RATE', 7, 'right') + pad('TOTAL', 9, 'right') + '\n';
  txt += thinHr + '\n';

  invoice.items.forEach((item) => {
    const sizeSuffix = item.size ? ` ${item.size}` : '';
    let itemLabel = `${item.name}${sizeSuffix}`.trim();
    if (itemLabel.length > 12) {
      itemLabel = itemLabel.substring(0, 11) + '…';
    }
    
    txt += pad(itemLabel, 12) + 
           pad(String(item.quantity), 4, 'right') + 
           pad(String(item.rate), 7, 'right') + 
           pad(String(item.total), 9, 'right') + '\n';
           
    if (item.discountPercent > 0) {
      const discVal = Math.round(((item.rate * item.quantity * item.discountPercent) / 100 + Number.EPSILON) * 100) / 100;
      txt += pad(`  (Disc: ${item.discountPercent}%)`, 20, 'left') + 
             pad(`-${formatReceiptCurrency(discVal, curSymbol)}`, 12, 'right') + '\n';
    }
  });

  txt += thinHr + '\n';
  txt += pad('Subtotal:', 20, 'left') + pad(formatReceiptCurrency(invoice.subtotal, curSymbol), 12, 'right') + '\n';
  
  if (invoice.totalDiscount > 0) {
    const overallPct = invoice.subtotal > 0 ? Math.round((invoice.totalDiscount / invoice.subtotal) * 100) : 0;
    txt += pad(`Discount (${overallPct}%):`, 20, 'left') + 
           pad('-' + formatReceiptCurrency(invoice.totalDiscount, curSymbol), 12, 'right') + '\n';
  }
  
  if (invoice.gstEnabled && invoice.totalGstAmount > 0) {
    txt += pad('CGST:', 20, 'left') + pad(formatReceiptCurrency(invoice.totalCgstAmount, curSymbol), 12, 'right') + '\n';
    txt += pad('SGST:', 20, 'left') + pad(formatReceiptCurrency(invoice.totalSgstAmount, curSymbol), 12, 'right') + '\n';
  }
  
  if (invoice.roundOff !== 0) {
    txt += pad('Round Off:', 20, 'left') + pad(formatReceiptCurrency(invoice.roundOff, curSymbol), 12, 'right') + '\n';
  }
  
  txt += hr + '\n';
  txt += pad('GRAND TOTAL:', 18, 'left') + pad(formatReceiptCurrency(invoice.grandTotal, curSymbol), 14, 'right') + '\n';
  txt += hr + '\n';
  
  txt += centerPad('Thank you for shopping!', 32) + '\n';
  txt += thinHr + '\n';
  txt += centerPad('EXCHANGE POLICY TERMS:', 32) + '\n';
  txt += '- Exchange allowed within 7 days\n';
  txt += '- Compulsory original invoice\n';
  txt += '- Unused condition + tags intact\n';
  txt += '- No swap on clearance/sale item\n';
  txt += '- Defect claim within 48 hours\n';
  txt += thinHr + '\n';
  txt += centerPad('Have a lovely day! ✨', 32) + '\n';

  return txt;
}

/**
 * Generate highly structured CSV contents formatting data month-by-month
 * mapped perfectly to Indian accounting requirements (GST, discount columns etc.)
 */
export function generateGSTReportCSV(invoices: Invoice[]): string {
  const headers = [
    'Invoice Number',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Sub Total',
    'Discount Deducted',
    'GST Mode',
    'CGST (9%)',
    'SGST (9%)',
    'Total GST Collected',
    'Grand Total Paid',
    'Payment Mode',
  ];

  const rows = invoices.map((inv) => {
    return [
      `"${inv.invoiceNumber}"`,
      `"${new Date(inv.date).toLocaleDateString('en-IN')}"`,
      `"${inv.customerName || 'Walk-in Customer'}"`,
      `"${inv.customerPhone || ''}"`,
      inv.subtotal,
      inv.totalDiscount,
      inv.gstEnabled ? 'ON' : 'OFF',
      inv.totalCgstAmount,
      inv.totalSgstAmount,
      inv.totalGstAmount,
      inv.grandTotal,
      `"${inv.paymentMethod}"`,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Dispatch session event helper
 */
export function logSessionEvent(msg: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('add-session-log', { detail: msg }));
  }
}


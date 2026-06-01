import React from 'react';
import { Invoice, ShopSetup } from '../types';
import { formatCurrency } from '../utils';

interface ThermalReceiptProps {
  invoice: Invoice | null;
  shopSetup: ShopSetup;
}

export default function ThermalReceipt({ invoice, shopSetup }: ThermalReceiptProps) {
  if (!invoice) return null;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  // Determine line item totals
  const totalQty = invoice.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div id="thermal-print-section-wrapper" className="thermal-receipt-text select-none text-black bg-white leading-tight">
      <div className="w-full text-center thermal-receipt-text">
        
        {/* Shop Info Header */}
        <h2 className="text-sm font-black uppercase tracking-wider mb-1 text-black font-mono">
          {shopSetup.shopName}
        </h2>
        <p className="text-[10px] text-black font-medium font-mono mb-1 leading-snug whitespace-pre-line px-2">
          {shopSetup.shopAddress}
        </p>
        <p className="text-[10px] text-black font-semibold font-mono mb-2">
          Tel: +{shopSetup.phone}
        </p>

        {shopSetup.gstEnabled && shopSetup.gstNumber && (
          <p className="text-[10px] text-black font-bold font-mono mb-2 border border-black py-0.5 px-2 inline-block">
            GSTIN: {shopSetup.gstNumber}
          </p>
        )}

        {/* Separator */}
        <div className="border-t border-dashed border-black my-2 w-full"></div>

        {/* Invoice Metadata Metadata */}
        <div className="text-left text-[10px] font-mono space-y-1 px-1">
          <div className="flex justify-between">
            <span>INV NO:</span>
            <span className="font-bold">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>DATE:</span>
            <span>{formatDate(invoice.date)}</span>
          </div>
          <div className="flex justify-between">
            <span>CASHIER:</span>
            <span>E-Bill Counter</span>
          </div>
          
          <div className="border-t border-dashed border-black my-1.5"></div>

          {/* Customer Metadata Card */}
          <div className="font-semibold text-[10px]">
            <p className="font-bold">CUSTOMER DETAILS:</p>
            <p>NAME: {invoice.customerName.toUpperCase()}</p>
            {invoice.customerPhone && <p>PHONE: +91 {invoice.customerPhone}</p>}
            {invoice.customerAddress && (
              <p className="truncate">ADDR: {invoice.customerAddress}</p>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t-2 border-black my-2.5 w-full"></div>

        {/* Table representation for list of items */}
        <div className="w-full text-left font-mono text-[9.5px]">
          <div className="flex justify-between font-black uppercase mb-1.5 border-b border-black pb-0.5">
            <span className="w-1/2">ITEM NAME</span>
            <span className="w-12 text-center">QTY</span>
            <span className="w-16 text-right">RATE</span>
            <span className="w-16 text-right">AMOUNT</span>
          </div>

          <div className="space-y-2">
            {invoice.items.map((item, index) => {
              const displayItemName = item.name.substring(0, 24) + (item.name.length > 24 ? '..' : '');
              const desc = [item.category, item.size].filter(Boolean).join('/') || '';

              return (
                <div key={item.id || index} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-black">
                    <span className="w-1/2 break-words leading-tight">{displayItemName}</span>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <span className="w-16 text-right">₹{item.rate}</span>
                    <span className="w-16 text-right font-black">₹{item.total}</span>
                  </div>
                  {desc && (
                    <div className="flex text-[8px] text-black/80 font-medium pl-1 italic">
                      ({desc})
                    </div>
                  )}
                  {item.discountPercent > 0 && (
                    <div className="flex justify-between text-[8px] text-black">
                      <span className="pl-1">- Item Disc ({item.discountPercent}%)</span>
                      <span>-₹{item.discountAmount}</span>
                    </div>
                  )}
                  {shopSetup.gstEnabled && item.gstPercent > 0 && (
                    <div className="flex justify-between text-[8px] text-black">
                      <span className="pl-1">+ GST ({item.gstPercent}%)</span>
                      <span>₹{item.gstAmount}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-black my-3 w-full"></div>

        {/* Consolidated Bills totals section */}
        <div className="text-left font-mono text-[10px] space-y-1.5 px-1 text-black">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>₹{invoice.subtotal.toLocaleString('en-IN')}</span>
          </div>

          {invoice.totalDiscount > 0 && (
            <div className="flex justify-between text-black font-semibold">
              <span>DISCOUNTS TOTAL:</span>
              <span>-₹{invoice.totalDiscount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {invoice.gstEnabled && (
            <>
              <div className="flex justify-between text-black/90">
                <span>CGST TOTAL:</span>
                <span>₹{invoice.totalCgstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-black/90">
                <span>SGST TOTAL:</span>
                <span>₹{invoice.totalSgstAmount.toLocaleString('en-IN')}</span>
              </div>
            </>
          )}

          {invoice.roundOff !== 0 && (
            <div className="flex justify-between text-[9px] italic">
              <span>ROUND OFF:</span>
              <span>{invoice.roundOff > 0 ? '+' : ''}₹{invoice.roundOff}</span>
            </div>
          )}

          <div className="border-t-2 border-double border-black my-2"></div>

          <div className="flex justify-between font-black text-xs text-black uppercase">
            <span>GRAND TOTAL:</span>
            <span>₹{invoice.grandTotal.toLocaleString('en-IN')}</span>
          </div>

          <div className="border-t-2 border-double border-black my-2"></div>

          {/* Payment Method tag */}
          <div className="flex justify-between text-[9.5px]">
            <span>PAYMENT STATUS:</span>
            <span className="font-bold uppercase border border-black px-1.5 text-[9px]">
              {invoice.paymentMethod === 'Pending' ? 'DUE / PENDING' : `${invoice.paymentMethod} - PAID`}
            </span>
          </div>

          {invoice.notes && (
            <div className="text-[9px] mt-2 italic text-left whitespace-pre-line border border-black/10 p-1.5 rounded bg-slate-50">
              <strong className="block text-[8px] font-bold uppercase not-italic">Remarks:</strong>
              {invoice.notes}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="border-t border-black my-4 w-full"></div>

        {/* Footer Greetings branding block */}
        <div className="font-mono text-center space-y-1.5 pb-2 text-black text-[9.5px]">
          <p className="font-bold uppercase">*** Thank You For Visiting! ***</p>
          <p className="font-medium">No Exchange / Refund without invoice receipt</p>
          <p className="text-[7.5px] text-black/60 pt-2 font-semibold">
            Invoice rendered digitally via E-Bill Book POS
          </p>
        </div>

      </div>
    </div>
  );
}

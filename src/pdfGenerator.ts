/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Invoice, ShopSetup } from './types';
import { formatCurrency } from './utils';

export function drawInvoiceOnPDFDoc(doc: jsPDF, invoice: Invoice, shop: ShopSetup) {
  const currencySymbol = shop.currency || 'Rs.';

  // Margins & Dimensions (A4 size: 210mm x 297mm)
  const leftMargin = 15;
  const rightMargin = 195;
  const contentWidth = rightMargin - leftMargin; // 180mm
  let currentY = 15;

  // Set default font to Helvetica
  doc.setFont('helvetica', 'normal');

  // --- DRAW DECORABLE TOP BANNER ---
  doc.setFillColor(242, 244, 247); // Soft light blue-grey
  doc.rect(14, currentY, contentWidth + 2, 8, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 130);
  doc.text('AI RETAIL BILLING SYSTEM • ORIGINAL CASH MEMO', leftMargin + 2, currentY + 5.5);
  doc.text(`${invoice.paymentMethod.toUpperCase()} INVOICE`, rightMargin - 4, currentY + 5.5, { align: 'right' });
  currentY += 15;

  // --- SHOP HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(26, 36, 43); // Slate charcoal
  doc.text(shop.shopName, leftMargin, currentY);
  
  doc.setFontSize(10);
  doc.setTextColor(110, 120, 130);
  doc.text('ESTD. FASHION BOUTIQUE', rightMargin, currentY - 1, { align: 'right' });
  currentY += 6;

  // Address & contact lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 90);
  
  // Wrap address if long
  const addressLines = doc.splitTextToSize(shop.shopAddress, 110);
  addressLines.forEach((line: string) => {
    doc.text(line, leftMargin, currentY);
    currentY += 4.5;
  });

  doc.text(`Tel: ${shop.phone}  |  WhatsApp: ${shop.whatsapp}`, leftMargin, currentY);
  
  // Right side: INVOICE IDENTIFIER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('TAX INVOICE', rightMargin, currentY - 5, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 90);
  doc.text(`Bill No: ${invoice.invoiceNumber}`, rightMargin, currentY, { align: 'right' });
  currentY += 4.5;
  doc.text(`Date: ${new Date(invoice.date).toLocaleString('en-IN')}`, rightMargin, currentY, { align: 'right' });
  
  if (shop.gstNumber) {
    currentY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`GSTIN/UIN: ${shop.gstNumber}`, leftMargin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 80, 90);
  }
  
  currentY += 10;

  // Double separator line
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, currentY, rightMargin, currentY);
  currentY += 6;

  // --- CLIENT DETAILS BLOCK (Two column grid) ---
  const gridColumnY = currentY;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 36, 43);
  doc.text('BILLED TO (CUSTOMER):', leftMargin, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(40, 50, 60);
  currentY += 5;
  doc.text(`Name: ${invoice.customerName || 'Walk-in Customer'}`, leftMargin, currentY);
  currentY += 4.5;
  doc.text(`Phone: ${invoice.customerPhone || 'N/A'}`, leftMargin, currentY);
  if (invoice.customerAddress) {
    currentY += 4.5;
    doc.text(`Address: ${invoice.customerAddress}`, leftMargin, currentY);
  }

  // Right column: QR representation (optional styling code)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 130);
  doc.rect(160, gridColumnY, 35, 14);
  doc.text('MEMBER LEDGER', 177.5, gridColumnY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Visit: ${invoice.customerPhone ? 'Regular' : 'One-time'}`, 177.5, gridColumnY + 9, { align: 'center' });
  doc.text(`Sync status: OK`, 177.5, gridColumnY + 12, { align: 'center' });

  currentY = Math.max(currentY + 10, gridColumnY + 20);

  // --- ITEMS TABLE CONTENT ---
  const colX = {
    sNo: leftMargin,
    item: leftMargin + 8,
    cat: leftMargin + 56,
    size: leftMargin + 78,
    qty: leftMargin + 90,
    rate: leftMargin + 100,
    disc: leftMargin + 120,
    gst: leftMargin + 135,
    total: leftMargin + 150,
  };

  // Table header background
  doc.setFillColor(30, 41, 59); // Charcoal Navy
  doc.rect(leftMargin, currentY, contentWidth, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('S.No', colX.sNo + 1, currentY + 5.5);
  doc.text('Clothing Item Name', colX.item + 1, currentY + 5.5);
  doc.text('Category', colX.cat + 1, currentY + 5.5);
  doc.text('Size', colX.size + 1, currentY + 5.5);
  doc.text('Qty', colX.qty + 5, currentY + 5.5, { align: 'right' });
  doc.text('Rate', colX.rate + 18, currentY + 5.5, { align: 'right' });
  doc.text('Disc %', colX.disc + 13, currentY + 5.5, { align: 'right' });
  doc.text('GST %', colX.gst + 13, currentY + 5.5, { align: 'right' });
  doc.text('Total Price', rightMargin - 2, currentY + 5.5, { align: 'right' });
  
  currentY += 8;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.setDrawColor(230, 235, 240);
  doc.setLineWidth(0.3);

  invoice.items.forEach((item, index) => {
    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(leftMargin, currentY, contentWidth, 7, 'F');
    }
    
    doc.text(String(index + 1), colX.sNo + 1, currentY + 5);
    
    // Auto-truncate item name if too long
    const itemLabel = item.name.length > 25 ? item.name.substring(0, 23) + '..' : item.name;
    doc.setFont('helvetica', 'bold');
    doc.text(itemLabel, colX.item + 1, currentY + 5);
    doc.setFont('helvetica', 'normal');
    
    doc.text(item.category || 'Apparel', colX.cat + 1, currentY + 5);
    doc.text(item.size || '-', colX.size + 1, currentY + 5);
    doc.text(String(item.quantity), colX.qty + 5, currentY + 5, { align: 'right' });
    doc.text(formatCurrency(item.rate, ''), colX.rate + 18, currentY + 5, { align: 'right' });
    doc.text(item.discountPercent > 0 ? `${item.discountPercent}%` : '0%', colX.disc + 13, currentY + 5, { align: 'right' });
    doc.text(invoice.gstEnabled ? `${item.gstPercent}%` : '0%', colX.gst + 13, currentY + 5, { align: 'right' });
    doc.text(formatCurrency(item.total, ''), rightMargin - 2, currentY + 5, { align: 'right' });

    // Draw bottom border line
    doc.line(leftMargin, currentY + 7, rightMargin, currentY + 7);
    currentY += 7;
  });

  currentY += 5;

  // --- CALCULATION BLOCK (Subtotals & Taxes) ---
  const calculationStartY = currentY;
  
  // Left side: GST summary break-up table (very important for Indian GST verification)
  if (invoice.gstEnabled && invoice.totalGstAmount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('CGST & SGST (9%+9% Split Breakdown)', leftMargin, currentY);
    currentY += 4;
    
    doc.setFillColor(248, 249, 250);
    doc.rect(leftMargin, currentY, 100, 15, 'F');
    doc.setDrawColor(220, 222, 225);
    doc.rect(leftMargin, currentY, 100, 15, 'S');

    doc.setFont('helvetica', 'normal');
    const cgstHalf = invoice.totalCgstAmount;
    const sgstHalf = invoice.totalSgstAmount;
    
    doc.text(`Central GST (CGST - Split):`, leftMargin + 3, currentY + 5);
    doc.text(formatCurrency(cgstHalf, currencySymbol), leftMargin + 97, currentY + 5, { align: 'right' });
    
    doc.text(`State GST (SGST - Split):`, leftMargin + 3, currentY + 10);
    doc.text(formatCurrency(sgstHalf, currencySymbol), leftMargin + 97, currentY + 10, { align: 'right' });
  }

  // Right side: Main aggregate sums
  currentY = calculationStartY;
  const metricsX = 145;
  const valuesX = rightMargin - 2;

  const drawMetricRow = (label: string, valueStr: string, isHeader: boolean = false) => {
    if (isHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(26, 36, 43);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 80, 90);
    }
    doc.text(label, metricsX, currentY + 4);
    doc.text(valueStr, valuesX, currentY + 4, { align: 'right' });
    currentY += 5;
  };

  drawMetricRow('Item Subtotal (Base):', formatCurrency(invoice.subtotal, currencySymbol));
  if (invoice.totalDiscount > 0) {
    const overallPct = invoice.subtotal > 0 ? Math.round((invoice.totalDiscount / invoice.subtotal) * 100) : 0;
    drawMetricRow(`Discounts Applied (${overallPct}%):`, `- ${formatCurrency(invoice.totalDiscount, currencySymbol)}`);
  }
  if (invoice.gstEnabled && invoice.totalGstAmount > 0) {
    drawMetricRow('Total Output GST:', formatCurrency(invoice.totalGstAmount, currencySymbol));
  }
  if (invoice.roundOff !== 0) {
    drawMetricRow('Round Off:', `${invoice.roundOff > 0 ? '+' : ''}${formatCurrency(invoice.roundOff, currencySymbol)}`);
  }

  // Grand Total box banner
  currentY += 2;
  doc.setFillColor(30, 41, 59);
  doc.rect(metricsX - 10, currentY, contentWidth - (metricsX - leftMargin) + 10, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAYABLE:', metricsX - 6, currentY + 5.5);
  doc.text(formatCurrency(invoice.grandTotal, currencySymbol), valuesX, currentY + 5.5, { align: 'right' });

  currentY += 16;

  // --- TERMS & RULES FOOTER SECTION ---
  doc.setLineWidth(0.3);
  doc.setDrawColor(220, 224, 230);
  doc.line(leftMargin, currentY, rightMargin, currentY);
  currentY += 4;

  const bottomY = currentY;

  // Left Section: 10 Indian Clothing Store Return & Exchange Rules
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(26, 36, 43);
  doc.text('STORE BILL EXCHANGE & TERMS (RETURN POLICY):', leftMargin, currentY);
  currentY += 3.5;

  const shopRules = [
    '1. Exchange allowed within 7 days from the date of purchase.',
    '2. Original bill/invoice is compulsory for any exchange.',
    '3. Products must be unused, unwashed, and in original condition with all tags attached.',
    '4. No exchange or replacement on discounted, clearance, or promotional sale items.',
    '5. Innerwear, accessories, and customized products are not eligible for exchange.',
    '6. Exchange is subject to stock availability.',
    '7. Customers may exchange for another product of equal or higher value (difference to be paid).',
    '8. No cash refund will be provided; only exchange or store credit (if applicable).',
    '9. Any manufacturing defect should be reported within 48 hours of purchase.',
    '10. Shop owner reserves the right to refuse exchange if product does not meet conditions.'
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(110, 120, 130);
  
  shopRules.forEach((rule) => {
    const splitRule = doc.splitTextToSize(rule, 122);
    splitRule.forEach((line: string) => {
      doc.text(line, leftMargin, currentY);
      currentY += 2.4;
    });
  });

  // Right Section: Authorized Signature upload box
  currentY = bottomY;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 110, 120);
  doc.rect(145, currentY + 1, 50, 16);
  
  if (shop.signatureUrl) {
    try {
      doc.addImage(shop.signatureUrl, 'PNG', 148, currentY + 2, 44, 14);
    } catch {
      doc.text('[ Signature Uploaded ]', 170, currentY + 9, { align: 'center' });
    }
  } else {
    doc.text('[ Stamp / Signature ]', 170, currentY + 9, { align: 'center' });
  }

  doc.text('Authorized Signatory', 170, currentY + 21, { align: 'center' });

  // Draw Bottom-most Branding footer
  doc.setFontSize(6);
  doc.text('THANK YOU FOR VISITING! CHOOSE TRADITION, WEAR TRUST.', 105, 288, { align: 'center' });
}

export function exportInvoicePDF(invoice: Invoice, shop: ShopSetup) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  drawInvoiceOnPDFDoc(doc, invoice, shop);

  // Save the generated document
  doc.save(`BILL_${invoice.invoiceNumber}.pdf`);
}

export function exportBulkInvoicesPDF(invoices: Invoice[], shop: ShopSetup) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  invoices.forEach((invoice, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawInvoiceOnPDFDoc(doc, invoice, shop);
  });

  doc.save(`BULK_INVOICES_${new Date().toISOString().slice(0, 10)}.pdf`);
}

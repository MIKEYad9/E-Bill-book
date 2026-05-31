/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoice, ShopSetup, CustomerHistory, ShareLog, GoogleSheetsConfig } from './types';

// Standard storage keys
const SETUP_KEY = 'ai_billing_shop_setup_v1';
const INVOICES_KEY = 'ai_billing_invoices_v1';
const SHEETS_KEY = 'ai_billing_sheets_config_v1';
const SHARE_LOGS_KEY = 'ai_billing_share_logs_v1';

// Default Shop Configuration
export const DEFAULT_SHOP_SETUP: ShopSetup = {
  shopName: 'Balaji Fashion Saree Kendra',
  shopAddress: 'Sector-5, Near Hanuman Mandir, Main Market, Jaipur, Rajasthan - 302001',
  phone: '9876543210',
  whatsapp: '9876543210',
  gstEnabled: true,
  gstNumber: '08AAAAA1111A1Z1',
  invoicePrefix: 'BFS/2026/',
  currency: '₹',
  logoUrl: null,
  signatureUrl: null,
};

// Initial Sample Boutique Inventory (Rich, standard Indian Clothing tags)
export interface CatalogItem {
  id: string;
  barcode: string;
  name: string;
  category: string;
  size: string;
  rate: number;
  discountPercent: number;
  gstPercent: number;
  stock: number;
}

export const SAMPLE_CATALOG: CatalogItem[] = [
  { id: '1', barcode: '8901001', name: 'Banarasi Silk Saree Premium', category: 'Saree', size: 'Free Size', rate: 2450.00, discountPercent: 10, gstPercent: 12, stock: 45 },
  { id: '2', barcode: '8901002', name: 'Jaipuri Bandhani Cotton Saree', category: 'Saree', size: 'Free Size', rate: 1200.00, discountPercent: 5, gstPercent: 5, stock: 60 },
  { id: '3', barcode: '8901003', name: 'Anarkali Suit Set Georgette', category: 'Suit', size: 'XL', rate: 1850.00, discountPercent: 15, gstPercent: 12, stock: 25 },
  { id: '4', barcode: '8901004', name: 'Anarkali Suit Set Georgette', category: 'Suit', size: 'L', rate: 1850.00, discountPercent: 15, gstPercent: 12, stock: 20 },
  { id: '5', barcode: '8901005', name: 'Designer Chikankari Kurti Special', category: 'Kurta', size: 'M', rate: 850.00, discountPercent: 0, gstPercent: 5, stock: 80 },
  { id: '6', barcode: '8901006', name: 'Designer Chikankari Kurti Special', category: 'Kurta', size: 'XL', rate: 850.00, discountPercent: 0, gstPercent: 5, stock: 55 },
  { id: '7', barcode: '8901007', name: 'Slim Fit Denim Jeans Distressed', category: 'Jeans', size: '32', rate: 1400.00, discountPercent: 20, gstPercent: 12, stock: 40 },
  { id: '8', barcode: '8901008', name: 'Slim Fit Denim Jeans Distressed', category: 'Jeans', size: '34', rate: 1400.00, discountPercent: 20, gstPercent: 12, stock: 35 },
  { id: '9', barcode: '8901009', name: 'Linen Casual Shirt Premium White', category: 'Shirt', size: '40', rate: 950.00, discountPercent: 0, gstPercent: 5, stock: 50 },
  { id: '10', barcode: '8901010', name: 'Linen Casual Shirt Premium White', category: 'Shirt', size: '42', rate: 950.00, discountPercent: 0, gstPercent: 5, stock: 42 },
  { id: '11', barcode: '8901011', name: 'Cotton Printed Short Kurti', category: 'Kurta', size: 'S', rate: 499.00, discountPercent: 10, gstPercent: 5, stock: 95 },
  { id: '12', barcode: '8901012', name: 'Wedding Lehenga Choli Zari Work', category: 'Traditional', size: 'XL', rate: 7500.00, discountPercent: 12, gstPercent: 12, stock: 12 }
];

// Helper Functions
export const DB = {
  // --- Shop Setup Config ---
  getShopSetup(): ShopSetup {
    const data = localStorage.getItem(SETUP_KEY);
    if (!data) {
      // Save default configuration initially
      localStorage.setItem(SETUP_KEY, JSON.stringify(DEFAULT_SHOP_SETUP));
      return DEFAULT_SHOP_SETUP;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_SHOP_SETUP;
    }
  },

  saveShopSetup(setup: ShopSetup): void {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  },

  // --- Invoices Management ---
  getInvoices(): Invoice[] {
    const data = localStorage.getItem(INVOICES_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveInvoice(invoice: Invoice): Invoice[] {
    const invoices = this.getInvoices();
    
    // Check if invoice already exists to perform update
    const index = invoices.findIndex((i) => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
    } else {
      invoices.unshift(invoice); // Newest bills on top
    }
    
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
    return invoices;
  },

  deleteInvoice(id: string): Invoice[] {
    const invoices = this.getInvoices().filter((i) => i.id !== id);
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
    return invoices;
  },

  // --- Customers Directory Accumulator ---
  getCustomersDirectory(): CustomerHistory[] {
    const invoices = this.getInvoices();
    const directoryMap: { [phone: string]: CustomerHistory } = {};

    invoices.forEach((inv) => {
      const phone = inv.customerPhone.trim();
      if (!phone) return;

      const spent = inv.grandTotal;
      if (directoryMap[phone]) {
        directoryMap[phone].totalSpent += spent;
        directoryMap[phone].totalInvoicesCount += 1;
        // Keep name and address updated with the newest invoice details
        if (new Date(inv.date) > new Date(directoryMap[phone].lastVisitDate)) {
          directoryMap[phone].name = inv.customerName;
          if (inv.customerAddress) {
            directoryMap[phone].address = inv.customerAddress;
          }
          directoryMap[phone].lastVisitDate = inv.date;
        }
      } else {
        directoryMap[phone] = {
          phone,
          name: inv.customerName || 'Walk-in Customer',
          address: inv.customerAddress || '',
          totalSpent: spent,
          totalInvoicesCount: 1,
          lastVisitDate: inv.date
        };
      }
    });

    return Object.values(directoryMap).sort((a, b) => b.totalSpent - a.totalSpent);
  },

  // --- Google Sheets Sync Connector details ---
  getSheetsConfig(): GoogleSheetsConfig {
    const defaultSync = {
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1_YourSpreadsheetId/edit',
      scriptUrl: '',
      connected: false
    };
    const data = localStorage.getItem(SHEETS_KEY);
    if (!data) return defaultSync;
    try {
      return JSON.parse(data);
    } catch {
      return defaultSync;
    }
  },

  saveSheetsConfig(config: GoogleSheetsConfig): void {
    localStorage.setItem(SHEETS_KEY, JSON.stringify(config));
  },

  // --- Share Logs Alerts tracker ---
  getShareLogs(): ShareLog[] {
    const data = localStorage.getItem(SHARE_LOGS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  addShareLog(log: Omit<ShareLog, 'id'>): ShareLog[] {
    const logs = this.getShareLogs();
    const newLog: ShareLog = {
      ...log,
      id: Math.random().toString(36).substring(2, 9)
    };
    logs.unshift(newLog);
    localStorage.setItem(SHARE_LOGS_KEY, JSON.stringify(logs.slice(0, 100))); // Cap at 100 entries for efficiency
    return logs;
  }
};

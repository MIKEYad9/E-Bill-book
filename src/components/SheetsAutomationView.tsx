/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Invoice, GoogleSheetsConfig, ShopSetup } from '../types';
import { generateGSTReportCSV, exportGSTReportXLSX, compileSheetsSyncPayload } from '../utils';
import { DB, SecureStorage } from '../db';
import {
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Code,
  Copy,
  Link,
  ChevronRight,
  Database,
  CloudLightning,
  Sparkles,
  Download,
  Terminal,
  Activity,
  RefreshCw,
  Play,
  Square,
  Clock
} from 'lucide-react';

interface SheetsAutomationViewProps {
  invoices: Invoice[];
  shopSetup: ShopSetup;
  onRefreshData: () => void;
}

export default function SheetsAutomationView({ invoices, shopSetup, onRefreshData }: SheetsAutomationViewProps) {
  const [config, setConfig] = useState<GoogleSheetsConfig>(DB.getSheetsConfig());
  const [sheetUrl, setSheetUrl] = useState(config.sheetUrl);
  const [scriptUrl, setScriptUrl] = useState(config.scriptUrl);
  const [copiedCode, setCopiedCode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isBgWorkerActive, setIsBgWorkerActive] = useState<boolean>(true);

  // Core Google Sheets macro Apps Script code
  const googleAppsScriptCode = `/**
 * Google Apps Script Webhook API for E-Bill Book Systems
 * Synchronizes multi-table relational data cleanly across 5 structured database sheets:
 * [USERS, BILLS, BILL ITEMS, ANALYTICS, ACTIVITY LOGS]
 * Handles dynamic spreadsheet auto-initialization, table alignment, and automated analytics summaries.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Attempt to acquire lock for 30s to prevent concurrency collisions & double write anomalies
    lock.waitLock(30000);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      "success": false,
      "error": "Timeout acquiring script lock. Please try again."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Step 1: Ensure all 5 standard database sheets exist with the correct columns immediately
    ensureDatabaseSheets(sheet);
    
    // Step 2: Extract & Process the standard payload structures
    var parsedPayload = preprocessPayload(payload);
    
    // A. Sync User Data
    if (parsedPayload.user) {
      syncUserTable(sheet, parsedPayload.user);
    }
    
    // B. Sync Bill Data
    if (parsedPayload.bill) {
      syncBillTable(sheet, parsedPayload.bill);
    }
    
    // C. Sync Item Level Data
    if (parsedPayload.items && parsedPayload.items.length > 0) {
      syncBillItemsTable(sheet, parsedPayload.items);
    }
    
    // D. Sync Activity Logs
    if (parsedPayload.activity) {
      syncActivityLogsTable(sheet, parsedPayload.activity);
    }
    
    // E. Perform analytics aggregation for the operation datetime
    if (parsedPayload.bill) {
      updateAnalyticsTable(sheet, parsedPayload.bill);
    }
    
    // Return standard success structure
    return ContentService.createTextOutput(JSON.stringify({
      "success": true,
      "message": "Data Saved"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      "success": false,
      "error": "Webhook Processing Error: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Automap legacy/basic invoice formats to the advanced 5-table standardized schema
 */
function preprocessPayload(payload) {
  if (payload.action === 'syncInvoice' && payload.bill) {
    return payload; // Already standardized payload structure
  }
  
  // Fallback: If payload is just a basic Invoice object
  var invoice = payload;
  var email = "guest@example.com";
  var namePart = "Guest";
  
  var user = {
    userId: email,
    fullName: namePart + " User",
    email: email,
    mobile: invoice.customerPhone || "9999999999",
    businessName: "E-Bill Book Store",
    role: "Owner",
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    status: "Active"
  };
  
  var bill = {
    billId: invoice.id || Utilities.getUuid(),
    billNumber: invoice.invoiceNumber || ("INV-" + Date.now()),
    userId: email,
    customerName: invoice.customerName || "Walk-in Customer",
    customerMobile: invoice.customerPhone || "9999999999",
    itemCount: invoice.items ? invoice.items.reduce(function(acc, item) { return acc + (item.quantity || 1); }, 0) : 1,
    subtotal: invoice.subtotal || invoice.grandTotal || 0,
    discount: invoice.totalDiscount || 0,
    tax: invoice.totalGstAmount || 0,
    grandTotal: invoice.grandTotal || 0,
    paymentMode: invoice.paymentMethod || "Cash",
    pdfUrl: "",
    whatsappStatus: "Synced",
    createdAt: invoice.date || new Date().toISOString()
  };
  
  var items = [];
  if (invoice.items) {
    for (var i = 0; i < invoice.items.length; i++) {
      var it = invoice.items[i];
      items.push({
        itemId: it.id || (bill.billId + "-" + i),
        billId: bill.billId,
        productName: it.name + (it.size ? " (" + it.size + ")" : ""),
        quantity: it.quantity || 1,
        unitPrice: it.rate || 0,
        amount: it.total || ((it.rate || 0) * (it.quantity || 1))
      });
    }
  }
  
  var activity = {
    logId: Utilities.getUuid(),
    userId: email,
    action: "Bill Sync Fallback",
    description: "Imported backup bill #" + bill.billNumber + " automatically via sync.",
    device: "API Gateway",
    timestamp: new Date().toISOString()
  };
  
  return {
    user: user,
    bill: bill,
    items: items,
    activity: activity
  };
}

/**
 * Ensures standard relational sheets exist in the spreadsheet with bold headers
 */
function ensureDatabaseSheets(sheet) {
  var schemas = {
    "USERS": ["User ID", "Full Name", "Email", "Mobile", "Business Name", "Role", "Created At", "Last Login", "Status"],
    "BILLS": ["Bill ID", "Bill Number", "User ID", "Customer Name", "Customer Mobile", "Item Count", "Subtotal", "Discount", "Tax", "Grand Total", "Payment Mode", "PDF URL", "WhatsApp Status", "Created At"],
    "BILL ITEMS": ["Item ID", "Bill ID", "Product Name", "Quantity", "Unit Price", "Amount"],
    "ANALYTICS": ["Date", "Total Bills", "Total Revenue", "Total Customers", "New Users", "Average Bill Value"],
    "ACTIVITY LOGS": ["Log ID", "User ID", "Action", "Description", "Device", "Timestamp"]
  };
  
  var keys = Object.keys(schemas);
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var headers = schemas[name];
    var targetSheet = sheet.getSheetByName(name);
    if (!targetSheet) {
      targetSheet = sheet.insertSheet(name);
      targetSheet.appendRow(headers);
      
      // Highlight database header rows
      var range = targetSheet.getRange(1, 1, 1, headers.length);
      range.setFontWeight("bold")
           .setBackground("#0f172a") // Premium Slate 900
           .setFontColor("#f8fafc")  // Slate 50
           .setFontSize(10);
      targetSheet.setFrozenRows(1);
    }
  }
}

/**
 * Handle USERS sheet updates (User ID is Unique constraint)
 */
function syncUserTable(sheet, user) {
  var target = sheet.getSheetByName("USERS");
  var emailCol = 3; // Email Column is Unique key for lookup
  var data = target.getDataRange().getValues();
  var rowIdx = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][emailCol - 1] && data[i][emailCol - 1].toString().trim().toLowerCase() === user.email.toLowerCase()) {
      rowIdx = i + 1;
      break;
    }
  }
  
  var rowValues = [
    user.userId,
    user.fullName,
    user.email,
    user.mobile,
    user.businessName,
    user.role,
    rowIdx === -1 ? user.createdAt : data[rowIdx - 1][6], // preserve original creation
    user.lastLogin,
    user.status
  ];
  
  if (rowIdx > -1) {
    // Update existing user variables preserving initial creation logs
    target.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    // Append completely new user
    target.appendRow(rowValues);
  }
}

/**
 * Sync invoice header values into the BILLS sheet
 */
function syncBillTable(sheet, bill) {
  var target = sheet.getSheetByName("BILLS");
  var billIdCol = 1; // Bill ID column
  var data = target.getDataRange().getValues();
  var rowIdx = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][billIdCol - 1] && data[i][billIdCol - 1].toString().trim() === bill.billId.toString().trim()) {
      rowIdx = i + 1;
      break;
    }
  }
  
  var rowValues = [
    bill.billId,
    bill.billNumber,
    bill.userId,
    bill.customerName,
    bill.customerMobile,
    bill.itemCount,
    bill.subtotal,
    bill.discount,
    bill.tax,
    bill.grandTotal,
    bill.paymentMode,
    bill.pdfUrl || "",
    bill.whatsappStatus || "Synced",
    bill.createdAt
  ];
  
  if (rowIdx > -1) {
    target.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    target.appendRow(rowValues);
  }
}

/**
 * Handle bill line items details in the BILL ITEMS sheet (Clears previous items for the invoice to avoid duplicates)
 */
function syncBillItemsTable(sheet, items) {
  var target = sheet.getSheetByName("BILL ITEMS");
  var data = target.getDataRange().getValues();
  var billId = items[0].billId;
  
  // Scan for past line items belonging to the same Invoice ID and delete them to prevent duplicate leaks
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] && data[i][1].toString().trim() === billId.toString().trim()) {
      target.deleteRow(i + 1);
    }
  }
  
  // Batch append item rows back beautifully
  for (var k = 0; k < items.length; k++) {
    var it = items[k];
    target.appendRow([
      it.itemId,
      it.billId,
      it.productName,
      it.quantity,
      it.unitPrice,
      it.amount
    ]);
  }
}

/**
 * Log activity transactions in the ACTIVITY LOGS sheet
 */
function syncActivityLogsTable(sheet, act) {
  var target = sheet.getSheetByName("ACTIVITY LOGS");
  target.appendRow([
    act.logId,
    act.userId,
    act.action,
    act.description,
    act.device,
    act.timestamp
  ]);
}

/**
 * Refresh and calculate live date-wise statistics inside the ANALYTICS sheet
 */
function updateAnalyticsTable(sheet, bill) {
  var target = sheet.getSheetByName("ANALYTICS");
  var billsSheet = sheet.getSheetByName("BILLS");
  var usersSheet = sheet.getSheetByName("USERS");
  
  var billDateStr = "";
  try {
    billDateStr = new Date(bill.createdAt).toLocaleDateString("en-IN");
  } catch(e) {
    billDateStr = new Date().toLocaleDateString("en-IN");
  }
  
  // Calculate aggregate metrics dynamically from the raw sheets to prevent any drift
  var billsData = billsSheet.getDataRange().getValues();
  var usersData = usersSheet.getDataRange().getValues();
  
  var totalBillsForDay = 0;
  var totalRevenueForDay = 0;
  var uniqueCustomers = {};
  var newUsersCount = 0;
  
  for (var i = 1; i < billsData.length; i++) {
    var createdAtStr = "";
    try {
      createdAtStr = new Date(billsData[i][13]).toLocaleDateString("en-IN");
    } catch(e) {
      continue;
    }
    
    if (createdAtStr === billDateStr) {
      totalBillsForDay += 1;
      totalRevenueForDay += parseFloat(billsData[i][9] || "0"); // grand total is index 9
      var custMobile = billsData[i][4]; // customer phone is index 4
      if (custMobile) {
        uniqueCustomers[custMobile] = true;
      }
    }
  }
  
  // Count users registered today
  for (var u = 1; u < usersData.length; u++) {
    var userCreatedStr = "";
    try {
      userCreatedStr = new Date(usersData[u][6]).toLocaleDateString("en-IN"); // Created At index 6
    } catch(e) {
      continue;
    }
    if (userCreatedStr === billDateStr) {
      newUsersCount += 1;
    }
  }
  
  var totalCustomersCount = Object.keys(uniqueCustomers).length;
  var avgBillValue = totalBillsForDay > 0 ? (totalRevenueForDay / totalBillsForDay) : 0;
  
  // Find date row in ANALYTICS sheet
  var analyticsData = target.getDataRange().getValues();
  var dateRowIdx = -1;
  for (var k = 1; k < analyticsData.length; k++) {
    if (analyticsData[k][0] && analyticsData[k][0].toString() === billDateStr) {
      dateRowIdx = k + 1;
      break;
    }
  }
  
  var analyticsValues = [
    billDateStr,
    totalBillsForDay,
    totalRevenueForDay,
    totalCustomersCount,
    newUsersCount,
    avgBillValue
  ];
  
  if (dateRowIdx > -1) {
    target.getRange(dateRowIdx, 1, 1, analyticsValues.length).setValues([analyticsValues]);
  } else {
    target.appendRow(analyticsValues);
  }
}
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      sheetUrl: sheetUrl.trim(),
      scriptUrl: scriptUrl.trim(),
      connected: !!scriptUrl.trim()
    };
    setConfig(updated);
    DB.saveSheetsConfig(updated);
    setConnectionStatus('success');
    setTimeout(() => setConnectionStatus('idle'), 3000);
  };

  // Periodic Background Sync Worker
  useEffect(() => {
    if (!isBgWorkerActive || !config.scriptUrl) return;

    const intervalId = setInterval(async () => {
      // Find all unsynced invoices
      const unsynced = invoices.filter((inv) => !inv.syncedToSheets);
      if (unsynced.length === 0) return;

      // Select the oldest unsynced to upload first and maintain chronological ordering
      const target = unsynced[unsynced.length - 1];
      
      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] [BG Worker] Auto-synchronizing invoice ${target.invoiceNumber} in background...`,
        ...prev
      ]);

      try {
        const activeUserEmail = SecureStorage.getItem('ai_billing_active_user_v2') || '';
        const payload = compileSheetsSyncPayload(target, shopSetup, activeUserEmail);

        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        target.syncedToSheets = true;
        DB.saveInvoice(target);
        setSyncLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] [BG Worker] Successfully logged ${target.invoiceNumber} to Google Sheet.`,
          ...prev
        ]);
        onRefreshData();
      } catch (err: any) {
        setSyncLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] [BG Worker Error] Auto-sync failed for ${target.invoiceNumber}: ${err.message}`,
          ...prev
        ]);
      }
    }, 15000); // Check and resolve every 15 seconds

    return () => clearInterval(intervalId);
  }, [isBgWorkerActive, config.scriptUrl, invoices, onRefreshData]);

  // Trigger Google Sheet Webhook Sync (for top 5 unsynced bills specifically)
  const handleTriggerSyncNow = async () => {
    if (!config.scriptUrl) {
      alert('Please configure and enter your Google Apps Script Deployment Webhook Trigger URL first.');
      return;
    }

    const unsynced = invoices.filter((inv) => !inv.syncedToSheets).slice(0, 5);
    if (unsynced.length === 0) {
      alert('All invoices are already synchronized with Google Sheets.');
      return;
    }

    setSyncing(true);
    setSyncLogs((prev) => [`[${new Date().toLocaleTimeString()}] Sync initiated for ${unsynced.length} pending entries...`, ...prev]);

    try {
      let successCount = 0;
      
      for (const inv of unsynced) {
        setSyncLogs((prev) => [`[${new Date().toLocaleTimeString()}] Posting bill code ${inv.invoiceNumber} -> Sheets API`, ...prev]);
        
        const activeUserEmail = SecureStorage.getItem('ai_billing_active_user_v2') || '';
        const payload = compileSheetsSyncPayload(inv, shopSetup, activeUserEmail);

        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors', // standard Apps Script trigger redirect
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        successCount++;
        // Update local sync state
        inv.syncedToSheets = true;
        DB.saveInvoice(inv);
        onRefreshData();
      }

      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Sync Successful! Synchronized ${successCount} clothing invoices.`,
        ...prev
      ]);

    } catch (err: any) {
      setSyncLogs((prev) => [`[Error] Synchronization failure: ${err.message}`, ...prev]);
    } finally {
      setSyncing(false);
    }
  };

  // Force Sync ALL outstanding unsynced invoices in chronological order
  const handleSyncAllUnsynced = async () => {
    if (!config.scriptUrl) {
      alert('Please configure and enter your Google Apps Script Deployment Webhook Trigger URL first.');
      return;
    }

    const unsyncedList = invoices.filter((inv) => !inv.syncedToSheets);
    if (unsyncedList.length === 0) {
      alert('Amazing! All invoices in the local ledger are already synchronized with Google Sheets.');
      return;
    }

    setSyncing(true);
    setSyncLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Force Batch Sync started for ${unsyncedList.length} unsynced entries...`,
      ...prev
    ]);

    try {
      let successCount = 0;
      
      // Sync from oldest to newest
      const sortedUnsynced = [...unsyncedList].reverse();

      for (const inv of sortedUnsynced) {
        setSyncLogs((prev) => [`[${new Date().toLocaleTimeString()}] Uploading missing entry ${inv.invoiceNumber} to sheet...`, ...prev]);
        
        const activeUserEmail = SecureStorage.getItem('ai_billing_active_user_v2') || '';
        const payload = compileSheetsSyncPayload(inv, shopSetup, activeUserEmail);

        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        successCount++;
        inv.syncedToSheets = true;
        DB.saveInvoice(inv);
        onRefreshData();
      }

      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Batch Sync Complete! Successfully uploaded ${successCount} invoices to Google Sheets.`,
        ...prev
      ]);
    } catch (err: any) {
      setSyncLogs((prev) => [`[Error] Batch synchronization failed: ${err.message}`, ...prev]);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadOfflineCSV = () => {
    const csvContent = generateGSTReportCSV(invoices);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GSTR1_SALES_REPORT_${new Date().getFullYear()}.csv`);
    link.click();
  };

  const handleDownloadOfflineXLSX = () => {
    try {
      exportGSTReportXLSX(invoices, shopSetup);
      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Generated and exported offline GST Excel Report (.xlsx) successfully.`,
        ...prev
      ]);
    } catch (err: any) {
      setSyncLogs((prev) => [`[Error] Failed to generate Excel report: ${err.message}`, ...prev]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* Setup instructions block: 3/5 cols */}
      <div className="lg:col-span-3 space-y-5 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        
        {/* Title */}
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-slate-850 flex items-center gap-1.5 uppercase tracking-wider">
            <FileSpreadsheet className="w-5 h-5 text-indigo-700 animate-pulse" />
            FREE GOOGLE SHEETS AUTOMATION ENGINE
          </h2>
          <p className="text-xs text-slate-700 mt-1 font-medium">Connect your billing systems with Google Sheets. Maintain live cloud bookkeeping completely free with Apps Script!</p>
        </div>

        {/* 3 Step setup tracker */}
        <div className="space-y-4 text-xs text-slate-800">
          
          <div className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              1
            </span>
            <div className="space-y-1.5">
              <p className="font-bold text-slate-900">Create a New Google Sheet</p>
              <p className="text-slate-705 font-medium leading-relaxed">
                Open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline font-extrabold inline-flex items-center gap-0.5">Google Sheets <Link className="w-3 h-3" /></a> and create an empty spreadsheet. Note its URL so you can paste it on the right side.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              2
            </span>
            <div className="space-y-2 w-full">
              <div className="flex justify-between items-center">
                <p className="font-bold text-slate-900">Copy & Paste Apps Script Macros code</p>
                <button
                  onClick={handleCopyCode}
                  className="bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-900 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold active:scale-95 transition-all text-right cursor-pointer"
                >
                  {copiedCode ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
                  {copiedCode ? 'Copied' : 'Copy Macros'}
                </button>
              </div>
              <p className="text-slate-705 font-medium leading-relaxed">
                In your Google Sheet menu, click on <span className="font-bold text-slate-800 font-mono bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-[10px]">Extensions &gt; Apps Script</span>. Delete any default code, paste the script below, and hit Save.
              </p>

              {/* Collapsible script view */}
              <div className="bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-850 h-32 overflow-y-auto font-mono text-[9px] relative leading-normal">
                <pre>{googleAppsScriptCode}</pre>
                <div className="absolute bottom-2 right-2 bg-slate-900 text-[9px] font-bold text-indigo-400 px-2 py-0.5 rounded">
                  JavaScript JSON Webhook Script
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              3
            </span>
            <div className="space-y-1.5">
              <p className="font-bold text-slate-900">Deploy as a Web App</p>
              <p className="text-slate-705 font-medium leading-relaxed">
                In Apps Script editor, click <span className="font-bold text-slate-800 font-medium">Deploy &gt; New Deployment</span>. Select <span className="font-extrabold text-indigo-700">Web App</span>. Set <span className="underline">"Execute as: Me"</span> and <span className="underline">"Who has access: Anyone"</span>. Click Deploy, copy the "Web app URL" and paste it in "Webhook script URL" on the right.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Form and Controls: 2/5 cols */}
      <div className="lg:col-span-2 space-y-5">
        
        {/* Settings configure */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-50 pb-2.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Code className="w-4 h-4 text-indigo-500" />
              Webhook Connect Parameters
            </h3>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
                        <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-700 block uppercase tracking-wide">GOOGLE SHEET PREVIEW URL</label>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/your-id/edit"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold text-slate-900 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-700 block uppercase tracking-wide">DEPLOYED WEB APP WEBHOOK URL</label>
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/As...Gg/exec"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono text-slate-900 bg-white"
              />
            </div>

            {connectionStatus === 'success' && (
              <div className="bg-emerald-50 text-emerald-800 text-[11px] p-2 rounded-lg border border-emerald-100 font-black flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Parameters saved successfully!
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl border border-slate-900 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CloudLightning className="w-3.5 h-3.5" />
              Save connection Hook
            </button>

          </form>
        </div>

        {/* Sync triggers & Logs */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-50 pb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              Live Sync Actions
            </h3>
            {isBgWorkerActive && config.scriptUrl && (
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md border border-emerald-200 animate-pulse">
                ● BG Worker Active
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            {/* Background Worker Controller */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5 max-w-[70%]">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isBgWorkerActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`}></span>
                  Background Auto-Sync Worker
                </span>
                <p className="text-[9px] text-slate-500 font-medium">Resolves unsynced tickets automatically every 15s</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newState = !isBgWorkerActive;
                  setIsBgWorkerActive(newState);
                  setSyncLogs(prev => [
                    `[${new Date().toLocaleTimeString()}] Background synchronization worker has been ${newState ? 'ACTIVATED' : 'PAUSED'}.`,
                    ...prev
                  ]);
                }}
                className={`text-[9px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer ${
                  isBgWorkerActive 
                    ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 shadow-sm'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm'
                }`}
              >
                {isBgWorkerActive ? 'Pause' : 'Activate'}
              </button>
            </div>

            {/* Unsynced Invoice Counter and Manual trigger */}
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-600" />
                    Unsynced Cloud Queue
                  </span>
                  <p className="text-sm font-black text-slate-800">
                    {invoices.filter(inv => !inv.syncedToSheets).length} Outstanding Invoice{invoices.filter(inv => !inv.syncedToSheets).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="bg-white/90 border border-indigo-200 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  Waiting Sync
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleTriggerSyncNow}
                  disabled={syncing || !config.scriptUrl || invoices.filter(inv => !inv.syncedToSheets).length === 0}
                  className={`text-[10px] font-extrabold py-2 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 border ${
                    config.scriptUrl && invoices.filter(inv => !inv.syncedToSheets).length > 0
                      ? 'bg-white hover:bg-slate-50 text-slate-900 border-slate-350 shadow-sm'
                      : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
                  Sync Recent 5
                </button>
                <button
                  type="button"
                  onClick={handleSyncAllUnsynced}
                  disabled={syncing || !config.scriptUrl || invoices.filter(inv => !inv.syncedToSheets).length === 0}
                  className={`text-[10px] font-black py-2 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow ${
                    config.scriptUrl && invoices.filter(inv => !inv.syncedToSheets).length > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:scale-[1.01]'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <CloudLightning className="w-3 h-3 text-amber-300" />
                  Sync All ({invoices.filter(inv => !inv.syncedToSheets).length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadOfflineCSV}
                className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-250 text-[10px] font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Offline GSTR-1 CSV Ledger
              </button>
              <button
                type="button"
                onClick={handleDownloadOfflineXLSX}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 hover:scale-[1.01]"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Offline GSTR-1 Excel (.xlsx)
              </button>
            </div>

          </div>

          {/* Sync logs output console */}
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-650 block uppercase tracking-wider">CONNECTIVITY MONITOR CONSOLE:</span>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-emerald-400 h-28 overflow-y-auto space-y-1 scrollbar-thin">
              {syncLogs.length === 0 ? (
                <p className="text-slate-400 italic">No sync operations triggered in this session.</p>
              ) : (
                syncLogs.map((log, index) => <p key={index}>{log}</p>)
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

// Inline Spinner
function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  );
}

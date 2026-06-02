/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Invoice, InvoiceItem, ShopSetup } from '../types';
import { calculateInvoiceTotals, buildWhatsAppLink, buildTextReceipt, compileSheetsSyncPayload } from '../utils';
import { exportInvoicePDF } from '../pdfGenerator';
import { DB, SAMPLE_CATALOG, CatalogItem, SecureStorage } from '../db';
import {
  User,
  Phone,
  MapPin,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Percent,
  Calculator,
  Printer,
  Share2,
  FileDown,
  Sparkles,
  Upload,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  FolderOpen,
  Camera,
  Play,
  MessageSquare,
  Copy,
  Smartphone,
  X,
  ExternalLink,
  Send,
  Check,
  ArrowRight
} from 'lucide-react';

interface BillGenerationViewProps {
  shopSetup: ShopSetup;
  initialCustomer?: { name: string; phone: string; address?: string };
  onBillGenerated: () => void;
}

export default function BillGenerationView({ shopSetup, initialCustomer, onBillGenerated }: BillGenerationViewProps) {
  // 1. Customer States
  const [customerName, setCustomerName] = useState(initialCustomer?.name || 'Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(initialCustomer?.address || '');
  
  // Set initial customer states if they change
  useEffect(() => {
    if (initialCustomer) {
      setCustomerName(initialCustomer.name);
      setCustomerPhone(initialCustomer.phone);
      setCustomerAddress(initialCustomer.address || '');
    }
  }, [initialCustomer]);

  // 2. Invoice Meta States
  const [invoiceNumber, setInvoiceNumber] = useState('');
  useEffect(() => {
    // Generate a beautiful randomized invoice number
    const count = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`${shopSetup.invoicePrefix || 'BFS-2026/'}${count}`);
  }, [shopSetup]);

  // 3. Draft Products State
  const [draftItems, setDraftItems] = useState<InvoiceItem[]>([]);
  const [flatDiscountPercent, setFlatDiscountPercent] = useState<number>(0);
  const [flatDiscountAmount, setFlatDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>('Cash');
  const [notes, setNotes] = useState('');

  // 4. Manual Add State form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Manual fast add line state
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('Saree');
  const [manualSize, setManualSize] = useState('Free Size');
  const [manualQty, setManualQty] = useState(1);
  const [manualRate, setManualRate] = useState(0);
  const [manualDisc, setManualDisc] = useState(0);
  const [manualGst, setManualGst] = useState(shopSetup.gstEnabled ? 12 : 0);

  // 5. Barcode Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerFeedback, setScannerFeedback] = useState('');

  // 6. OCR State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrSuccess, setOcrSuccess] = useState(false);

  // 7. Sharing & Deep Linking Hub State
  const [sharingInvoice, setSharingInvoice] = useState<Invoice | null>(null);
  const [sharingPhone, setSharingPhone] = useState('');
  const [sharingFormat, setSharingFormat] = useState<'friendly' | 'thermal'>('friendly');
  const [shareCopied, setShareCopied] = useState(false);
  const [editedShareText, setEditedShareText] = useState('');
  const [whatsappGateway, setWhatsappGateway] = useState<'deeplink' | 'api'>(() => {
    return (SecureStorage.getItem('ai_billing_whatsapp_type_v1') as 'deeplink' | 'api') || 'deeplink';
  });

  // Viewport detect for text editor responsiveness
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto grow textarea height to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to let scrollHeight update accurately
    textarea.style.height = 'auto';
    
    // Calculate required height
    const scrollHeight = textarea.scrollHeight;
    
    // Set heights based on viewport & content
    const isMobile = viewportWidth < 768;
    const minHeight = isMobile ? 220 : 300;
    
    textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
  }, [editedShareText, viewportWidth]);

  // 8. Row Delete Two-Step Confirmation State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (sharingInvoice) {
      const initialText = sharingFormat === 'friendly'
        ? buildFriendlyTextReceipt(sharingInvoice, shopSetup)
        : buildTextReceipt(sharingInvoice, shopSetup);
      setEditedShareText(initialText);
    } else {
      setEditedShareText('');
    }
  }, [sharingInvoice, sharingFormat, shopSetup]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recalculate whole bill dynamically using our math logic
  const totals = calculateInvoiceTotals(
    draftItems,
    flatDiscountPercent,
    flatDiscountAmount,
    shopSetup.gstEnabled
  );

  // Search through pre-loaded catalog items
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = SAMPLE_CATALOG.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
    setSearchResults(filtered);
  }, [searchQuery]);

  // Add Item to Draft POS
  const triggerAddItem = (item: Omit<InvoiceItem, 'id' | 'discountAmount' | 'gstAmount' | 'cgstAmount' | 'sgstAmount' | 'total'>) => {
    const newItem: InvoiceItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      discountAmount: 0,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      total: item.rate * item.quantity,
    };
    setDraftItems((prev) => [...prev, newItem]);
    
    // Play subtle soft scanner confirmation beep visually
    setScannerFeedback(`Added: ${item.name}`);
    setTimeout(() => setScannerFeedback(''), 1500);
  };

  // Add Item directly from manual listing
  const handleManualAddLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      alert('Product name/description is required.');
      return;
    }
    triggerAddItem({
      name: manualName.trim(),
      category: manualCategory,
      size: manualSize,
      quantity: manualQty,
      rate: manualRate,
      discountPercent: manualDisc,
      gstPercent: manualGst,
    });
    // Clear line
    setManualName('');
    setManualRate(0);
    setManualQty(1);
    setManualDisc(0);
  };

  // Add Catalog Item directly with pre-populated specs
  const handleSelectCatalogItem = (cat: CatalogItem) => {
    triggerAddItem({
      name: cat.name,
      category: cat.category,
      size: cat.size,
      quantity: 1,
      rate: cat.rate,
      discountPercent: cat.discountPercent,
      gstPercent: cat.gstPercent,
    });
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // Scan Barcode
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = SAMPLE_CATALOG.find((item) => item.barcode === barcodeInput.trim());
    if (matched) {
      triggerAddItem({
        name: matched.name,
        category: matched.category,
        size: matched.size,
        quantity: 1,
        rate: matched.rate,
        discountPercent: matched.discountPercent,
        gstPercent: matched.gstPercent,
      });
      setBarcodeInput('');
    } else {
      setScannerFeedback(`Unknown code "${barcodeInput}". Enter manually.`);
      setTimeout(() => setScannerFeedback(''), 3000);
    }
  };

  // Preset categories shortcut adder
  const handleAddShortcutItem = (label: string, category: string, size: string, basePrice: number, gstRate: number) => {
    triggerAddItem({
      name: `Premium ${label}`,
      category,
      size,
      quantity: 1,
      rate: basePrice,
      discountPercent: 0,
      gstPercent: gstRate,
    });
  };

  // OCR Upload handler
  const handleOCRFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrFile(file);
    setOcrLoading(true);
    setOcrError('');
    setOcrSuccess(false);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Str = reader.result as string;

        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Str }),
        });

        const body = await res.json();
        if (res.ok && body.success && body.data) {
          const parsed = body.data;
          
          if (parsed.shopName) {
            setNotes((prev) => prev ? `${prev}\nScanned supplier: ${parsed.shopName}` : `Scanned supplier: ${parsed.shopName}`);
          }
          if (parsed.customerName) setCustomerName(parsed.customerName);
          if (parsed.customerPhone) setCustomerPhone(parsed.customerPhone);

          if (parsed.items && Array.isArray(parsed.items)) {
            // Convert and append elements
            const itemsToAppend: InvoiceItem[] = parsed.items.map((it: any) => ({
              id: Math.random().toString(36).substring(2, 9),
              name: it.name || 'Imported Apparel Item',
              category: it.category || 'Apparel',
              size: it.size || 'Free Size',
              quantity: Number(it.quantity) || 1,
              rate: Number(it.rate) || 0,
              discountPercent: Number(it.discountPercent) || 0,
              gstPercent: Number(it.gstPercent) || (shopSetup.gstEnabled ? 12 : 0),
              discountAmount: 0,
              gstAmount: 0,
              cgstAmount: 0,
              sgstAmount: 0,
              total: 0,
            }));
            
            setDraftItems((prev) => [...prev, ...itemsToAppend]);
            setOcrSuccess(true);
          } else {
            setOcrError('Could not locate item table structure inside the bill.');
          }
        } else {
          setOcrError(body.error || 'Server error parsing invoice image.');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setOcrError('Failed to process image OCR.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Update item details in draft
  const handleUpdateItemField = (id: string, field: keyof InvoiceItem, value: any) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Remove Item
  const handleRemoveDraftItem = (id: string) => {
    setDraftItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Trigger Delete Confirmation Flow
  const triggerDeleteConfirmation = (id: string) => {
    if (confirmDeleteId === id) {
      handleRemoveDraftItem(id);
      setConfirmDeleteId(null);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
    } else {
      setConfirmDeleteId(id);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      deleteTimeoutRef.current = setTimeout(() => {
        setConfirmDeleteId(null);
      }, 3000); // 3-second auto-revert window
    }
  };

  // Clear bill entirely
  const handleResetBill = () => {
    setDraftItems([]);
    setFlatDiscountPercent(0);
    setFlatDiscountAmount(0);
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCustomerAddress('');
    setNotes('');
  };

  // Submit & Publish Bill
  const handlePostInvoice = (mode: 'PDF' | 'TXT' | 'WhatsApp') => {
    if (draftItems.length === 0) {
      alert('The bill cannot be generated because there are no clothing items listed.');
      return;
    }

    const compiledInvoice: Invoice = {
      id: Math.random().toString(36).substring(2, 9),
      invoiceNumber,
      date: new Date().toISOString(),
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || '9999999999', // fallback
      customerAddress,
      items: totals.items,
      subtotal: totals.subtotal,
      itemDiscountTotal: totals.itemDiscountTotal,
      flatDiscountPercent,
      flatDiscountAmount: totals.flatDiscountAmount,
      totalDiscount: totals.totalDiscount,
      gstEnabled: shopSetup.gstEnabled,
      totalGstAmount: totals.totalGstAmount,
      totalCgstAmount: totals.totalCgstAmount,
      totalSgstAmount: totals.totalSgstAmount,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paymentMethod,
      notes,
      syncedToSheets: false,
    };

    // Save permanently in localStorage DB
    DB.saveInvoice(compiledInvoice);

    // Dynamic audit feed event trigger
    window.dispatchEvent(new CustomEvent('add-session-log', {
      detail: `📝 [Invoice Compiling] Saved new invoice #${compiledInvoice.invoiceNumber} for ${compiledInvoice.customerName} - Grand Total: ₹${Math.round(compiledInvoice.grandTotal)}`
    }));

    // Real-Time Google Sheets Sync trigger (if configured)
    const sheetsConfig = DB.getSheetsConfig();
    if (sheetsConfig.connected && sheetsConfig.scriptUrl) {
      window.dispatchEvent(new CustomEvent('add-session-log', {
        detail: `🔄 [Sync In-Progress] Transferring transaction log for Invoice #${compiledInvoice.invoiceNumber} to Google Sheet...`
      }));
      const activeUserEmail = SecureStorage.getItem('ai_billing_active_user_v2') || '';
      const payload = compileSheetsSyncPayload(compiledInvoice, shopSetup, activeUserEmail);

      fetch(sheetsConfig.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      .then(() => {
        // Mark as synced to sheets
        compiledInvoice.syncedToSheets = true;
        DB.saveInvoice(compiledInvoice);
        window.dispatchEvent(new CustomEvent('add-session-log', {
          detail: `📊 [Sync Success] Google Sheets real-time append finished for Invoice #${compiledInvoice.invoiceNumber}!`
        }));
      })
      .catch((err) => {
        window.dispatchEvent(new CustomEvent('add-session-log', {
          detail: `⚠️ [Sync Failure] Real-time sheet synchronization stalled: ${err.message}`
        }));
      });
    }

    // Track state inside our dedicated Preview & Sharing Station
    setSharingInvoice(compiledInvoice);
    setSharingPhone(customerPhone.trim());
    setSharingFormat(mode === 'TXT' ? 'thermal' : 'friendly');

    // Execute direct prompt reactions
    if (mode === 'PDF') {
      try {
        exportInvoicePDF(compiledInvoice, shopSetup);
        window.dispatchEvent(new CustomEvent('add-session-log', {
          detail: `📥 [PDF Export] Compiled dynamic high-fidelity invoice PDF file for customer: ${compiledInvoice.customerName}`
        }));
      } catch (err) {
        console.error('PDF generation error', err);
      }
    } else if (mode === 'TXT') {
      try {
        const txt = buildTextReceipt(compiledInvoice, shopSetup);
        const blob = new Blob(['\ufeff' + txt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `RECEIPT_${compiledInvoice.invoiceNumber.replace(/\//g, '_')}.txt`;
        link.click();
        window.dispatchEvent(new CustomEvent('add-session-log', {
          detail: `🖨️ [Print Receipt] Downloaded legacy thermal receipt plain text file for Invoice #${compiledInvoice.invoiceNumber}`
        }));
      } catch (err) {
        console.error('TXT receipt generation error', err);
      }
    } else if (mode === 'WhatsApp') {
      DB.addShareLog({
        invoiceId: compiledInvoice.id,
        invoiceNumber: compiledInvoice.invoiceNumber,
        customerName: compiledInvoice.customerName,
        phone: compiledInvoice.customerPhone,
        timestamp: new Date().toISOString(),
        type: 'WhatsApp',
      });
      window.dispatchEvent(new CustomEvent('add-session-log', {
        detail: `📱 [Share Event] Initialized WhatsApp Sharing hub for invoice #${compiledInvoice.invoiceNumber}`
      }));
    }
  };

  // Ref to hold the latest handlePostInvoice to prevent event listener closure staleness
  const handlePostInvoiceRef = useRef<((mode: 'PDF' | 'TXT' | 'WhatsApp') => void) | null>(null);
  useEffect(() => {
    handlePostInvoiceRef.current = handlePostInvoice;
  }, [handlePostInvoice]);

  // Global Keyboard listener for Ctrl+P / Cmd+P to trigger PDF download
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept Ctrl+P or Cmd+P
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePostInvoiceRef.current?.('PDF');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCopyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch (copyErr) {
        alert('Could not copy automatically. Please select text from the preview box.');
      }
      document.body.removeChild(textArea);
    }
  };

  // Retrieve active sharing preview message values & normalize line-breaks strictly for WhatsApp/SMS compatibility
  const currentPreviewText = editedShareText;
  const normalizedPreviewText = currentPreviewText.replace(/\r\n/g, '\n').trim();

  // Fetch customized WhatsApp redirection settings
  const getWhatsAppPrefs = () => {
    const prefix = SecureStorage.getItem('ai_billing_whatsapp_prefix_v1') || '91';
    const meBase = SecureStorage.getItem('ai_billing_whatsapp_me_base_v1') || 'https://wa.me';
    const apiBase = SecureStorage.getItem('ai_billing_whatsapp_api_base_v1') || 'https://api.whatsapp.com/send';
    return { prefix, meBase, apiBase };
  };

  // 1) Universal Free Direct App Deep Link (wa.me) - recommended for mobile triggering
  const waMeLinkUrl = sharingInvoice ? (() => {
    const prefs = getWhatsAppPrefs();
    let pn = sharingPhone.replace(/\D/g, '') || '9999999999';
    if (pn.length === 10 && prefs.prefix) {
      pn = `${prefs.prefix}${pn}`;
    }
    const cleanBase = prefs.meBase.endsWith('/') ? prefs.meBase.slice(0, -1) : prefs.meBase;
    return `${cleanBase}/${pn}?text=${encodeURIComponent(normalizedPreviewText)}`;
  })() : '#';

  // 2) Standard Official WhatsApp Web Link (api.whatsapp.com)
  const waLinkUrl = sharingInvoice ? (() => {
    const prefs = getWhatsAppPrefs();
    let pn = sharingPhone.replace(/\D/g, '') || '9999999999';
    if (pn.length === 10 && prefs.prefix) {
      pn = `${prefs.prefix}${pn}`;
    }
    const cleanBase = prefs.apiBase;
    const connector = cleanBase.includes('?') ? '&' : '?';
    return `${cleanBase}${connector}phone=${pn}&text=${encodeURIComponent(normalizedPreviewText)}`;
  })() : '#';

  const smsLinkUrl = sharingInvoice ? (() => {
    const pn = sharingPhone.replace(/\D/g, '') || '9999999999';
    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return `sms:${pn}${isIOS ? '&' : '?'}body=${encodeURIComponent(normalizedPreviewText)}`;
  })() : '#';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* LEFT SECTION (POS Entries & Table): 3/5 cols */}
      <div className="lg:col-span-3 space-y-5">
        
        {/* Step 1: Customer info Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-2.5 gap-2 min-w-0">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 min-w-0">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">1. Customer Profile Context</span>
            </h3>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black uppercase self-start sm:self-auto shrink-0">
              BILL CODE: {invoiceNumber}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">CUSTOMER NAME</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onFocus={(e) => {
                  e.target.select();
                  if (customerName === 'Walk-in Customer') {
                    setCustomerName('');
                  }
                }}
                onBlur={() => {
                  if (!customerName.trim()) {
                    setCustomerName('Walk-in Customer');
                  }
                }}
                placeholder="Walk-in Customer"
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">MOBILE PHONE (10-DIGIT)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[10px] text-slate-400 font-bold">+91</span>
                <input
                  type="text"
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  onFocus={(e) => e.target.select()}
                  placeholder="e.g. 98765 43210"
                  className="w-full pl-10 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">CUSTOMER HOME ADDRESS (OPTIONAL)</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Indian colony details, Jaipur..."
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Step 2: OCR / Smart Extraction AI Panel */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 shadow-inner flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                AI SMART INVOICE OCR & BILL PARSER
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                Drop supplier, wholesale, or hand-written bill images. Gemini will auto-extract products, sizes, prices and insert them below.
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto">
            {ocrLoading ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl">
                <Spinner /> Processing Image OCR...
              </div>
            ) : ocrSuccess ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Bill Scanned OK!
              </div>
            ) : (
              <label className="w-full md:w-auto bg-indigo-600 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:shadow transition-all active:scale-95">
                <Upload className="w-3.5 h-3.5" />
                Upload Bill Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleOCRFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
              </label>
            )}
          </div>

          {ocrError && (
            <div className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 md:col-span-2 flex items-center gap-1.5 w-full">
              <AlertCircle className="w-3.5 h-3.5" /> {ocrError}
            </div>
          )}
        </div>

        {/* Step 3: Fast Product Entry Block (Inputs, Barcode, Catalog) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-50 pb-2.5 gap-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-slate-500" />
              2. Clothing Selection POS Input
            </h3>
            
            {/* Visual Scan confirmation notifier */}
            {scannerFeedback && (
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 animate-pulse">
                {scannerFeedback}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* BARCODE SCANNER FORM */}
            <form onSubmit={handleBarcodeSubmit} className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">BARCODE QUICK SCAN</label>
              <div className="relative">
                <Barcode className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Scan clothing tag or type barcode (e.g. 8901001)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold text-slate-800"
                />
              </div>
            </form>

            {/* MANUAL SEARCH AUTOCOMPLETION */}
            <div className="space-y-1 relative">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">CATALOG SEARCH</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Type product name or category (e.g. Saree, Kurta)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={(e) => {
                    setShowSearchResults(true);
                    e.target.select();
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold text-slate-800 text-left bg-white"
                />
              </div>

              {/* Suggestions Popup Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-14 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-50">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectCatalogItem(item)}
                      className="w-full text-left p-2.5 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Size {item.size}  |  Barcode: {item.barcode}</p>
                      </div>
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                        Rs.{item.rate}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick categories triggers */}
          <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-3">
            <span className="text-[9px] font-bold text-slate-400 py-1 uppercase">POS Shortcuts:</span>
            <button
              onClick={() => handleAddShortcutItem('Premium Silk Saree', 'Saree', 'Free Size', 1800, 5)}
              className="bg-slate-100 hover:bg-slate-900 hover:text-white px-2 py-1 rounded text-[10px] text-slate-600 font-bold transition-all active:scale-95"
            >
              + Saree (₹1,800)
            </button>
            <button
              onClick={() => handleAddShortcutItem('Designer Kurta', 'Kurta', 'L', 750, 5)}
              className="bg-slate-100 hover:bg-slate-900 hover:text-white px-2 py-1 rounded text-[10px] text-slate-600 font-bold transition-all active:scale-95"
            >
              + Kurta (₹750)
            </button>
            <button
              onClick={() => handleAddShortcutItem('Womens Jeans Shorts', 'Jeans', '30', 999, 12)}
              className="bg-slate-100 hover:bg-slate-900 hover:text-white px-2 py-1 rounded text-[10px] text-slate-600 font-bold transition-all active:scale-95"
            >
              + Jeans (₹999)
            </button>
            <button
              onClick={() => handleAddShortcutItem('Casual Cotton Shirt', 'Shirt', 'M', 600, 5)}
              className="bg-slate-100 hover:bg-slate-900 hover:text-white px-2 py-1 rounded text-[10px] text-slate-600 font-bold transition-all active:scale-95"
            >
              + Shirt (₹600)
            </button>
          </div>

          {/* MANUAL LINE ADD BLOCK FOR NEW CUSTOM APPAREL */}
          <form onSubmit={handleManualAddLine} className="border-t border-slate-50 pt-4 grid grid-cols-2 md:grid-cols-7 gap-2.5">
            <div className="col-span-2 space-y-0.5">
              <label className="text-[9px] font-bold text-slate-400 block uppercase">Product Spec Title</label>
              <input
                type="text"
                placeholder="e.g. Georgette Dupatta Net"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 font-bold"
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-slate-400 block uppercase">Size</label>
              <input
                type="text"
                list="size-suggestions"
                value={manualSize}
                onChange={(e) => setManualSize(e.target.value)}
                placeholder="Free Size"
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <datalist id="size-suggestions">
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="32">32</option>
                <option value="34">34</option>
                <option value="36">36</option>
                <option value="38">38</option>
                <option value="40">40</option>
                <option value="Free Size">Free</option>
              </datalist>
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-slate-400 block uppercase">Rate Rs.</label>
              <input
                type="number"
                value={manualRate === 0 ? '' : manualRate}
                onChange={(e) => setManualRate(Math.max(0, Number(e.target.value)))}
                onFocus={(e) => e.target.select()}
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 font-bold"
              />
            </div>

            <div className="space-y-0.5 md:col-span-1">
              <label className="text-[9px] font-bold text-slate-400 block uppercase">Qty</label>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setManualQty(Math.max(1, (manualQty || 1) - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:scale-90 text-slate-700 rounded-xl border border-slate-200 transition-all font-black text-sm shrink-0"
                  title="Decrease Quantity"
                  aria-label="Decrease quantity manually"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={manualQty || ''}
                  onChange={(e) => setManualQty(Math.max(1, Number(e.target.value)))}
                  onFocus={(e) => e.target.select()}
                  className="w-full text-center py-2 h-10 text-xs border border-slate-200 rounded-xl text-slate-850 font-black"
                />
                <button
                  type="button"
                  onClick={() => setManualQty((manualQty || 1) + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:scale-90 text-slate-700 rounded-xl border border-slate-200 transition-all font-black text-sm shrink-0"
                  title="Increase Quantity"
                  aria-label="Increase quantity manually"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-slate-400 block uppercase">Disc %</label>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={manualDisc === 0 ? '' : manualDisc}
                onChange={(e) => setManualDisc(Math.min(100, Math.max(0, Number(e.target.value))))}
                onFocus={(e) => e.target.select()}
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 font-bold"
              />
            </div>

            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold py-1.5 flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95 animate-pulse-subtle"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </form>

        </div>

        {/* Dynamic Exchange Policy / Store Rules Block */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-slate-700" />
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Store Return & Exchange Policy Terms
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10.5px] text-slate-600 leading-relaxed font-semibold">
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Exchange allowed within 7 days from the date of purchase.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Original bill/invoice is compulsory for any exchange.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Products must be unused, unwashed, and in original condition with all tags attached.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>No exchange or replacement on discounted, clearance, or promotional sale items.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Innerwear, accessories, and customized products are not eligible for exchange.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Exchange is subject to stock availability.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Customers may exchange for another product of equal or higher value.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>No cash refund will be provided; only exchange or store credit if applicable.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>Any manufacturing defect should be reported within 48 hours of purchase.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5 font-black">•</span>
              <span>The shop owner reserves the right to refuse exchange if conditions aren't met.</span>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN (Sticky aggregates & Actions): 2/5 cols */}
      <div className="lg:col-span-2 space-y-5">
        
        {/* Aggregated sums Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 sticky top-4">
          <div className="border-b border-slate-50 pb-2.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-slate-500" />
              3. Order Aggregations & Discounts
            </h3>
          </div>

          {/* COMPACT ITEM CARD SUMMARY */}
          {draftItems.length > 0 ? (
            <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100 space-y-2 max-h-56 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cart Items ({draftItems.length})</span>
                <button
                  type="button"
                  onClick={handleResetBill}
                  className="text-[9px] text-red-600 hover:underline font-bold"
                >
                  Clear Cart
                </button>
              </div>
              <div className="divide-y divide-slate-100/80">
                {totals.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-700 hover:bg-slate-50/50 rounded-xl px-1.5 transition-colors">
                    <div className="space-y-1 my-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-900 font-extrabold">{item.name}</span>
                        <span className="bg-slate-200/70 text-slate-800 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold leading-none">{item.size}</span>
                      </div>
                      {/* Interactive responsive Touch-Friendly Qty changer in POS Row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center justify-center gap-1 bg-slate-150/70 rounded-lg p-0.5 border border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemField(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-white hover:bg-slate-50 active:scale-90 text-slate-800 rounded-md border border-slate-200/60 transition-all font-black text-xs cursor-pointer shadow-3xs"
                            title="Decrease Quantity"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-7 text-center text-[10.5px] font-black font-mono text-slate-850">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemField(item.id, 'quantity', item.quantity + 1)}
                            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-white hover:bg-slate-50 active:scale-90 text-slate-800 rounded-md border border-slate-200/60 transition-all font-black text-xs cursor-pointer shadow-3xs"
                            title="Increase Quantity"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold font-mono">
                          × Rs.{item.rate}
                        </span>
                        {item.discountPercent > 0 && <span className="text-emerald-600 font-black text-[9px] ml-0.5">-{item.discountPercent}%</span>}
                        {shopSetup.gstEnabled && item.gstPercent > 0 && <span className="text-slate-500 font-bold text-[9px] ml-0.5">GST {item.gstPercent}%</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Individual Discount column with touch-enhanced interactive target area */}
                      <div 
                        className="flex items-center gap-1 bg-white border border-slate-200/95 rounded-xl px-3 py-1.5 h-10 shadow-3xs pos-touch-input-container cursor-text"
                        title="Item level discount percent (tap to edit)"
                      >
                        <span className="text-[8.5px] text-slate-450 font-black uppercase tracking-wider">Disc:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPercent || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value)));
                            handleUpdateItemField(item.id, 'discountPercent', val);
                          }}
                          className="w-8 sm:w-9 text-center text-xs sm:text-sm font-black text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 pos-compact-number font-mono"
                          aria-label={`Discount percent for ${item.name}`}
                        />
                        <span className="text-[9.5px] text-slate-500 font-extrabold">%</span>
                      </div>

                      <div className="text-right min-w-[55px]">
                        <span className="text-slate-900 font-black block text-xs">Rs.{Math.round(item.total)}</span>
                        {item.discountPercent > 0 && (
                          <span className="text-[8px] text-slate-400 line-through font-medium block leading-none">
                            Rs.{item.rate * item.quantity}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftItem(item.id)}
                        className="p-2 bg-slate-50 hover:bg-rose-50 border border-slate-200/50 hover:border-rose-200/40 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center active:scale-95"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-xl p-3.5 border border-dashed border-slate-200 text-center text-slate-400 text-[11px] font-medium">
              No clothing items in Cart. Type or scan above to add items.
            </div>
          )}

          <div className="space-y-3.5 text-xs text-slate-600 font-bold border-b border-slate-50 pb-4">
            
            <div className="flex items-center justify-between">
              <span>Item Sum Base:</span>
              <span className="text-slate-900 text-sm">Rs.{totals.subtotal.toLocaleString('en-IN')}</span>
            </div>

            {/* FLAT INVOICE-WIDE DISCOUNT OPTIONS */}
            <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-100">
              <div className="flex items-center justify-between">
                <span>Flat Shop Discount (Optional):</span>
                <div className="flex gap-1 items-center">
                  {totals.totalDiscount > 0 && totals.subtotal > 0 && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.5 rounded text-[9px] font-black mr-1 animate-pulse">
                      -{Math.round((totals.totalDiscount / totals.subtotal) * 100)}% Overall
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-bold">Total: Rs.{totals.totalDiscount}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                  <input
                    type="number"
                    placeholder="Disc %"
                    value={flatDiscountPercent || ''}
                    onChange={(e) => {
                      setFlatDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))));
                      setFlatDiscountAmount(0); // reset flat sum
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-xs font-bold text-slate-800"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-[10px] text-slate-400 font-bold">Rs</span>
                  <input
                    type="number"
                    placeholder="Disc. Flat"
                    value={flatDiscountAmount || ''}
                    onChange={(e) => {
                      setFlatDiscountAmount(Math.max(0, Number(e.target.value)));
                      setFlatDiscountPercent(0); // reset percent
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* GST SLIDERS (IF ENABLED) */}
            {shopSetup.gstEnabled && (
              <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-100">
                <div className="flex items-center justify-between">
                  <span>Output GST Breakdown:</span>
                  <span className="text-slate-900 font-bold text-xs">Rs.{totals.totalGstAmount}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-150 text-[10px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Central GST (CGST - 50% split value):</span>
                    <span className="font-bold">Rs.{totals.totalCgstAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>State GST (SGST - 50% split value):</span>
                    <span className="font-bold">Rs.{totals.totalSgstAmount}</span>
                  </div>
                </div>
              </div>
            )}

            {totals.roundOff !== 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Calculated Round Off:</span>
                <span>{totals.roundOff > 0 ? '+' : ''}Rs.{totals.roundOff}</span>
              </div>
            )}

          </div>

          {/* GRAND PAYABLE VALUE CHANGER */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">
                NET AMOUNT COLLECTABLE:
              </span>
              <span className="text-2xl font-black text-amber-300">
                {shopSetup.currency}{totals.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl text-white">
              <Calculator className="w-5 h-5 text-amber-300" />
            </div>
          </div>

          {/* Core mode triggers */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">PAYMENT OPTION SELECTOR</span>
            <div className="grid grid-cols-4 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150">
              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all border ${
                  paymentMethod === 'Cash'
                    ? 'bg-slate-900 text-white border-slate-900 shadow'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                CASH
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all border ${
                  paymentMethod === 'UPI'
                    ? 'bg-slate-900 text-white border-slate-900 shadow'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                UPI
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('Card')}
                className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all border ${
                  paymentMethod === 'Card'
                    ? 'bg-slate-900 text-white border-slate-900 shadow'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                CARD
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('Pending')}
                className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all border ${
                  paymentMethod === 'Pending'
                    ? 'bg-red-600 text-white border-red-600 shadow animate-pulse'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                PENDING
              </button>
            </div>
          </div>

          {/* Core Notes Field */}
          <div className="space-y-1 pt-1 border-t border-dashed border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Auxiliary Remarks / Receipt Notes</span>
            <textarea
              placeholder="Add auxiliary remarks on invoice footer, size customization notes, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-slate-900 focus:outline-none focus:bg-white text-slate-800 font-semibold"
            />
          </div>

          {/* ACTIVE DISPATCH TRIGGERS */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            
            <button
              onClick={() => handlePostInvoice('PDF')}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow cursor-pointer active:scale-95"
              title="Shortcut: Ctrl+P"
            >
              <FileDown className="w-4 h-4 text-amber-300" />
              <span>Download Official Tax Invoice (PDF)</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-sans font-medium text-slate-400 bg-white/10 rounded border border-white/20 ml-1">
                Ctrl+P
              </kbd>
            </button>

            <button
              onClick={() => handlePostInvoice('WhatsApp')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share Bill via WhatsApp Notification
            </button>

            <button
              onClick={() => handlePostInvoice('TXT')}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print Thermal Receipt (Download .TXT)
            </button>

          </div>

          {/* Brief instructions section footer */}
          <div className="bg-amber-50 text-amber-800 text-[10px] leading-relaxed p-3 rounded-xl border border-amber-100">
            <span className="font-bold flex items-center gap-1 mb-0.5">
              <HelpCircle className="w-3 h-3 text-amber-600" /> POS Billing Hints:
            </span>
            Once you click any layout action button above, the sales log is recorded, relevant directories sync automatically, and you can generate your next invoice instantly!
          </div>

        </div>
      </div>

      {/* 8. REFINED SHARE PREVIEW & DEEP-LINKING HUB (MODAL OVERLAY) */}
      {sharingInvoice && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 flex flex-col md:flex-row h-[90vh] md:h-[85vh] max-h-[92vh] md:max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            {/* LEFT SIDE: Management Control Desk & Editor Workspace */}
            <div className="flex-1 p-5 sm:p-6 md:p-8 flex flex-col justify-between overflow-y-auto border-b-0 md:border-r border-slate-850">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Recorded Successfully
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                      <Share2 className="w-5 h-5 text-indigo-400" /> Share Preview & Hub
                    </h3>
                    <p className="text-xs text-slate-400">
                      Verify, customize, and share this digital receipt with your customer instantly.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSharingInvoice(null);
                      onBillGenerated();
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                    title="Close and Setup Next Sale"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Info summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">INV. NUMBER</span>
                    <strong className="font-mono text-white text-xs">{sharingInvoice.invoiceNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">CUSTOMER</span>
                    <strong className="text-white text-xs truncate block max-w-[130px]">{sharingInvoice.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">NET PAYABLE</span>
                    <strong className="text-amber-400 text-xs font-black">₹{sharingInvoice.grandTotal.toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">PAYMENT</span>
                    <strong className="text-indigo-400 text-xs">{sharingInvoice.paymentMethod}</strong>
                  </div>
                </div>

                {/* Phone editor input row */}
                <div className="space-y-1 bg-slate-950/50 p-3 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-300 block uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-450" /> Verify / Edit Customer Mobile
                    </label>
                    <span className="text-[9px] text-slate-500">Live link syncs automatically</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-405 font-bold font-sans">+91</span>
                    <input
                      type="text"
                      maxLength={10}
                      value={sharingPhone}
                      onChange={(e) => setSharingPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-11 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-white tracking-widest text-sm"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                {/* Tab layout selector & raw format description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-300 block uppercase tracking-wider">
                      Select Sharing Mode & Format:
                    </label>
                    <span className="text-[9px] text-slate-500">Auto-formatted with official WhatsApp indicators</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-slate-850">
                    <button
                      type="button"
                      onClick={() => setSharingFormat('friendly')}
                      className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        sharingFormat === 'friendly'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> WhatsApp Premium Format
                    </button>
                    <button
                      type="button"
                      onClick={() => setSharingFormat('thermal')}
                      className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        sharingFormat === 'thermal'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-450" /> Raw Thermal TXT Receipt
                    </button>
                  </div>
                </div>

                {/* Interactive Message Content Editor */}
                <div className="bg-slate-950/40 p-4 sm:p-5 rounded-2xl border border-slate-800/80 backdrop-blur-sm space-y-4 w-full max-w-full min-w-0 transition-all duration-300">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-black tracking-wider text-slate-200 uppercase font-sans flex items-center gap-1.5 shrink-0">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      Interactive Text Editor
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(editedShareText)}
                      className={`font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 border shrink-0 ${
                        viewportWidth < 768 
                          ? 'w-full py-3 px-4 min-h-[44px] text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-550 shadow-md' 
                          : 'w-auto px-3 py-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 bg-slate-950/80 border-emerald-500/25 hover:border-emerald-500/50'
                      }`}
                      id="quick-copy-text"
                    >
                      {shareCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy to Clipboard</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="relative w-full max-w-full min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={editedShareText}
                      onChange={(e) => setEditedShareText(e.target.value)}
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        maxHeight: viewportWidth < 768 ? '360px' : '450px',
                      }}
                      className={`w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-4 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all text-slate-100 placeholder-slate-500 leading-relaxed resize-none scrollbar-thin overflow-y-auto ${
                        viewportWidth < 768 
                          ? 'text-[14px]' 
                          : viewportWidth >= 768 && viewportWidth < 1024 
                            ? 'text-sm' 
                            : 'text-xs font-mono'
                      }`}
                      placeholder="Formatting beautiful lines..."
                    />
                  </div>
                </div>

                {/* Copy & Deep Linking Operations Hub */}
                <div className="space-y-4 pt-3 border-t border-slate-850">
                  
                  {/* Gateway Selector Segment */}
                  <div className="space-y-1.5 bg-slate-950/45 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                        Default WhatsApp Sharing Gateway
                      </span>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-400/20 px-2 py-0.5 rounded font-black uppercase">
                        Active Selection
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappGateway('deeplink');
                          SecureStorage.setItem('ai_billing_whatsapp_type_v1', 'deeplink');
                          window.dispatchEvent(new CustomEvent('add-session-log', { detail: '📱 Changed WhatsApp gateway to Mobile App Deep-Link (wa.me)' }));
                        }}
                        className={`py-1.5 px-2 text-[10px] font-extrabold rounded-lg transition-all border text-center cursor-pointer ${
                          whatsappGateway === 'deeplink'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850'
                        }`}
                      >
                        App Deep-Link (wa.me)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappGateway('api');
                          SecureStorage.setItem('ai_billing_whatsapp_type_v1', 'api');
                          window.dispatchEvent(new CustomEvent('add-session-log', { detail: '💻 Changed WhatsApp gateway to Computer Web API (api.whatsapp)' }));
                        }}
                        className={`py-1.5 px-2 text-[10px] font-extrabold rounded-lg transition-all border text-center cursor-pointer ${
                          whatsappGateway === 'api'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850'
                        }`}
                      >
                        Web API (api.whatsapp)
                      </button>
                    </div>
                  </div>

                  {/* Primary Direct Share trigger */}
                  <a
                    href={whatsappGateway === 'api' ? waLinkUrl : waMeLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      DB.addShareLog({
                        invoiceId: sharingInvoice.id,
                        invoiceNumber: sharingInvoice.invoiceNumber,
                        customerName: sharingInvoice.customerName,
                        phone: sharingPhone || '9999999999',
                        timestamp: new Date().toISOString(),
                        type: 'WhatsApp'
                      });
                      window.dispatchEvent(new CustomEvent('add-session-log', {
                        detail: `⚡ Triggered direct WhatsApp transmission for Invoice #${sharingInvoice.invoiceNumber} -> customer phone +${getWhatsAppPrefs().prefix} ${sharingPhone}`
                      }));
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm text-center"
                    id="whatsapp-primary-share-btn"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <Share2 className="w-4 h-4 text-emerald-100" />
                      <span>LAUNCH DIRECT WHATSAPP CHAT</span>
                      <ExternalLink className="w-3 h-3 text-emerald-200" />
                    </div>
                    <span className="text-[9px] text-emerald-200 font-semibold p-1 px-2 rounded bg-emerald-950/45 mt-0.5 uppercase tracking-wider">
                      Active Gateway: {whatsappGateway === 'api'
                        ? `${getWhatsAppPrefs().apiBase.replace('https://', '')}`
                        : `${getWhatsAppPrefs().meBase.replace('https://', '')}/${getWhatsAppPrefs().prefix}...`}
                    </span>
                  </a>

                  {/* Secondary fallbacks */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(currentPreviewText)}
                      className={`py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                        shareCopied
                          ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/35 font-semibold'
                          : 'bg-slate-800 hover:bg-slate-750 text-indigo-300 hover:text-indigo-200 border-slate-705'
                      }`}
                      id="modal-copy-clipboard-btn"
                    >
                      {shareCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Copy Receipt Code</span>
                        </>
                      )}
                    </button>

                    <a
                      href={smsLinkUrl}
                      onClick={() => {
                        DB.addShareLog({
                          invoiceId: sharingInvoice ? sharingInvoice.id : 'unknown',
                          invoiceNumber: sharingInvoice ? sharingInvoice.invoiceNumber : 'unknown',
                          customerName: sharingInvoice ? sharingInvoice.customerName : 'Walk-in',
                          phone: sharingPhone || '9999999999',
                          timestamp: new Date().toISOString(),
                          type: 'SMS'
                        });
                        window.dispatchEvent(new CustomEvent('add-session-log', {
                          detail: `✉️ Launched mobile native SMS client for +91 ${sharingPhone}`
                        }));
                      }}
                      className="bg-slate-800/65 hover:bg-slate-800 text-slate-300 border border-slate-750 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 text-center"
                      id="sms-fallback-link"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-455" />
                      <span>Send Cell SMS</span>
                    </a>
                  </div>

                </div>

              </div>

              {/* Action and Download Bar footprint */}
              <div className="mt-5 border-t border-slate-850 pt-4 flex flex-wrap gap-2 justify-between items-center text-xs">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (sharingInvoice) {
                        window.dispatchEvent(
                          new CustomEvent('trigger-thermal-print', { detail: sharingInvoice })
                        );
                        window.dispatchEvent(
                          new CustomEvent('add-session-log', {
                            detail: `🖨️ [Thermal POS Printer] Dispatched high-performance print job for Invoice #${sharingInvoice.invoiceNumber}`
                          })
                        );
                      }
                    }}
                    className="text-[10px] font-black text-amber-400 hover:text-amber-300 bg-amber-950/50 hover:bg-amber-900 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" /> Thermal print (80mm)
                  </button>
                  <button
                    onClick={() => exportInvoicePDF(sharingInvoice, shopSetup)}
                    className="text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5 text-amber-300" /> Invoice PDF
                  </button>
                  <button
                    onClick={() => {
                      const txtStr = buildTextReceipt(sharingInvoice, shopSetup);
                      const blob = new Blob(['\ufeff' + txtStr], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `RECEIPT_${sharingInvoice.invoiceNumber.replace(/\//g, '_')}.txt`;
                      link.click();
                    }}
                    className="text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" /> Print .TXT File
                  </button>
                  <button
                    onClick={() => {
                      const txtStr = buildTextReceipt(sharingInvoice, shopSetup);
                      handleCopyToClipboard(txtStr);
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-400" /> Copy Raw TXT Receipt
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSharingInvoice(null);
                    onBillGenerated();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
                >
                  Start Next Sale <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* RIGHT SIDE: Smartphone Realistic UI Live Simulator preview - Hidden on mobile screens to prioritize full height editor workspace layout */}
            <div className="hidden md:flex md:w-[360px] bg-slate-950 p-4 sm:p-6 flex-col items-center justify-center border-t md:border-t-0 border-slate-850 shrink-0">
              <div className="w-full max-w-[280px] sm:max-w-[300px] aspect-[9/18] bg-slate-950 border-[5px] border-slate-800 rounded-[2.5rem] p-2.5 flex flex-col relative shadow-2xl overflow-hidden font-sans select-none">
                {/* Phone Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-3.5 bg-slate-800 rounded-b-xl z-20"></div>

                {/* Top Status Bar Mock */}
                <div className="flex justify-between items-center text-[8px] text-slate-400 font-semibold px-2 pt-1 pb-1.5 border-b border-white/5 bg-slate-950">
                  <span>12:45 PM UTC</span>
                  <div className="flex items-center gap-0.5 text-[7px]">
                    <span>LTE</span>
                    <span>🔋 100%</span>
                  </div>
                </div>

                {/* Chat Container window */}
                <div className="flex-1 overflow-y-auto p-2 bg-slate-900 border-b border-slate-850 flex flex-col space-y-2 scrollbar-thin scrollbar-thumb-slate-800 relative">
                  <div className="flex items-center justify-between text-[7px] text-slate-500 py-0.5 px-1 bg-slate-950/30 rounded tracking-wider uppercase font-extrabold">
                    <div className="flex items-center gap-0.5">
                      <Smartphone className="w-2.5 h-2.5 text-indigo-400" />
                      <span>Live Chat Message Preview</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(currentPreviewText)}
                      className="text-[7px] text-indigo-400 hover:text-indigo-300 font-extrabold px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-900 active:scale-95 transition-all flex items-center gap-0.5"
                      title="Copy message body"
                    >
                      {shareCopied ? (
                        <>
                          <Check className="w-2 h-2 text-emerald-405" />
                          <span className="text-emerald-450">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2 h-2" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Text Messaging Bubble layout */}
                  <div className={`p-2.5 rounded-2xl max-w-[95%] text-[9px] shadow-sm leading-relaxed whitespace-pre-wrap select-all font-sans relative group ${
                    sharingFormat === 'friendly'
                      ? 'bg-emerald-800 border border-emerald-700/40 text-emerald-100 self-end rounded-tr-none'
                      : 'bg-slate-800 border border-slate-700/60 text-slate-100 self-start rounded-tl-none font-mono text-[8px]'
                  }`}>
                    {currentPreviewText}
                  </div>
                </div>

                <div className="py-2.5 text-center text-slate-550 text-[8px] font-bold flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  <span>WhatsApp Live Simulation</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Generates an elegant, friendly text format for SMS / Text message sharing
 */
function buildFriendlyTextReceipt(invoice: Invoice, shop: ShopSetup): string {
  const curSymbol = shop.currency || '₹';
  const shopName = shop.shopName || 'Fashion Store';
  
  // Format items list with beautiful bullet points and discount percentages
  const itemsList = invoice.items
    .map((item) => {
      let line = `👗 *${item.name}* [${item.size}]\n   Qty: ${item.quantity} × ${curSymbol}${item.rate.toLocaleString('en-IN')}`;
      if (item.discountPercent > 0) {
        const itemDiscAmt = Math.round(((item.rate * item.quantity * item.discountPercent) / 100 + Number.EPSILON) * 100) / 100;
        line += `\n   Discount Offered: -${item.discountPercent}% (-${curSymbol}${itemDiscAmt.toLocaleString('en-IN')})`;
      }
      return line;
    })
    .join('\n\n');

  const overallPct = invoice.subtotal > 0 ? Math.round((invoice.totalDiscount / invoice.subtotal) * 100) : 0;

  return `🌸 *INVOICE FROM ${shopName.toUpperCase()}* 🌸

Dear *${invoice.customerName || 'Customer'}*, thank you for shopping with us! Here is your digital receipt summary:

━━━━━━━━━━━━━━━━━━━━
🧾 *Bill No*: ${invoice.invoiceNumber}
📅 *Date*: ${new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
💳 *Payment Mode*: ${invoice.paymentMethod}
━━━━━━━━━━━━━━━━━━━━

🛍️ *YOUR PURCHASE DETAILS:*

${itemsList}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal*: ${curSymbol}${invoice.subtotal.toLocaleString('en-IN')}
🏷️ *Discount Offered*: -${curSymbol}${invoice.totalDiscount.toLocaleString('en-IN')}${overallPct > 0 ? ` (${overallPct}% overall)` : ''}
${invoice.gstEnabled ? `📈 *GST (CGST+SGST)*: ${curSymbol}${invoice.totalGstAmount.toLocaleString('en-IN')}\n` : ''}💰 *NET PAYABLE*: *${curSymbol}${invoice.grandTotal.toLocaleString('en-IN')}*
━━━━━━━━━━━━━━━━━━━━

📍 *Store Outlet*: ${shop.shopAddress || 'Main Store'}
📞 *Helpline Support*: ${shop.phone}

*Return & Exchange Policy:*
• Exchange allowed within 7 days from the date of purchase.
• Original invoice copy is compulsory for exchange.
• Products must be unused, unwashed, with tags in original condition.
• No swap/exchange on discounted, clearance, or promotional sale items.
• Innerwear, accessories, and customized items are non-eligible.
• Exchange is subject to stock availability.
• Customers may exchange for another product of equal or higher value.
• No cash refund will be provided; only exchange/store credit.
• Any manufacturing defects must be reported within 48 hours.
• Right to refuse exchange is reserved if product conditions aren't met.

We hope to see you again soon! Have an amazing day! ✨❤️`;
}

// Spinner Helper
function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
  );
}

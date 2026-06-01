/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Invoice, ShopSetup, ShareLog } from '../types';
import { formatCurrency } from '../utils';
import { exportInvoicePDF, exportBulkInvoicesPDF } from '../pdfGenerator';
import { DB, SecureStorage } from '../db';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Percent,
  TrendingDown,
  Users,
  Search,
  IndianRupee,
  CalendarDays,
  FileSpreadsheet,
  AlertCircle,
  Share2,
  Printer,
  FileDown,
  Sparkles,
  User,
  Clock,
  ArrowRight,
  ChevronRight,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  X,
  MessageSquareCode,
  History,
  Trash2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

interface DashboardViewProps {
  invoices: Invoice[];
  shopSetup: ShopSetup;
  onNavigateToPOS: (customerInfo?: { name: string; phone: string; address?: string }) => void;
  onRefreshData: () => void;
}

export default function DashboardView({ invoices, shopSetup, onNavigateToPOS, onRefreshData }: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'shares'>('overview');

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [activeTab]);

  const selectedInvoiceSum = invoices
    .filter((inv) => selectedInvoiceIds.includes(inv.id))
    .reduce((sum, current) => sum + current.grandTotal, 0);

  const handleBulkDownload = () => {
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(inv.id));
    if (selectedInvoices.length === 0) return;
    exportBulkInvoicesPDF(selectedInvoices, shopSetup);
  };

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const searchQueryRef = React.useRef(searchQuery);

  useEffect(() => {
    const saved = SecureStorage.getItem('ai_billing_recent_searches_v1');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // Safe fallback
      }
    }
  }, []);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowHistoryDropdown(false);
        if (searchQueryRef.current.trim().length >= 2) {
          saveSearchQuery(searchQueryRef.current);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const saveSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      SecureStorage.setItem('ai_billing_recent_searches_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const removeSearchQuery = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      SecureStorage.setItem('ai_billing_recent_searches_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    SecureStorage.removeItem('ai_billing_recent_searches_v1');
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !query.trim()) return <span className="truncate font-sans">{text}</span>;
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return (
      <span className="truncate font-sans">
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-amber-100 text-slate-950 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Date filter helper states for searching by specific weeks or months
  const [dateRangeType, setDateRangeType] = useState<'all' | 'week' | 'month' | 'lastMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const currencySymbol = shopSetup.currency || '₹';

  // State calculations
  const today = new Date().toDateString();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // 1. Core KPIs
  const todayInvoices = invoices.filter((inv) => new Date(inv.date).toDateString() === today);
  const monthInvoices = invoices.filter((inv) => {
    const d = new Date(inv.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const todaySales = todayInvoices.reduce((acc, curr) => acc + curr.grandTotal, 0);
  const monthlySales = monthInvoices.reduce((acc, curr) => acc + curr.grandTotal, 0);
  
  const totalGstCollected = invoices.reduce((acc, curr) => acc + (curr.gstEnabled ? curr.totalGstAmount : 0), 0);
  const pendingPaymentsNum = invoices.filter((inv) => inv.paymentMethod === 'Pending').reduce((acc, curr) => acc + curr.grandTotal, 0);

  const customerHistory = DB.getCustomersDirectory();
  const customerCount = customerHistory.length;

  const shareLogs = DB.getShareLogs();

  // 2. Prepare past 7 days Recharts trend data
  const getDailySalesData = () => {
    const dataList = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const formattedDayShort = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      
      const salesOnDay = invoices
        .filter((inv) => new Date(inv.date).toDateString() === dayStr)
        .reduce((sum, current) => sum + current.grandTotal, 0);

      dataList.push({
        name: formattedDayShort,
        sales: salesOnDay,
      });
    }
    return dataList;
  };

  const chartData = getDailySalesData();

  // 3. AI Assistant response logic
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    setAiResponse('');

    try {
      // Gather context of inventory levels and sales sums
      const contextSummary = {
        shopName: shopSetup.shopName,
        totalInvoices: invoices.length,
        todaySales,
        monthlySales,
        popularClothingCategories: ['Saree', 'Kurti', 'Suit', 'Jeans', 'Shirt'],
        totalCustomersRecorded: customerCount,
        recentDraftSales: invoices.slice(0, 3).map(inv => ({ 
          id: inv.invoiceNumber, 
          cust: inv.customerName, 
          total: inv.grandTotal,
          items: inv.items.map(it => `${it.name}(${it.size})`)
        }))
      };

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, context: contextSummary }),
      });

      const body = await res.json();
      if (res.ok) {
        setAiResponse(body.response || 'Please provide details about your shop items.');
      } else {
        setAiResponse(`Failed to fetch advice: ${body.error}`);
      }
    } catch (err: any) {
      setAiResponse('Make sure GEMINI_API_KEY is active in your secrets menu.');
    } finally {
      setAiLoading(false);
    }
  };

  // 4. Quick suggestions for AI
  const handleQuickQuestion = (q: string) => {
    setAiPrompt(q);
  };

  // 5. Build dynamic search and date-range filters
  const filteredInvoices = invoices.filter((inv) => {
    // A. Text Search query (supports invoice number, customer name, phone, payment method, item names, and item sizes)
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.customerPhone.includes(q) ||
      inv.paymentMethod.toLowerCase().includes(q) ||
      (inv.items && inv.items.some((item) => 
        item.name.toLowerCase().includes(q) || 
        item.size.toLowerCase().includes(q)
      ))
    );

    if (!matchesSearch) return false;

    // B. Date Range Boundaries
    if (dateRangeType === 'all') return true;

    const invDate = new Date(inv.date);
    invDate.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (dateRangeType === 'week') {
      // Past 7 Days
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      return invDate >= weekAgo && invDate <= now;
    }

    if (dateRangeType === 'month') {
      // Current Calendar Month
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return invDate >= firstDay && invDate <= lastDay;
    }

    if (dateRangeType === 'lastMonth') {
      // Last Calendar Month
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return invDate >= firstDay && invDate <= lastDay;
    }

    if (dateRangeType === 'custom') {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (invDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (invDate > end) return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: CORE STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:translate-y-[-2px] transition-all flex items-start justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 block tracking-wide uppercase">Today Sales</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(todaySales, currencySymbol)}</span>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
              <TrendingUp className="w-3 h-3" />
              {todayInvoices.length} Bills issued
            </div>
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-2xl">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:translate-y-[-2px] transition-all flex items-start justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 block tracking-wide uppercase">Monthly Sales</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(monthlySales, currencySymbol)}</span>
            <div className="text-[11px] text-slate-500 font-medium">
              Month focus: <span className="font-bold underline">{new Date().toLocaleString('en-IN', { month: 'long' })}</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* Output GST Collected */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:translate-y-[-2px] transition-all flex items-start justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 block tracking-wide uppercase">GST Collected (Total)</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(totalGstCollected, currencySymbol)}</span>
            <p className="text-[11px] text-slate-400 font-medium">Includes CGST/SGST ledger split</p>
          </div>
          <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Payments ledger */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:translate-y-[-2px] transition-all flex items-start justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 block tracking-wide uppercase">Pending Payments</span>
            <span className="text-2xl font-black text-red-600 tracking-tight">{formatCurrency(pendingPaymentsNum, currencySymbol)}</span>
            <p className="text-[11px] text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded-full w-fit">Requires ledger follow-up</p>
          </div>
          <div className="p-3 bg-red-50 text-red-700 rounded-2xl">
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* SECTION 2: CHARTS & AI INSIGHTS BLOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Weekly Chart: 3/5 cols */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Weekly Billings Curve</h3>
              <p className="text-xs text-slate-500">Live graphical data aggregated over the past 7 days</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-slate-200">
              <Clock className="w-3 h-3" />
              Realtime Sync
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `₹${val}`} tickLine={false} axisLine={false} width={45} />
                <Tooltip
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Day Sales']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Retail Business Mentor: 2/5 cols */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 animate-bounce" />
              AI BOUTIQUE BUSINESS MENTOR
            </h3>
            <p className="text-xs text-slate-300">Ask Gemini for clothing suggestions, size metrics, and regional wedding-season strategies.</p>
          </div>

          {/* Response Box */}
          <div className="my-4 bg-white/5 border border-white/10 rounded-xl p-3.5 h-36 overflow-y-auto text-xs text-slate-200 scrollbar-thin">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-2">
                <Spinner />
                <p className="text-[10px] text-amber-300 animate-pulse font-medium">Gemini is analyzing boutique records...</p>
              </div>
            ) : aiResponse ? (
              <div className="space-y-1">
                <span className="font-bold text-[10px] text-amber-400 tracking-wider">RECOMMENDATION:</span>
                <p className="leading-relaxed font-sans">{aiResponse}</p>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-center items-center text-slate-400 space-y-1 text-center">
                <p className="font-bold text-[11px] text-slate-300">Enter a prompt or click below:</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  <button
                    onClick={() => handleQuickQuestion('How can I raise saree discount conversions?')}
                    className="bg-white/10 hover:bg-white/20 text-[10px] text-white px-2.5 py-1 rounded-full transition-all"
                  >
                    🚀 Saree conversion ideas
                  </button>
                  <button
                    onClick={() => handleQuickQuestion('Which size of Suits sells best in Jaipur?')}
                    className="bg-white/10 hover:bg-white/20 text-[10px] text-white px-2.5 py-1 rounded-full transition-all"
                  >
                    👗 Sizing trends
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form input */}
          <form onSubmit={handleAskAI} className="relative mt-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask mentor 'How to handle discount CGST/SGST?'"
              className="w-full bg-white/10 text-white placeholder-slate-400 text-xs rounded-xl pl-3 pr-10 py-2.5 border border-white/10 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:bg-white/15 transition-all"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="absolute right-1.5 top-1.5 p-1 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-lg transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </form>
        </div>
      </div>

      {/* SECTION 3: RECENT TRANSACTION LISTS */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Navigation tabs for Tables */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex gap-2.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Recent Invoices ({filteredInvoices.length})
            </button>
            
            <button
              onClick={() => setActiveTab('customers')}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${
                activeTab === 'customers'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Boutique Buyers ({customerCount})
            </button>
            
            <button
              onClick={() => setActiveTab('shares')}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${
                activeTab === 'shares'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              WhatsApp Shares Log
            </button>
          </div>

          {activeTab === 'overview' && (
            <div ref={searchContainerRef} className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search code, customer, item, size..."
                value={searchQuery}
                onFocus={() => setShowHistoryDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveSearchQuery(searchQuery);
                    setShowHistoryDropdown(false);
                  }
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowHistoryDropdown(true);
                }}
                className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all text-slate-800 bg-white"
              />
              {searchQuery ? (
                <button 
                  onClick={() => {
                    setSearchQuery('');
                  }} 
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                recentSearches.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                )
              )}

              {showHistoryDropdown && (
                <div 
                  className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden font-sans"
                  id="search-history-dropdown"
                >
                  {recentSearches.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-[10px] leading-normal select-none">
                      <Clock className="w-4 h-4 mx-auto mb-1 text-slate-300" />
                      No recent searches. Press <span className="font-mono bg-slate-100 px-1 rounded font-bold">Enter</span> on any search query to save it to history.
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/50 border-b border-slate-100 select-none">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <History className="w-3 h-3 text-slate-500" />
                          Recent Searches
                        </span>
                        <button
                          type="button"
                          onClick={clearAllSearches}
                          className="text-[9px] font-bold text-slate-500 hover:text-red-600 transition-colors font-sans"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                        {recentSearches.map((term, index) => (
                          <div
                            key={`${term}-${index}`}
                            onClick={() => {
                              setSearchQuery(term);
                              saveSearchQuery(term);
                              setShowHistoryDropdown(false);
                            }}
                            className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700 transition-colors group"
                          >
                            <span className="truncate flex items-center gap-2">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              {highlightText(term, searchQuery)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => removeSearchQuery(index, e)}
                              className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-all opacity-0 group-hover:opacity-100 hover:bg-slate-100"
                              title="Delete entry"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Premium Date Range Picker Filter Panel */}
        {activeTab === 'overview' && (
          <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Quick selectors */}
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 flex items-center gap-1 select-none">
                <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                Date Range Filter:
              </span>
              <button
                type="button"
                onClick={() => setDateRangeType('all')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  dateRangeType === 'all'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                All Bills
              </button>
              <button
                type="button"
                onClick={() => setDateRangeType('week')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  dateRangeType === 'week'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setDateRangeType('month')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  dateRangeType === 'month'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateRangeType('lastMonth')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  dateRangeType === 'lastMonth'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => setDateRangeType('custom')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  dateRangeType === 'custom'
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Custom Period...
              </button>
            </div>

            {/* Custom inputs */}
            {dateRangeType === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase select-none">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2.5 py-1 text-[11px] border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase select-none">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2.5 py-1 text-[11px] border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded bg-white border border-slate-200 transition-colors"
                    title="Clear filter range"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Display Panels */}
        <div className="p-4 overflow-x-auto min-h-64">
          
          {/* TAB 1: INVOICES LIST */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* BULK SELECTION ACTION CONTROL BOARD */}
              <AnimatePresence>
                {selectedInvoiceIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-900 border border-slate-850 text-white rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-800 p-2.5 text-amber-400 rounded-xl">
                          <Printer className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                            Bulk Ledger PDF Print Engine
                          </h4>
                          <p className="text-xs text-slate-300">
                            Selected <strong className="text-white font-bold">{selectedInvoiceIds.length}</strong> invoice{selectedInvoiceIds.length > 1 ? 's' : ''} • Combined Invoice Total: <strong className="text-emerald-400 font-extrabold">{formatCurrency(selectedInvoiceSum, currencySymbol)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceIds([])}
                          className="text-xs text-slate-300 hover:text-white px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 font-bold transition-all active:scale-95 cursor-pointer"
                        >
                          Cancel Selection
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkDownload}
                          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-white" />
                          Download Concatenated PDF ({selectedInvoiceIds.length})
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Database className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-medium">No matching bills/invoices found.</p>
                  <button
                    onClick={() => onNavigateToPOS()}
                    className="mt-2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 active:scale-95 transition-all"
                  >
                    Quick Add Invoice <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-bold text-xs uppercase bg-slate-50/50">
                      <th className="p-3 w-10 text-center select-none">
                        <input
                          type="checkbox"
                          checked={filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedInvoiceIds.includes(inv.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newIds = Array.from(new Set([...selectedInvoiceIds, ...filteredInvoices.map(inv => inv.id)]));
                              setSelectedInvoiceIds(newIds);
                            } else {
                              const filteredIds = filteredInvoices.map(inv => inv.id);
                              setSelectedInvoiceIds(selectedInvoiceIds.filter(id => !filteredIds.includes(id)));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-slate-900 cursor-pointer accent-indigo-600"
                        />
                      </th>
                      <th className="p-3">Invoice Code</th>
                      <th className="p-3">Purchase Date</th>
                      <th className="p-3">Customer Profile</th>
                      <th className="p-3">Payment Method</th>
                      <th className="p-3 text-right">Items Count</th>
                      <th className="p-3 text-right">Invoice Sum</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                    {filteredInvoices.map((inv) => (
                      <tr 
                        key={inv.id} 
                        className={`hover:bg-slate-50/70 transition-colors ${selectedInvoiceIds.includes(inv.id) ? 'bg-indigo-50/20' : ''}`}
                      >
                        <td className="p-3 w-10 text-center select-none">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(inv.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvoiceIds([...selectedInvoiceIds, inv.id]);
                              } else {
                                setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-slate-900 cursor-pointer accent-indigo-600"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-indigo-600">{inv.invoiceNumber}</td>
                        <td className="p-3 text-slate-500">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px]">
                              {inv.customerName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-slate-800 font-bold">{inv.customerName || 'Walk-in'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              inv.paymentMethod === 'UPI'
                                ? 'bg-indigo-50 text-indigo-700'
                                : inv.paymentMethod === 'Cash'
                                ? 'bg-amber-50 text-amber-700'
                                : inv.paymentMethod === 'Card'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700 font-black animate-pulse'
                            }`}
                          >
                            {inv.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-700 font-bold">{inv.items.length} apparel(s)</td>
                        <td className="p-3 text-right text-slate-900 font-bold text-sm">
                          {formatCurrency(inv.grandTotal, currencySymbol)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Thermal POS print trigger */}
                            <button
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent('trigger-thermal-print', { detail: inv })
                                );
                                window.dispatchEvent(
                                  new CustomEvent('add-session-log', {
                                    detail: `🖨️ [Dashboard Panel] Dispatched direct thermal reprint for Invoice #${inv.invoiceNumber}`
                                  })
                                );
                              }}
                              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                              title="Thermal POS Print"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                // Dynamic triggers
                                const url = DB.getShopSetup();
                                const alertLink = DB.saveInvoice(inv);
                                exportInvoicePDF(inv, url);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-all"
                              title="Download Tax PDF Invoice"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            
                            <a
                              href={requireWhatsAppLink(inv, shopSetup)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                DB.addShareLog({
                                  invoiceId: inv.id,
                                  invoiceNumber: inv.invoiceNumber,
                                  customerName: inv.customerName,
                                  phone: inv.customerPhone,
                                  timestamp: new Date().toISOString(),
                                  type: 'WhatsApp'
                                });
                                onRefreshData();
                              }}
                              className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Share via WhatsApp Alerts"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </a>
                            
                            <button
                              onClick={() => onNavigateToPOS({ name: inv.customerName, phone: inv.customerPhone, address: inv.customerAddress })}
                              className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 active:scale-95 transition-all font-bold"
                            >
                              Bill Again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: BOUTIQUE CUSTOMERS HISTORY */}
          {activeTab === 'customers' && (
            <div>
              {customerHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Users className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-medium">No Customer purchasing ledgers recorded yet.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-bold text-xs uppercase bg-slate-50/50">
                      <th className="p-3">Rank No.</th>
                      <th className="p-3">Buyer Profile</th>
                      <th className="p-3">10-Digit Mobile</th>
                      <th className="p-3">Visit Counter</th>
                      <th className="p-3 text-right">Combined Spendings</th>
                      <th className="p-3">Last Visit Timestamp</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                    {customerHistory.map((cust, idx) => (
                      <tr key={cust.phone} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-400 text-center">#{idx + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-300 flex items-center justify-center text-[10px] font-black">
                              ★
                            </span>
                            <div>
                              <p className="text-slate-800 font-extrabold">{cust.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{cust.address || 'Local Walk-in Address'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">{cust.phone}</td>
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                            {cust.totalInvoicesCount} Bill(s)
                          </span>
                        </td>
                        <td className="p-3 text-right text-emerald-600 font-black text-sm">
                          {formatCurrency(cust.totalSpent, currencySymbol)}
                        </td>
                        <td className="p-3 text-slate-500 font-semibold">
                          {new Date(cust.lastVisitDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => onNavigateToPOS({ name: cust.name, phone: cust.phone, address: cust.address })}
                            className="bg-slate-900 text-white rounded-xl text-[10.5px] font-bold px-3 py-1.5 hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                          >
                            New POS Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: WHATSAPP SHARES LOG */}
          {activeTab === 'shares' && (
            <div>
              {shareLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Share2 className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-medium">WhatsApp share logs will show up here as you issue bills.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-bold text-xs uppercase bg-slate-50/50">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Invoice Number</th>
                      <th className="p-3">Recipient Name</th>
                      <th className="p-3">Phone number Sent To</th>
                      <th className="p-3">Channel Used</th>
                      <th className="p-3">Verification status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                    {shareLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString('en-IN')}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">{log.invoiceNumber}</td>
                        <td className="p-3 font-bold text-slate-800">{log.customerName}</td>
                        <td className="p-3 font-mono font-medium text-slate-500">{log.phone}</td>
                        <td className="p-3">
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            WhatsApp API Link Triggered
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">
                          <span className="bg-emerald-50 text-emerald-800 text-[9.5px] px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center justify-center w-fit gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Shared Success
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

// Helpers inside file
function requireWhatsAppLink(invoice: Invoice, shop: ShopSetup) {
  const cleanPhone = invoice.customerPhone.replace(/\D/g, '');
  
  const billSummary = invoice.items
    .map((item) => `• ${item.name} (${item.size})`)
    .slice(0, 3)
    .join('\n');

  const textMessage = 
`Dear *${invoice.customerName || 'Customer'}*,

Welcome shopping at *${shop.shopName}*!

Invoice No: ${invoice.invoiceNumber}
Total Net Amount Paid: ${shop.currency}${invoice.grandTotal.toLocaleString()}
Method: ${invoice.paymentMethod}

Purchases:
${billSummary}

Thank you. Visit Again! ❤️`;
  
  let formattedPhone = cleanPhone;
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`;
  }
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(textMessage)}`;
}

// Spinner Helper
function Spinner() {
  return (
    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
  );
}

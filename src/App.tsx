/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Invoice, ShopSetup } from './types';
import { DB, DEFAULT_SHOP_SETUP } from './db';
import ShopSetupView from './components/ShopSetupView';
import DashboardView from './components/DashboardView';
import BillGenerationView from './components/BillGenerationView';
import SheetsAutomationView from './components/SheetsAutomationView';
import LoginView from './components/LoginView';
import logoImg from './assets/images/ebook_logo_1780230548111.png';
import {
  TrendingUp,
  ShoppingBag,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Store,
  ChevronRight,
  Heart,
  Terminal,
  Activity,
  User,
  Plus,
  X,
  Clock,
  LogOut,
  Database,
  Globe,
  Share2,
  Save,
  Smartphone,
  Lock
} from 'lucide-react';

export default function App() {
  // 1. Core States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [shopSetup, setShopSetup] = useState<ShopSetup>(DEFAULT_SHOP_SETUP);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'sheets' | 'settings'>('dashboard');
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [posCustomerPreFill, setPosCustomerPreFill] = useState<{ name: string; phone: string; address?: string } | undefined>(undefined);
  
  // Profile Drawer States
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [loginTime, setLoginTime] = useState('');
  const [sessionLogs, setSessionLogs] = useState<{ id: string; time: string; msg: string; type?: string }[]>([]);

  // Profile Drawer tab selector & active edit credentials states
  const [drawerTab, setDrawerTab] = useState<'audit' | 'config'>('audit');

  const [profileSheetUrl, setProfileSheetUrl] = useState('');
  const [profileScriptUrl, setProfileScriptUrl] = useState('');
  const [profileSheetsConnected, setProfileSheetsConnected] = useState(false);

  const [profileWhatsAppGateway, setProfileWhatsAppGateway] = useState<'deeplink' | 'api'>('deeplink');
  const [profileWhatsAppPrefix, setProfileWhatsAppPrefix] = useState('91');
  const [profileWhatsAppMeBase, setProfileWhatsAppMeBase] = useState('https://wa.me');
  const [profileWhatsAppApiBase, setProfileWhatsAppApiBase] = useState('https://api.whatsapp.com/send');

  const [profileShopName, setProfileShopName] = useState('');
  const [profileShopAddress, setProfileShopAddress] = useState('');
  const [profileShopPhone, setProfileShopPhone] = useState('');
  const [profileShopGstEnabled, setProfileShopGstEnabled] = useState(false);
  const [profileShopGstNumber, setProfileShopGstNumber] = useState('');
  const [profileInvoicePrefix, setProfileInvoicePrefix] = useState('');
  const [profileCurrency, setProfileCurrency] = useState('');

  // Sync profile side drawer credentials states when it is opened or shopSetup changes
  useEffect(() => {
    if (isProfileDrawerOpen) {
      const sheets = DB.getSheetsConfig();
      setProfileSheetUrl(sheets.sheetUrl);
      setProfileScriptUrl(sheets.scriptUrl);
      setProfileSheetsConnected(sheets.connected);
      
      const gw = (localStorage.getItem('ai_billing_whatsapp_type_v1') as 'deeplink' | 'api') || 'deeplink';
      setProfileWhatsAppGateway(gw);

      const cachedPrefix = localStorage.getItem('ai_billing_whatsapp_prefix_v1') || '91';
      setProfileWhatsAppPrefix(cachedPrefix);

      const cachedMeBase = localStorage.getItem('ai_billing_whatsapp_me_base_v1') || 'https://wa.me';
      setProfileWhatsAppMeBase(cachedMeBase);

      const cachedApiBase = localStorage.getItem('ai_billing_whatsapp_api_base_v1') || 'https://api.whatsapp.com/send';
      setProfileWhatsAppApiBase(cachedApiBase);

      setProfileShopName(shopSetup.shopName);
      setProfileShopAddress(shopSetup.shopAddress);
      setProfileShopPhone(shopSetup.phone);
      setProfileShopGstEnabled(shopSetup.gstEnabled);
      setProfileShopGstNumber(shopSetup.gstNumber);
      setProfileInvoicePrefix(shopSetup.invoicePrefix);
      setProfileCurrency(shopSetup.currency);
    }
  }, [isProfileDrawerOpen, shopSetup]);

  const handleSaveAllDrawerCredentials = () => {
    try {
      // 1. Save Shop Setup
      const updatedSetup: ShopSetup = {
        ...shopSetup,
        shopName: profileShopName.trim(),
        shopAddress: profileShopAddress.trim(),
        phone: profileShopPhone.trim(),
        gstEnabled: profileShopGstEnabled,
        gstNumber: profileShopGstNumber.trim(),
        invoicePrefix: profileInvoicePrefix.trim(),
        currency: profileCurrency.trim(),
        whatsapp: profileShopPhone.trim() // align whatsapp number
      };
      DB.saveShopSetup(updatedSetup);
      setShopSetup(updatedSetup);

      // 2. Save Google Sheets Config
      DB.saveSheetsConfig({
        sheetUrl: profileSheetUrl.trim(),
        scriptUrl: profileScriptUrl.trim(),
        connected: profileSheetsConnected
      });

      // 3. Save WhatsApp gateway & detailed credentials parameters
      localStorage.setItem('ai_billing_whatsapp_type_v1', profileWhatsAppGateway);
      localStorage.setItem('ai_billing_whatsapp_prefix_v1', profileWhatsAppPrefix.trim());
      localStorage.setItem('ai_billing_whatsapp_me_base_v1', profileWhatsAppMeBase.trim());
      localStorage.setItem('ai_billing_whatsapp_api_base_v1', profileWhatsAppApiBase.trim());

      // Log to sessions stream
      const customLogMsg = `⚙️ [Control Panel] Master credentials synced: Active Store: "${profileShopName}", Sheets Active Sync: ${profileSheetsConnected ? 'ENABLED' : 'DISABLED'}, WhatsApp Gateway: ${profileWhatsAppGateway === 'api' ? 'Web API' : 'App Deep Link'} (Prefix: +${profileWhatsAppPrefix}, waBase: "${profileWhatsAppMeBase}", apiBase: "${profileWhatsAppApiBase}")`;
      
      const logTime = new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setSessionLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          time: logTime,
          msg: customLogMsg
        },
        ...prev
      ]);

      alert('All credentials & configuration parameters successfully synchronized in local cache!');
      setDrawerTab('audit'); // Switch back to audit view to see confirmation log
    } catch (e) {
      alert('Error updating credentials configuration.');
    }
  };

  // Initialize Session Time & Feed
  useEffect(() => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    setLoginTime(formattedTime);

    // Default start sequence details feed
    const initialLogs = [
      { id: 'log-1', time: formattedTime, msg: 'Secure TLS Administrator session authenticated for vedantthakur918@gmail.com', type: 'system' },
      { id: 'log-2', time: formattedTime, msg: `Boutique POS engine spawned: Loaded config for ${DB.getShopSetup().shopName}`, type: 'system' },
      { id: 'log-3', time: formattedTime, msg: 'Cloud Connectivity Gateway online: Real-time Google Sheets sync active', type: 'network' },
      { id: 'log-4', time: formattedTime, msg: 'Integrated WhatsApp sharing engine initialized successfully', type: 'whatsapp' }
    ];
    setSessionLogs(initialLogs);

    // Capture logs via custom event
    const handleAddLogEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const logTime = new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setSessionLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          time: logTime,
          msg: customEvent.detail
        },
        ...prev
      ]);
    };

    window.addEventListener('add-session-log', handleAddLogEvent);
    return () => window.removeEventListener('add-session-log', handleAddLogEvent);
  }, []);

  // 2. Fetch records initially
  useEffect(() => {
    // Check if onboarded previously
    const onboardFlag = localStorage.getItem('ai_billing_has_onboarded_v1');
    if (onboardFlag === 'true') {
      setHasOnboarded(true);
    }

    const fetchedSetup = DB.getShopSetup();
    const fetchedInvoices = DB.getInvoices();

    setShopSetup(fetchedSetup);
    setInvoices(fetchedInvoices);
  }, []);

  const handleRefreshData = () => {
    setInvoices(DB.getInvoices());
  };

  // 3. Complete shop setup save
  const handleSaveShopSetup = (updated: ShopSetup) => {
    DB.saveShopSetup(updated);
    setShopSetup(updated);
  };

  // Onboarding Wizard submit handle
  const handleOnboardingSubmit = (setup: ShopSetup) => {
    DB.saveShopSetup(setup);
    setShopSetup(setup);
    localStorage.setItem('ai_billing_has_onboarded_v1', 'true');
    setHasOnboarded(true);
    setActiveTab('dashboard');
  };

  // Custom deep-linking navigation helper to prefill POS bills
  const handleNavigateToPOSWithCustomer = (customerInfo?: { name: string; phone: string; address?: string }) => {
    setPosCustomerPreFill(customerInfo);
    setActiveTab('pos');
  };

  // Render Login & Sheets Setup Gate first
  if (!isLoggedIn) {
    return (
      <LoginView
        userEmail="vedantthakur918@gmail.com"
        onLoginSuccess={(sheetsConfig) => {
          setIsLoggedIn(true);
          const logTime = new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
          setSessionLogs((prev) => [
            {
              id: Math.random().toString(36).substring(2, 9),
              time: logTime,
              msg: `🔑 [Secure Session] Access granted for vedantthakur918@gmail.com. Sheets Automation state: ${sheetsConfig.connected ? 'ACTIVE (READY TO POST)' : 'NOT LINKED'}`
            },
            ...prev
          ]);
        }}
      />
    );
  }

  // Render Onboarding Screen if not structured yet
  if (!hasOnboarded) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-amber-400 selection:text-slate-900 animate-fadeIn">
        <div className="max-w-3xl w-full space-y-6">
          {/* Logo Heading */}
          <div className="text-center space-y-2">
            <span className="bg-amber-400/20 text-amber-300 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border border-amber-300/20 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-spin-slow" />
              AI Enabled Retail POS
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
              Configure Your Clothing Shop Settings
            </h1>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Please enter your business credentials to initialize tax metrics, invoice codes, and digital receipt templates.
            </p>
          </div>

          {/* Setup view inside Onboarding */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <ShopSetupView
              setup={shopSetup}
              onSave={handleOnboardingSubmit}
            />
          </div>

          <div className="text-center">
            <p className="text-[10px] text-slate-500">
              AI Retail Billing System for Clothing Shops • Zero upfront server fees • Cloud Sheet Compatible
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-slate-900 selection:text-white w-full max-w-full overflow-hidden" id="main-app-container">
      
      {/* SECTION 1: GLOBAL HEADER FRAME */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            
            {/* Branding */}
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2 md:mr-4">
              <img
                src={logoImg}
                alt="E BOOK Logo"
                className="w-10 h-10 rounded-xl object-cover shadow border border-amber-500/20 ring-2 ring-black/40 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-black font-display tracking-tight text-white flex items-center gap-1.5 leading-none truncate">
                  <span className="truncate">{shopSetup.shopName}</span>
                  {shopSetup.gstNumber && (
                    <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded border border-indigo-400/20 uppercase font-black shrink-0">
                      GSTIN OK
                    </span>
                  )}
                </h1>
                <p className="text-[10px] text-slate-400 mt-1 truncate max-w-xs sm:max-w-sm">
                  {shopSetup.shopAddress}
                </p>
              </div>
            </div>

            {/* Platform Quick Stats & Profile */}
            <div className="flex items-center gap-4">
              {/* Platform Quick Stats */}
              <div className="hidden lg:flex items-center gap-5">
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Continuous Bills</span>
                  <span className="text-xs font-mono font-bold text-white tracking-wider">{invoices.length} Registered</span>
                </div>
                <div className="h-6 w-px bg-slate-800"></div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Operational Status</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active POS
                  </span>
                </div>
              </div>

              {/* Secure Session Profile Badge */}
              <button
                onClick={() => {
                  setIsProfileDrawerOpen(true);
                  window.dispatchEvent(new CustomEvent('add-session-log', { detail: 'Opened Profile & Session Details Feed panel' }));
                }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 text-white border border-slate-705 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 text-left"
                id="user-profile-header-trigger"
                title="View Admin Profile & Login Details Feed"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-rose-500 font-extrabold text-[12px] text-white flex items-center justify-center shadow-inner">
                  VT
                </div>
                <div className="hidden sm:block leading-none">
                  <p className="text-[10px] font-extrabold text-slate-200">Vedant Thakur</p>
                  <p className="text-[8px] font-medium text-emerald-400 flex items-center gap-0.5 mt-0.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full"></span> Online
                  </p>
                </div>
              </button>
            </div>

          </div>
        </div>

        {/* SECTION 2: PATH NAVIGATION BAR TABS */}
        <div className="border-t border-slate-800 bg-slate-950/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 py-1.5 overflow-x-auto scrollbar-thin">
              
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setPosCustomerPreFill(undefined);
                  window.dispatchEvent(new CustomEvent('add-session-log', { detail: 'Switched view to Store Metrics Overview' }));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Store Metrics
              </button>

              <button
                onClick={() => {
                  setActiveTab('pos');
                  window.dispatchEvent(new CustomEvent('add-session-log', { detail: 'Opened Cashier Workbench - Interactive POS billing screen loaded' }));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all shrink-0 ${
                  activeTab === 'pos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                POS Quick Bill
              </button>

              <button
                onClick={() => {
                  setActiveTab('sheets');
                  setPosCustomerPreFill(undefined);
                  window.dispatchEvent(new CustomEvent('add-session-log', { detail: 'Configured Google Sheets automated webhook settings interface' }));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all shrink-0 ${
                  activeTab === 'sheets'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Google Sheets Sync
              </button>

              <button
                onClick={() => {
                  setActiveTab('settings');
                  setPosCustomerPreFill(undefined);
                  window.dispatchEvent(new CustomEvent('add-session-log', { detail: 'Accessed General Settings - Shop and GST configurations panel' }));
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Store Settings
              </button>

            </div>
          </div>
        </div>
      </header>

      {/* SECTION 3: CORE WORKSPACE VIEWPORT */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        <div className="animate-fadeIn">
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={invoices}
              shopSetup={shopSetup}
              onNavigateToPOS={handleNavigateToPOSWithCustomer}
              onRefreshData={handleRefreshData}
            />
          )}

          {activeTab === 'pos' && (
            <BillGenerationView
              shopSetup={shopSetup}
              initialCustomer={posCustomerPreFill}
              onBillGenerated={() => {
                handleRefreshData();
                setActiveTab('dashboard'); // go to overview on success
              }}
            />
          )}

          {activeTab === 'sheets' && (
            <SheetsAutomationView
              invoices={invoices}
              shopSetup={shopSetup}
              onRefreshData={handleRefreshData}
            />
          )}

          {activeTab === 'settings' && (
            <ShopSetupView
              setup={shopSetup}
              onSave={(updated) => {
                handleSaveShopSetup(updated);
                alert('Shop configuration details updated successfully!');
              }}
            />
          )}
        </div>
      </main>

      {/* SECTION 4: GLOBAL SITE FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-4 text-center text-[10px] text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p>© 2026 AI Retail Billing System. Crafted for Indian Fashion Boutique Stores.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for Jaipur & Handloom weavers.
          </p>
        </div>
      </footer>

      {/* SECTION 5: PROFILE & DETAILS FEED SIDE DRAWER */}
      {isProfileDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="profile-drawer-backdrop">
          {/* Backdrop Blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsProfileDrawerOpen(false)}
          />
          
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-slate-900 text-slate-100 flex flex-col shadow-2xl relative border-l border-slate-800 animate-in slide-in-from-right duration-250">
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wider text-slate-100 uppercase">Operational Session</h3>
                    <p className="text-[9px] text-slate-500 font-semibold tracking-wider font-mono">ID: SECURE-VT-77A</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsProfileDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub tab selectors */}
              <div className="grid grid-cols-2 p-1 bg-slate-950/45 border-b border-slate-850 animate-fade-in">
                <button
                  type="button"
                  onClick={() => setDrawerTab('audit')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider text-center cursor-pointer transition-all ${
                    drawerTab === 'audit'
                      ? 'bg-slate-800/80 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📊 Session Stream Logs
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('config')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider text-center cursor-pointer transition-all ${
                    drawerTab === 'config'
                      ? 'bg-slate-800/80 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🛠️ Credentials Central
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {drawerTab === 'audit' ? (
                  <>
                    {/* 1. Admin Profile Card */}
                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-rose-500 font-black text-2xl text-white flex items-center justify-center shadow-lg border border-indigo-500/20">
                          VT
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-md font-extrabold text-white">Vedant Thakur</h4>
                            <span className="bg-emerald-500/15 text-emerald-400 text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded border border-emerald-500/25 shrink-0">
                              ACTIVE
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium font-mono truncate">vedantthakur918@gmail.com</p>
                          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Role: Master Store Administrator</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-slate-850 pt-3 text-[10px] text-slate-400">
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                          <span className="block font-bold text-slate-500 text-[8px] uppercase">Session Created At</span>
                          <span className="font-mono text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-indigo-400" />
                            {loginTime}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                          <span className="block font-bold text-slate-500 text-[8px] uppercase">Boutique Database</span>
                          <span className="font-mono text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                            <Database className="w-3 h-3 text-amber-500" />
                            Indexed Cache
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Live Activity Details Feed */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-350 tracking-wider uppercase flex items-center gap-1.5">
                          <Terminal className="w-4 h-4 text-emerald-400" />
                          Session Audit Feed ({sessionLogs.length})
                        </h4>
                        <button
                          onClick={() => {
                            setSessionLogs([{
                              id: 'log-clear',
                              time: new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
                              msg: 'Audit feed cleared by Store Master Admin.'
                            }]);
                          }}
                          className="text-[9px] text-rose-450 hover:text-rose-400 font-extrabold hover:underline select-none cursor-pointer"
                        >
                          Clear Logs
                        </button>
                      </div>

                      {/* Feed stream box */}
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 h-72 overflow-y-auto space-y-3 font-mono scrollbar-thin">
                        {sessionLogs.map((log) => (
                          <div key={log.id} className="text-[10px] leading-relaxed flex gap-2 border-l border-slate-800 pl-3.5 relative">
                            <span className="absolute -left-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-950 mt-1"></span>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 font-semibold">[{log.time}]</span>
                              </div>
                              <p className="text-slate-300 font-normal leading-normal">{log.msg}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Operational Quick Settings Shortcut */}
                    <div className="bg-gradient-to-r from-indigo-950/40 to-slate-950/30 p-3.5 rounded-2xl border border-indigo-900/20 text-xs text-slate-305">
                      <h4 className="font-bold text-indigo-300 flex items-center gap-1 uppercase text-[9px]">
                        <Sparkles className="w-3.5 h-3.5" /> Cloud Platform Insights
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        Automatic synchronization of sales logs ensures error-free bookkeeping. Changes in inventory levels update instantly across your storefront active views.
                      </p>
                    </div>
                  </>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveAllDrawerCredentials(); }} className="space-y-4">
                    
                    {/* BOUTIQUE BLOCK */}
                    <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <Store className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-black tracking-wider text-slate-200 uppercase">1. Edit Shop Settings</h4>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Shop Name</label>
                        <input
                          type="text"
                          value={profileShopName}
                          onChange={(e) => setProfileShopName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Shop Address</label>
                        <textarea
                          rows={2}
                          value={profileShopAddress}
                          onChange={(e) => setProfileShopAddress(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Shop Mobile</label>
                          <input
                            type="text"
                            value={profileShopPhone}
                            onChange={(e) => setProfileShopPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Currency Symbol</label>
                          <input
                            type="text"
                            value={profileCurrency}
                            onChange={(e) => setProfileCurrency(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-mono">Inv Prefix</label>
                          <input
                            type="text"
                            value={profileInvoicePrefix}
                            onChange={(e) => setProfileInvoicePrefix(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white font-mono focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-mono">GSTIN Code</label>
                          <input
                            type="text"
                            value={profileShopGstNumber}
                            onChange={(e) => setProfileShopGstNumber(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 select-none">
                        <input
                          type="checkbox"
                          id="p-gst-enabled-box"
                          checked={profileShopGstEnabled}
                          onChange={(e) => setProfileShopGstEnabled(e.target.checked)}
                          className="w-4 h-4 text-amber-550 border-slate-800 bg-slate-900 focus:ring-0 rounded cursor-pointer"
                        />
                        <label htmlFor="p-gst-enabled-box" className="text-[11px] text-slate-300 font-bold cursor-pointer">
                          Apply GST on Item-Additions
                        </label>
                      </div>
                    </div>

                    {/* SHEETS CREDENTIALS BLOCK */}
                    <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-black tracking-wider text-slate-200 uppercase">2. Google Sheet Credentials</h4>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-sans">Spreadsheet URL</label>
                        <input
                          type="text"
                          value={profileSheetUrl}
                          onChange={(e) => setProfileSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/your-id/edit"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-sans">Apps Script Deployment Webhook API</label>
                        <textarea
                          rows={2}
                          value={profileScriptUrl}
                          placeholder="https://script.google.com/macros/s/deployment-id/exec"
                          onChange={(e) => setProfileScriptUrl(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-mono text-slate-300 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1 select-none">
                        <input
                          type="checkbox"
                          id="p-sheets-connected-box"
                          checked={profileSheetsConnected}
                          onChange={(e) => setProfileSheetsConnected(e.target.checked)}
                          className="w-4 h-4 text-emerald-500 border-slate-800 bg-slate-900 focus:ring-0 rounded cursor-pointer"
                        />
                        <label htmlFor="p-sheets-connected-box" className="text-[11px] text-slate-300 font-bold cursor-pointer">
                          Activate Real-Time Continuous Sync
                        </label>
                      </div>
                    </div>

                    {/* WHATSAPP CREDENTIALS BLOCK */}
                    <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <Smartphone className="w-4 h-4 text-sky-400" />
                        <h4 className="text-xs font-black tracking-wider text-slate-200 uppercase">3. WhatsApp Gateways</h4>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Active Protocol Gateway</label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setProfileWhatsAppGateway('deeplink')}
                            className={`py-1.5 text-[9px] font-black rounded-lg cursor-pointer transition-all uppercase ${
                              profileWhatsAppGateway === 'deeplink'
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            App Deep Link (wa.me)
                          </button>
                          <button
                            type="button"
                            onClick={() => setProfileWhatsAppGateway('api')}
                            className={`py-1.5 text-[9px] font-black rounded-lg cursor-pointer transition-all uppercase ${
                              profileWhatsAppGateway === 'api'
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Web API (api.whatsapp)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-1.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-mono">Default Country Code Prefix</label>
                          <input
                            type="text"
                            value={profileWhatsAppPrefix}
                            onChange={(e) => setProfileWhatsAppPrefix(e.target.value.replace(/\D/g, ''))}
                            placeholder="91"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-bold text-white font-mono focus:outline-none"
                          />
                          <p className="text-[8px] text-slate-550 font-medium">Prepended automatically if customer mobile number has 10 digits (e.g. 91 for India, 1 for USA, 44 for UK).</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-mono">App Deep Link Base URL</label>
                          <input
                            type="text"
                            value={profileWhatsAppMeBase}
                            onChange={(e) => setProfileWhatsAppMeBase(e.target.value)}
                            placeholder="https://wa.me"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-semibold text-slate-200 font-mono focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block font-mono">Web API Base URL</label>
                          <input
                            type="text"
                            value={profileWhatsAppApiBase}
                            onChange={(e) => setProfileWhatsAppApiBase(e.target.value)}
                            placeholder="https://api.whatsapp.com/send"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-semibold text-slate-200 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <p className="text-[9px] text-slate-550 font-semibold leading-relaxed">
                        App Deep Link works natively on smartphones, Web API opens the web client on computers. Saved values are synced with immediate click links.
                      </p>
                    </div>

                    {/* Submit settings button inside Profile drawer */}
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow hover:shadow-lg transition-transform active:scale-95 text-center mt-3"
                    >
                      <Save className="w-4 h-4 text-emerald-300" />
                      <span>SAVE CONFIGURATION SYSTEMS</span>
                    </button>

                  </form>
                )}

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const auditSummary = sessionLogs.map(l => `[${l.time}] ${l.msg}`).join('\n');
                    navigator.clipboard.writeText(auditSummary);
                    alert('Audit Trail Copied to Clipboard!');
                  }}
                  className="flex-grow bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer text-center"
                >
                  Copy Audit Summary
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to sign out and clear your onboarding boutique sessions?')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="bg-rose-950 hover:bg-rose-900 text-rose-450 border border-rose-800/20 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 justify-center shrink-0"
                  title="Sign Out Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Code,
  Link as LinkIcon,
  CloudLightning,
  Eye,
  EyeOff,
  Database,
  Smartphone,
  Store,
  UserPlus
} from 'lucide-react';
import logoImg from '../assets/images/ebook_logo_1780230548111.png';
import { GoogleSheetsConfig } from '../types';
import { DB } from '../db';

interface LoginViewProps {
  onLoginSuccess: (sheetsConfig: GoogleSheetsConfig) => void;
  userEmail: string;
}

export default function LoginView({ onLoginSuccess, userEmail }: LoginViewProps) {
  const [step, setStep] = useState<'login' | 'sheets_setup'>('login');
  
  // Auth Mode selection
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Input states
  const [email, setEmail] = useState(userEmail || 'vedantthakur918@gmail.com');
  const [password, setPassword] = useState('admin123'); // Default simple password for boutique setup
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupShopName, setSignupShopName] = useState('Balaji Fashion Saree Kendra');
  const [signupShopAddress, setSignupShopAddress] = useState('Sector-5, Near Hanuman Mandir, Main Market, Jaipur, Rajasthan - 302001');

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Sheets configuration phase states
  const savedSheetsConfig = DB.getSheetsConfig();
  const [sheetUrl, setSheetUrl] = useState(savedSheetsConfig.sheetUrl || '');
  const [scriptUrl, setScriptUrl] = useState(savedSheetsConfig.scriptUrl || '');
  const [sheetsConnected, setSheetsConnected] = useState(savedSheetsConfig.connected || false);

  // WhatsApp setup wizard states
  const [waGateway, setWaGateway] = useState<'deeplink' | 'api'>(
    (localStorage.getItem('ai_billing_whatsapp_type_v1') as 'deeplink' | 'api') || 'deeplink'
  );
  const [waPrefix, setWaPrefix] = useState(
    localStorage.getItem('ai_billing_whatsapp_prefix_v1') || '91'
  );

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize or check registered users
  const getRegisteredUsers = () => {
    const usersData = localStorage.getItem('ai_billing_registered_users_v2');
    if (!usersData) {
      const defaultUser = {
        email: 'vedantthakur918@gmail.com',
        password: 'admin123',
        shopName: 'Balaji Fashion Saree Kendra',
        shopAddress: 'Sector-5, Near Hanuman Mandir, Main Market, Jaipur, Rajasthan - 302001'
      };
      localStorage.setItem('ai_billing_registered_users_v2', JSON.stringify([defaultUser]));
      return [defaultUser];
    }
    try {
      return JSON.parse(usersData);
    } catch {
      return [];
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setAuthLoading(true);

    setTimeout(() => {
      const usersList = getRegisteredUsers();
      const emailLower = email.trim().toLowerCase();

      if (authMode === 'signin') {
        const matchingUser = usersList.find(
          (u: any) => u.email.toLowerCase() === emailLower && u.password === password
        );

        if (matchingUser) {
          // Sync ShopSetup configured for this user session or preserve active one
          const currentShopSetup = DB.getShopSetup();
          DB.saveShopSetup({
            ...currentShopSetup,
            shopName: matchingUser.shopName || currentShopSetup.shopName,
            shopAddress: matchingUser.shopAddress || currentShopSetup.shopAddress
          });
          
          setSuccessMsg('Authentication successful! Loading integrated gateways...');
          setTimeout(() => {
            setStep('sheets_setup');
            setSuccessMsg('');
          }, 800);
        } else {
          setErrorMsg('Invalid email or password. Registrant not found database.');
        }
      } else {
        // Sign Up Mode validation
        if (!emailLower || !password || !signupShopName.trim()) {
          setErrorMsg('Please populate all required fields to complete registration.');
          setAuthLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMsg('Confirmation password does not match. Please verify.');
          setAuthLoading(false);
          return;
        }

        if (password.length < 5) {
          setErrorMsg('For store safety, password must be at least 5 indices long.');
          setAuthLoading(false);
          return;
        }

        const userExists = usersList.some((u: any) => u.email.toLowerCase() === emailLower);
        if (userExists) {
          setErrorMsg('This email is already registered. Please sign in instead.');
          setAuthLoading(false);
          return;
        }

        // Add user registered credentials
        const newUser = {
          email: emailLower,
          password: password,
          shopName: signupShopName.trim(),
          shopAddress: signupShopAddress.trim()
        };

        const updatedUsers = [...usersList, newUser];
        localStorage.setItem('ai_billing_registered_users_v2', JSON.stringify(updatedUsers));

        // Save shop setup directly for direct workspace setup preview
        const currentShopSetup = DB.getShopSetup();
        DB.saveShopSetup({
          ...currentShopSetup,
          shopName: newUser.shopName,
          shopAddress: newUser.shopAddress
        });

        setSuccessMsg('Account registered successfully! Now proceeding to integration workspace...');
        setTimeout(() => {
          setStep('sheets_setup');
          setSuccessMsg('');
        }, 850);
      }
      setAuthLoading(false);
    }, 850);
  };

  const handleSheetsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);

    const config: GoogleSheetsConfig = {
      sheetUrl: sheetUrl.trim(),
      scriptUrl: scriptUrl.trim(),
      connected: sheetsConnected
    };

    DB.saveSheetsConfig(config);

    // Save active user email
    localStorage.setItem('ai_billing_active_user_v2', email.trim().toLowerCase());

    // Persist WhatsApp protocols in sync with App configurations
    localStorage.setItem('ai_billing_whatsapp_type_v1', waGateway);
    localStorage.setItem('ai_billing_whatsapp_prefix_v1', waPrefix.trim());
    localStorage.setItem('ai_billing_whatsapp_me_base_v1', 'https://wa.me');
    localStorage.setItem('ai_billing_whatsapp_api_base_v1', 'https://api.whatsapp.com/send');

    setTimeout(() => {
      onLoginSuccess(config);
    }, 1200);
  };

  const handleSkipSheets = () => {
    const config: GoogleSheetsConfig = {
      sheetUrl: sheetUrl.trim(),
      scriptUrl: scriptUrl.trim(),
      connected: sheetsConnected
    };

    // Save active user email
    localStorage.setItem('ai_billing_active_user_v2', email.trim().toLowerCase());

    // Always make sure WhatsApp setups are written
    localStorage.setItem('ai_billing_whatsapp_type_v1', waGateway);
    localStorage.setItem('ai_billing_whatsapp_prefix_v1', waPrefix.trim());
    localStorage.setItem('ai_billing_whatsapp_me_base_v1', 'https://wa.me');
    localStorage.setItem('ai_billing_whatsapp_api_base_v1', 'https://api.whatsapp.com/send');

    onLoginSuccess(config);
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-b from-slate-900 to-black flex items-center justify-center p-4 selection:bg-amber-400 selection:text-slate-950">
      <div className="max-w-md w-full relative">
        {/* Glow Effects */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -z-10"></div>

        {/* Brand Header */}
        <div className="text-center mb-8 space-y-4">
          <img
            src={logoImg}
            alt="E BOOK Logo"
            className="w-28 h-28 object-cover rounded-2xl shadow-2xl mx-auto border-2 border-amber-500/20 ring-4 ring-black/40 hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight font-sans">
              Jaipur Handloom POS Secure Gate
            </h1>
            <p className="text-xs text-slate-200 font-semibold font-sans tracking-wide">
              Continuous Ledger Billing & Cloud Sheets Integration
            </p>
          </div>
        </div>

        {/* Phase 1: Interactive Secure Login & Registration Tab */}
        {step === 'login' && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 shadow-2xl space-y-5 animate-fadeIn">
            {/* Header Tabs switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-250 select-none">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2 text-[11px] font-black tracking-wide rounded-lg cursor-pointer transition-all uppercase flex items-center justify-center gap-1.5 ${
                  authMode === 'signin'
                    ? 'bg-slate-900 text-white shadow'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2 text-[11px] font-black tracking-wide rounded-lg cursor-pointer transition-all uppercase flex items-center justify-center gap-1.5 ${
                  authMode === 'signup'
                    ? 'bg-slate-900 text-white shadow'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Sign Up
              </button>
            </div>

            <div className="space-y-1 text-center border-b border-slate-100 pb-3">
              <span className="bg-indigo-50 text-indigo-900 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border border-indigo-200 inline-flex items-center gap-1 font-sans">
                {authMode === 'signin' ? (
                  <>
                    <Lock className="w-3 h-3 text-indigo-700" />
                    Secure Lobby Gate
                  </>
                ) : (
                  <>
                    <Store className="w-3 h-3 text-indigo-700 animate-bounce" />
                    Register Boutique Profile
                  </>
                )}
              </span>
              <p className="text-xs text-slate-700 font-medium font-sans mt-1">
                {authMode === 'signin' 
                  ? 'Access the master retail ledger workspace below.' 
                  : 'Establish a new secure workspace and customized sales setup.'}
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-800 text-xs p-3 rounded-xl border border-red-200 font-semibold leading-relaxed font-sans">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 text-emerald-950 text-xs p-3 rounded-xl border border-emerald-200 font-extrabold leading-relaxed font-sans flex items-center gap-1.5 animate-pulse">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-800 block uppercase tracking-wider font-sans">
                  {authMode === 'signin' ? 'Cashier Email Address' : 'Account Owner Email'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-600 w-4 h-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="e.g. cashier@boutique.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 bg-white font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Only for sign up: Store Name & Address */}
              {authMode === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-800 block uppercase tracking-wider font-sans">Boutique Store Name</label>
                    <div className="relative">
                      <Store className="absolute left-3 top-3 text-slate-600 w-4 h-4" />
                      <input
                        type="text"
                        value={signupShopName}
                        onChange={(e) => setSignupShopName(e.target.value)}
                        required
                        placeholder="e.g. Jaipur Saree Emporium"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 bg-white font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-800 block uppercase tracking-wider font-sans">Store Physical Address</label>
                    <textarea
                      value={signupShopAddress}
                      onChange={(e) => setSignupShopAddress(e.target.value)}
                      required
                      rows={2}
                      placeholder="Enter address for PDF Bill headers..."
                      className="w-full px-3 py-2 text-xs border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 bg-white font-semibold text-slate-900 resize-none"
                    />
                  </div>
                </>
              )}

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-800 block uppercase tracking-wider font-sans">Security Key / Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-600 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 bg-white font-mono font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Double Confirm password for Sign Up */}
              {authMode === 'signup' && (
                <div className="space-y-1 animate-slideDown">
                  <label className="text-[10px] font-black text-slate-800 block uppercase tracking-wider font-sans">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-600 w-4 h-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 bg-white font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Default Credentials Hint for Quick Onboarding */}
              {authMode === 'signin' && (
                <p className="text-[10px] text-slate-700 font-semibold select-none leading-normal">
                  💡 Hint: Default admin account email is <span className="font-bold text-slate-900">vedantthakur918@gmail.com</span> and password is <span className="font-extrabold text-slate-900 font-mono bg-slate-100 border border-slate-200 px-1 rounded-sm">admin123</span>
                </p>
              )}

              {/* Submit Trigger */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>{authMode === 'signin' ? 'Verify Secret Session' : 'Register Secure Profile'}</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Phase 2: Dual Integration setup (Google Sheets + WhatsApp Configuration Wizard) */}
        {step === 'sheets_setup' && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl space-y-4 animate-slideIn">
            <div className="space-y-1.5 text-center border-b border-slate-200 pb-3">
              <span className="bg-emerald-50 text-emerald-850 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1 font-sans">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-850" />
                Step 2: Connect Cloud & WhatsApp Channels
              </span>
              <p className="text-[11px] text-slate-700 font-bold leading-normal font-sans">
                Real-time online bookkeeping & customer transmission gateway protocols.
              </p>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-50 text-emerald-950 text-[11px] p-2.5 rounded-xl border border-emerald-200 font-extrabold flex items-center gap-1.5 font-sans animate-bounce">
                <CheckCircle className="w-4 h-4 text-emerald-705" /> Connective gateways registered! Accessing POS...
              </div>
            )}

            <form onSubmit={handleSheetsSubmit} className="space-y-4 font-sans text-xs">
              
              {/* GOOGLE SHEETS BLOCK */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  Google Sheet Synchronization
                </h4>

                {/* Spreadsheet URL */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-700 block uppercase tracking-wider">Spreadsheet Preview Link</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-2.5 top-2.5 text-slate-500 w-3.5 h-3.5" />
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white font-semibold text-slate-900"
                    />
                  </div>
                </div>

                {/* Web App URL */}
                <div className="space-y-1 border-t border-slate-200/60 pt-2">
                  <label className="text-[9px] font-black text-slate-700 block uppercase tracking-wider">Macros Webhook API Url</label>
                  <div className="relative">
                    <CloudLightning className="absolute left-2.5 top-2.5 text-slate-500 w-3.5 h-3.5" />
                    <input
                      type="url"
                      value={scriptUrl}
                      onChange={(e) => setScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white font-mono text-slate-900"
                    />
                  </div>
                </div>

                {/* Sync check box */}
                <div className="flex items-start gap-2 pt-1 select-none">
                  <input
                    type="checkbox"
                    id="login-sheets-connect"
                    checked={sheetsConnected}
                    onChange={(e) => setSheetsConnected(e.target.checked)}
                    className="w-4 h-4 text-emerald-700 border-2 border-slate-300 rounded focus:ring-0 cursor-pointer mt-0.5"
                  />
                  <label htmlFor="login-sheets-connect" className="text-[10px] text-slate-800 font-extrabold cursor-pointer">
                    Enable background continuous sync dynamically
                  </label>
                </div>
              </div>

              {/* WHATSAPP PROTOCOL GATEWAY INTEGRATION */}
              <div className="space-y-3 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-700 animate-pulse" />
                  WhatsApp Sharing Integration
                </h4>

                {/* Gateway selection */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-700 block uppercase tracking-wider">Active Messaging Gateway</label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-250">
                    <button
                      type="button"
                      onClick={() => setWaGateway('deeplink')}
                      className={`py-1.5 text-[9px] font-extrabold rounded-md cursor-pointer transition-all uppercase ${
                        waGateway === 'deeplink'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      📱 Mobile App Link (wa.me)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaGateway('api')}
                      className={`py-1.5 text-[9px] font-extrabold rounded-md cursor-pointer transition-all uppercase ${
                        waGateway === 'api'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      💻 Computer Web API (whatsapp)
                    </button>
                  </div>
                </div>

                {/* Default Phone Prefix country code */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-700 block uppercase tracking-wider">Standard Country Code Prefix</label>
                  <input
                    type="text"
                    value={waPrefix}
                    onChange={(e) => setWaPrefix(e.target.value.replace(/\D/g, ''))}
                    placeholder="91 (e.g. India)"
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white font-bold text-slate-900 font-mono"
                  />
                  <p className="text-[8px] text-slate-500 leading-normal font-semibold">Prepends code automatically for seamless WhatsApp clicks if missing in invoice phone numbers.</p>
                </div>
              </div>

              {/* Action Rows */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSkipSheets}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold py-2.5 rounded-xl transition-all cursor-pointer text-center text-[11px]"
                >
                  Configure Later
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-750 text-white font-black py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer text-center text-[11px] flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Save & Complete
                </button>
              </div>

            </form>
          </div>
        )}

        <div className="text-center mt-6">
          <p className="text-[10px] text-slate-400 font-semibold select-none">
            Secure Admin Workspace Session for {email}
          </p>
        </div>
      </div>
    </div>
  );
}

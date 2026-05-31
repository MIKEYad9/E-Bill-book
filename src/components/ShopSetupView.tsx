/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShopSetup } from '../types';
import { DB } from '../db';
import logoImg from '../assets/images/ebook_logo_1780230548111.png';
import { Store, MapPin, Phone, AlertCircle, Sparkles, Check, Upload, Image as ImageIcon, FileSignature } from 'lucide-react';

interface ShopSetupViewProps {
  setup: ShopSetup;
  onSave: (updated: ShopSetup) => void;
}

export default function ShopSetupView({ setup, onSave }: ShopSetupViewProps) {
  const [shopName, setShopName] = useState(setup.shopName);
  const [shopAddress, setShopAddress] = useState(setup.shopAddress);
  const [phone, setPhone] = useState(setup.phone);
  const [whatsapp, setWhatsapp] = useState(setup.whatsapp);
  const [gstEnabled, setGstEnabled] = useState(setup.gstEnabled);
  const [gstNumber, setGstNumber] = useState(setup.gstNumber);
  const [invoicePrefix, setInvoicePrefix] = useState(setup.invoicePrefix);
  const [currency, setCurrency] = useState(setup.currency || '₹');
  const [logoUrl, setLogoUrl] = useState<string | null>(setup.logoUrl || logoImg);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(setup.signatureUrl);
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Convert uploaded image to Base64 for persistent offline indexing
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo image should be under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        alert('Signature sign should be under 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!shopName.trim()) {
      setValidationError('Shop Name is required.');
      return;
    }
    if (!phone.trim()) {
      setValidationError('Store contact phone is required.');
      return;
    }

    const updated: ShopSetup = {
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      gstEnabled,
      gstNumber: gstEnabled ? gstNumber.trim().toUpperCase() : '',
      invoicePrefix: invoicePrefix.trim(),
      currency,
      logoUrl,
      signatureUrl,
    };

    onSave(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="bg-white/95 rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="shop-setup-section">
      {/* Decorative Brand Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-indigo-400" />
            Shop Setup & Billing Profile
          </h2>
          <p className="text-xs text-slate-300 mt-1">Configure your invoice headers, brand logo, rates and tax details</p>
        </div>
        <div className="hidden sm:block">
          <span className="bg-amber-400/20 text-amber-200 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 border border-amber-300/30">
            <Sparkles className="w-3.5 h-3.5" />
            AI Enabled Software
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
        {validationError && (
          <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start gap-2.5 border border-red-100 animate-pulse">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <p className="font-medium">{validationError}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="bg-emerald-50 text-emerald-800 text-sm p-4 rounded-xl flex items-center gap-2.5 border border-emerald-100 animate-bounce">
            <Check className="w-4 h-4" />
            <p className="font-semibold">Store settings recorded securely! Invoices will update dynamically.</p>
          </div>
        )}

        {/* 1. Shop Core details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 block">SHOP REGISTERED NAME *</label>
            <div className="relative">
              <Store className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Balaji Fashion Boutique"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 block">STORE CONTACT MOBILE *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-600 block">PHYSICAL ADDRESS FOR RECEIPT HEADER</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <textarea
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                placeholder="Complete store location, floor, sector, city and pincode..."
                rows={2}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* 2. Billing configuration */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Billing & Accounting Presets</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">WHATSAPP NOTIFIER PHONE</label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Prefix to send bills, e.g. 9876543210"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">INVOICE NUMBER PREFIX</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="e.g. BFB/2026/"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-medium text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">BILLING CURRENCY STANDARD</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-slate-800 bg-white"
              >
                <option value="₹">₹ - Indian Rupee (INR)</option>
                <option value="$">$ - US Dollar (USD)</option>
                <option value="£">£ - British Pound (GBP)</option>
                <option value="€">€ - Euro (EUR)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. GST parameters */}
        <div className="border-t border-slate-100 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">GST Validation Header</h3>
              <p className="text-xs text-slate-500 mt-0.5">Toggle default state for calculating central & state clothing taxes</p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={gstEnabled}
                onChange={(e) => setGstEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
              <span className="ml-2 text-xs font-bold text-slate-700">{gstEnabled ? 'ENABLED' : 'DISABLED'}</span>
            </label>
          </div>

          {gstEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">PROVINCE IN GSTIN REGISTRATION (15-DIGIT)</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="e.g. 08AAAAA1111A1Z1"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono tracking-widest uppercase font-medium text-slate-800"
                />
                <p className="text-[10px] text-slate-400">First 2 digits represent State Code in India (e.g. 08 for Rajasthan, 27 for Maharashtra)</p>
              </div>
            </div>
          )}
        </div>

        {/* 4. Brand assets uploads */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Brand Logo & Digital Verification Signature</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Box */}
            <div className="border border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center space-y-3 bg-slate-50/55 hover:bg-slate-50 transition-colors">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-700">UPLOAD SHOP CUSTOM LOGO</p>
                <p className="text-[10px] text-slate-500 mt-1">PNG, JPG formats (Max width 300px recommended)</p>
              </div>

              {logoUrl ? (
                <div className="relative border border-slate-200 rounded-lg p-2 bg-white max-h-24 overflow-hidden">
                  <img src={logoUrl} alt="Store logo preview" className="h-16 object-contain" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold hover:bg-red-600 border border-white"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="bg-white hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Choose File
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Signature Box */}
            <div className="border border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center space-y-3 bg-slate-50/55 hover:bg-slate-50 transition-colors">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
                <FileSignature className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-700">UPLOAD DIGITAL SIGNATURE SIGN</p>
                <p className="text-[10px] text-slate-500 mt-1">Saves to invoice footer (Clear white or alpha background)</p>
              </div>

              {signatureUrl ? (
                <div className="relative border border-slate-200 rounded-lg p-2 bg-white max-h-24 overflow-hidden">
                  <img src={signatureUrl} alt="Signature preview" className="h-16 object-contain" />
                  <button
                    type="button"
                    onClick={() => setSignatureUrl(null)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold hover:bg-red-600 border border-white"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="bg-white hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Choose File
                  <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Form submit footer */}
        <div className="border-t border-slate-100 pt-6 flex justify-end">
          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-8 py-3 rounded-xl shadow-sm transition-all hover:shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Profile Credentials
          </button>
        </div>
      </form>
    </div>
  );
}

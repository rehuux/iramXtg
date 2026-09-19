import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Car,
  User,
  Fuel,
  FileCheck2,
  Calendar,
  AlertCircle,
  FileCode,
  Building2,
  Phone,
  ShieldCheck
} from 'lucide-react';
import type { SearchResult } from '../types';

interface ResultViewerProps {
  result: SearchResult | null;
  isLoading: boolean;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ result, isLoading }) => {
  const [copied, setCopied] = useState(false);
  const [viewRawJson, setViewRawJson] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
        <h3 className="text-white font-medium text-base mb-1">Scanning OSINT Database...</h3>
        <p className="text-slate-400 text-xs max-w-sm mx-auto">
          Querying intelligence registries, telecom nodes, and vehicle databases.
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500">
        <FileCode className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <h3 className="text-slate-300 font-medium text-sm mb-1">Ready for Query</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Select a category above, input the target identifier, and click Search to retrieve records.
        </p>
      </div>
    );
  }

  const jsonString = JSON.stringify(result.data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.type}_${result.query.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check if result is empty or not found
  const isNotFound =
    !result.success ||
    !result.data ||
    (typeof result.data === 'object' && Object.keys(result.data).length === 0) ||
    result.data.error ||
    result.data.found === false;

  if (isNotFound) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-white font-semibold text-base mb-1">No Record Found</h3>
        <p className="text-slate-400 text-xs max-w-md mx-auto mb-4">
          No records matching <code className="text-amber-300 font-mono">{result.query}</code> were returned by the registry.
        </p>
        <div className="inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <span>Target: {result.type}</span>
          <span>•</span>
          <span>Time: {new Date(result.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    );
  }

  // Render Vehicle format if vehicle
  const renderVehicleData = (data: any) => {
    return (
      <div className="space-y-4">
        {/* Top summary card */}
        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-wider font-mono">
                {data.reg_number || result.query}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Owner: <strong className="text-slate-200">{data.owner_name || 'N/A'}</strong></span>
                {data.owner_count && <span>• {data.owner_count} Owner</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {data.rc_status || 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ownership */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Ownership & Jurisdiction
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Owner Name</span>
                <span className="text-slate-100 font-medium">{data.owner_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Masked Phone</span>
                <span className="text-slate-100 font-mono">{data.phone_masked || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">RTO Code</span>
                <span className="text-slate-100 font-mono">{data.rto_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">RTO Authority</span>
                <span className="text-slate-100">{data.rto_name || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Vehicle Specification */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" />
              Specification
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Make / Model</span>
                <span className="text-slate-100 font-medium">
                  {[data.make, data.model].filter(Boolean).join(' ') || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Variant & Year</span>
                <span className="text-slate-100">
                  {data.variant || 'Standard'} ({data.variant_year || 'N/A'})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Fuel & Emission</span>
                <span className="text-slate-100">
                  {data.fuel_type || 'N/A'} ({data.emission_norm || 'N/A'})
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Color & Body</span>
                <span className="text-slate-100">
                  {data.color || 'N/A'} • {data.body_type || data.vehicle_class || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Engine & Technical */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5" />
              Engine & Chassis
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Chassis Number</span>
                <span className="text-slate-100 font-mono">{data.chassis_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Engine Number</span>
                <span className="text-slate-100 font-mono">{data.engine_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Displacement (CC)</span>
                <span className="text-slate-100">{data.cubic_capacity ? `${data.cubic_capacity} cc` : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Gross Weight</span>
                <span className="text-slate-100">{data.gross_weight ? `${data.gross_weight} kg` : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Validity & Insurance */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Validity & Compliance
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Registration Date</span>
                <span className="text-slate-100">{data.registration_date || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Fitness Up To</span>
                <span className="text-slate-100">{data.fitness_upto || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Insurance Expiry</span>
                <span className="text-slate-100">{data.insurance_expiry || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Financer</span>
                <span className="text-slate-100 truncate max-w-[200px]">{data.financer || 'None / Cleared'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render GST by name data
  const renderGstByName = (data: any) => {
    const active = data.active_gstins || [];
    const cancelled = data.cancelled_gstins || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-300">Total Entities Found: <strong className="text-white">{data.total || active.length + cancelled.length}</strong></span>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Active: {active.length}</span>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">Cancelled: {cancelled.length}</span>
          </div>
        </div>

        {active.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Active GSTIN Registrations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {active.map((g: any, i: number) => (
                <div key={i} className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-1">
                  <div className="font-mono text-indigo-300 font-bold text-sm">{g.gstin}</div>
                  <div className="text-slate-200 font-medium">{g.legal_name || 'N/A'}</div>
                  {g.trade_name && <div className="text-slate-400 text-[11px]">Trade: {g.trade_name}</div>}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                    <span>State Code: {g.state_code || 'N/A'}</span>
                    <span className="text-emerald-400 font-medium">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cancelled.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cancelled Registrations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {cancelled.map((g: any, i: number) => (
                <div key={i} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-400">
                  {typeof g === 'object' ? g.gstin : g}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header bar */}
      <div className="bg-slate-950/70 px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            {result.type} Record
          </span>
          <span className="text-xs text-slate-500">•</span>
          <code className="text-xs text-indigo-300 font-mono">{result.query}</code>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle raw JSON */}
          <button
            id="toggle-raw-json-btn"
            onClick={() => setViewRawJson(!viewRawJson)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
              viewRawJson
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {viewRawJson ? 'Formatted View' : 'Raw JSON'}
          </button>

          {/* Copy button */}
          <button
            id="copy-result-btn"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition cursor-pointer"
            title="Copy JSON output"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Download button */}
          <button
            id="download-result-btn"
            onClick={handleDownload}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition cursor-pointer"
            title="Download JSON file"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6">
        {viewRawJson ? (
          <div className="relative">
            <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono overflow-x-auto max-h-[500px] border border-slate-800">
              {jsonString}
            </pre>
          </div>
        ) : result.type === 'vehicle' ? (
          renderVehicleData(result.data)
        ) : result.type === 'gst2name' ? (
          renderGstByName(result.data)
        ) : (
          <div className="space-y-4">
            <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono overflow-x-auto max-h-[480px] border border-slate-800 leading-relaxed">
              {jsonString}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

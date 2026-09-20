import React from 'react';
import {
  Car,
  Smartphone,
  CreditCard,
  Users,
  Vote,
  Flame,
  Building2,
  FileSpreadsheet,
  FileText,
  BadgePercent
} from 'lucide-react';
import type { LookupType, LookupOption, BotButton } from '../types';

export const LOOKUP_OPTIONS: LookupOption[] = [
  {
    id: 'vehicle',
    title: 'Vehicle RC',
    icon: 'Car',
    placeholder: 'Enter Vehicle Reg Number (e.g. HR26EV0001)',
    example: 'HR26EV0001',
    description: 'Owner name, chassis, engine, RTO code, fitness & insurance details.',
    category: 'vehicles',
  },
  {
    id: 'num2',
    title: 'Num2 Mobile',
    icon: 'Smartphone',
    placeholder: 'Enter 10-digit mobile number',
    example: '6399964669',
    description: 'Telecom database lookup for operator, subscriber and circle data.',
    category: 'telecom',
  },
  {
    id: 'aadhar2info',
    title: 'Aadhaar Info',
    icon: 'CreditCard',
    placeholder: 'Enter 12-digit Aadhaar number',
    example: '646858617313',
    description: 'Verify Aadhaar profile registration status and metadata.',
    category: 'identity',
  },
  {
    id: 'aadhar2family',
    title: 'Aadhaar Family',
    icon: 'Users',
    placeholder: 'Enter 12-digit Aadhaar number',
    example: '309484613752',
    description: 'Discover linked family members and associated household records.',
    category: 'identity',
  },
  {
    id: 'voter',
    title: 'Voter ID (EPIC)',
    icon: 'Vote',
    placeholder: 'Enter EPIC number (e.g. ZNO1150077)',
    example: 'ZNO1150077',
    description: 'Electoral card details, assembly constituency, polling station.',
    category: 'identity',
  },
  {
    id: 'lpg',
    title: 'LPG Gas',
    icon: 'Flame',
    placeholder: 'Enter 10-digit linked phone number',
    example: '9546585647',
    description: 'Consumer connection details from Indian Oil, Bharat Gas or HP Gas.',
    category: 'telecom',
  },
  {
    id: 'upi2num',
    title: 'UPI to Number',
    icon: 'CreditCard',
    placeholder: 'Enter UPI ID (e.g. username@bank)',
    example: 'sagar5973@ptyes',
    description: 'Resolve UPI virtual payment address to associated account or phone.',
    category: 'telecom',
  },
  {
    id: 'gst2name',
    title: 'GST by Name',
    icon: 'Building2',
    placeholder: 'Enter business or individual legal name',
    example: 'RUBINA AKBARALI ANSARI',
    description: 'Search active and cancelled GSTIN registrations by trade name.',
    category: 'business',
  },
  {
    id: 'gst2pan',
    title: 'GST by PAN',
    icon: 'FileSpreadsheet',
    placeholder: 'Enter 10-character PAN number',
    example: 'AXIPA2589D',
    description: 'Locate all GSTIN accounts registered under a Permanent Account Number.',
    category: 'business',
  },
  {
    id: 'gst',
    title: 'Full GSTIN Record',
    icon: 'FileText',
    placeholder: 'Enter 15-character GSTIN',
    example: '27AXIPA2589D1ZK',
    description: 'Complete registration status, jurisdiction, tax payer type & address.',
    category: 'business',
  },
];

interface LookupGridProps {
  selectedType: LookupType;
  onSelectType: (type: LookupType) => void;
  buttons?: BotButton[];
}

export const LookupGrid: React.FC<LookupGridProps> = ({ selectedType, onSelectType, buttons }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Car': return <Car className="w-5 h-5" />;
      case 'Smartphone': return <Smartphone className="w-5 h-5" />;
      case 'CreditCard': return <CreditCard className="w-5 h-5" />;
      case 'Users': return <Users className="w-5 h-5" />;
      case 'Vote': return <Vote className="w-5 h-5" />;
      case 'Flame': return <Flame className="w-5 h-5" />;
      case 'Building2': return <Building2 className="w-5 h-5" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-5 h-5" />;
      case 'FileText': return <FileText className="w-5 h-5" />;
      default: return <BadgePercent className="w-5 h-5" />;
    }
  };

  // If dynamic buttons are supplied, merge with base options or render enabled buttons
  const displayOptions: LookupOption[] = buttons && buttons.length > 0
    ? buttons
        .filter((b) => b.enabled)
        .map((b) => {
          const matched = LOOKUP_OPTIONS.find((o) => o.id === b.id);
          return {
            id: b.id,
            title: b.label,
            icon: matched ? matched.icon : 'BadgePercent',
            placeholder: b.placeholder || (matched ? matched.placeholder : `Enter ${b.label}`),
            example: b.example || (matched ? matched.example : ''),
            description: b.description || (matched ? matched.description : ''),
            category: (b.category as any) || 'custom',
            enabled: b.enabled,
            apiUrl: b.apiUrl,
            isCustom: b.isCustom,
          };
        })
    : LOOKUP_OPTIONS;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
      {displayOptions.map((item) => {
        const isSelected = selectedType === item.id;
        return (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            onClick={() => onSelectType(item.id)}
            className={`p-3 rounded-xl border text-left transition relative overflow-hidden group cursor-pointer ${
              isSelected
                ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isSelected && (
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-indigo-400 m-2" />
            )}
            <div className={`p-2 rounded-lg inline-flex mb-2 ${
              isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
            }`}>
              {getIcon(item.icon)}
            </div>
            <div className="font-semibold text-xs sm:text-sm text-slate-100 mb-0.5 truncate">
              {item.title}
            </div>
            <div className="text-[11px] text-slate-400 line-clamp-1">
              {item.placeholder.replace('Enter ', '')}
            </div>
          </button>
        );
      })}
    </div>
  );
};

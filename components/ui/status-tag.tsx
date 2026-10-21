import { Tag } from '@carbon/react';

type TagType = 'red' | 'magenta' | 'purple' | 'blue' | 'green' | 'gray' | 'warm-gray' | 'cyan';
const MAP: Record<string, { type: TagType; ar: string }> = {
  Draft: { type: 'gray', ar: 'مسودة' }, Approved: { type: 'blue', ar: 'معتمد' }, 'Partially received': { type: 'cyan', ar: 'مستلم جزئيًا' }, Received: { type: 'green', ar: 'مستلم' }, Cancelled: { type: 'red', ar: 'ملغى' },
  Available: { type: 'green', ar: 'متاح' }, Quarantined: { type: 'purple', ar: 'محجور' }, Depleted: { type: 'gray', ar: 'مستنفد' }, Discarded: { type: 'gray', ar: 'مُتلَف' },
  Expired: { type: 'red', ar: 'منتهي الصلاحية' }, 'Expiring soon': { type: 'magenta', ar: 'قارب على الانتهاء' }
};
// One status vocabulary → one Carbon tag colour and Arabic label across all modules.
export function StatusTag({ status, locale, suffix }: { status: string; locale: string; suffix?: string }) {
  const m = MAP[status] ?? { type: 'gray' as TagType, ar: status };
  return <Tag type={m.type} size="sm">{locale === 'ar' ? m.ar : status}{suffix ? ` · ${suffix}` : ''}</Tag>;
}

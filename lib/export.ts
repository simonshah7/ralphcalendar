import * as htmlToImage from 'html-to-image';

interface Activity {
  title: string;
  startDate: string;
  endDate: string;
  statusId: string | null;
  swimlaneId: string;
  campaignId: string | null;
  cost: string | null;
  currency: string | null;
  region: string | null;
  tags: string | null;
  description: string | null;
}

interface Named { id: string; name: string; }

export async function exportToPNG(
  element: HTMLElement,
  exportType: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const dataUrl = await htmlToImage.toPng(element, {
    backgroundColor: document.documentElement.classList.contains('dark') ? '#0c0a09' : '#fafaf9',
    quality: 1,
    style: { transform: 'scale(1)', transformOrigin: 'top left' },
  });
  const link = document.createElement('a');
  link.download = `campaignos-${exportType}-export-${startDate}-to-${endDate}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToCSV(
  activities: Activity[],
  statuses: Named[],
  swimlanes: Named[],
  campaigns: Named[],
  startDate: string,
  endDate: string
): void {
  const activitiesToExport = activities.filter(
    (a) => a.startDate <= endDate && a.endDate >= startDate
  );

  const headers = [
    'Title', 'Start Date', 'End Date', 'Status', 'Swimlane',
    'Campaign', 'Cost', 'Currency', 'Region', 'Tags', 'Description',
  ];

  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n'))
      return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const csvContent = [
    headers.join(','),
    ...activitiesToExport.map((a) => {
      const status = statuses.find((s) => s.id === a.statusId)?.name || '';
      const swimlane = swimlanes.find((s) => s.id === a.swimlaneId)?.name || '';
      const campaign = campaigns.find((c) => c.id === a.campaignId)?.name || 'N/A';
      return [
        escapeCSV(a.title), escapeCSV(a.startDate), escapeCSV(a.endDate),
        escapeCSV(status), escapeCSV(swimlane), escapeCSV(campaign),
        escapeCSV(a.cost), escapeCSV(a.currency), escapeCSV(a.region || ''),
        escapeCSV(a.tags || ''), escapeCSV(a.description || ''),
      ].join(',');
    }),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `campaignos-activities-${startDate}-to-${endDate}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

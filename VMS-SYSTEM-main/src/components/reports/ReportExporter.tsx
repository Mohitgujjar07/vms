import React, { useState } from 'react';
import { Visit, Branch } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { X, FileText, FileSpreadsheet } from 'lucide-react';

interface ReportExporterProps {
  scope: 'branch' | 'college' | 'platform';
  targetName: string;
  visits: Visit[];
  branches?: Branch[];
  onClose: () => void;
}

export const ReportExporter: React.FC<ReportExporterProps> = ({ scope, targetName, visits, branches, onClose }) => {
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'monthly' | 'yearly' | 'custom_range'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredVisits = visits.filter(v => {
    if (filterType === 'all') return true;
    const vDate = new Date(v.check_in_time);
    const target = new Date(selectedDate);
    if (filterType === 'daily') return vDate.toDateString() === target.toDateString();
    if (filterType === 'monthly') return vDate.getMonth() === target.getMonth() && vDate.getFullYear() === target.getFullYear();
    if (filterType === 'yearly') return vDate.getFullYear() === target.getFullYear();
    if (filterType === 'custom_range') {
      const s = new Date(startDate);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      return vDate >= s && vDate <= e;
    }
    return true;
  });

  const totalVisitors = filteredVisits.length;
  const activeCount = filteredVisits.filter(v => v.status === 'inside').length;
  const completedCount = filteredVisits.filter(v => v.status === 'checked_out').length;

  const calculateDuration = (cin: string, cout?: string | null) => {
    if (!cout) return 'Active';
    const mins = Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 60000);
    const h = Math.floor(mins / 60); const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(9); doc.setTextColor(128, 0, 128); doc.setFont('helvetica', 'bold');
    doc.text('VIDYAVAHINI GROUP', 14, 15);
    doc.setFontSize(15); doc.setTextColor(74, 18, 74);
    doc.text('VAISIRI INSTITUTE OF MANAGEMENT & TECHNOLOGY', 14, 22);
    doc.setFontSize(9); doc.setTextColor(100, 110, 120); doc.setFont('helvetica', 'normal');
    doc.text('2nd Stage, Sri Sharadadevi Nagar, Sai Baba Temple Road, Tumkur – 572103', 14, 28);
    doc.text('Approved by AICTE • Affiliated to Tumkur University • Recognized by Govt. of Karnataka', 14, 33);
    doc.setDrawColor(128, 0, 128); doc.setLineWidth(0.8); doc.line(14, 36, 196, 36);
    doc.setFontSize(11); doc.setTextColor(30, 40, 50); doc.setFont('helvetica', 'bold');
    doc.text(`Official Visitor Log Report — ${targetName}`, 14, 44);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.text(`Scope: ${scope.toUpperCase()} | Filter: ${filterType.toUpperCase()} | Generated: ${new Date().toLocaleString()}`, 14, 50);
    doc.text(`Total: ${totalVisitors} | Inside: ${activeCount} | Completed: ${completedCount}`, 14, 55);

    autoTable(doc, {
      startY: 60,
      head: [['#', 'Visitor', 'Phone', 'Purpose', 'Host', 'Check-In', 'Check-Out', 'Duration', 'Rating', 'Feedback Comment']],
      body: filteredVisits.map((v, i) => [
        i + 1,
        v.visitor_name || 'Visitor',
        v.visitor_phone || '',
        v.purpose || 'Visit',
        v.host_name || 'Host',
        new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        v.check_out_time ? new Date(v.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        calculateDuration(v.check_in_time, v.check_out_time),
        v.rating ? `${v.rating} Stars` : '-',
        v.feedback_comment || '-'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [74, 18, 74], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(9); doc.setTextColor(80, 90, 100);
    doc.text('Prepared by VMS Front Desk System', 14, finalY + 20);
    doc.text('Principal Signature: _______________________', 105, finalY + 20);
    doc.save(`VIMTECH_Report_${targetName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  };

  const sanitizeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  };

  const exportExcel = () => {
    const data = filteredVisits.map((v, i) => ({
      'Sl No': i + 1,
      'College': 'VIMTECH',
      'Branch': sanitizeCell(targetName),
      'Visitor': sanitizeCell(v.visitor_name),
      'Phone': sanitizeCell(v.visitor_phone),
      'Purpose': sanitizeCell(v.purpose),
      'Host': sanitizeCell(v.host_name),
      'Department': sanitizeCell(v.host_department),
      'Status': sanitizeCell(v.status),
      'Check-In': new Date(v.check_in_time).toLocaleString(),
      'Check-Out': v.check_out_time ? new Date(v.check_out_time).toLocaleString() : 'N/A',
      'Duration': calculateDuration(v.check_in_time, v.check_out_time),
      'Rating (1-5)': v.rating ? `${v.rating} Stars` : 'N/A',
      'Feedback Comments': sanitizeCell(v.feedback_comment || 'N/A'),
      'Token': sanitizeCell(v.qr_token)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VIMTECH Log');
    XLSX.writeFile(wb, `VIMTECH_Export_${Date.now()}.xlsx`);
  };

  return (
    <div className="vms-modal-overlay animate-fadeIn">
      <div className="vms-modal max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div><h3 className="font-heading font-bold text-lg text-gray-900">Generate Reports</h3><p className="text-xs text-gray-500">Branded PDF & Excel for {targetName}</p></div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Time Filter</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-full vms-input text-xs font-semibold">
              <option value="all">All Historical Records</option>
              <option value="daily">Single Day</option>
              <option value="monthly">Single Month</option>
              <option value="yearly">Single Year</option>
              <option value="custom_range">Custom Date Range (Start — End)</option>
            </select>
          </div>
          {filterType !== 'all' && filterType !== 'custom_range' && (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full vms-input text-xs" />
          )}
          {filterType === 'custom_range' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">From Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full vms-input text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">To Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full vms-input text-xs" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center text-xs vms-card p-3">
            <div><p className="text-gray-500">Matched</p><p className="font-bold text-gray-900 text-sm">{totalVisitors}</p></div>
            <div><p className="text-gray-500">Inside</p><p className="font-bold text-green-600 text-sm">{activeCount}</p></div>
            <div><p className="text-gray-500">Closed</p><p className="font-bold text-[#800080] text-sm">{completedCount}</p></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button onClick={exportPDF} className="vms-btn-primary text-xs flex items-center justify-center gap-2"><FileText className="w-4 h-4" /> PDF Report</button>
          <button onClick={exportExcel} className="vms-btn-secondary text-xs flex items-center justify-center gap-2 !bg-green-50 !text-green-700 !border-green-200"><FileSpreadsheet className="w-4 h-4" /> Excel Export</button>
        </div>
      </div>
    </div>
  );
};

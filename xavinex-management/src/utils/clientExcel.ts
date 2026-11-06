import ExcelJS from 'exceljs';
import type { Client, FinancialAccount } from '../types';
import { businessDate } from './formatters';

export async function createClientExcel(clients: Client[], accounts: FinancialAccount[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Xavinex Management';
  const sheet = workbook.addWorksheet('Clients', { views: [{ state: 'frozen', ySplit: 1 }] });
  const columns: { header: string; key: string; width: number }[] = [
    { header: 'Client Name', key: 'name', width: 28 },
    { header: 'Fiverr Username', key: 'fiverrUsername', width: 23 },
    { header: 'Company Name', key: 'companyName', width: 28 },
    { header: 'Email Address', key: 'email', width: 32 },
    { header: 'Country', key: 'country', width: 20 },
    { header: 'Phone Number', key: 'phone', width: 24 },
    { header: 'Address', key: 'address', width: 45 },
    { header: 'LinkedIn Profile URL', key: 'linkedinUrl', width: 45 },
    { header: 'Live Project Link', key: 'liveProjectUrl', width: 45 },
    { header: 'Any Other Profile', key: 'otherProfile', width: 45 },
    { header: 'Linked Fiverr Account', key: 'linkedAccount', width: 28 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Notes', key: 'notes', width: 45 },
    { header: 'Created At', key: 'createdAt', width: 27 },
    { header: 'Client ID', key: 'id', width: 38 },
  ];
  sheet.columns = columns;
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  for (const client of clients) {
    const values = { ...client, linkedAccount: accountNames.get(client.linkedFiverrAccountId) || client.linkedFiverrAccountId };
    // Explicit strings preserve phone prefixes, Unicode, line breaks and leading
    // zeroes. User data is never interpreted as an Excel formula or hyperlink.
    sheet.addRow(columns.map(column => String(values[column.key as keyof typeof values] ?? '')));
  }
  sheet.eachRow(row => row.eachCell(cell => { cell.numFmt = '@'; cell.alignment = { vertical: 'top', wrapText: true }; }));
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(sheet.rowCount, 1), column: columns.length } };
  return workbook.xlsx.writeBuffer();
}

export function downloadClientExcel(buffer: Awaited<ReturnType<typeof createClientExcel>>) {
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Xavinex_Clients_${businessDate()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

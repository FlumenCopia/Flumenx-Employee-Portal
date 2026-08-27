import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface SalaryBreakdown {
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  joiningDate?: string;
  month: number;
  year: number;
  basicSalary: number;
  hra: number;
  conveyance: number;
  allowances: number;
  pf: number;
  tax: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  bankName?: string;
  accountNo?: string;
  daysWorked?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function numberToWords(num: number): string {
  if (!num || num === 0) return 'Rupees Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  }

  return 'Rupees ' + inWords(Math.floor(num)) + ' Only';
}

export async function generatePdfSalarySlip(
  data: SalaryBreakdown,
  outputFilePath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(outputFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // A4 page setup: 595.28 x 841.89 points
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(outputFilePath);
      doc.pipe(stream);

      // --- Executive Corporate Palette (Monochrome & Slate Accent) ---
      const NAVY_MAIN = '#0F172A';
      const SLATE_DARK = '#334155';
      const SLATE_LIGHT = '#F1F5F9';
      const BORDER_DARK = '#CBD5E1';
      const TEXT_MAIN = '#0F172A';
      const TEXT_MUTED = '#475569';

      const monthName = MONTH_NAMES[data.month - 1] || 'Month';

      // --- 1. Top Header with Official FLUMENX Logo ---
      const officialLogo = path.join(process.cwd(), '..', 'frontend', 'public', 'flumenx-dashboard-official-logo.png');
      const markLogo = path.join(process.cwd(), '..', 'frontend', 'public', 'flumenx-mark-only.png');
      
      let hasLogo = false;
      if (fs.existsSync(officialLogo)) {
        try {
          doc.image(officialLogo, 40, 35, { height: 32 });
          hasLogo = true;
        } catch {
          hasLogo = false;
        }
      }

      if (!hasLogo && fs.existsSync(markLogo)) {
        try {
          doc.image(markLogo, 40, 35, { height: 32 });
          hasLogo = true;
        } catch {
          hasLogo = false;
        }
      }

      if (!hasLogo) {
        doc.fillColor(NAVY_MAIN).fontSize(20).font('Helvetica-Bold').text('FLUMENX', 40, 38);
      }

      // Corporate Address (Right Aligned)
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(11).text('FLUMENX TECHNOLOGIES PVT. LTD.', 300, 35, { align: 'right' });
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8.5)
         .text('Enterprise Tech Park, Suite 402 • Reg. No: FLX-2024-99', 300, 49, { align: 'right' })
         .text('Email: hr@flumenx.com • Website: www.flumenx.com', 300, 60, { align: 'right' });

      // Header Separator Line
      doc.moveTo(40, 78).lineTo(555, 78).strokeColor(NAVY_MAIN).lineWidth(1.5).stroke();

      // --- 2. Payslip Document Title Block ---
      doc.rect(40, 86, 515, 24).fill(SLATE_LIGHT);
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(11)
         .text(`PAYSLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${data.year}`, 40, 93, { align: 'center' });

      // --- 3. Employee Metadata Table ---
      const metaTop = 118;
      doc.rect(40, metaTop, 515, 78).strokeColor(BORDER_DARK).lineWidth(1).stroke();

      doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(9);

      // Col 1
      doc.text('Employee Name :', 50, metaTop + 10);
      doc.font('Helvetica').text(data.employeeName, 135, metaTop + 10);

      doc.font('Helvetica-Bold').text('Employee Code :', 50, metaTop + 30);
      doc.font('Helvetica').text(data.employeeCode || 'EMP-1001', 135, metaTop + 30);

      doc.font('Helvetica-Bold').text('Department :', 50, metaTop + 50);
      doc.font('Helvetica').text(data.department || 'Management', 135, metaTop + 50);

      // Col 2
      doc.font('Helvetica-Bold').text('Designation :', 310, metaTop + 10);
      doc.font('Helvetica').text(data.designation || 'Staff Member', 395, metaTop + 10);

      doc.font('Helvetica-Bold').text('Bank Account :', 310, metaTop + 30);
      doc.font('Helvetica').text(data.accountNo || 'XXXX XXXX 4821', 395, metaTop + 30);

      doc.font('Helvetica-Bold').text('Paid Days :', 310, metaTop + 50);
      doc.font('Helvetica').text(`${data.daysWorked || 30} Days`, 395, metaTop + 50);

      // --- 4. Earnings & Deductions Table Header ---
      const tableTop = 206;
      const colW = 257.5;

      // Table Header Row
      doc.rect(40, tableTop, colW, 22).fill(SLATE_DARK);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5).text('EARNINGS', 50, tableTop + 6);
      doc.text('AMOUNT (INR)', 190, tableTop + 6, { align: 'right' });

      doc.rect(297.5, tableTop, colW, 22).fill(SLATE_DARK);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5).text('DEDUCTIONS', 307.5, tableTop + 6);
      doc.text('AMOUNT (INR)', 447.5, tableTop + 6, { align: 'right' });

      // Table Rows
      let rowY = tableTop + 22;
      const rows = [
        { earnLabel: 'Basic Salary', earnVal: data.basicSalary, dedLabel: 'Provident Fund (PF)', dedVal: data.pf },
        { earnLabel: 'House Rent Allowance (HRA)', earnVal: data.hra, dedLabel: 'Professional Tax / TDS', dedVal: data.tax },
        { earnLabel: 'Conveyance Allowance', earnVal: data.conveyance, dedLabel: 'Other Deductions', dedVal: data.deductions },
        { earnLabel: 'Special Allowances', earnVal: data.allowances, dedLabel: '', dedVal: 0 },
      ];

      rows.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        
        // Left (Earnings)
        doc.rect(40, rowY, colW, 22).fillAndStroke(bg, BORDER_DARK);
        doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(9).text(r.earnLabel, 50, rowY + 6);
        doc.font('Helvetica-Bold').text(r.earnVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 180, rowY + 6, { width: 105, align: 'right' });

        // Right (Deductions)
        doc.rect(297.5, rowY, colW, 22).fillAndStroke(bg, BORDER_DARK);
        if (r.dedLabel) {
          doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(9).text(r.dedLabel, 307.5, rowY + 6);
          doc.font('Helvetica-Bold').text(r.dedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 437.5, rowY + 6, { width: 105, align: 'right' });
        }

        rowY += 22;
      });

      // Gross / Total Row
      const totalEarn = data.basicSalary + data.hra + data.conveyance + data.allowances;
      const totalDed = data.pf + data.tax + data.deductions;

      doc.rect(40, rowY, colW, 24).fillAndStroke(SLATE_LIGHT, BORDER_DARK);
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(9.5).text('GROSS EARNINGS', 50, rowY + 7);
      doc.font('Helvetica-Bold').text(`INR ${totalEarn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 170, rowY + 7, { width: 115, align: 'right' });

      doc.rect(297.5, rowY, colW, 24).fillAndStroke(SLATE_LIGHT, BORDER_DARK);
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(9.5).text('TOTAL DEDUCTIONS', 307.5, rowY + 7);
      doc.font('Helvetica-Bold').text(`INR ${totalDed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 427.5, rowY + 7, { width: 115, align: 'right' });

      rowY += 34;

      // --- 5. Net Salary Box ---
      const netSalary = totalEarn - totalDed;
      const inWordsStr = numberToWords(netSalary);

      doc.rect(40, rowY, 515, 42).fillAndStroke('#FFFFFF', BORDER_DARK);
      
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(10).text('NET PAYABLE SALARY :', 50, rowY + 14);
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(13).text(`INR ${netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 350, rowY + 13, { width: 195, align: 'right' });

      // Amount in words
      rowY += 50;
      doc.rect(40, rowY, 515, 22).fill(SLATE_LIGHT);
      doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(8.5).text('Amount in Words :', 50, rowY + 6);
      doc.fillColor(NAVY_MAIN).font('Helvetica-Bold').fontSize(8.5).text(inWordsStr, 135, rowY + 6);

      rowY += 40;

      // --- 6. Signatures & Digital Seal ---
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8.5).text('Prepared By: Finance / Payroll Dept', 50, rowY);
      doc.text('Authorized Signatory', 430, rowY, { align: 'right' });

      doc.moveTo(430, rowY - 5).lineTo(545, rowY - 5).strokeColor(BORDER_DARK).lineWidth(0.8).stroke();

      rowY += 30;
      doc.moveTo(40, rowY).lineTo(555, rowY).strokeColor(BORDER_DARK).lineWidth(1).stroke();
      rowY += 10;

      doc.fillColor(TEXT_MUTED).font('Helvetica-Oblique').fontSize(8)
         .text('This document is electronically generated by FLUMENX Portal. No physical signature is required.', 40, rowY, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(outputFilePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

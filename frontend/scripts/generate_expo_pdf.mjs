import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

async function generateMastersExpoTemplate() {
  const doc = await PDFDocument.create();
  // Standard A4 Portrait: 595.28 x 841.89 points
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Embed standard fonts
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Color Palette - Refined Professional Emerald/Forest Green Brand
  const cDarkGreen = rgb(0.04, 0.28, 0.18);      // #0A472E - Primary Dark Header
  const cForest = rgb(0.06, 0.42, 0.28);         // #0F6B47 - Brand Green Accent
  const cEmerald = rgb(0.1, 0.65, 0.42);         // #1AA66B - Vibrant Green
  const cGold = rgb(0.82, 0.68, 0.2);            // #D1AE33 - Elegant Gold Accent
  const cTextDark = rgb(0.12, 0.15, 0.18);       // #1F262E - Deep Charcoal
  const cTextMuted = rgb(0.42, 0.46, 0.52);      // #6B7584 - Slate Muted
  const cSidebarBg = rgb(0.96, 0.97, 0.98);      // #F5F7FA - Sleek Modern Sidebar
  const cBorder = rgb(0.85, 0.88, 0.92);         // #D9E0EB - Clean Border
  const cCardBg = rgb(0.98, 0.99, 1.0);          // #FAFCFF - Stall Card Bg

  // =========================================================================
  // 1. TOP BANNER & BRAND HEADER
  // =========================================================================
  page.drawRectangle({
    x: 0,
    y: height - 68,
    width: width,
    height: 68,
    color: cDarkGreen,
  });

  page.drawRectangle({
    x: 0,
    y: height - 70,
    width: width,
    height: 2,
    color: cGold,
  });

  // Load official Masters Expo 2026 logo from user-provided PDF
  let embeddedLogo = null;
  try {
    const logoPdfBytes = fs.readFileSync("public/masters_logo.pdf");
    const logoDoc = await PDFDocument.load(logoPdfBytes);
    const [logoPage] = await doc.embedPdf(logoDoc, [0]);
    embeddedLogo = logoPage;
  } catch (err) {
    console.warn("Could not embed masters_logo.pdf:", err);
  }

  // Top Banner Content - Official Logo
  if (embeddedLogo) {
    const logoH = 52;
    const logoW = (logoH * 841.92) / 396.24; // ~110.5pt
    page.drawPage(embeddedLogo, {
      x: 16,
      y: height - 62,
      width: logoW,
      height: logoH,
    });

    page.drawText("MASTERS", {
      x: 16 + logoW + 10,
      y: height - 32,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("MINISTRY APPROVED SOLAR TRADERS", {
      x: 16 + logoW + 10,
      y: height - 46,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.8, 0.95, 0.88),
    });
  } else {
    page.drawText("MASTERS", {
      x: 30,
      y: height - 34,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("MINISTRY APPROVED SOLAR TRADERS", {
      x: 30,
      y: height - 48,
      size: 8,
      font: fontRegular,
      color: rgb(0.8, 0.95, 0.88),
    });
  }

  // Top Banner Content - Right Badge
  page.drawRectangle({
    x: width - 180,
    y: height - 56,
    width: 165,
    height: 44,
    color: rgb(0.02, 0.2, 0.12),
    borderColor: cForest,
    borderWidth: 1,
  });
  page.drawText("EXPO/2.0/2026", {
    x: width - 170,
    y: height - 26,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("LULU MALL, TVM", {
    x: width - 170,
    y: height - 39,
    size: 8.5,
    font: fontBold,
    color: rgb(0.85, 0.95, 0.88),
  });
  page.drawText("25th - 27th September", {
    x: width - 170,
    y: height - 50,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.7, 0.85, 0.78),
  });

  // =========================================================================
  // 2. LEFT SIDEBAR (Width: 168pt)
  // =========================================================================
  const sidebarWidth = 168;
  const sidebarTop = height - 70;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: sidebarWidth,
    height: sidebarTop,
    color: cSidebarBg,
  });

  page.drawLine({
    start: { x: sidebarWidth, y: 0 },
    end: { x: sidebarWidth, y: sidebarTop },
    thickness: 1,
    color: cBorder,
  });

  const drawSidebarDot = (y) => {
    page.drawCircle({
      x: 18,
      y: y + 3,
      size: 4,
      color: cForest,
    });
    page.drawCircle({
      x: 18,
      y: y + 3,
      size: 2,
      color: cEmerald,
    });
  };

  // Section 1: Dates
  let curY = sidebarTop - 24;
  drawSidebarDot(curY);
  page.drawText("25 - 27 September 2026", { x: 28, y: curY, size: 9, font: fontBold, color: cTextDark });
  page.drawText("Three Day Exhibition", { x: 28, y: curY - 11, size: 7.5, font: fontRegular, color: cTextMuted });

  // Section 2: Venue
  curY -= 28;
  drawSidebarDot(curY);
  page.drawText("LULU MALL TRIVANDRUM", { x: 28, y: curY, size: 8.5, font: fontBold, color: cTextDark });
  page.drawText("Trivandrum, Kerala", { x: 28, y: curY - 11, size: 7.5, font: fontRegular, color: cTextMuted });

  // Section 3: Visitors
  curY -= 28;
  drawSidebarDot(curY);
  page.drawText("20,000+ Visitors", { x: 28, y: curY, size: 9, font: fontBold, color: cTextDark });
  page.drawText("Industry & Public", { x: 28, y: curY - 11, size: 7.5, font: fontRegular, color: cTextMuted });

  // Divider
  curY -= 18;
  page.drawLine({ start: { x: 14, y: curY }, end: { x: sidebarWidth - 14, y: curY }, thickness: 0.8, color: cBorder });

  // Section 4: PILLARS
  curY -= 16;
  drawSidebarDot(curY);
  page.drawText("PILLARS", { x: 28, y: curY, size: 8.5, font: fontBold, color: cForest });

  const drawChip = (label, x, y, w) => {
    page.drawRectangle({
      x,
      y: y - 3,
      width: w,
      height: 14,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.8, 0.85, 0.82),
      borderWidth: 0.8,
    });
    page.drawText(label, { x: x + 4, y: y + 1, size: 7, font: fontRegular, color: cTextDark });
  };

  curY -= 15;
  drawChip("SOLAR", 26, curY, 36);
  drawChip("Storage", 66, curY, 44);
  drawChip("EV", 114, curY, 24);

  curY -= 18;
  drawChip("Conferences", 26, curY, 56);
  drawChip("Seminars", 86, curY, 48);

  curY -= 18;
  drawChip("Job Fair", 26, curY, 42);
  drawChip("Energy Conclave", 72, curY, 74);

  // Divider
  curY -= 16;
  page.drawLine({ start: { x: 14, y: curY }, end: { x: sidebarWidth - 14, y: curY }, thickness: 0.8, color: cBorder });

  // Section 5: OFFICE BEARERS
  curY -= 16;
  drawSidebarDot(curY);
  page.drawText("OFFICE BEARERS", { x: 28, y: curY, size: 8.5, font: fontBold, color: cForest });

  curY -= 13;
  page.drawText("President", { x: 28, y: curY, size: 7, font: fontRegular, color: cTextMuted });
  page.drawText("Noufal Rosaiz", { x: 28, y: curY - 9, size: 8, font: fontBold, color: cTextDark });

  curY -= 22;
  page.drawText("Secretary", { x: 28, y: curY, size: 7, font: fontRegular, color: cTextMuted });
  page.drawText("Lijo JC", { x: 28, y: curY - 9, size: 8, font: fontBold, color: cTextDark });

  curY -= 22;
  page.drawText("Treasurer", { x: 28, y: curY, size: 7, font: fontRegular, color: cTextMuted });
  page.drawText("Rajesh", { x: 28, y: curY - 9, size: 8, font: fontBold, color: cTextDark });

  // Divider
  curY -= 16;
  page.drawLine({ start: { x: 14, y: curY }, end: { x: sidebarWidth - 14, y: curY }, thickness: 0.8, color: cBorder });

  // Section 6: CONTACT
  curY -= 16;
  drawSidebarDot(curY);
  page.drawText("CONTACT", { x: 28, y: curY, size: 8.5, font: fontBold, color: cForest });

  curY -= 13;
  page.drawText("Sasi kumar B", { x: 28, y: curY, size: 8, font: fontBold, color: cTextDark });
  page.drawText("Expo Committee Chairman", { x: 28, y: curY - 9, size: 7, font: fontRegular, color: cTextMuted });

  curY -= 22;
  page.drawText("Shiyas Maheen", { x: 28, y: curY, size: 8, font: fontBold, color: cTextDark });
  page.drawText("Expo Coordinator", { x: 28, y: curY - 9, size: 7, font: fontRegular, color: cTextMuted });
  page.drawText("+91 91883 41489", { x: 28, y: curY - 18, size: 7, font: fontRegular, color: cTextDark });
  page.drawText("+91 99955 21091", { x: 28, y: curY - 26, size: 7, font: fontRegular, color: cTextDark });
  page.drawText("mastersinfo2022@gmail.com", { x: 28, y: curY - 35, size: 6.8, font: fontRegular, color: cForest });

  // Divider
  curY -= 44;
  page.drawLine({ start: { x: 14, y: curY }, end: { x: sidebarWidth - 14, y: curY }, thickness: 0.8, color: cBorder });

  // Section 7: ENERGY CONCLAVE CONVENOR
  curY -= 16;
  drawSidebarDot(curY);
  page.drawText("ENERGY CONCLAVE", { x: 28, y: curY, size: 8, font: fontBold, color: cForest });
  page.drawText("CONVENOR", { x: 28, y: curY - 9, size: 7.5, font: fontBold, color: cForest });

  curY -= 22;
  page.drawText("Shiyas Maheen", { x: 28, y: curY, size: 7.8, font: fontBold, color: cTextDark });
  page.drawText("+91 91883 41489  |  +91 99955 21091", { x: 28, y: curY - 9, size: 6.5, font: fontRegular, color: cTextDark });

  curY -= 20;
  page.drawText("Aseem", { x: 28, y: curY, size: 7.8, font: fontBold, color: cTextDark });
  page.drawText("+91 99955 21091", { x: 28, y: curY - 9, size: 6.5, font: fontRegular, color: cTextDark });

  curY -= 20;
  page.drawText("Akash AG", { x: 28, y: curY, size: 7.8, font: fontBold, color: cTextDark });
  page.drawText("+91 86068 85072", { x: 28, y: curY - 9, size: 6.5, font: fontRegular, color: cTextDark });

  // =========================================================================
  // 3. MAIN CONTENT BODY (x: 192 to 570pt)
  // =========================================================================
  const contentX = 192;
  const contentWidth = width - contentX - 25; // 378.28pt

  // Date top right
  page.drawText("21 September 2026", {
    x: width - 145,
    y: 749.89,
    size: 9.5,
    font: fontBold,
    color: cTextDark,
  });

  // Subject Header
  page.drawText("Subject: Confirmation of Participation and Stall Allocation -", {
    x: contentX,
    y: 698,
    size: 10,
    font: fontBold,
    color: cTextDark,
  });
  page.drawText("Kerala RE2.OEXPO26", {
    x: contentX,
    y: 685,
    size: 10,
    font: fontBold,
    color: cForest,
  });

  // Salutation
  page.drawText("Dear Sir/Madam,", {
    x: contentX,
    y: 658,
    size: 9.5,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("Greetings from MASTERS - MINISTRY APPROVED SOLAR TRADERS", {
    x: contentX,
    y: 641,
    size: 9.5,
    font: fontBold,
    color: cForest,
  });

  // NOTE: Paragraph 1 (We are pleased to confirm...) is deliberately left
  // to be rendered dynamically by the tool with the reflowing companyName
  // so there is ZERO overlap, ZERO double-text, and clean line-wrapping!

  // Paragraph 2
  page.drawText("We are pleased to confirm that the following exhibition space has been", {
    x: contentX,
    y: 574,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("allocated to your organization:", {
    x: contentX,
    y: 561,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  // =========================================================================
  // 4. STALL ALLOCATION CARD (Premium Elevated Design)
  // =========================================================================
  const cardY = 466;
  const cardHeight = 84;
  page.drawRectangle({
    x: contentX,
    y: cardY,
    width: contentWidth,
    height: cardHeight,
    color: cCardBg,
    borderColor: rgb(0.82, 0.9, 0.85),
    borderWidth: 1.2,
  });

  // Left vertical accent bar on card
  page.drawRectangle({
    x: contentX,
    y: cardY,
    width: 4,
    height: cardHeight,
    color: cForest,
  });

  // Card Static Labels (Values are filled dynamically by tool at exact spots)
  const cardTextX = contentX + 16;
  page.drawText("Stall Number:", { x: cardTextX, y: 533, size: 9, font: fontBold, color: cTextDark });
  page.drawText("Stall Category:", { x: cardTextX, y: 515, size: 9, font: fontBold, color: cTextDark });
  page.drawText("Exact Stall Dimensions:", { x: cardTextX, y: 497, size: 9, font: fontBold, color: cTextDark });
  page.drawText("Total Stall Area:", { x: cardTextX, y: 479, size: 9, font: fontBold, color: cTextDark });

  // =========================================================================
  // 5. REMAINING TERMS & SIGN-OFF
  // =========================================================================
  page.drawText("The above stall space has been reserved exclusively for your organization's", {
    x: contentX,
    y: 450,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("participation in KERALA RE 2.0 Expo 26.", {
    x: contentX,
    y: 437,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("We request you to ensure that your stall design and construction activities", {
    x: contentX,
    y: 418,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("comply with the exhibition guidelines and safety requirements. All exhibitors", {
    x: contentX,
    y: 405,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("undertaking custom fabrication or special stall construction must obtain", {
    x: contentX,
    y: 392,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("prior approval from the Expo Organizing Committee before commencing", {
    x: contentX,
    y: 379,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("installation.", {
    x: contentX,
    y: 366,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("Please submit your stall design, including the proposed structure and total", {
    x: contentX,
    y: 348,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("electrical power requirement, for approval before installation.", {
    x: contentX,
    y: 335,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("Your acceptance to participating in the KERALA RE 2.0 Expo26 is subject to", {
    x: contentX,
    y: 317,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("the Guidelines of the Expo.", {
    x: contentX,
    y: 304,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("We look forward to your valuable participation and contribution towards", {
    x: contentX,
    y: 286,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("making KERALA RE2.0 Expo 26 a successful platform for the renewable", {
    x: contentX,
    y: 273,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("energy industry.", {
    x: contentX,
    y: 260,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("Thank you for your cooperation and support.", {
    x: contentX,
    y: 242,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("Yours faithfully,", {
    x: contentX,
    y: 224,
    size: 9,
    font: fontRegular,
    color: cTextDark,
  });

  page.drawText("For MASTERS - MINISTRY APPROVED SOLAR TRADERS", {
    x: contentX,
    y: 206,
    size: 9.5,
    font: fontBold,
    color: cForest,
  });

  page.drawText("Shiyas Maheen", {
    x: contentX,
    y: 184,
    size: 10,
    font: fontBold,
    color: cTextDark,
  });
  page.drawText("Expo Coordinator - KERALA RE 2.0 Expo 26", {
    x: contentX,
    y: 171,
    size: 8.5,
    font: fontRegular,
    color: cTextMuted,
  });
  page.drawText("+91 91883 41489", {
    x: contentX,
    y: 158,
    size: 8.5,
    font: fontRegular,
    color: cTextDark,
  });
  page.drawText("mastersinfo2022@gmail.com", {
    x: contentX,
    y: 145,
    size: 8.5,
    font: fontRegular,
    color: cForest,
  });

  // Save the PDF
  const pdfBytes = await doc.save();
  const outPdfPath = path.resolve("public/MASTERS_EXPO_2026_Template.pdf");
  fs.writeFileSync(outPdfPath, pdfBytes);
  console.log(`Saved template PDF to ${outPdfPath} (${pdfBytes.length} bytes)`);

  // =========================================================================
  // 6. GENERATE MATCHING EXCEL & CSV DATA
  // =========================================================================
  const exhibitors = [
    {
      companyName: "SEMICON SOLAR PVT LTD",
      stallNo: "G1",
      category: "Gold",
      dimension: "8 metres x 4 metres",
      area: "32 sq. metres",
    },
    {
      companyName: "SunPower Green Energy Ltd",
      stallNo: "A-12",
      category: "Solar PV Pavilion",
      dimension: "3 metres x 3 metres",
      area: "9 sq. metres",
    },
    {
      companyName: "Tata Power Solar Systems & Green Renewable Energy Private Limited",
      stallNo: "B-04",
      category: "Diamond Sponsor Pavilion",
      dimension: "6 metres x 6 metres",
      area: "36 sq. metres",
    },
    {
      companyName: "Adani Solar Technologies Ltd",
      stallNo: "C-18",
      category: "Inverters & Storage",
      dimension: "4 metres x 3 metres",
      area: "12 sq. metres",
    },
    {
      companyName: "Waaree Energies Limited",
      stallNo: "A-08",
      category: "Solar Modules & Cells",
      dimension: "3 metres x 3 metres",
      area: "9 sq. metres",
    },
    {
      companyName: "Vikram Solar Private Limited",
      stallNo: "D-02",
      category: "EV & Energy Storage",
      dimension: "5 metres x 4 metres",
      area: "20 sq. metres",
    },
    {
      companyName: "Loom Solar Pvt Ltd",
      stallNo: "B-15",
      category: "Rooftop Solar Solutions",
      dimension: "3 metres x 3 metres",
      area: "9 sq. metres",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exhibitors);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stall_Allocations");

  const outXlsxPath = path.resolve("public/MASTERS_EXPO_2026_Data.xlsx");
  XLSX.writeFile(wb, outXlsxPath);
  console.log(`Saved Excel data to ${outXlsxPath}`);

  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const outCsvPath = path.resolve("public/MASTERS_EXPO_2026_Data.csv");
  fs.writeFileSync(outCsvPath, csvContent, "utf8");
  console.log(`Saved CSV data to ${outCsvPath}`);
}

generateMastersExpoTemplate().catch(console.error);

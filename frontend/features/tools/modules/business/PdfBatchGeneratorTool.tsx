"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  FileSpreadsheet,
  Upload,
  Download,
  Trash2,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Archive,
  RefreshCw,
  Layers,
  Settings2,
  AlertCircle,
  Eye,
  Type,
  Maximize2,
  FileCheck,
  Search,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ShieldCheck,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { toast } from "@/components/ToastContext";

// Interface for visual field placement pin with overflow & auto-fit protection
export interface FieldPin {
  id: string;
  columnName: string;
  label: string;
  pageNumber: number;
  xPercent: number; // 0 to 100% from left
  yPercent: number; // 0 to 100% from top
  fontSize: number;
  fontFamily: "Helvetica" | "Helvetica-Bold" | "Times-Roman" | "Times-Bold" | "Courier" | "Courier-Bold";
  color: string;
  align: "left" | "center" | "right";
  coverBackground: boolean;
  coverColor?: string;
  coverPadding?: number;
  prefix?: string;
  suffix?: string;

  // Overflow Protection & Auto-Fit
  autoFit: boolean; // Scale font down if text exceeds maxWidth
  maxWidth: number; // Max width in points/pixels before shrinking/wrapping
  minFontSize: number; // Lowest allowed font size during auto-fit
  wrapText: boolean; // Wrap text into multiple lines if exceeds maxWidth
  lineHeight: number; // Line height multiplier for multi-line text
  templateString?: string; // Inline sentence template e.g. "Employee {{name}}, Phone: {{phone}}"
}

// Convert hex color to pdf-lib rgb
function hexToRgb(hex: string) {
  let cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  const num = parseInt(cleaned, 16);
  return rgb(
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255
  );
}

// Dynamically load PDF.js from CDN for canvas rendering & text scanning
const loadPdfJs = async (): Promise<any> => {
  if (typeof window === "undefined") return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById("pdfjs-cdn-script");
    if (existing) {
      const check = setInterval(() => {
        if ((window as any).pdfjsLib) {
          clearInterval(check);
          resolve((window as any).pdfjsLib);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error("PDF.js load timeout"));
      }, 5000);
      return;
    }

    const script = document.createElement("script");
    script.id = "pdfjs-cdn-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(pdfjs);
      } else {
        reject(new Error("pdfjsLib not found on window"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(script);
  });
};

export function PdfBatchGeneratorTool() {
  // --- File States ---
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [detectedFormFields, setDetectedFormFields] = useState<string[]>([]);
  const [isFormPdf, setIsFormPdf] = useState<boolean>(false);

  // Data states
  const [dataRows, setDataRows] = useState<Record<string, any>[]>([]);
  const [dataColumns, setDataColumns] = useState<string[]>([]);
  const [dataFileName, setDataFileName] = useState<string>("");

  // Configuration
  const [formMappings, setFormMappings] = useState<Record<string, string>>({});
  const [fieldPins, setFieldPins] = useState<FieldPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isScanningPlaceholders, setIsScanningPlaceholders] = useState<boolean>(false);

  // Preview & Batch Generation
  const [previewRowIndex, setPreviewRowIndex] = useState<number>(0);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState<boolean>(false);

  // Export Settings
  const [namingPattern, setNamingPattern] = useState<string>("Document_{Index}");
  const [exportFormat, setExportFormat] = useState<"zip" | "merged">("zip");
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const abortBatchRef = useRef<boolean>(false);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  // Dragging state for pins on canvas
  const [isDraggingPin, setIsDraggingPin] = useState<boolean>(false);
  const draggingPinIdRef = useRef<string | null>(null);

  // -------------------------------------------------------------
  // 1. PDF Handling & Automatic Placeholders Detection
  // -------------------------------------------------------------
  const handlePdfUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const pageCount = pages.length;

      // Check AcroForm
      let formFieldNames: string[] = [];
      let hasForm = false;
      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        if (fields && fields.length > 0) {
          formFieldNames = fields.map((f) => f.getName());
          hasForm = true;
        }
      } catch (e) {
        // No form
      }

      setPdfBytes(buffer);
      setPdfFileName(file.name);
      setPdfPageCount(pageCount);
      setActivePage(1);
      setIsFormPdf(hasForm);
      setDetectedFormFields(formFieldNames);

      // Auto-match form fields if columns already loaded
      if (hasForm && dataColumns.length > 0) {
        const autoMap: Record<string, string> = {};
        formFieldNames.forEach((field) => {
          const lowerField = field.toLowerCase().replace(/[^a-z0-9]/g, "");
          const match = dataColumns.find(
            (c) => c.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerField
          );
          if (match) autoMap[field] = match;
        });
        setFormMappings(autoMap);
      }

      toast.success(`Loaded PDF: ${file.name} (${pageCount} page${pageCount > 1 ? "s" : ""})`);
    } catch (err: any) {
      console.error("PDF upload error:", err);
      toast.error("Failed to load PDF. Please make sure it's a valid PDF file.");
    }
  };

  // -------------------------------------------------------------
  // 2. Data File Handling (Excel, CSV, JSON)
  // -------------------------------------------------------------
  const handleDataUpload = async (file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, any>[] = [];

      if (ext === "json") {
        const text = await file.text();
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // Excel or CSV
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }

      if (rows.length === 0) {
        toast.error("No data rows found in uploaded file.");
        return;
      }

      const columns = Object.keys(rows[0] || {});
      setDataRows(rows);
      setDataColumns(columns);
      setDataFileName(file.name);
      setPreviewRowIndex(0);

      // Set default naming pattern
      if (columns.length > 0) {
        setNamingPattern(`Document_{${columns[0]}}`);
      }

      // Auto-map if form PDF already loaded
      if (isFormPdf && detectedFormFields.length > 0) {
        const autoMap: Record<string, string> = {};
        detectedFormFields.forEach((field) => {
          const lowerField = field.toLowerCase().replace(/[^a-z0-9]/g, "");
          const match = columns.find(
            (c) => c.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerField
          );
          if (match) autoMap[field] = match;
        });
        setFormMappings(autoMap);
      }

      toast.success(`Loaded data: ${rows.length} records with ${columns.length} columns!`);
    } catch (err: any) {
      console.error("Data upload error:", err);
      toast.error("Failed to parse data file. Please upload a valid .xlsx, .csv, or .json file.");
    }
  };

  // -------------------------------------------------------------
  // 3. Scan & Auto-Detect {{placeholders}} from the PDF text stream
  // -------------------------------------------------------------
  const handleAutoDetectPlaceholders = async () => {
    if (!pdfBytes) {
      toast.error("Please upload a template PDF first.");
      return;
    }

    setIsScanningPlaceholders(true);
    try {
      const pdfjs = await loadPdfJs();
      if (!pdfjs) {
        toast.error("PDF engine could not be initialized.");
        setIsScanningPlaceholders(false);
        return;
      }

      const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice(0) });
      const pdf = await loadingTask.promise;
      const newPins: FieldPin[] = [];
      const placeholderRegex = /\{\{([^}]+)\}\}/g;

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        for (const item of (textContent.items as any[])) {
          const str = item.str || "";
          let match;
          while ((match = placeholderRegex.exec(str)) !== null) {
            const rawPlaceholder = match[1].trim();
            const cleanPlaceholder = rawPlaceholder.toLowerCase().replace(/[^a-z0-9]/g, "");

            // Match against data columns
            const matchedCol =
              dataColumns.find(
                (c) => c.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanPlaceholder
              ) || dataColumns.find(
                (c) => c.toLowerCase().includes(cleanPlaceholder) || cleanPlaceholder.includes(c.toLowerCase())
              ) || rawPlaceholder;

            // Transform matrix: [scaleX, skewY, skewX, scaleY, tx, ty]
            const transform = item.transform || [1, 0, 0, 1, 0, 0];
            const tx = transform[4];
            const ty = transform[5];
            const detectedFontSize = Math.round(
              Math.hypot(transform[0], transform[1]) || Math.hypot(transform[2], transform[3]) || 14
            );

            // Coordinates converted to percentages from top-left
            const xPercent = parseFloat(((tx / viewport.width) * 100).toFixed(2));
            const yPercent = parseFloat((((viewport.height - ty) / viewport.height) * 100).toFixed(2));
            const detectedWidth = Math.max(Math.round(item.width || 120), 80);

            newPins.push({
              id: `pin_detected_${p}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              columnName: matchedCol,
              label: `{{${rawPlaceholder}}}`,
              pageNumber: p,
              xPercent,
              yPercent,
              fontSize: detectedFontSize,
              fontFamily: "Helvetica-Bold",
              color: "#0F172A",
              align: "left",
              coverBackground: true, // Automatically cover the original {{placeholder}}
              coverColor: "#FFFFFF",
              coverPadding: 3,
              autoFit: true, // Automatically scale font down if text is longer
              maxWidth: Math.round(detectedWidth * 1.5),
              minFontSize: 8,
              wrapText: false,
              lineHeight: 1.25,
            });
          }
        }
      }

      if (newPins.length === 0) {
        toast.info("No {{placeholder}} text found in this PDF. You can click anywhere on the page to place fields manually.");
      } else {
        setFieldPins((prev) => {
          const existingLabels = new Set(prev.map((x) => `${x.pageNumber}_${x.label}`));
          const filtered = newPins.filter((x) => !existingLabels.has(`${x.pageNumber}_${x.label}`));
          return [...prev, ...filtered];
        });
        setSelectedPinId(newPins[0].id);
        toast.success(
          `Auto-detected ${newPins.length} placeholder(s)! Font size, position, and auto-fit protection applied.`
        );
      }
    } catch (err: any) {
      console.error("Auto detect error:", err);
      toast.error("Failed to auto-detect placeholders: " + err.message);
    } finally {
      setIsScanningPlaceholders(false);
    }
  };

  // -------------------------------------------------------------
  // 4. Render PDF Page to Canvas via PDF.js
  // -------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (!pdfBytes || !canvasRef.current) return;

      try {
        const pdfjs = await loadPdfJs();
        if (isCancelled || !pdfjs) return;

        const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice(0) });
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const page = await pdf.getPage(activePage);
        if (isCancelled) return;

        const containerWidth = containerRef.current?.clientWidth || 700;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(1.8, Math.max(0.6, (containerWidth - 32) / unscaledViewport.width));
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
      } catch (err) {
        console.warn("Could not render page preview via PDF.js:", err);
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, activePage]);

  // -------------------------------------------------------------
  // 5. Interactive Field Pin Management
  // -------------------------------------------------------------
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingPin) return;
    if (!containerRef.current || !canvasRef.current || dataColumns.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;

    const xPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    // Choose the first unmapped column or default column
    const usedCols = fieldPins.map((p) => p.columnName);
    const availableCol = dataColumns.find((c) => !usedCols.includes(c)) || dataColumns[0];

    const newPin: FieldPin = {
      id: `pin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      columnName: availableCol,
      label: availableCol,
      pageNumber: activePage,
      xPercent: parseFloat(xPercent.toFixed(2)),
      yPercent: parseFloat(yPercent.toFixed(2)),
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: "#1E293B",
      align: "left",
      coverBackground: false,
      coverColor: "#FFFFFF",
      coverPadding: 4,
      autoFit: true,
      maxWidth: 160,
      minFontSize: 8,
      wrapText: false,
      lineHeight: 1.25,
    };

    setFieldPins((prev) => [...prev, newPin]);
    setSelectedPinId(newPin.id);
    toast.success(`Placed field "${availableCol}" with auto-fit protection enabled.`);
  };

  const handlePinMouseDown = (e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    setSelectedPinId(pinId);
    draggingPinIdRef.current = pinId;
    setIsDraggingPin(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current || !draggingPinIdRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const curX = moveEvent.clientX - rect.left;
      const curY = moveEvent.clientY - rect.top;

      const newXPercent = Math.max(0, Math.min(100, (curX / rect.width) * 100));
      const newYPercent = Math.max(0, Math.min(100, (curY / rect.height) * 100));

      setFieldPins((prev) =>
        prev.map((pin) =>
          pin.id === draggingPinIdRef.current
            ? {
                ...pin,
                xPercent: parseFloat(newXPercent.toFixed(2)),
                yPercent: parseFloat(newYPercent.toFixed(2)),
              }
            : pin
        )
      );
    };

    const onMouseUp = () => {
      setIsDraggingPin(false);
      draggingPinIdRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const updateSelectedPin = (updates: Partial<FieldPin>) => {
    if (!selectedPinId) return;
    setFieldPins((prev) =>
      prev.map((pin) => (pin.id === selectedPinId ? { ...pin, ...updates } : pin))
    );
  };

  const removePin = (pinId: string) => {
    setFieldPins((prev) => prev.filter((p) => p.id !== pinId));
    if (selectedPinId === pinId) setSelectedPinId(null);
  };

  // -------------------------------------------------------------
  // 6. Single PDF Generator Core Function (pdf-lib)
  // With Auto-Fit, Word Wrap & Sentence Template Interpolation
  // -------------------------------------------------------------
  const generatePdfForRow = useCallback(
    async (rowIndex: number): Promise<Uint8Array | null> => {
      if (!pdfBytes) return null;
      const row = dataRows[rowIndex] || {};

      const pdfDoc = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });

      // Handle AcroForm fields
      if (isFormPdf && Object.keys(formMappings).length > 0) {
        try {
          const form = pdfDoc.getForm();
          for (const [formField, col] of Object.entries(formMappings)) {
            if (!col) continue;
            const val = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
            try {
              const tf = form.getTextField(formField);
              tf.setText(val);
            } catch (err) {
              // Non-text field
            }
          }
          form.flatten();
        } catch (e) {
          console.warn("Form filling notice:", e);
        }
      }

      // Handle Visual Field Pins
      if (fieldPins.length > 0) {
        const pages = pdfDoc.getPages();

        // Standard fonts
        const fontMap: Record<string, any> = {
          "Helvetica": await pdfDoc.embedFont(StandardFonts.Helvetica),
          "Helvetica-Bold": await pdfDoc.embedFont(StandardFonts.HelveticaBold),
          "Times-Roman": await pdfDoc.embedFont(StandardFonts.TimesRoman),
          "Times-Bold": await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
          "Courier": await pdfDoc.embedFont(StandardFonts.Courier),
          "Courier-Bold": await pdfDoc.embedFont(StandardFonts.CourierBold),
        };

        for (const pin of fieldPins) {
          const targetPageIdx = Math.min(Math.max((pin.pageNumber || 1) - 1, 0), pages.length - 1);
          const page = pages[targetPageIdx];
          const { width, height } = page.getSize();

          // 1. Determine text to draw (custom sentence template OR single column value)
          let textToDraw = "";
          if (pin.templateString && pin.templateString.trim()) {
            textToDraw = pin.templateString;
            dataColumns.forEach((col) => {
              const val = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
              textToDraw = textToDraw.replace(new RegExp(`\\{\\{${col}\\}\\}`, "gi"), val);
              textToDraw = textToDraw.replace(new RegExp(`\\{${col}\\}`, "gi"), val);
            });
          } else {
            const rawVal = row[pin.columnName];
            const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
            textToDraw = `${pin.prefix || ""}${valStr}${pin.suffix || ""}`;
          }

          if (!textToDraw) continue;

          const font = fontMap[pin.fontFamily] || fontMap["Helvetica"];
          let currentFontSize = pin.fontSize || 16;

          // 2. AUTO-FIT / SHRINK-TO-FIT CALCULATION
          // If autoFit is enabled and text exceeds maxWidth, calculate proportional scaled font size
          if (pin.autoFit && pin.maxWidth && pin.maxWidth > 0) {
            const initialWidth = font.widthOfTextAtSize(textToDraw, currentFontSize);
            if (initialWidth > pin.maxWidth) {
              const minSize = pin.minFontSize || 8;
              const scaledSize = Math.floor((pin.maxWidth / initialWidth) * currentFontSize);
              currentFontSize = Math.max(minSize, scaledSize);
            }
          }

          // 3. MULTI-LINE WORD WRAPPING
          let linesToDraw: string[] = [textToDraw];
          if (pin.wrapText && pin.maxWidth && pin.maxWidth > 0) {
            const words = textToDraw.split(/\s+/);
            const wrapped: string[] = [];
            let curLine = "";

            for (const word of words) {
              const testLine = curLine ? `${curLine} ${word}` : word;
              const testWidth = font.widthOfTextAtSize(testLine, currentFontSize);
              if (testWidth > pin.maxWidth && curLine) {
                wrapped.push(curLine);
                curLine = word;
              } else {
                curLine = testLine;
              }
            }
            if (curLine) wrapped.push(curLine);
            linesToDraw = wrapped;
          }

          // 4. COORDINATE MAPPING & BACKGROUND COVER (WHITE-OUT)
          const lineHeight = (pin.lineHeight || 1.25) * currentFontSize;
          const totalHeight = linesToDraw.length * lineHeight;

          // Convert percentage coordinates (origin top-left) to PDF points (origin bottom-left)
          let pdfX = (pin.xPercent / 100) * width;
          let pdfY = height - (pin.yPercent / 100) * height - currentFontSize * 0.75;

          // Background cover mask (covers underlying dummy text so nothing collides or shows through)
          if (pin.coverBackground) {
            const pad = pin.coverPadding || 2;
            const maxLineWidth = Math.max(
              ...linesToDraw.map((l) => font.widthOfTextAtSize(l, currentFontSize)),
              30
            );
            const maskWidth = maxLineWidth + pad * 2;
            const maskHeight = pin.wrapText ? (totalHeight + pad * 2) : (currentFontSize + pad * 2);

            let maskX = pdfX - pad;
            if (pin.align === "center") {
              maskX = pdfX - maskWidth / 2;
            } else if (pin.align === "right") {
              maskX = pdfX - maskWidth + pad;
            }
            const maskY = pdfY - (linesToDraw.length - 1) * lineHeight - pad * 0.5;

            page.drawRectangle({
              x: maskX,
              y: maskY,
              width: maskWidth,
              height: maskHeight,
              color: hexToRgb(pin.coverColor || "#FFFFFF"),
            });
          }

          // 5. DRAW TEXT LINES
          linesToDraw.forEach((line, lineIdx) => {
            const lineWidth = font.widthOfTextAtSize(line, currentFontSize);
            let lineX = pdfX;
            if (pin.align === "center") {
              lineX = pdfX - lineWidth / 2;
            } else if (pin.align === "right") {
              lineX = pdfX - lineWidth;
            }
            const lineY = pdfY - lineIdx * lineHeight;

            page.drawText(line, {
              x: lineX,
              y: lineY,
              size: currentFontSize,
              font,
              color: hexToRgb(pin.color || "#000000"),
            });
          });
        }
      }

      return await pdfDoc.save();
    },
    [pdfBytes, dataRows, isFormPdf, formMappings, fieldPins, dataColumns]
  );

  // -------------------------------------------------------------
  // 7. Real-time Live Preview Generation for Active Row
  // -------------------------------------------------------------
  const generatePreview = useCallback(async () => {
    if (!pdfBytes || dataRows.length === 0) return;
    setIsPreviewGenerating(true);

    try {
      const outputBytes = await generatePdfForRow(previewRowIndex);
      if (!outputBytes) return;

      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }

      const blob = new Blob([outputBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (err) {
      console.error("Preview generation error:", err);
    } finally {
      setIsPreviewGenerating(false);
    }
  }, [pdfBytes, dataRows, previewRowIndex, generatePdfForRow, previewPdfUrl]);

  // Trigger preview update when row or field pins change
  useEffect(() => {
    if (pdfBytes && dataRows.length > 0) {
      const timer = setTimeout(() => {
        generatePreview();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [previewRowIndex, fieldPins, formMappings, pdfBytes, dataRows.length]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  // -------------------------------------------------------------
  // 8. Format Output File Name for a Row
  // -------------------------------------------------------------
  const getFileNameForRow = (row: Record<string, any>, index: number) => {
    let name = namingPattern;
    name = name.replace(/\{Index\}/gi, String(index + 1).padStart(3, "0"));
    dataColumns.forEach((col) => {
      const val = row[col] !== undefined ? String(row[col]) : "";
      const safeVal = val.replace(/[/\\?%*:|"<>]/g, "_").trim();
      name = name.replace(new RegExp(`\\{${col}\\}`, "g"), safeVal);
    });
    return `${name || `Document_${index + 1}`}.pdf`;
  };

  // -------------------------------------------------------------
  // 9. Batch Export (ZIP or Merged PDF)
  // -------------------------------------------------------------
  const handleBatchGenerate = async () => {
    if (!pdfBytes || dataRows.length === 0) {
      toast.error("Please upload both a PDF template and a data file first.");
      return;
    }

    setIsBatchGenerating(true);
    abortBatchRef.current = false;
    const total = dataRows.length;
    setBatchProgress({ current: 0, total, percent: 0 });

    try {
      if (exportFormat === "zip") {
        const zip = new JSZip();

        for (let i = 0; i < total; i++) {
          if (abortBatchRef.current) {
            toast.info("Batch generation cancelled by user.");
            setIsBatchGenerating(false);
            setBatchProgress(null);
            return;
          }

          const singlePdfBytes = await generatePdfForRow(i);
          if (singlePdfBytes) {
            const fileName = getFileNameForRow(dataRows[i], i);
            zip.file(fileName, singlePdfBytes);
          }

          const current = i + 1;
          const percent = Math.round((current / total) * 100);
          setBatchProgress({ current, total, percent });

          if (i % 5 === 0) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }

        toast.info("Compressing files into ZIP archive...");
        const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
          setBatchProgress({ current: total, total, percent: Math.round(metadata.percent) });
        });

        const zipUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = zipUrl;
        a.download = `Batch_PDFs_${Date.now()}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(zipUrl), 2000);

        toast.success(`Successfully generated and downloaded ${total} PDFs in a ZIP archive!`);
      } else {
        // Merged single PDF
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < total; i++) {
          if (abortBatchRef.current) {
            toast.info("Batch generation cancelled.");
            setIsBatchGenerating(false);
            setBatchProgress(null);
            return;
          }

          const singlePdfBytes = await generatePdfForRow(i);
          if (singlePdfBytes) {
            const doc = await PDFDocument.load(singlePdfBytes);
            const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
            copiedPages.forEach((p) => mergedPdf.addPage(p));
          }

          const current = i + 1;
          const percent = Math.round((current / total) * 100);
          setBatchProgress({ current, total, percent });

          if (i % 5 === 0) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }

        toast.info("Saving merged PDF...");
        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Merged_Batch_${Date.now()}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        toast.success(`Successfully generated and merged ${total} records into 1 PDF!`);
      }
    } catch (err: any) {
      console.error("Batch error:", err);
      toast.error("An error occurred during batch generation: " + (err.message || String(err)));
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // -------------------------------------------------------------
  // 10. Load Sample Template & Data
  // -------------------------------------------------------------
  const loadSample = async () => {
    try {
      const doc = await PDFDocument.create();
      const page = doc.addPage([842, 595]); // A4 Landscape
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const font = await doc.embedFont(StandardFonts.Helvetica);

      // Certificate borders
      page.drawRectangle({
        x: 24,
        y: 24,
        width: 794,
        height: 547,
        borderColor: rgb(0.12, 0.35, 0.65),
        borderWidth: 4,
      });
      page.drawRectangle({
        x: 32,
        y: 32,
        width: 778,
        height: 531,
        borderColor: rgb(0.85, 0.72, 0.35),
        borderWidth: 1.5,
      });

      // Header
      page.drawText("CERTIFICATE OF EXCELLENCE", {
        x: 180,
        y: 475,
        size: 32,
        font: fontBold,
        color: rgb(0.1, 0.25, 0.5),
      });
      page.drawText("THIS IS PROUDLY PRESENTED TO", {
        x: 295,
        y: 425,
        size: 13,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });

      // Underline for Candidate Name
      page.drawLine({
        start: { x: 200, y: 350 },
        end: { x: 642, y: 350 },
        thickness: 1,
        color: rgb(0.75, 0.75, 0.75),
      });

      // Description sentence with inline context
      page.drawText("for outstanding contributions and exceptional dedication as", {
        x: 235,
        y: 300,
        size: 13,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });

      // Underline for Role / Designation
      page.drawLine({
        start: { x: 240, y: 260 },
        end: { x: 602, y: 260 },
        thickness: 1,
        color: rgb(0.75, 0.75, 0.75),
      });

      // Footer
      page.drawText("Date of Issue: ____________________", {
        x: 120,
        y: 110,
        size: 12,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      page.drawText("Certificate ID: ____________________", {
        x: 500,
        y: 110,
        size: 12,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });

      const certBytes = await doc.save();
      setPdfBytes(certBytes.buffer as ArrayBuffer);
      setPdfFileName("Sample_Certificate_Template.pdf");
      setPdfPageCount(1);
      setActivePage(1);
      setIsFormPdf(false);

      // Sample Data Rows (including long names to test auto-fit!)
      const sampleRows = [
        {
          FullName: "Alexander Wright",
          Designation: "Lead Cloud Architect",
          IssueDate: "2026-09-22",
          CertID: "FLX-2026-001",
          Department: "Engineering",
        },
        {
          // Notice this long name! It demonstrates Auto-Fit in action:
          FullName: "Dr. Christopher Montgomery-Wellington III",
          Designation: "Chief Artificial Intelligence & Data Science Strategist",
          IssueDate: "2026-09-22",
          CertID: "FLX-2026-002",
          Department: "Applied AI",
        },
        {
          FullName: "Sophia Patel",
          Designation: "Principal AI Researcher",
          IssueDate: "2026-09-22",
          CertID: "FLX-2026-003",
          Department: "Applied AI",
        },
        {
          FullName: "Marcus Chen",
          Designation: "Senior Product Designer",
          IssueDate: "2026-09-22",
          CertID: "FLX-2026-004",
          Department: "Design & UX",
        },
      ];

      setDataRows(sampleRows);
      setDataColumns(["FullName", "Designation", "IssueDate", "CertID", "Department"]);
      setDataFileName("Sample_Employees.xlsx");
      setNamingPattern("Certificate_{FullName}_{CertID}");
      setPreviewRowIndex(0);

      // Sample pins with autoFit & maxWidth enabled
      const samplePins: FieldPin[] = [
        {
          id: "pin_sample_name",
          columnName: "FullName",
          label: "Candidate Name",
          pageNumber: 1,
          xPercent: 50,
          yPercent: 39,
          fontSize: 26,
          fontFamily: "Helvetica-Bold",
          color: "#0F172A",
          align: "center",
          coverBackground: false,
          autoFit: true,
          maxWidth: 400, // Long names will automatically shrink to fit within 400pt
          minFontSize: 14,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_sample_role",
          columnName: "Designation",
          label: "Designation",
          pageNumber: 1,
          xPercent: 50,
          yPercent: 54,
          fontSize: 18,
          fontFamily: "Helvetica-Bold",
          color: "#0369A1",
          align: "center",
          coverBackground: false,
          autoFit: true,
          maxWidth: 360,
          minFontSize: 11,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_sample_date",
          columnName: "IssueDate",
          label: "Date of Issue",
          pageNumber: 1,
          xPercent: 25,
          yPercent: 81,
          fontSize: 12,
          fontFamily: "Helvetica",
          color: "#334155",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 140,
          minFontSize: 9,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_sample_id",
          columnName: "CertID",
          label: "Certificate ID",
          pageNumber: 1,
          xPercent: 71,
          yPercent: 81,
          fontSize: 12,
          fontFamily: "Helvetica",
          color: "#334155",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 140,
          minFontSize: 9,
          wrapText: false,
          lineHeight: 1.25,
        },
      ];

      setFieldPins(samplePins);
      setSelectedPinId("pin_sample_name");
      toast.success("Loaded sample Certificate Template with Auto-Fit overflow protection!");
    } catch (e) {
      console.error("Load sample error:", e);
      toast.error("Failed to load sample files.");
    }
  };

  // -------------------------------------------------------------
  // 11. Load Masters Expo 2026 Confirmation Template (Matches User's Document)
  // -------------------------------------------------------------
  const loadMastersExpoSample = async () => {
    try {
      const res = await fetch("/MASTERS_EXPO_2026_Template.pdf");
      const buffer = await res.arrayBuffer();

      setPdfBytes(buffer);
      setPdfFileName("MASTERS_EXPO_2026_Template.pdf");
      setPdfPageCount(1);
      setActivePage(1);
      setIsFormPdf(false);

      // Fetch the actual MASTERS_EXPO_2026_Data.xlsx
      let expoRows: Record<string, any>[] = [];
      try {
        const excelRes = await fetch("/MASTERS_EXPO_2026_Data.xlsx");
        const excelBuffer = await excelRes.arrayBuffer();
        const workbook = XLSX.read(excelBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0] || "Confirmed_Exhibitors";
        const worksheet = workbook.Sheets[sheetName];
        expoRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      } catch (err) {
        console.warn("Could not fetch MASTERS_EXPO_2026_Data.xlsx directly, fallback to default", err);
      }

      const columns = Object.keys(expoRows[0] || {});
      setDataRows(expoRows);
      setDataColumns(columns.length > 0 ? columns : ["companyName", "stallNo", "category", "dimension", "area"]);
      setDataFileName("MASTERS_EXPO_2026_Data.xlsx");
      setNamingPattern("Confirmation_{companyName}_{stallNo}");
      setPreviewRowIndex(0);

      // Pre-configured pins for Masters Expo Template
      const expoPins: FieldPin[] = [
        {
          id: "pin_top_company",
          columnName: "companyName",
          label: "Top Recipient",
          pageNumber: 1,
          xPercent: 32.25,
          yPercent: 12.73,
          fontSize: 13,
          fontFamily: "Helvetica-Bold",
          color: "#0F172A",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 280,
          minFontSize: 9,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_sentence_reflow",
          columnName: "companyName",
          label: "Sentence Reflow",
          pageNumber: 1,
          xPercent: 32.25,
          yPercent: 25.79,
          fontSize: 9,
          fontFamily: "Helvetica",
          color: "#1F262E",
          align: "left",
          coverBackground: false,
          autoFit: false,
          maxWidth: 378,
          minFontSize: 8,
          wrapText: true,
          lineHeight: 1.4,
          templateString:
            "We are pleased to confirm the participation of {{companyName}} as an exhibitor at KERALA RE 2.0 Expo 26, scheduled to be held from 25–27 September at LULU MALL Thiruvananthapuram, Trivandrum, kerala.",
        },
        {
          id: "pin_stall_no",
          columnName: "stallNo",
          label: "Stall Number",
          pageNumber: 1,
          xPercent: 46.7,
          yPercent: 35.89,
          fontSize: 9,
          fontFamily: "Helvetica-Bold",
          color: "#0F6B47",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 120,
          minFontSize: 8,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_stall_cat",
          columnName: "category",
          label: "Stall Category",
          pageNumber: 1,
          xPercent: 47.71,
          yPercent: 38.03,
          fontSize: 9,
          fontFamily: "Helvetica-Bold",
          color: "#1F262E",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 160,
          minFontSize: 8,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_stall_dim",
          columnName: "dimension",
          label: "Stall Dimensions",
          pageNumber: 1,
          xPercent: 55.1,
          yPercent: 40.16,
          fontSize: 9,
          fontFamily: "Helvetica-Bold",
          color: "#1F262E",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 140,
          minFontSize: 8,
          wrapText: false,
          lineHeight: 1.25,
        },
        {
          id: "pin_stall_area",
          columnName: "area",
          label: "Stall Area",
          pageNumber: 1,
          xPercent: 49.22,
          yPercent: 42.3,
          fontSize: 9,
          fontFamily: "Helvetica-Bold",
          color: "#1F262E",
          align: "left",
          coverBackground: false,
          autoFit: true,
          maxWidth: 120,
          minFontSize: 8,
          wrapText: false,
          lineHeight: 1.25,
        },
      ];

      setFieldPins(expoPins);
      setSelectedPinId("pin_top_company");
      toast.success("Loaded MASTERS EXPO 2026 Confirmation Template & Exhibitors Dataset!");
    } catch (e) {
      console.error("Load Masters Expo sample error:", e);
      toast.error("Failed to load Masters Expo sample files.");
    }
  };

  const handleClearAll = () => {
    setPdfBytes(null);
    setPdfFileName("");
    setPdfPageCount(1);
    setActivePage(1);
    setDetectedFormFields([]);
    setIsFormPdf(false);
    setDataRows([]);
    setDataColumns([]);
    setDataFileName("");
    setFormMappings({});
    setFieldPins([]);
    setSelectedPinId(null);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
    toast.info("Cleared all files and configuration.");
  };

  const selectedPin = useMemo(
    () => fieldPins.find((p) => p.id === selectedPinId) || null,
    [fieldPins, selectedPinId]
  );

  // -------------------------------------------------------------
  // Render UI
  // -------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Hidden file inputs */}
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]);
        }}
      />
      <input
        ref={dataInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) handleDataUpload(e.target.files[0]);
        }}
      />

      {/* Top Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--tools-border)",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--tools-text)" }}>
            PDF Batch Mail Merge & Template Filler
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--tools-text-muted)" }}>
            Replace <code>{`{{companyName}}`}</code>, <code>{`{{stallNo}}`}</code>, or any field with automatic text shrink-to-fit so your layout never cracks.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {!pdfBytes && (
            <>
              <button
                type="button"
                onClick={loadMastersExpoSample}
                className="tool-btn-primary"
                style={{
                  fontSize: "0.82rem",
                  padding: "8px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#059669",
                }}
                title="Load the exact Masters Expo 2026 template from your document"
              >
                <Sparkles size={14} style={{ color: "#FEF08A" }} />
                <span>Load Masters Expo 2026 (Your Document)</span>
              </button>

              <button
                type="button"
                onClick={loadSample}
                className="tool-btn-secondary"
                style={{ fontSize: "0.82rem", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Sparkles size={14} style={{ color: "#F59E0B" }} />
                <span>Load Certificate Demo</span>
              </button>
            </>
          )}

          {(pdfBytes || dataRows.length > 0) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="tool-btn-secondary"
              style={{ color: "#DC2626", borderColor: "#FCA5A5", fontSize: "0.82rem", padding: "8px 12px" }}
              title="Reset everything"
            >
              <Trash2 size={14} />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: UPLOAD SECTION */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {/* PDF Upload Card */}
        <div
          style={{
            border: "1px solid var(--tools-border)",
            borderRadius: "12px",
            padding: "20px",
            backgroundColor: "var(--tools-surface)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(220, 38, 38, 0.1)",
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                1
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--tools-text)" }}>
                Template PDF Document
              </span>
            </div>
            {pdfFileName && (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "#059669",
                  fontWeight: 600,
                }}
              >
                Ready ({pdfPageCount} pgs)
              </span>
            )}
          </div>

          {!pdfBytes ? (
            <div
              className="tool-dropzone"
              style={{ padding: "36px 16px", cursor: "pointer" }}
              onClick={() => pdfInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handlePdfUpload(e.dataTransfer.files[0]);
              }}
            >
              <FileText size={32} className="tool-dropzone-icon" style={{ color: "#DC2626" }} />
              <div className="tool-dropzone-title" style={{ fontSize: "0.95rem", marginTop: "8px" }}>
                Upload Template PDF
              </div>
              <div className="tool-dropzone-sub" style={{ fontSize: "0.78rem" }}>
                Supports standard PDFs with <code>{`{{placeholders}}`}</code> or AcroForms
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                backgroundColor: "var(--tools-surface-subtle)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                <FileText size={20} style={{ color: "#DC2626", flexShrink: 0 }} />
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--tools-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "220px",
                    }}
                  >
                    {pdfFileName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>
                    {isFormPdf ? `Fillable Form (${detectedFormFields.length} fields)` : "Standard Template PDF"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="tool-btn-secondary"
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Data Upload Card */}
        <div
          style={{
            border: "1px solid var(--tools-border)",
            borderRadius: "12px",
            padding: "20px",
            backgroundColor: "var(--tools-surface)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                2
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--tools-text)" }}>
                Data Source (Excel / JSON)
              </span>
            </div>
            {dataRows.length > 0 && (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "#059669",
                  fontWeight: 600,
                }}
              >
                {dataRows.length} Rows Loaded
              </span>
            )}
          </div>

          {dataRows.length === 0 ? (
            <div
              className="tool-dropzone"
              style={{ padding: "36px 16px", cursor: "pointer" }}
              onClick={() => dataInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleDataUpload(e.dataTransfer.files[0]);
              }}
            >
              <FileSpreadsheet size={32} className="tool-dropzone-icon" style={{ color: "#059669" }} />
              <div className="tool-dropzone-title" style={{ fontSize: "0.95rem", marginTop: "8px" }}>
                Upload Excel or JSON
              </div>
              <div className="tool-dropzone-sub" style={{ fontSize: "0.78rem" }}>
                Supports .xlsx, .xls, .csv, and .json
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                backgroundColor: "var(--tools-surface-subtle)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                <FileSpreadsheet size={20} style={{ color: "#059669", flexShrink: 0 }} />
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--tools-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "220px",
                    }}
                  >
                    {dataFileName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>
                    {dataRows.length} rows &bull; {dataColumns.length} columns (
                    {dataColumns.slice(0, 3).join(", ")}
                    {dataColumns.length > 3 ? "..." : ""})
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <a
                  href="/MASTERS_EXPO_2026_Data.xlsx"
                  download="MASTERS_EXPO_2026_Data.xlsx"
                  className="tool-btn-secondary"
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    textDecoration: "none",
                  }}
                  title="Download the full MASTERS EXPO 2026 Excel workbook"
                >
                  <Download size={12} />
                  <span>Download .xlsx</span>
                </a>
                <button
                  type="button"
                  onClick={() => dataInputRef.current?.click()}
                  className="tool-btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                >
                  Change
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: FIELD MAPPING & VISUAL PLACEMENT */}
      {pdfBytes && dataRows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--tools-border)",
            borderRadius: "12px",
            backgroundColor: "var(--tools-surface)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                3
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--tools-text)" }}>
                  Field Mapping & Visual Placement (With Auto-Fit)
                </span>
                <div style={{ fontSize: "0.78rem", color: "var(--tools-text-muted)" }}>
                  Detect <code>{`{{placeholders}}`}</code> automatically, or click anywhere on the page to place fields.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Auto-Detect Placeholders Button */}
              <button
                type="button"
                onClick={handleAutoDetectPlaceholders}
                disabled={isScanningPlaceholders}
                className="tool-btn-primary"
                style={{
                  fontSize: "0.8rem",
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#2563EB",
                }}
              >
                <Sparkles size={14} className={isScanningPlaceholders ? "animate-spin" : ""} />
                <span>
                  {isScanningPlaceholders ? "Scanning PDF Text..." : "Auto-Detect {{placeholders}}"}
                </span>
              </button>

              {/* Page Navigation if multi-page */}
              {pdfPageCount > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)" }}>Page:</span>
                  <button
                    type="button"
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    className="tool-btn-secondary"
                    style={{ padding: "4px 8px" }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                    {activePage} / {pdfPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePage((p) => Math.min(pdfPageCount, p + 1))}
                    disabled={activePage === pdfPageCount}
                    className="tool-btn-secondary"
                    style={{ padding: "4px 8px" }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form PDF Mappings (If AcroForm Detected) */}
          {isFormPdf && detectedFormFields.length > 0 && (
            <div
              style={{
                padding: "16px",
                backgroundColor: "var(--tools-surface-subtle)",
                borderRadius: "10px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "10px", color: "var(--tools-text)" }}>
                Detected PDF Form Fields (AcroForm):
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "10px",
                }}
              >
                {detectedFormFields.map((field) => (
                  <div
                    key={field}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      padding: "10px",
                      backgroundColor: "var(--tools-surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--tools-border)",
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--tools-text-muted)" }}>
                      Field: <code style={{ color: "var(--tools-primary)" }}>{field}</code>
                    </span>
                    <select
                      className="tool-input"
                      value={formMappings[field] || ""}
                      onChange={(e) =>
                        setFormMappings((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                      style={{ fontSize: "0.82rem", padding: "6px 8px" }}
                    >
                      <option value="">-- Do Not Fill --</option>
                      {dataColumns.map((col) => (
                        <option key={col} value={col}>
                          Column: {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Visual Workspace: Canvas Preview + Pin Properties Sidebar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 340px",
              gap: "18px",
              alignItems: "start",
            }}
          >
            {/* Left: Interactive Canvas Overlay */}
            <div
              ref={containerRef}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "var(--tools-surface-subtle)",
                borderRadius: "10px",
                border: "1px solid var(--tools-border)",
                padding: "16px",
                overflowX: "auto",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  cursor: "crosshair",
                  userSelect: "none",
                }}
                onClick={handleCanvasClick}
              >
                {/* PDF Page Canvas */}
                <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%", height: "auto" }} />

                {/* Overlaid Field Pins */}
                {fieldPins
                  .filter((p) => p.pageNumber === activePage)
                  .map((pin) => {
                    const isSelected = pin.id === selectedPinId;
                    const previewValue =
                      dataRows[previewRowIndex]?.[pin.columnName] !== undefined
                        ? String(dataRows[previewRowIndex]?.[pin.columnName])
                        : pin.columnName;

                    return (
                      <div
                        key={pin.id}
                        onMouseDown={(e) => handlePinMouseDown(e, pin.id)}
                        style={{
                          position: "absolute",
                          left: `${pin.xPercent}%`,
                          top: `${pin.yPercent}%`,
                          transform:
                            pin.align === "center"
                              ? "translate(-50%, -50%)"
                              : pin.align === "right"
                              ? "translate(-100%, -50%)"
                              : "translate(0%, -50%)",
                          cursor: "grab",
                          zIndex: isSelected ? 20 : 10,
                          pointerEvents: "auto",
                        }}
                      >
                        <div
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: isSelected ? "rgba(37, 99, 235, 0.95)" : "rgba(15, 23, 42, 0.85)",
                            color: "#FFFFFF",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            boxShadow: isSelected
                              ? "0 0 0 2px #FFFFFF, 0 0 0 4px #2563EB"
                              : "0 2px 6px rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.4)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Type size={11} />
                          <span>{pin.columnName}</span>
                          <span style={{ opacity: 0.75 }}>({previewValue || "empty"})</span>
                          {pin.autoFit && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                padding: "1px 4px",
                                borderRadius: "2px",
                                backgroundColor: "rgba(16, 185, 129, 0.3)",
                                color: "#A7F3D0",
                              }}
                              title={`Auto-fit enabled: text shrinks if wider than ${pin.maxWidth}px`}
                            >
                              Auto-fit
                            </span>
                          )}
                        </div>

                        {/* Visual Max-Width Boundary Indicator when selected */}
                        {isSelected && pin.maxWidth && (
                          <div
                            style={{
                              position: "absolute",
                              left: pin.align === "center" ? `calc(50% - ${pin.maxWidth / 2}px)` : pin.align === "right" ? `calc(100% - ${pin.maxWidth}px)` : 0,
                              top: "100%",
                              width: `${pin.maxWidth}px`,
                              height: "2px",
                              backgroundColor: "#2563EB",
                              borderBottom: "1px dashed rgba(255,255,255,0.8)",
                              marginTop: "2px",
                              pointerEvents: "none",
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                top: "4px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                fontSize: "0.65rem",
                                color: "#2563EB",
                                backgroundColor: "rgba(255,255,255,0.9)",
                                padding: "1px 4px",
                                borderRadius: "2px",
                                whiteSpace: "nowrap",
                                fontWeight: 700,
                              }}
                            >
                              max {pin.maxWidth}px (Auto-Fit)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--tools-text-muted)",
                  marginTop: "12px",
                  textAlign: "center",
                }}
              >
                Tip: Click anywhere to place a marker. Click <strong>"Auto-Detect {"{{placeholders}}"}"</strong> to automatically find and size fields.
              </div>
            </div>

            {/* Right: Selected Pin Properties Panel */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                padding: "16px",
                backgroundColor: "var(--tools-surface-subtle)",
                borderRadius: "10px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tools-text)" }}>
                  {selectedPin ? `Field: ${selectedPin.columnName}` : "Field Settings"}
                </span>
                {selectedPin && (
                  <button
                    type="button"
                    onClick={() => removePin(selectedPin.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#DC2626",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    title="Delete field marker"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {selectedPin ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.82rem" }}>
                  {/* Linked Column */}
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", color: "var(--tools-text-muted)" }}>
                      Data Column:
                    </label>
                    <select
                      className="tool-input"
                      value={selectedPin.columnName}
                      onChange={(e) => updateSelectedPin({ columnName: e.target.value, label: e.target.value })}
                      style={{ width: "100%", fontSize: "0.82rem" }}
                    >
                      {dataColumns.map((col) => (
                        <option key={col} value={col}>
                          {col} (e.g. "{String(dataRows[0]?.[col] || "").substring(0, 15)}")
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Inline Sentence Template (Optional) */}
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", color: "var(--tools-text-muted)" }}>
                      Inline Sentence Template (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g. Employee {{${selectedPin.columnName}}} (Phone: {{phone}})`}
                      value={selectedPin.templateString || ""}
                      onChange={(e) => updateSelectedPin({ templateString: e.target.value })}
                      className="tool-input"
                      style={{ width: "100%", fontSize: "0.8rem" }}
                    />
                    <div style={{ fontSize: "0.72rem", color: "var(--tools-text-muted)", marginTop: "2px" }}>
                      Leave blank to output column value directly.
                    </div>
                  </div>

                  {/* Font Size & Alignment */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "4px", color: "var(--tools-text-muted)" }}>
                        Base Font Size ({selectedPin.fontSize}px):
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={72}
                        value={selectedPin.fontSize}
                        onChange={(e) => updateSelectedPin({ fontSize: Number(e.target.value) || 14 })}
                        className="tool-input"
                        style={{ width: "100%", fontSize: "0.82rem" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", marginBottom: "4px", color: "var(--tools-text-muted)" }}>
                        Alignment:
                      </label>
                      <select
                        className="tool-input"
                        value={selectedPin.align}
                        onChange={(e) => updateSelectedPin({ align: e.target.value as any })}
                        style={{ width: "100%", fontSize: "0.82rem" }}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>

                  {/* Font Style */}
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", color: "var(--tools-text-muted)" }}>
                      Font Style:
                    </label>
                    <select
                      className="tool-input"
                      value={selectedPin.fontFamily}
                      onChange={(e) => updateSelectedPin({ fontFamily: e.target.value as any })}
                      style={{ width: "100%", fontSize: "0.82rem" }}
                    >
                      <option value="Helvetica">Helvetica (Regular)</option>
                      <option value="Helvetica-Bold">Helvetica (Bold)</option>
                      <option value="Times-Roman">Times New Roman (Regular)</option>
                      <option value="Times-Bold">Times New Roman (Bold)</option>
                      <option value="Courier">Courier (Monospace)</option>
                      <option value="Courier-Bold">Courier (Monospace Bold)</option>
                    </select>
                  </div>

                  {/* Text Color */}
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", color: "var(--tools-text-muted)" }}>
                      Text Color:
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="color"
                        value={selectedPin.color}
                        onChange={(e) => updateSelectedPin({ color: e.target.value })}
                        style={{ width: "36px", height: "32px", borderRadius: "4px", border: "1px solid var(--tools-border)", cursor: "pointer" }}
                      />
                      <input
                        type="text"
                        value={selectedPin.color}
                        onChange={(e) => updateSelectedPin({ color: e.target.value })}
                        className="tool-input"
                        style={{ flex: 1, fontSize: "0.82rem" }}
                      />
                    </div>
                  </div>

                  {/* OVERFLOW & AUTO-FIT CONTROLS */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "var(--tools-surface)",
                      border: "1px solid var(--tools-border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#2563EB" }}>
                      <ShieldCheck size={16} />
                      <span>Overflow & Auto-Fit Protection</span>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedPin.autoFit}
                        onChange={(e) => updateSelectedPin({ autoFit: e.target.checked })}
                      />
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Auto-Shrink Font to Fit Space</span>
                    </label>

                    {selectedPin.autoFit && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <label style={{ display: "block", marginBottom: "2px", fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>
                            Max Width (px):
                          </label>
                          <input
                            type="number"
                            min={20}
                            max={1000}
                            value={selectedPin.maxWidth}
                            onChange={(e) => updateSelectedPin({ maxWidth: Number(e.target.value) || 120 })}
                            className="tool-input"
                            style={{ width: "100%", fontSize: "0.8rem" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", marginBottom: "2px", fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>
                            Min Font Size (px):
                          </label>
                          <input
                            type="number"
                            min={4}
                            max={24}
                            value={selectedPin.minFontSize}
                            onChange={(e) => updateSelectedPin({ minFontSize: Number(e.target.value) || 8 })}
                            className="tool-input"
                            style={{ width: "100%", fontSize: "0.8rem" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Word Wrap Toggle */}
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedPin.wrapText}
                        onChange={(e) => updateSelectedPin({ wrapText: e.target.checked })}
                      />
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Multi-line Word Wrap</span>
                    </label>
                  </div>

                  {/* Cover Background Mask Checkbox (White-out) */}
                  <div
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      backgroundColor: "var(--tools-surface)",
                      border: "1px solid var(--tools-border)",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedPin.coverBackground}
                        onChange={(e) => updateSelectedPin({ coverBackground: e.target.checked })}
                      />
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Cover underlying text (White-out)</span>
                    </label>
                    {selectedPin.coverBackground && (
                      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Mask Color:</span>
                        <input
                          type="color"
                          value={selectedPin.coverColor || "#FFFFFF"}
                          onChange={(e) => updateSelectedPin({ coverColor: e.target.value })}
                          style={{ width: "28px", height: "24px", cursor: "pointer", border: "1px solid var(--tools-border)" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--tools-text-muted)", fontSize: "0.82rem" }}>
                  <AlertCircle size={28} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
                  <div>No field selected.</div>
                  <div style={{ marginTop: "4px", fontSize: "0.75rem" }}>
                    Click a field marker or click anywhere on the page to create one.
                  </div>
                </div>
              )}

              {/* List of all active pins */}
              {fieldPins.length > 0 && (
                <div style={{ marginTop: "10px", borderTop: "1px solid var(--tools-border)", paddingTop: "12px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "8px", color: "var(--tools-text-muted)" }}>
                    All Placed Fields ({fieldPins.length}):
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {fieldPins.map((pin) => (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={() => setSelectedPinId(pin.id)}
                        style={{
                          fontSize: "0.75rem",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: pin.id === selectedPinId ? "1px solid #2563EB" : "1px solid var(--tools-border)",
                          backgroundColor: pin.id === selectedPinId ? "rgba(37, 99, 235, 0.1)" : "var(--tools-surface)",
                          color: pin.id === selectedPinId ? "#2563EB" : "var(--tools-text)",
                          cursor: "pointer",
                          fontWeight: pin.id === selectedPinId ? 700 : 500,
                        }}
                      >
                        {pin.columnName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: LIVE PREVIEW & BATCH EXPORT */}
      {pdfBytes && dataRows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--tools-border)",
            borderRadius: "12px",
            backgroundColor: "var(--tools-surface)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(168, 85, 247, 0.1)",
                  color: "#9333EA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                4
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--tools-text)" }}>
                Live Verification & Batch Export
              </span>
            </div>

            {/* Row Stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setPreviewRowIndex((r) => Math.max(0, r - 1))}
                disabled={previewRowIndex === 0}
                className="tool-btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
              >
                <ChevronLeft size={14} />
                <span>Prev Row</span>
              </button>

              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                Row {previewRowIndex + 1} of {dataRows.length}
              </span>

              <button
                type="button"
                onClick={() => setPreviewRowIndex((r) => Math.min(dataRows.length - 1, r + 1))}
                disabled={previewRowIndex === dataRows.length - 1}
                className="tool-btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
              >
                <span>Next Row</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Current Row Values Card */}
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--tools-surface-subtle)",
              borderRadius: "8px",
              border: "1px solid var(--tools-border)",
              display: "flex",
              flexWrap: "wrap",
              gap: "14px",
              fontSize: "0.82rem",
            }}
          >
            {dataColumns.slice(0, 6).map((col) => (
              <div key={col}>
                <span style={{ color: "var(--tools-text-muted)" }}>{col}: </span>
                <span style={{ fontWeight: 600, color: "var(--tools-text)" }}>
                  {String(dataRows[previewRowIndex]?.[col] || "—")}
                </span>
              </div>
            ))}
          </div>

          {/* Live Preview Iframe Container */}
          {previewPdfUrl && (
            <div
              style={{
                border: "1px solid var(--tools-border)",
                borderRadius: "8px",
                overflow: "hidden",
                height: "500px",
                backgroundColor: "#525659",
                position: "relative",
              }}
            >
              <iframe
                src={`${previewPdfUrl}#toolbar=0&navpanes=0`}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Live PDF Preview"
              />
              {isPreviewGenerating && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={24} className="animate-spin" style={{ marginRight: "8px" }} />
                  Updating Preview...
                </div>
              )}
            </div>
          )}

          {/* Batch Export Configuration */}
          <div
            style={{
              borderTop: "1px solid var(--tools-border)",
              paddingTop: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {/* File Naming Pattern */}
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600, color: "var(--tools-text)" }}>
                  Output File Naming Pattern:
                </label>
                <input
                  type="text"
                  value={namingPattern}
                  onChange={(e) => setNamingPattern(e.target.value)}
                  className="tool-input"
                  style={{ width: "100%", fontSize: "0.85rem" }}
                  placeholder="e.g. Document_{Name}_{ID}"
                />
                <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--tools-text-muted)" }}>Tags:</span>
                  <button
                    type="button"
                    onClick={() => setNamingPattern((p) => `${p}_{Index}`)}
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "var(--tools-surface-subtle)",
                      border: "1px solid var(--tools-border)",
                      cursor: "pointer",
                    }}
                  >
                    {`{Index}`}
                  </button>
                  {dataColumns.slice(0, 5).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNamingPattern((p) => `${p}_{${col}}`)}
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--tools-surface-subtle)",
                        border: "1px solid var(--tools-border)",
                        cursor: "pointer",
                      }}
                    >
                      {`{${col}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Format (ZIP vs Merged PDF) */}
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600, color: "var(--tools-text)" }}>
                  Export Format:
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setExportFormat("zip")}
                    className={exportFormat === "zip" ? "tool-btn-primary" : "tool-btn-secondary"}
                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Archive size={15} />
                    <span>ZIP Archive (Individual PDFs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("merged")}
                    className={exportFormat === "merged" ? "tool-btn-primary" : "tool-btn-secondary"}
                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Layers size={15} />
                    <span>Single Merged PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Batch Progress Bar */}
            {isBatchGenerating && batchProgress && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  backgroundColor: "var(--tools-surface-subtle)",
                  border: "1px solid var(--tools-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600 }}>
                  <span>
                    Generating PDFs: Row {batchProgress.current} of {batchProgress.total}...
                  </span>
                  <span>{batchProgress.percent}%</span>
                </div>
                <div
                  style={{
                    height: "8px",
                    width: "100%",
                    backgroundColor: "var(--tools-border)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${batchProgress.percent}%`,
                      backgroundColor: "var(--tools-primary, #2563EB)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      abortBatchRef.current = true;
                    }}
                    style={{
                      fontSize: "0.78rem",
                      color: "#DC2626",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Cancel Generation
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              {/* Single Download for current row */}
              <button
                type="button"
                onClick={async () => {
                  const bytes = await generatePdfForRow(previewRowIndex);
                  if (bytes) {
                    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = getFileNameForRow(dataRows[previewRowIndex], previewRowIndex);
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.success("Downloaded single preview PDF!");
                  }
                }}
                className="tool-btn-secondary"
                style={{ padding: "10px 16px", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={15} />
                <span>Download Row {previewRowIndex + 1} PDF</span>
              </button>

              {/* Full Batch Download */}
              <button
                type="button"
                onClick={handleBatchGenerate}
                disabled={isBatchGenerating}
                className="tool-btn-primary"
                style={{
                  padding: "10px 24px",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Download size={16} />
                <span>
                  {isBatchGenerating
                    ? `Processing (${batchProgress?.percent || 0}%)...`
                    : `Generate & Download All (${dataRows.length} PDFs)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

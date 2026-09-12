export function formatCurrency(amount: number | string = 0, currency = "INR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr?: string | Date): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

export const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ASSET: { bg: "rgba(59, 130, 246, 0.1)", text: "#2563eb", border: "rgba(59, 130, 246, 0.25)" },
  LIABILITY: { bg: "rgba(239, 68, 68, 0.1)", text: "#dc2626", border: "rgba(239, 68, 68, 0.25)" },
  EQUITY: { bg: "rgba(168, 85, 247, 0.1)", text: "#9333ea", border: "rgba(168, 85, 247, 0.25)" },
  REVENUE: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669", border: "rgba(16, 185, 129, 0.25)" },
  EXPENSE: { bg: "rgba(245, 158, 11, 0.1)", text: "#d97706", border: "rgba(245, 158, 11, 0.25)" },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  POSTED: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669" },
  PAID: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669" },
  CLEARED: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669" },
  RECONCILED: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669" },
  DRAFT: { bg: "rgba(100, 116, 139, 0.1)", text: "#64748b" },
  SENT: { bg: "rgba(59, 130, 246, 0.1)", text: "#2563eb" },
  PARTIALLY_PAID: { bg: "rgba(245, 158, 11, 0.1)", text: "#d97706" },
  OVERDUE: { bg: "rgba(239, 68, 68, 0.1)", text: "#dc2626" },
  UNPAID: { bg: "rgba(239, 68, 68, 0.1)", text: "#dc2626" },
  VOID: { bg: "rgba(100, 116, 139, 0.15)", text: "#94a3b8" },
  REVERSED: { bg: "rgba(239, 68, 68, 0.15)", text: "#b91c1c" },
};

/**
 * Normalizes backend responses that may be wrapped in { count, results } or direct arrays.
 */
export function unpackResults<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Universal CSV Export with RFC-4180 escaping and UTF-8 BOM for Microsoft Excel / Google Sheets compatibility.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const escapeCell = (cell: any) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const safeFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.setAttribute("download", safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  FileCode,
  Sparkles,
  Eye,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type { Employee, EmployeeDocumentItem } from "@/lib/types";

const DOCUMENT_TYPES = [
  "Aadhar Card",
  "PAN Card",
  "Degree Certificate",
  "Experience Letter",
  "Passport / ID Proof",
  "Resume / CV",
  "Offer Letter",
  "Employment Contract",
  "Educational Certificate",
  "Other",
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getTypeBadgeStyle(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("aadhar") || t.includes("pan") || t.includes("passport") || t.includes("id")) {
    return { background: "rgba(217, 119, 6, 0.1)", color: "#b45309", border: "1px solid rgba(217, 119, 6, 0.25)" };
  }
  if (t.includes("offer") || t.includes("contract")) {
    return { background: "rgba(16, 185, 129, 0.1)", color: "#047857", border: "1px solid rgba(16, 185, 129, 0.25)" };
  }
  if (t.includes("resume") || t.includes("cv")) {
    return { background: "rgba(14, 165, 233, 0.1)", color: "#0369a1", border: "1px solid rgba(14, 165, 233, 0.25)" };
  }
  if (t.includes("certificate") || t.includes("experience") || t.includes("degree")) {
    return { background: "rgba(168, 85, 247, 0.1)", color: "#6b21a8", border: "1px solid rgba(168, 85, 247, 0.25)" };
  }
  return { background: "rgba(100, 116, 139, 0.1)", color: "#475569", border: "1px solid rgba(100, 116, 139, 0.25)" };
}

function getFileIcon(fileType: string, fileName: string) {
  const isImage = fileType?.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(fileName);
  const isPdf = fileType?.includes("pdf") || /\.pdf$/i.test(fileName);

  if (isImage) {
    return (
      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#f3e8ff", border: "1px solid #d8b4fe", display: "grid", placeItems: "center", color: "#9333ea", flexShrink: 0 }}>
        <ImageIcon size={20} />
      </div>
    );
  }
  if (isPdf) {
    return (
      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#ffe4e6", border: "1px solid #fecdd3", display: "grid", placeItems: "center", color: "#e11d48", flexShrink: 0 }}>
        <FileText size={20} />
      </div>
    );
  }
  return (
    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#e0f2fe", border: "1px solid #bae6fd", display: "grid", placeItems: "center", color: "#0284c7", flexShrink: 0 }}>
      <FileCode size={20} />
    </div>
  );
}

export function EmployeeDocumentsModal({
  isOpen,
  onClose,
  employee,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}) {
  const [documents, setDocuments] = useState<EmployeeDocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Upload Form State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("Aadhar Card");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Deleting State
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const loadDocuments = async () => {
    if (!employee) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<EmployeeDocumentItem[]>(`/employees/${employee.id}/documents/`);
      setDocuments(res || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && employee) {
      loadDocuments();
      setShowUploadForm(false);
      setTitle("");
      setDocumentType("Aadhar Card");
      setSelectedFile(null);
      setFilePreview(null);
      setUploadError("");
    }
  }, [isOpen, employee]);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !selectedFile) {
      setUploadError("Please select a document file to upload.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title.trim() || selectedFile.name);
      formData.append("document_type", documentType);

      await api(`/employees/${employee.id}/documents/`, {
        method: "POST",
        body: formData,
      });

      setShowUploadForm(false);
      setTitle("");
      setSelectedFile(null);
      setFilePreview(null);
      toast.success("Employee document uploaded successfully!");
      loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload document.";
      setUploadError(msg);
      toast.error(msg, "Upload Failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string | number) => {
    if (!employee || !confirm("Are you sure you want to permanently delete this document?")) return;
    setDeletingId(docId);
    try {
      await api(`/employees/${employee.id}/documents/${docId}/`, { method: "DELETE" });
      toast.success("Document deleted successfully.");
      loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete document.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <Modal onClose={onClose} title={`Documents: ${employee.name}`} size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* 1. Header Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "linear-gradient(135deg, #fdfbf7 0%, #f5f2e9 100%)",
            border: "1px solid #e8e6e1",
            padding: "14px 18px",
            borderRadius: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                color: "#a8874e",
                fontSize: "15px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {employee.name.charAt(0)}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#111827" }}>{employee.name}</h3>
                <span
                  style={{
                    background: "rgba(203, 168, 110, 0.15)",
                    color: "#a8874e",
                    border: "1px solid rgba(203, 168, 110, 0.3)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {employee.employee_code}
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                {employee.designation} &bull; <strong style={{ color: "#374151" }}>{employee.department}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowUploadForm(!showUploadForm);
              setUploadError("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "8px",
              background: "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(168, 135, 78, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            {showUploadForm ? <X size={15} /> : <Plus size={15} />}
            {showUploadForm ? "Close Form" : "Upload Document"}
          </button>
        </div>

        {/* 2. Upload Form Panel */}
        {showUploadForm && (
          <form
            onSubmit={handleUploadSubmit}
            style={{
              background: "#ffffff",
              border: "2px dashed #cba86e",
              padding: "18px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#a8874e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Sparkles size={15} />
                <span>Upload New Employee Document</span>
              </div>
              <span style={{ fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" }}>PDF, PNG, JPG, WEBP, DOCX (Max 15MB)</span>
            </div>

            {uploadError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecdd3", color: "#dc2626", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={16} />
                {uploadError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#4b5563", letterSpacing: "0.05em" }}>
                DOCUMENT TITLE / LABEL <span style={{ color: "#dc2626" }}>*</span>
                <input
                  type="text"
                  placeholder="e.g. Aadhar Card Front & Back"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid #e5e7eb",
                    fontSize: "13px",
                    outline: "none",
                    background: "#f9fafb",
                    color: "#111827",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#4b5563", letterSpacing: "0.05em" }}>
                DOCUMENT CATEGORY <span style={{ color: "#dc2626" }}>*</span>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid #e5e7eb",
                    fontSize: "13px",
                    outline: "none",
                    background: "#f9fafb",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Custom Dropzone */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#4b5563", letterSpacing: "0.05em" }}>
                ATTACH FILE <span style={{ color: "#dc2626" }}>*</span>
              </span>
              <div
                style={{
                  position: "relative",
                  border: "2px dashed #cbd5e1",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "16px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    width: "100%",
                    height: "100%",
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                />

                {selectedFile ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "#ffffff", border: "1px solid #cba86e", padding: "10px 14px", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {filePreview ? (
                        <img src={filePreview} alt="Preview" style={{ width: "38px", height: "38px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }} />
                      ) : (
                        <div style={{ width: "38px", height: "38px", borderRadius: "6px", background: "#fef3c7", display: "grid", placeItems: "center", color: "#d97706" }}>
                          <FileText size={18} />
                        </div>
                      )}
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>{selectedFile.name}</div>
                        <div style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace" }}>{formatBytes(selectedFile.size)}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={15} /> Ready to upload
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <UploadCloud size={28} style={{ color: "#a8874e" }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>Click or drop document file here</span>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>Supports PDF, PNG, JPG, WEBP, DOCX up to 15MB</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#6b7280",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  opacity: uploading || !selectedFile ? 0.5 : 1,
                  boxShadow: "0 2px 6px rgba(168, 135, 78, 0.25)",
                }}
              >
                {uploading && <RefreshCw size={14} className="animate-spin" />}
                {uploading ? "Saving..." : "Save & Upload"}
              </button>
            </div>
          </form>
        )}

        {/* 3. Error Alert */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecdd3", color: "#dc2626", padding: "12px 14px", borderRadius: "10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* 4. Loading State */}
        {loading && !showUploadForm && (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: "#a8874e", margin: "0 auto 8px" }} />
            <div>Loading employee documents...</div>
          </div>
        )}

        {/* 5. Empty State */}
        {!loading && documents.length === 0 && !showUploadForm && (
          <div
            style={{
              padding: "36px 20px",
              textAlign: "center",
              background: "#fafafa",
              border: "2px dashed #e5e7eb",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(203, 168, 110, 0.12)", border: "1px solid rgba(203, 168, 110, 0.3)", display: "grid", placeItems: "center", color: "#a8874e" }}>
              <FolderOpen size={22} />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              No Uploaded Documents Found
            </div>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, maxWidth: "380px", lineHeight: 1.5 }}>
              No official documents have been uploaded for {employee.name} yet. Click <strong style={{ color: "#a8874e" }}>Upload Document</strong> above to add Aadhar, PAN, Offer Letter, or Certificates.
            </p>
          </div>
        )}

        {/* 6. Documents Cards List */}
        {!loading && documents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 2px" }}>
              <span>DOCUMENT VAULT ({documents.length})</span>
              <span>LIVE RECORDS</span>
            </div>

            {documents.map((doc) => {
              const badgeStyle = getTypeBadgeStyle(doc.document_type);
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    {getFileIcon(doc.file_type, doc.file_name)}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>{doc.title}</span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: 700,
                            ...badgeStyle,
                          }}
                        >
                          {doc.document_type}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#6b7280", fontFamily: "monospace", marginTop: "3px" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{doc.file_name}</span>
                        <span>&bull;</span>
                        <span>{formatBytes(doc.file_size)}</span>
                        <span>&bull;</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        color: "#374151",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                        cursor: "pointer",
                      }}
                      title="View / Download Document"
                    >
                      <Eye size={14} style={{ color: "#a8874e" }} />
                      <span>View</span>
                    </a>

                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDelete(doc.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid #fecdd3",
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontSize: "12px",
                        cursor: "pointer",
                        opacity: deletingId === doc.id ? 0.5 : 1,
                      }}
                      title="Delete Document"
                    >
                      {deletingId === doc.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

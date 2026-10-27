"use client"
import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { formatRupee, numberToWordsRupees, formatShortId } from "@/lib/utils"
import { sileo } from "sileo"

/**
 * Builds a clean, self-explanatory, filesystem-safe PDF filename for any document.
 * Example outputs:
 * - Quotation_WCO-Q-4510_PR-4510_West-Coast-Optilinks_27-Oct-2026
 * - PurchaseOrder_SKF-PO-0001_SKF-India_27-Oct-2026
 * - RFQ_SKF-RFQ-0002_SKF-India_27-Oct-2026
 * - COC_WCO-COC-0001_West-Coast-Optilinks_27-Oct-2026
 */
export function buildSmartPdfFilename({
  docType,
  docNumber,
  partyName,
  referenceNo,
  date,
}: {
  docType: "Quotation" | "PurchaseOrder" | "RFQ" | "COC"
  docNumber: string
  partyName?: string | null
  referenceNo?: string | null
  date?: Date | string | null
}): string {
  const cleanSegment = (str?: string | null, maxLen = 28) => {
    if (!str) return ""
    return str
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLen)
      .replace(/-+$/g, "")
  }

  const d = date ? new Date(date) : new Date()
  const dateStr = isNaN(d.getTime())
    ? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s+/g, "-")
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s+/g, "-")

  const cleanDocNo = cleanSegment(docNumber.toUpperCase(), 24) || "DOC"
  const cleanRef = referenceNo ? `Ref-${cleanSegment(referenceNo, 16)}` : ""
  const cleanParty = cleanSegment(partyName, 30)

  return [docType, cleanDocNo, cleanRef, cleanParty, dateStr].filter(Boolean).join("_")
}

/**
 * Sets document.title to the smart PDF filename so browser "Save as PDF"
 * pre-fills the exact filename automatically, then triggers window.print().
 */
export function triggerPrintWithFilename(filename: string, docLabel?: string) {
  if (typeof window === "undefined") return
  const previousTitle = document.title
  document.title = filename

  sileo.info({
    title: `PDF Filename Ready: ${filename}.pdf`,
    description: `In the print window, choose "Save as PDF" — the filename is already filled in for ${docLabel || "this document"}.`,
  })

  const restoreTitle = () => {
    // Keep the smart filename as the page title so subsequent Ctrl+P also uses it
    document.title = filename
    window.removeEventListener("afterprint", restoreTitle)
  }
  window.addEventListener("afterprint", restoreTitle)

  setTimeout(() => {
    window.print()
  }, 60)

  // Unused fallback reference so previousTitle is preserved if needed
  void previousTitle
}

export function DocumentPrintPortal({
  children,
  filename,
}: {
  children: React.ReactNode
  filename?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep document.title synced with the smart PDF filename so even Ctrl+P / Cmd+P auto-fills the filename
  useEffect(() => {
    if (!filename || typeof document === "undefined") return
    document.title = filename
    const handleBeforePrint = () => {
      document.title = filename
    }
    window.addEventListener("beforeprint", handleBeforePrint)
    return () => window.removeEventListener("beforeprint", handleBeforePrint)
  }, [filename])

  if (!mounted) return null

  return createPortal(
    <div id="document-print-portal" className="hidden print:block w-full bg-white text-slate-900">
      <style type="text/css" media="print">
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm 14mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              height: auto !important;
              overflow: visible !important;
            }
            body > *:not(#document-print-portal) {
              display: none !important;
            }
            #document-print-portal {
              display: block !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .doc-table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            .doc-table thead {
              display: table-header-group;
            }
            .doc-table thead tr,
            .doc-table thead th {
              background-color: #0f172a !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .doc-table tfoot {
              display: table-footer-group;
            }
            .doc-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .doc-avoid-break {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}
      </style>
      {children}
    </div>,
    document.body
  )
}

export type CorporateDocumentProps = {
  docType: "QUOTATION" | "PURCHASE ORDER" | "REQUEST FOR QUOTATION" | "CERTIFICATE OF CONFORMANCE"
  docNumber: string
  date: Date | string
  filename?: string
  settings: any
  metaRows?: { label: string; value: string | React.ReactNode }[]
  partyBox: {
    heading: string
    name: string
    address?: string | null
    location?: string | null
    gstNumber?: string | null
    contact?: string | null
    email?: string | null
  }
  summaryBox: {
    heading: string
    title?: string | null
    subtitle?: string | null
    rows?: { label: string; value: string | React.ReactNode }[]
    declarationText?: string | null
  }
  introHtml?: string | null
  columns: {
    label: string
    width: string
    align?: "left" | "center" | "right"
  }[]
  rows: React.ReactNode[][]
  totals?: {
    subtotal: number
    totalGst: number
    grandTotal: number
  } | null
  notesBox?: {
    heading: string
    text: string
  } | null
  showBankDetails?: boolean
}

/**
 * Unified, pixel-consistent Corporate Document Layout used across
 * Quotations, Purchase Orders, Vendor RFQs, and Certificates of Conformance (COC)
 * for both PDF Printing and HTML Email Copying.
 */
export const CorporateDocumentTemplate = React.forwardRef<HTMLDivElement, CorporateDocumentProps>(
  function CorporateDocumentTemplate(
    {
      docType,
      docNumber,
      date,
      filename,
      settings,
      metaRows = [],
      partyBox,
      summaryBox,
      introHtml,
      columns,
      rows,
      totals,
      notesBox,
      showBankDetails = false,
    },
    ref
  ) {
    const formattedDate = (() => {
      const d = new Date(date)
      return isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    })()

    const companyName = settings?.companyName || "Radiant Industrial Company"
    const hasBankDetails =
      showBankDetails && (settings?.bankName || settings?.accountNumber || settings?.ifscCode)

    return (
      <div
        ref={ref}
        style={{
          color: "#0f172a",
          width: "100%",
          maxWidth: "210mm",
          margin: "0 auto",
          padding: "0",
          boxSizing: "border-box",
          fontSize: "12px",
          lineHeight: "1.5",
          fontFamily: "'Outfit', 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
          backgroundColor: "#ffffff",
        }}
      >
        {/* 1. Corporate Letterhead Header */}
        <table
          width="100%"
          border={0}
          cellPadding={0}
          cellSpacing={0}
          style={{
            borderBottom: "2px solid #0f172a",
            paddingBottom: "14px",
            marginBottom: "18px",
          }}
        >
          <tbody>
            <tr>
              <td valign="top" width="56%" style={{ paddingRight: "12px" }}>
                <img
                  src={settings?.logoUrl || "/logo-long.png"}
                  alt={companyName}
                  style={{
                    maxHeight: "52px",
                    objectFit: "contain",
                    marginBottom: "8px",
                    display: "block",
                  }}
                />
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.2px" }}>
                  {companyName}
                </div>
                {settings?.address && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      whiteSpace: "pre-wrap",
                      marginTop: "2px",
                      lineHeight: "1.4",
                    }}
                  >
                    {settings.address}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                  {settings?.phone && <span>Phone: {settings.phone}</span>}
                  {settings?.phone && settings?.email && <span> &nbsp;|&nbsp; </span>}
                  {settings?.email && <span>Email: {settings.email}</span>}
                </div>
                {settings?.gstNumber && (
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#0f172a",
                      marginTop: "3px",
                      fontFamily: "monospace",
                    }}
                  >
                    GSTIN: {settings.gstNumber}
                  </div>
                )}
              </td>

              <td valign="top" width="44%" align="right">
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#ea580c",
                    padding: "5px 14px",
                    borderRadius: "5px",
                    fontSize: docType.length > 18 ? "13px" : "15px",
                    fontWeight: 800,
                    letterSpacing: "0.8px",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  {docType}
                </div>

                <table
                  border={0}
                  cellPadding={2}
                  cellSpacing={0}
                  align="right"
                  style={{ fontSize: "11px", color: "#334155" }}
                >
                  <tbody>
                    <tr>
                      <td align="right" style={{ color: "#64748b", paddingRight: "8px", whiteSpace: "nowrap" }}>
                        Document No:
                      </td>
                      <td
                        align="right"
                        style={{
                          fontWeight: 800,
                          color: "#0f172a",
                          fontFamily: "monospace",
                          fontSize: "11.5px",
                        }}
                      >
                        {formatShortId(docNumber)}
                      </td>
                    </tr>
                    <tr>
                      <td align="right" style={{ color: "#64748b", paddingRight: "8px", whiteSpace: "nowrap" }}>
                        Issue Date:
                      </td>
                      <td align="right" style={{ fontWeight: 600, color: "#0f172a" }}>
                        {formattedDate}
                      </td>
                    </tr>
                    {metaRows.map((m, idx) => (
                      <tr key={idx}>
                        <td align="right" style={{ color: "#64748b", paddingRight: "8px", whiteSpace: "nowrap" }}>
                          {m.label}:
                        </td>
                        <td align="right" style={{ fontWeight: 600, color: "#0f172a" }}>
                          {m.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2. Party & Commercial Summary Box */}
        <table
          width="100%"
          border={0}
          cellPadding={0}
          cellSpacing={0}
          style={{
            marginBottom: "18px",
            backgroundColor: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            borderCollapse: "separate",
          }}
        >
          <tbody>
            <tr>
              <td
                valign="top"
                width="52%"
                style={{
                  padding: "12px 16px",
                  borderRight: "1px solid #cbd5e1",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    color: "#64748b",
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    marginBottom: "4px",
                  }}
                >
                  {partyBox.heading}
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0f172a" }}>
                  {partyBox.name}
                </div>
                {partyBox.address && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      marginTop: "2px",
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.4",
                    }}
                  >
                    {partyBox.address}
                  </div>
                )}
                {partyBox.location && !partyBox.address && (
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                    {partyBox.location}
                  </div>
                )}
                {partyBox.gstNumber && (
                  <div style={{ fontSize: "11px", color: "#0f172a", marginTop: "4px", fontFamily: "monospace" }}>
                    <strong>GSTIN:</strong> {partyBox.gstNumber}
                  </div>
                )}
                {partyBox.contact && (
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                    <strong>Contact:</strong> {partyBox.contact}
                  </div>
                )}
                {partyBox.email && (
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                    <strong>Email:</strong> {partyBox.email}
                  </div>
                )}
              </td>

              <td valign="top" width="48%" style={{ padding: "12px 16px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    color: "#64748b",
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    marginBottom: "4px",
                  }}
                >
                  {summaryBox.heading}
                </div>
                {summaryBox.title && (
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {summaryBox.title}
                  </div>
                )}
                {summaryBox.subtitle && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      marginTop: "2px",
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.4",
                      marginBottom: summaryBox.rows?.length ? "6px" : "0",
                    }}
                  >
                    {summaryBox.subtitle}
                  </div>
                )}
                {summaryBox.declarationText && (
                  <div style={{ fontSize: "11px", color: "#334155", lineHeight: "1.45" }}>
                    {summaryBox.declarationText}
                  </div>
                )}
                {summaryBox.rows && summaryBox.rows.length > 0 && (
                  <table width="100%" border={0} cellPadding={1} cellSpacing={0} style={{ fontSize: "11px" }}>
                    <tbody>
                      {summaryBox.rows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ color: "#64748b", paddingRight: "6px", width: "42%" }}>
                            <strong>{r.label}:</strong>
                          </td>
                          <td style={{ color: "#0f172a", fontWeight: 600 }}>{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. Optional Intro Message Banner */}
        {introHtml && (
          <div
            style={{
              marginBottom: "16px",
              padding: "9px 14px",
              backgroundColor: "#f8fafc",
              borderLeft: "3px solid #ea580c",
              borderTop: "1px solid #e2e8f0",
              borderRight: "1px solid #e2e8f0",
              borderBottom: "1px solid #e2e8f0",
              color: "#334155",
              fontSize: "11.5px",
            }}
            dangerouslySetInnerHTML={{ __html: introHtml }}
          />
        )}

        {/* 4. Line Items Table */}
        <table
          className="doc-table"
          width="100%"
          border={0}
          cellPadding={0}
          cellSpacing={0}
          style={{
            borderCollapse: "collapse",
            border: "1px solid #cbd5e1",
            marginBottom: "18px",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    backgroundColor: "#0f172a",
                    color: "#ffffff",
                    border: "1px solid #0f172a",
                    padding: "8px 7px",
                    textAlign: col.align || "left",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    letterSpacing: "0.4px",
                    width: col.width,
                  }}
                >
                  <span style={{ color: "#ffffff" }}>{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  backgroundColor: rIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                }}
              >
                {cells.map((cell, cIdx) => {
                  const col = columns[cIdx]
                  return (
                    <td
                      key={cIdx}
                      style={{
                        border: "1px solid #cbd5e1",
                        padding: "8px 7px",
                        textAlign: col?.align || "left",
                        verticalAlign: "top",
                        wordBreak: "break-word",
                        color: "#0f172a",
                        fontSize: "11.5px",
                      }}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 5. Totals + Amount in Words + Notes / Bank Details */}
        {(totals || notesBox || hasBankDetails) && (
          <table
            className="doc-avoid-break"
            width="100%"
            border={0}
            cellPadding={0}
            cellSpacing={0}
            style={{ marginBottom: "20px" }}
          >
            <tbody>
              <tr>
                <td
                  width={totals ? "55%" : "100%"}
                  valign="top"
                  style={{ paddingRight: totals ? "18px" : "0" }}
                >
                  {totals && (
                    <div
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        marginBottom: notesBox || hasBankDetails ? "10px" : "0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          marginBottom: "3px",
                        }}
                      >
                        Total Amount in Words (Incl. GST)
                      </div>
                      <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a", fontStyle: "italic" }}>
                        {numberToWordsRupees(totals.grandTotal)}
                      </div>
                    </div>
                  )}

                  {hasBankDetails && (
                    <div
                      style={{
                        padding: "9px 14px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        marginBottom: notesBox ? "10px" : "0",
                        fontSize: "10.5px",
                        color: "#334155",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9.5px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          marginBottom: "3px",
                        }}
                      >
                        Company Bank Details for Remittance
                      </div>
                      <div>
                        {settings?.bankName && (
                          <span>
                            <strong>Bank:</strong> {settings.bankName} &nbsp;|&nbsp;{" "}
                          </span>
                        )}
                        {settings?.accountNumber && (
                          <span>
                            <strong>A/C No:</strong>{" "}
                            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                              {settings.accountNumber}
                            </span>{" "}
                            &nbsp;|&nbsp;{" "}
                          </span>
                        )}
                        {settings?.ifscCode && (
                          <span>
                            <strong>IFSC:</strong>{" "}
                            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                              {settings.ifscCode}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {notesBox && notesBox.text && (
                    <div
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: "#b45309",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          marginBottom: "3px",
                        }}
                      >
                        {notesBox.heading}
                      </div>
                      <div style={{ fontSize: "11px", color: "#334155", whiteSpace: "pre-wrap" }}>
                        {notesBox.text}
                      </div>
                    </div>
                  )}
                </td>

                {totals && (
                  <td width="45%" valign="top">
                    <table
                      width="100%"
                      border={0}
                      cellPadding={0}
                      cellSpacing={0}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderCollapse: "collapse",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              padding: "8px 12px",
                              color: "#475569",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "11.5px",
                            }}
                          >
                            Subtotal (Excl. GST)
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              fontWeight: 700,
                              color: "#0f172a",
                              textAlign: "right",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "11.5px",
                              fontFamily: "monospace",
                            }}
                          >
                            {formatRupee(totals.subtotal)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "8px 12px",
                              color: "#475569",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "11.5px",
                            }}
                          >
                            Total GST
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              fontWeight: 700,
                              color: "#0f172a",
                              textAlign: "right",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "11.5px",
                              fontFamily: "monospace",
                            }}
                          >
                            {formatRupee(totals.totalGst)}
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: "#fff7ed" }}>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontSize: "12.5px",
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            Grand Total (Incl. GST)
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontSize: "14px",
                              fontWeight: 800,
                              color: "#ea580c",
                              textAlign: "right",
                              fontFamily: "monospace",
                            }}
                          >
                            {formatRupee(totals.grandTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        )}

        {/* 6. Terms & Authorized Signatory Footer */}
        <table
          className="doc-avoid-break"
          width="100%"
          border={0}
          cellPadding={0}
          cellSpacing={0}
          style={{
            borderTop: "1.5px solid #cbd5e1",
            paddingTop: "14px",
            marginTop: "14px",
          }}
        >
          <tbody>
            <tr>
              <td width="65%" valign="top" style={{ paddingRight: "18px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    color: "#64748b",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    marginBottom: "4px",
                  }}
                >
                  Commercial Terms & Conditions
                </div>
                {settings?.bottomDetails ? (
                  <div
                    style={{ fontSize: "10.5px", color: "#475569", lineHeight: "1.45" }}
                    dangerouslySetInnerHTML={{ __html: settings.bottomDetails }}
                  />
                ) : (
                  <div style={{ fontSize: "10.5px", color: "#475569", lineHeight: "1.45" }}>
                    1. Goods once sold/ordered are subject to standard commercial terms.
                    <br />
                    2. All disputes are subject to local jurisdiction.
                  </div>
                )}
              </td>

              <td width="35%" valign="bottom" align="right" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  For {companyName}
                </div>
                {settings?.signatureUrl ? (
                  <img
                    src={settings.signatureUrl}
                    alt="Authorized Signatory"
                    style={{
                      maxHeight: "55px",
                      margin: "0 auto 6px",
                      display: "block",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div style={{ height: "46px" }} />
                )}
                <div
                  style={{
                    borderTop: "1px solid #334155",
                    paddingTop: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Authorized Signatory
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 7. Subtle System Footer Line */}
        {filename && (
          <div
            className="doc-avoid-break"
            style={{
              marginTop: "12px",
              paddingTop: "6px",
              borderTop: "1px dashed #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "9.5px",
              color: "#94a3b8",
              fontFamily: "monospace",
            }}
          >
            <span>File: {filename}.pdf</span>
            <span>
              {companyName} • Ref #{formatShortId(docNumber)}
            </span>
          </div>
        )}
      </div>
    )
  }
)

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { recordManualPayment, recordPayment, recordBulkPayment } from "@/app/actions/payment"
import { X, Check, Loader2 } from "lucide-react"
import { sileo } from "sileo"
import { formatRupee, formatShortId } from "@/lib/utils"
import { SmartNumberInput } from "./ui/SmartNumberInput"

export function TransactionModal({
  onClose,
  quotations,
  pos,
  purchases,
  clients,
  initialDefaults,
}: any) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [category, setCategory] = useState(initialDefaults?.category || "manual")
  const [type, setType] = useState<"IN" | "OUT">(
    initialDefaults?.type ||
      (initialDefaults?.category === "po" || initialDefaults?.category === "purchase"
        ? "OUT"
        : "IN")
  )
  const [entityId, setEntityId] = useState(initialDefaults?.entityId || "")
  const [entityName, setEntityName] = useState("")

  const [amount, setAmount] = useState(initialDefaults?.amount || "")
  const [method, setMethod] = useState("BANK_TRANSFER")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState(initialDefaults?.notes || "")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [status, setStatus] = useState("CLEARED")

  const getSelectedEntity = () => {
    if (!entityId) return null
    if (category === "quotation") return quotations?.find((q: any) => q.id === entityId)
    if (category === "po") return pos?.find((p: any) => p.id === entityId)
    if (category === "purchase") return purchases?.find((p: any) => p.id === entityId)
    return null
  }

  const selectedEntity = getSelectedEntity()

  const handleEntityChange = (newEntityId: string) => {
    setEntityId(newEntityId)
    if (!newEntityId) {
      setAmount("")
      return
    }

    let entity = null
    if (category === "quotation") entity = quotations?.find((q: any) => q.id === newEntityId)
    if (category === "po") entity = pos?.find((p: any) => p.id === newEntityId)
    if (category === "purchase") entity = purchases?.find((p: any) => p.id === newEntityId)

    if (entity) {
      const remainingPaise =
        (entity.totalAmount || 0) + (entity.totalGst || 0) - (entity.amountPaid || 0)
      setAmount((remainingPaise / 100).toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (selectedEntity) {
        const remainingPaise =
          (selectedEntity.totalAmount || 0) +
          (selectedEntity.totalGst || 0) -
          (selectedEntity.amountPaid || 0)
        const amountPaise = Number(amount) * 100
        if (amountPaise > remainingPaise) {
          sileo.warning({
            title: "Overpayment Prevented",
            description: `Maximum amount allowed is ${formatRupee(remainingPaise)}.`,
          })
          setIsSubmitting(false)
          return
        }
      }

      if (
        category === "manual" ||
        category === "LOAN" ||
        category === "TRANSFER" ||
        category === "UNTAGGED"
      ) {
        await recordManualPayment({
          type,
          category: category === "manual" ? "MANUAL" : category,
          entityName,
          amount: Number(amount),
          method,
          reference,
          notes,
          date,
          status,
          untagged: category === "UNTAGGED",
          clientId: category === "UNTAGGED" && entityId ? entityId : undefined,
        })
      } else if (category === "bulk_payment") {
        await recordBulkPayment({
          clientId: entityId,
          amount: Number(amount),
          method,
          reference,
          notes,
          date,
          status,
        })
      } else {
        await recordPayment({
          type: category as "quotation" | "po" | "purchase",
          entityId,
          amount: Number(amount),
          method,
          reference,
          notes,
          date,
          status,
        })
      }
      sileo.success({
        title: "Transaction Recorded",
        description: `₹${Number(amount).toLocaleString("en-IN")} (${type}) added to ledger.`,
      })
      router.refresh()
      onClose()
    } catch (err) {
      sileo.error({
        title: "Transaction Failed",
        description: "Failed to save transaction to ledger.",
      })
      setIsSubmitting(false)
    }
  }

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
  const labelClass = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Record Ledger Transaction</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Log incoming client collections, vendor payments, loans, or manual entries.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    handleEntityChange("")
                    if (e.target.value === "quotation" || e.target.value === "bulk_payment")
                      setType("IN")
                    if (e.target.value === "po" || e.target.value === "purchase") setType("OUT")
                  }}
                  className={inputClass}
                >
                  <option value="manual">Manual Entry</option>
                  <option value="LOAN">Loan (Borrow / Lend)</option>
                  <option value="TRANSFER">Internal Transfer</option>
                  <option value="UNTAGGED">Untagged Payment</option>
                  <option value="quotation">Against Quotation / Sale</option>
                  <option value="bulk_payment">Bulk Payment (Client)</option>
                  <option value="po">Against Purchase Order</option>
                  <option value="purchase">Against Direct Purchase</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Direction</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                  disabled={!["manual", "LOAN", "TRANSFER", "UNTAGGED"].includes(category)}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="IN">
                    {category === "LOAN"
                      ? "Borrowed from someone (+)"
                      : category === "TRANSFER"
                      ? "Transferred IN (+)"
                      : "Money IN (+)"}
                  </option>
                  <option value="OUT">
                    {category === "LOAN"
                      ? "Lent to someone (-)"
                      : category === "TRANSFER"
                      ? "Transferred OUT (-)"
                      : "Money OUT (-)"}
                  </option>
                </select>
              </div>
            </div>

            {(category === "LOAN" || category === "TRANSFER") && (
              <div>
                <label className={labelClass}>Name of Person / Account</label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            )}

            {category === "UNTAGGED" && (
              <div>
                <label className={labelClass}>Select Client (Optional)</label>
                <select
                  value={entityId}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- No specific client --</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  This payment can be resolved and linked to a quotation later.
                </p>
              </div>
            )}

            {category === "bulk_payment" && (
              <div>
                <label className={labelClass}>Select Client</label>
                <select
                  required
                  value={entityId}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.creditBalance > 0 ? `(Cr: ${formatRupee(c.creditBalance)})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Payment will be auto-allocated to oldest unpaid quotations first.
                </p>
              </div>
            )}

            {category === "quotation" && (
              <div>
                <label className={labelClass}>Select Quotation</label>
                <select
                  required
                  value={entityId}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {quotations?.map((q: any) => (
                    <option key={q.id} value={q.id}>
                      #{formatShortId(q.id)} {q.prNo ? `(${q.prNo}) ` : ""}- {q.client.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {category === "po" && (
              <div>
                <label className={labelClass}>Select Purchase Order</label>
                <select
                  required
                  value={entityId}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {pos?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.poNumber || formatShortId(p.id)} - {p.supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {category === "purchase" && (
              <div>
                <label className={labelClass}>Select Direct Purchase</label>
                <select
                  required
                  value={entityId}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {purchases?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      #{formatShortId(p.id)} - {p.supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedEntity && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Total Value:</span>
                  <span className="text-slate-900 font-mono font-bold">
                    {formatRupee(
                      (selectedEntity.totalAmount || 0) + (selectedEntity.totalGst || 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Already Paid:</span>
                  <span className="text-emerald-700 font-mono font-semibold">
                    {formatRupee(selectedEntity.amountPaid || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 pb-1.5 border-b border-slate-200">
                  <span>Current Due:</span>
                  <span className="text-orange-600 font-mono font-bold">
                    {formatRupee(
                      (selectedEntity.totalAmount || 0) +
                        (selectedEntity.totalGst || 0) -
                        (selectedEntity.amountPaid || 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Due after this txn:</span>
                  <span className="text-emerald-700 font-mono font-bold">
                    {formatRupee(
                      Math.max(
                        0,
                        (selectedEntity.totalAmount || 0) +
                          (selectedEntity.totalGst || 0) -
                          (selectedEntity.amountPaid || 0) -
                          (Number(amount) * 100 || 0)
                      )
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Amount (₹)</label>
                <SmartNumberInput
                  required
                  value={amount}
                  onValueChange={(_, str) => setAmount(str)}
                  className={`${inputClass} font-mono font-bold`}
                  placeholder="0.00 or e.g. 5000+1200"
                />
              </div>
              <div>
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={inputClass}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="CLEARED">Cleared (Completed)</option>
                  <option value="PENDING">Pending (PDC / Uncleared)</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Reference (Cheque No, UTR, etc)</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className={labelClass}>Remarks / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Optional notes"
              />
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="transaction-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Check className="w-4 h-4 text-white" />
            )}
            <span className="text-white">{isSubmitting ? "Saving..." : "Save Transaction"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

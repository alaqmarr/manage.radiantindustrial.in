import re

with open('src/components/POActions.tsx', 'r') as f:
    content = f.read()

table_header_old = """<thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Code</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "45%" }}>Description</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "10%" }}>Qty</th>
                
                
              </tr>
            </thead>"""

table_header_new = """<thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Code</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "35%" }}>Description</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "10%" }}>Qty</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Rate</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "10%" }}>GST</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Total</th>
              </tr>
            </thead>"""

content = content.replace(table_header_old, table_header_new)

tbody_old_start = """<td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", verticalAlign: "top" }}>
                    <span style={{ fontWeight: "600", color: "#374151", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</span>
                    <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "4px" }}>{item.product.unit}</span>
                  </td>
                  
                </tr>"""

tbody_new_start = """<td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", verticalAlign: "top" }}>
                    <span style={{ fontWeight: "600", color: "#374151", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</span>
                    <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "4px" }}>{item.product.unit}</span>
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", verticalAlign: "top", color: "#374151", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    {formatRupee(item.unitPrice)}
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", verticalAlign: "top", color: "#374151", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    {item.gstRate}%
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", verticalAlign: "top", color: "#111827", fontWeight: "600", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    {formatRupee(item.quantity * item.unitPrice)}
                  </td>
                </tr>"""

content = content.replace(tbody_old_start, tbody_new_start)

totals_old = """<div style={{ marginTop: '20px', textAlign: 'right' }}>
            <p style={{ margin: '4px 0', color: '#475569' }}>Total Amount: <strong>?</strong></p>
            <p style={{ margin: '4px 0', color: '#475569' }}>Total GST: <strong>?</strong></p>
            <p style={{ margin: '4px 0', color: '#0f172a', fontSize: '18px' }}>Grand Total: <strong>?</strong></p>
          </div>"""

totals_new = """<div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ width: '60%' }}>
              <p style={{ margin: '0 0 8px 0', color: '#4b5563', fontSize: '12px' }}>Amount in words:</p>
              <p style={{ margin: '0', color: '#111827', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>
                {numberToWordsRupees(po.totalAmount + po.totalGst)}
              </p>
            </div>
            <div style={{ width: '35%' }}>
              <table width="100%" border={0} cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td align="right" style={{ padding: '4px 8px', color: '#4b5563', fontSize: '13px' }}>Subtotal:</td>
                    <td align="right" style={{ padding: '4px 8px', color: '#111827', fontSize: '13px', fontWeight: '600' }}>{formatRupee(po.totalAmount)}</td>
                  </tr>
                  <tr>
                    <td align="right" style={{ padding: '4px 8px', color: '#4b5563', fontSize: '13px' }}>Total GST:</td>
                    <td align="right" style={{ padding: '4px 8px', color: '#111827', fontSize: '13px', fontWeight: '600' }}>{formatRupee(po.totalGst)}</td>
                  </tr>
                  <tr>
                    <td align="right" style={{ padding: '8px 8px 4px 8px', color: '#111827', fontSize: '15px', fontWeight: '700', borderTop: '2px solid #e5e7eb' }}>Grand Total:</td>
                    <td align="right" style={{ padding: '8px 8px 4px 8px', color: '#ea580c', fontSize: '16px', fontWeight: '800', borderTop: '2px solid #e5e7eb' }}>{formatRupee(po.totalAmount + po.totalGst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>"""

content = content.replace(totals_old, totals_new)

# Wait, there's another totals_old inside the HTML!
# But look at lines 386-391 in the view_file from earlier. It has nothing there.
# Let me just write the file out and see what happened.
with open('src/components/POActions.tsx', 'w') as f:
    f.write(content)

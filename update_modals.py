import re

def add_gst_verify(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()
    
    if 'verifyGSTAction' not in code:
        code = code.replace(
            'import { Loader2, X } from "lucide-react"',
            'import { Loader2, X, Search } from "lucide-react"\nimport { verifyGSTAction } from "@/app/actions/gst"'
        )
    
    # State hooks
    state_injection = '''
  const [isVerifyingGST, setIsVerifyingGST] = useState(false)
  const [gstInput, setGstInput] = useState("")

  const handleVerifyGST = async () => {
    if (!gstInput.trim() || gstInput.length < 15) {
      alert("Please enter a valid 15-character GST Number.");
      return;
    }
    setIsVerifyingGST(true);
    try {
      const res = await verifyGSTAction(gstInput.trim());
      if (res.error) {
        alert(res.error);
      } else if (res.data) {
        // Autofill fields
        const form = document.getElementById(isEditing ? "edit-form" : "new-form") as HTMLFormElement;
        if (form) {
          const nameInput = form.elements.namedItem("name") as HTMLInputElement;
          const addressInput = form.elements.namedItem("address") as HTMLInputElement;
          const locationInput = form.elements.namedItem("location") as HTMLInputElement;
          if (nameInput) nameInput.value = res.data.name || "";
          if (addressInput) addressInput.value = res.data.address || "";
          if (locationInput) locationInput.value = res.data.location || "";
        }
        alert("Details fetched successfully! \\n" + (res.data.legalName ? "(" + res.data.legalName + ")" : ""));
      }
    } catch (e) {
      alert("Failed to verify GST.");
    } finally {
      setIsVerifyingGST(false);
    }
  }
'''
    # Inject state right after const isEditing = ...
    if 'isVerifyingGST' not in code:
        code = code.replace(
            '  const isEditing = action === "edit-client"\n' if 'ClientModal' in filepath else '  const isEditing = action === "edit-supplier"\n',
            ('  const isEditing = action === "edit-client"\n' if 'ClientModal' in filepath else '  const isEditing = action === "edit-supplier"\n') + state_injection
        )

    # Inject ID into forms
    code = code.replace('<form onSubmit={handleSubmit} className="p-6 space-y-4">', '<form id={isEditing ? "edit-form" : "new-form"} onSubmit={handleSubmit} className="p-6 space-y-4">')

    # Update GST input
    gst_field_pattern = r'(<input\s+defaultValue=\{editItem\?\.gstNumber\s*\|\|\s*""\}\s+name="gstNumber"\s+type="text".*?/>)'
    
    new_gst_field = '''
              <div className="flex gap-2">
                <input
                  defaultValue={editItem?.gstNumber || ""}
                  name="gstNumber"
                  type="text"
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-slate uppercase"
                  onChange={(e) => setGstInput(e.target.value)}
                  onFocus={(e) => {
                    if (!gstInput) setGstInput(e.target.value || (editItem?.gstNumber || ""));
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyGST}
                  disabled={isVerifyingGST}
                  className="flex items-center gap-1 px-3 py-2 bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 disabled:opacity-50 rounded-md transition-colors"
                >
                  {isVerifyingGST ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="text-xs font-semibold whitespace-nowrap">Verify</span>
                </button>
              </div>
    '''
    
    code = re.sub(gst_field_pattern, new_gst_field, code)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)

add_gst_verify('src/components/ClientModal.tsx')
add_gst_verify('src/components/SupplierModal.tsx')

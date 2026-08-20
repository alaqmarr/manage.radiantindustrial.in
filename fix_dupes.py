import re

def fix_dupes(filename, marker):
    with open(filename, 'r', encoding='utf-8') as f:
        code = f.read()
    
    # We want to find the first occurrence of the UI block and the second occurrence.
    # The block starts with <div>\s*<label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>
    
    parts = code.split('<div>\n                <label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>')
    if len(parts) > 2:
        # It's duplicated. We can just keep the first part and the last part
        # wait, the first part is everything before the first GST Number.
        # the last part is everything after the LAST GST Number.
        # Is there any other GST Number field in the file? No.
        new_code = parts[0] + '<div>\n                <label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>' + parts[-1]
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_code)
        print(f"Fixed {filename}")
    else:
        print(f"No duplicates in {filename}")

fix_dupes('src/components/RfqForm.tsx', 'GST')
fix_dupes('src/components/QuotationForm.tsx', 'GST')


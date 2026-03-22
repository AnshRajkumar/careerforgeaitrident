import os
import glob
import re

directory = r"d:\\careerforgeai\\CAIFRONTEND\\CarrerforgeAI\\public"
files_to_check = glob.glob(directory + "/**/*.html", recursive=True) + glob.glob(directory + "/**/*.js", recursive=True)

count = 0
for file_path in files_to_check:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        new_content = re.sub(r"'(\$\{API_BASE_URL\}[^']*)'", r"`\1`", content)
        
        if new_content != content:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            count += 1
            print(f"Fixed quotes in: {file_path}")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

print(f"Done. Fixed {count} files.")

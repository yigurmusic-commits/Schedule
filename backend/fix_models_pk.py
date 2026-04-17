import re

with open('app/models/models.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Match: something_id = Column(BigInteger, primary_key=True
    if re.search(r'\w+_id\s*=\s*Column\(', line) and 'primary_key=True' in line:
        line = re.sub(r'(=\s*Column\()', r'\1"id", ', line)
    new_lines.append(line)

with open('app/models/models.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)


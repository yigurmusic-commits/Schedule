import re

with open('app/models/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace ForeignKey("tablename.some_id") with ForeignKey("tablename.id")
content = re.sub(r'ForeignKey\("([a-z_]+)\.[a-z_]+_id"\)', r'ForeignKey("\1.id")', content)

with open('app/models/models.py', 'w', encoding='utf-8') as f:
    f.write(content)

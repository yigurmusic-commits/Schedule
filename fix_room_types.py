import re

with open('college_schedule_production_schema_fixed.sql', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'(rt_\w+)\.room_type_id', r'\1.id', content)
content = re.sub(r'SELECT\s+room_type_id\s+FROM room_types', 'SELECT id FROM room_types', content)

with open('college_schedule_production_schema_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(content)

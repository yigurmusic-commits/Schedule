import re

with open('college_schedule_production_schema_fixed.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fixes
subs = [
    (r'\birm\.subject_id\b', 'irm.id'),
    (r'\brt\.room_type_id\b', 'rt.id'),
    (r'\bt\.teacher_id\b', 't.id'),
]

for pat, repl in subs:
    content = re.sub(pat, repl, content)

with open('college_schedule_production_schema_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(content)

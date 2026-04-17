import re

with open('college_schedule_production_schema_fixed.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fixes for SELECT / FROM / JOIN clauses
subs = [
    (r'\btr\.teacher_id\b', 'tr.id'),
    (r'\bt\.teacher_id\b', 't.id'),
    (r'\bsb\.subject_id\b', 'sb.id'),
    (r'\blt\.lesson_type_id\b', 'lt.id'),
    (r'\bg\.group_id\b', 'g.id'),
    (r'\bap\.academic_period_id\b', 'ap.id'),
    # Note: ts can be time_slots, so ts.time_slot_id -> ts.id
    (r'\bts\.time_slot_id\b', 'ts.id'),
    # Note: ts can also be teacher_subjects, so ts.subject_id is valid!
    # Let's manually check the ones in the error log
    (r'\bsp\.specialty_id\b', 'sp.id'),
]

for pat, repl in subs:
    content = re.sub(pat, repl, content)

with open('college_schedule_production_schema_fixed.sql', 'w', encoding='utf-8') as f:
    f.write(content)

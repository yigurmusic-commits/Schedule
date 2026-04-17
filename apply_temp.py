import psycopg2
import io
import sys

# Connect to the exact backend database
conn = psycopg2.connect('postgresql://postgres:raim100100@localhost:5432/schedulesys')
conn.autocommit = True
cur = conn.cursor()

# Drop public schema to make absolutely sure everything is wiped clean
print('Dropping schema...')
cur.execute('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')

# Read and execute the fixed schema
print('Applying schema...')
with io.open('college_schedule_production_schema_fixed.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

cur.execute(sql)
print('Applied college_schedule_production_schema_fixed.sql successfully.')

conn.close()

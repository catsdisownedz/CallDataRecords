#!/bin/bash

PG_COUNT=$(docker exec -i postgres psql -U z -d db -t -c "SELECT COUNT(*) FROM cdrs;" | xargs)
MY_COUNT=$(docker exec -i mysql mysql -ubackend -pbackendpass -e "USE cdrdb; SELECT COUNT(*) FROM cdrs;" -s -N)

echo "PostgreSQL CDR count: $PG_COUNT"
echo "MySQL CDR count:      $MY_COUNT"

if [ "$PG_COUNT" = "$MY_COUNT" ]; then
    echo "✅ CDR counts match!"
else
    echo "❌ CDR count mismatch!"
fi

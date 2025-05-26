#!/bin/bash

CSV_FILE=/data/users.csv
OUTPUT_JSON=/output/cdr-realm.json

echo "🛠 Generating cdr-realm.json from users.csv..."

USERS_JSON=""

# Track added usernames
declare -A seen_users

# Parse users.csv, skipping duplicates dynamically
while IFS=',' read -r username password; do
    [ -z "$username" ] && continue
    username=$(echo "$username" | xargs) # Trim whitespace

    # Skip duplicates dynamically
    if [[ ${seen_users[$username]} ]]; then
        echo "⚠️  Skipping duplicate user '$username'"
        continue
    fi

    seen_users[$username]=1

    USERS_JSON+="
    {
      \"username\": \"${username}\",
      \"enabled\": true,
      \"email\": \"${username}@example.com\",
      \"emailVerified\": true,
      \"firstName\": \"${username}\",
      \"lastName\": \"User\",
      \"credentials\": [
        {
          \"type\": \"password\",
          \"value\": \"${password}\",
          \"temporary\": false
        }
      ]
    },"

    echo "✅ Added user: $username"
done < <(tail -n +2 "$CSV_FILE")  # Skip header

# Finalize JSON
USERS_JSON="[${USERS_JSON%,}]"

cat <<EOF > "$OUTPUT_JSON"
{
  "realm": "cdr-realm",
  "enabled": true,
  "loginTheme": "cdr-pastel",
  "clients": [
    {
      "clientId": "cdr-frontend",
      "publicClient": true,
      "redirectUris": ["http://localhost:8080/*"],
      "webOrigins": ["*"],
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": true
    }
  ],
  "users": $USERS_JSON
}
EOF

echo "📦 Realm generated with ${#seen_users[@]} unique user(s)."

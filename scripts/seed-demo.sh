#!/usr/bin/env bash
# Seed a known demo merchant + sample menu items so the demo loop has data
# from the very first cold-open. Idempotent enough — re-running creates a
# fresh merchant (the server doesn't dedupe by name).
#
# Usage:
#   API=https://state-falls-new-volleyball.trycloudflare.com ./scripts/seed-demo.sh
#   API=http://localhost:3000 LAT=48.7758 LNG=9.1829 ./scripts/seed-demo.sh
#
# Defaults to the Stuttgart Marktplatz coordinates.

set -euo pipefail

API="${API:-http://localhost:3000}"
LAT="${LAT:-48.7758}"
LNG="${LNG:-9.1829}"
DEVICE_ID="${DEVICE_ID:-demo-seed-$(date +%s)}"

echo "→ Health check: $API/health"
curl -sf --max-time 5 "$API/health" > /dev/null || { echo "API not reachable"; exit 1; }

echo "→ Creating merchant…"
MERCHANT_JSON=$(curl -sf -X POST "$API/api/merchant" \
  -H 'Content-Type: application/json' \
  -d "$(cat <<JSON
{
  "owner_device_id": "$DEVICE_ID",
  "name": "Café Anatolia",
  "type": "café",
  "lat": $LAT,
  "lng": $LNG,
  "geohash6": null,
  "goal": "fill_quiet_hours",
  "max_discount_pct": 20,
  "time_windows": ["lunch","afternoon"],
  "inventory_tags": ["cappuccino","croissant","sandwich","kuchen"],
  "locale": "de"
}
JSON
)")

MERCHANT_ID=$(echo "$MERCHANT_JSON" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\(.*\)"/\1/')
echo "  merchant_id=$MERCHANT_ID"

echo "→ Adding menu items…"
add_item () {
  curl -sf -X POST "$API/api/merchant/$MERCHANT_ID/menu" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$1\",\"price_cents\":$2,\"category\":\"$3\"}" > /dev/null
  echo "  + $1 ($2 ct, $3)"
}

add_item "Cappuccino"               320 "drink"
add_item "Latte Macchiato"          390 "drink"
add_item "Espresso"                 250 "drink"
add_item "Mineralwasser still"      280 "drink"
add_item "Croissant"                250 "food"
add_item "Sandwich Caprese"         620 "food"
add_item "Quiche Lorraine"          580 "food"
add_item "Hummus-Bowl"              790 "food"
add_item "Schoko-Mousse"            420 "dessert"
add_item "Apfelstrudel"             480 "dessert"
add_item "Mittagsmenü Suppe + Salat" 990 "special"

echo
echo "✓ Seed complete."
echo "  Owner device id: $DEVICE_ID"
echo "  Merchant id:     $MERCHANT_ID"
echo
echo "Set DEVICE_ID in your phone's AsyncStorage to claim this merchant,"
echo "or just open the app as customer near $LAT,$LNG to receive offers."

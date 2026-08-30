# Analytics Schema

The `hebrew_transliterator_usage` Analytics Engine dataset stores one row for
each accepted product event. The browser sends only `schemaVersion` and a
whitelisted event name, plus the coarse `sefaria` or `arbitrary` classification
for audio listen/download actions. All location fields are added by the Worker
from Cloudflare's `request.cf` metadata. No Hebrew, transliteration, reference,
audio filename, or content hash is stored in analytics.

## Version 3 field map

| Column | Meaning |
| --- | --- |
| `index1` | Event name |
| `blob1` | Storage schema (`schema-3`) |
| `blob2` | Client event schema |
| `blob3` | Worker version ID |
| `blob4` | Worker version tag |
| `blob5` | Worker version timestamp |
| `blob6` | Request hostname |
| `blob7` | Continent code |
| `blob8` | Country code |
| `blob9` | State or region name |
| `blob10` | State or region code |
| `blob11` | City |
| `blob12` | Postal code |
| `blob13` | Metro/DMA code |
| `blob14` | Timezone |
| `blob15` | EU-country indicator (`1` or `0`) |
| `blob16` | Serving Cloudflare data center code |
| `blob17` | Coordinates-present indicator (`1` or `0`) |
| `blob18` | Audio source (`sefaria`, `arbitrary`, or empty for non-audio events) |
| `double1` | Event count (`1`) |
| `double2` | Approximate latitude, or `0` when unavailable |
| `double3` | Approximate longitude, or `0` when unavailable |

Empty strings indicate unavailable string dimensions. Geographic values are
network-derived approximations and must not be treated as exact locations.

## Example: events by state or region

```sql
SELECT
  blob8 AS country,
  blob9 AS region,
  blob10 AS region_code,
  SUM(_sample_interval * double1) AS events
FROM hebrew_transliterator_usage
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY country, region, region_code
ORDER BY events DESC
```

## Example: events by city

```sql
SELECT
  blob8 AS country,
  blob9 AS region,
  blob11 AS city,
  blob12 AS postal_code,
  SUM(_sample_interval * double1) AS events
FROM hebrew_transliterator_usage
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY country, region, city, postal_code
ORDER BY events DESC
```

Results should be reported in aggregate. Avoid publishing small geographic
groups that could make individual visitors recognizable.

## Example: audio activity and generation cost

```sql
SELECT
  index1 AS event,
  blob18 AS source_type,
  SUM(_sample_interval * double1) AS actions
FROM hebrew_transliterator_usage
WHERE timestamp > NOW() - INTERVAL '30' DAY
  AND index1 IN ('audio_generated', 'audio_listened', 'audio_downloaded')
GROUP BY event, source_type
ORDER BY event, source_type
```

`audio_generated` is written by the Worker only after Azure successfully
creates a new file. A reused R2 object does not increment it, so this event is
the closest count of billable synthesis requests. Listen and download events
are browser actions and may be higher than generation counts.

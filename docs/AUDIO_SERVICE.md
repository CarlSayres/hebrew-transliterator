# Azure Audio Service

The production audio path uses one fixed rendering profile:

- Voice: `he-IL-HilaNeural` (Hila)
- Prosody rate: `-60%`
- Output: 24 kHz, 48 kbit/s mono MP3
- Pronunciation rules: versioned IPA lexicon generated from the transliterator

The Worker holds the Azure credential, creates a short-lived pronunciation
lexicon for Azure to retrieve, calls Azure Speech, and deletes that serving copy
after synthesis. For debugging, it also stores the exact lexicon and SSML in R2
under the `debug/` prefix. Audio made from unchanged Sefaria imports is stored
in R2; audio made from pasted or edited Hebrew is not stored.

## Cloudflare setup

1. In **R2 Object Storage**, create a bucket named
   `hebrew-transliterator-audio`.
2. In the `hebrew-transliterator` Worker, add encrypted secrets named
   `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. The region is the short Azure
   resource region, such as `eastus`, not a full URL.
3. Deploy the repository. `wrangler.jsonc` binds the bucket as `AUDIO_BUCKET`
   and limits new synthesis attempts to 10 per visitor per minute.

Do not put the Azure key in Git, JavaScript, `wrangler.jsonc`, or a Cloudflare
plain-text variable.

## Cache identity

The R2 object name is SHA-256 over the normalized Hebrew plus the fixed voice,
rate, output format, tzere choice, and pronunciation-rules version. Whitespace
is collapsed to a single space rather than deleted because word boundaries can
change speech. When pronunciation rules change, increment the Worker rules
version so old audio cannot be mistaken for the new rendering.

Sefaria audio objects store the imported reference in the
`sefariaReferences` custom-metadata field. If identical text is imported from
more than one reference, the field keeps a compact ` | `-separated list while
the audio itself remains shared. Hebrew text is never stored in object metadata.

## Debug artifacts

Every new Azure synthesis attempt stores the exact request artifacts under the
same content hash used by the corresponding audio key:

```text
debug/lexicons/<hash>.xml
debug/ssml/<hash>.ssml
```

Both objects contain metadata for the audio key, source type, Sefaria reference
when applicable, rules version, voice, rate, tzere option, and creation time.
The files themselves contain the Hebrew and IPA submitted for speech, including
for arbitrary pasted or edited Hebrew. Configure an R2 lifecycle rule for the
`debug/` prefix to delete these objects after the desired short retention
period. The audio endpoint continues to work if a debug-artifact write fails.

## Analytics

`audio_generated` counts successful Azure syntheses and excludes R2 cache hits.
`audio_listened` and `audio_downloaded` count user actions. Each carries only
`sefaria` or `arbitrary`; no text, reference, hash, or filename is included.
Queries are in `docs/ANALYTICS_SCHEMA.md`.

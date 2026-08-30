# Azure Speech lexicon proof of concept

This test compares the fully inline IPA version of Barukh She'amar with an external Azure pronunciation lexicon. It does not alter the application's current speech behavior.

## Published files

- Lexicon: `https://hebrewtransliterator.com/speech/barukh-sheamar-v2.xml`
- Test SSML: `https://hebrewtransliterator.com/speech/barukh-sheamar-lexicon-test-v2.ssml`

The lexicon contains the 62 distinct vocalized Hebrew word forms in the application's 806-character, 87-word Barukh She'amar sample.

## Test procedure

1. Open Azure Speech Studio's Audio Content Creation tool.
2. Create an SSML file.
3. Paste the contents of `barukh-sheamar-lexicon-test-v2.ssml`.
4. Synthesize it with `he-IL-HilaNeural`.
5. Compare the audio against the fully inline IPA test.
6. Record the billable character count displayed by Speech Studio.
7. Change the voice name to `he-IL-AvriNeural` and repeat if desired.

## Expected outcome

The lexicon should provide the same word pronunciations and stresses while allowing Azure to process ordinary word boundaries. The request should be far smaller than the fully inline IPA document because Azure does not bill for the contents of the externally hosted lexicon.

Azure caches a custom lexicon by URI for up to 15 minutes. Publish corrections under a new versioned filename instead of overwriting this file during testing.

Version 2 corrects the bet in `מְשֻׁבָּח` and divides the long synthesis into explicit sentence-sized phrases. The phrase boundaries prevent Azure from choosing an internal synthesis boundary between `דָוִד` and `עַבְדֶּךָ`; sentence-boundary silence is fixed at 140 milliseconds, with a slightly longer break between the prayer's major sections.

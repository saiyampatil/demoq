# Audio summary: what other tools do, and what we took

Research done 2026-11-16 from public pages (vendor blogs, app store listings, reviews, accessibility guidance). Vendor pages are marketing, so details may differ from the products. Nothing here was verified inside the products.

## What the tools do

| Tool | What it offers | Link |
|---|---|---|
| NotebookLM Audio Overviews | Two AI hosts built from your sources. Customise length (Shorter, Default, Longer) and a focus prompt before it is made. Formats (Deep Dive, Brief, Critique, Debate). Interactive mode: join the hosts and ask. Citations are on its text answers, not the audio, and Google says the audio can compress or misstate nuance. | support.google.com/notebooklm/answer/16212820, blog.google/innovation-and-ai/products/notebooklm-audio-overviews, murf.ai/blog/notebook-lm-audio-customization, casrai.org/guides/notebooklm-for-research-workflows |
| Apple Podcasts transcripts | Transcript scrolls and highlights what is being spoken (word by word on iOS, like Apple Music lyrics). Tap a sentence to jump. Search the transcript and jump to a match. | sixcolors.com/post/2024/01/full-automatic-podcast-transcripts-coming-to-ios-17-4, macrumors.com/how-to/view-search-transcripts-podcasts-app |
| Snipd | AI chapters, searchable transcripts, one-tap highlights ("snips") with titles and summaries, speaker identification, export to notes tools. | apps.apple.com/app/id1557206126 |
| Spotify (podcast and audiobook design studies) | People listen while doing something else, so controls must work without looking. Bookmarks, resume where you left off, scannable chapters. | medium.com/design-bootcamp/why-were-rethinking-spotify-s-podcast-player-c8362533d115, medium.com/design-bootcamp/case-study-redesigning-spotify-with-audiobook-listeners-in-mind-3843a24eb9b2 |
| Speechify, ElevenReader, NaturalReader | Word-by-word synced highlighting, speed controls, bookmarks, sleep timer. | elevenreader.io/blog/free-speechify-alternatives, elevenlabs.io/blog/naturalreader-alternatives |
| Fireflies, Otter | Speaker names and timestamps on a transcript, click a line to jump, suggested "soundbites", summary at the top. | guide.fireflies.ai/articles/1026795385-Soundbites, read.ai/articles/fireflies-vs-otter-side-by-side-comparison |
| Dovetail, Condens | Clips from tagged transcript text, shared as a playlist or one reel. Advice: keep reels short (three to seven minutes); 45 minutes of clips saves nobody time. | dovetail.com/blog/research-stories-with-video-highlights, condens.io/blog/share-your-findings-and-engage-stakeholders |
| Descript | Edit the audio by editing the text; waveform and transcript side by side. | thepodcasthost.com/editing-production/descript-review |
| Accessibility guidance | Never autoplay. Honour reduced motion. Anything that moves must be pausable. A transcript is a companion; timestamps can clutter. | universaldesign.ie, yale usability guidance, smashingmagazine.com/2023/11/creating-accessible-ui-animations |

## What we took (built)

1. **Words light up as they are said** (Apple Podcasts, Speechify, ElevenReader): the line being spoken is lit word by word from the clock. Other lines step back to 75% while playing.
2. **A waveform scrubber** that shows where people's own words sit: quote bars are taller and a different colour from narration, so you can see the shape of the recording at a glance. The bars never animate; only the played edge moves.
3. **Chapter awareness** (Snipd, Spotify): "Now: The headline" and "Up next: ... at 1:20" in the bar, with a tick for each chapter.
4. **Back and forward 15 seconds** (Spotify, podcast apps): easy to hit without looking.
5. **Play only the quotes** (Dovetail and Condens reels): a stakeholder can listen to just what people said, or just the findings. The brief's length rule still applies to the whole script.
6. **Search the script and jump to matches** (Apple Podcasts, Snipd).
7. **A Listen view** (Apple Music lyrics style): the current line large, with the line before and after, and who is speaking. For reading on a phone while listening.
8. **Bookmarks** (Spotify, Snipd snips): star a line; "Bookmarked n" filters to them. Changes nothing in the script.
9. **Resume** (Spotify): the next visit offers "Resume from 3:12". It never starts by itself.
10. **Motion kept honest** (accessibility guidance): nothing autoplays, no decorative animation, the only moving things are the played edge and the word highlight, and the reduced-motion setting already switches every transition off.

## What we did not take, and why

- **Interactive "join the hosts" mode and AI hosts** (NotebookLM): our summary is read by a narrator and quotes are verbatim. An AI that chats would invent claims; the point of this feature is that every claim links to exact words.
- **Voice cloning** (Descript Overdub): quotes are the participants' own words, so they are never regenerated or synthesised in anyone's voice. Consent questions are in OPEN_QUESTIONS (#214, #236).
- **Auto-generated soundbites and clip export** (Fireflies): clips are the Showreel's job.
- **A free-text "focus" prompt** (NotebookLM): worth having, and it fits Rebuild in step 3. Not built yet.

## What this feature does that the tools above don't

Every claim line is cited to exact respondent turns, checked against the count it states, and goes stale when the analysis changes; the opening line is locked and says it is AI-generated. NotebookLM's audio, by Google's own account, is not citable.

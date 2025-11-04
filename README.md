# AI Text Checker Tool

A lightweight, local-first text quality checker that analyzes spelling, readability, style issues, and repetition. No external AI service required.

Features
- Spelling suggestions (offline) using pyspellchecker
- Readability metrics via textstat (Flesch, FK grade, Gunning Fog, etc.)
- Style heuristics: passive voice, long sentences, adverb overuse
- Repetition detector: repeated words and sentences
- CLI with JSON or human-readable output

Quick start
1) Create a virtual environment
   python3 -m venv .venv
   source .venv/bin/activate

2) Install dependencies
   pip install -r requirements.txt

3) Run on a file
   python -m aichecker check --file your_text.txt

4) Or pipe text via stdin
   echo "Your text here." | python -m aichecker check

5) JSON output
   echo "Your text here." | python -m aichecker check --json

Options
- --lang: Language for spellchecker (default: en)
- --long-sentence-threshold: Max words per sentence before flagging (default: 30)
- --max-duplicates: Max allowed exact duplicate sentences before flagging (default: 1)

Notes
- Spell checking excludes capitalized words to reduce false positives for proper nouns.
- Passive voice detection is heuristic and may include false positives.

License
MIT
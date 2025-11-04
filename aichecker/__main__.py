import sys
import json
import argparse
from typing import Optional

from .analyzer import analyze_text, CheckerOptions


def read_input_text(file_path: Optional[str]) -> str:
    if file_path:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    # Read from stdin
    if sys.stdin.isatty():
        return ""
    return sys.stdin.read()


def format_human(result: dict) -> str:
    lines = []
    s = result["summary"]
    lines.append(f"Summary: {s['words']} words, {s['sentences']} sentences, {s['characters']} chars")

    r = result["readability"]
    lines.append("Readability:")
    for k in [
        "flesch_reading_ease",
        "flesch_kincaid_grade",
        "gunning_fog",
        "smog_index",
        "automated_readability_index",
    ]:
        v = r.get(k)
        if v is not None:
            lines.append(f"  - {k.replace('_',' ').title()}: {v:.2f}")

    sp = result["spelling"]
    lines.append(f"Spelling: {sp['total_unknown']} potential issue(s)")
    for issue in sp["issues"][:20]:
        lines.append(f"  - '{issue['word']}' -> suggestion: {issue['suggestion']}")
    if sp["total_unknown"] > 20:
        lines.append(f"  ... and {sp['total_unknown'] - 20} more")

    st = result["style"]
    if st["long_sentences"]:
        lines.append("Style: Long sentences")
        for item in st["long_sentences"][:10]:
            lines.append(f"  - #{item['index']} ({item['word_count']} words): {item['text']}")
    if st["passive_voice"]:
        lines.append("Style: Possible passive voice")
        for item in st["passive_voice"][:10]:
            lines.append(f"  - #{item['index']}: {item['match']}")
    if st["adverbs"]:
        lines.append("Style: Adverbs (-ly)")
        for item in st["adverbs"][:10]:
            lines.append(f"  - {item['word']} x{item['count']}")

    rep = result["repetition"]
    if rep["duplicate_words"]:
        lines.append("Repetition: Immediate duplicate words")
        for item in rep["duplicate_words"][:10]:
            lines.append(f"  - '{item['word']}' at positions {item['occurrences'][:5]}")
    if rep["duplicate_sentences"]:
        lines.append("Repetition: Duplicate sentences")
        for item in rep["duplicate_sentences"][:5]:
            lines.append(f"  - x{item['count']}: {item['sentence']}")

    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="aichecker", description="Local AI text checker")
    sub = parser.add_subparsers(dest="command")

    p_check = sub.add_parser("check", help="Analyze text from a file or stdin")
    p_check.add_argument("--file", "-f", help="Path to input text file")
    p_check.add_argument("--json", action="store_true", help="Output JSON")
    p_check.add_argument("--lang", default="en", help="Spellcheck language (default: en)")
    p_check.add_argument("--long-sentence-threshold", type=int, default=30, help="Words per sentence threshold")
    p_check.add_argument("--max-duplicates", type=int, default=1, help="Max allowed exact duplicate sentences")

    args = parser.parse_args(argv)

    if args.command != "check":
        parser.print_help()
        return 1

    text = read_input_text(args.file)
    if not text.strip():
        print("No input text provided. Use --file or pipe text via stdin.", file=sys.stderr)
        return 2

    options = CheckerOptions(
        lang=args.lang,
        long_sentence_threshold=args.long_sentence_threshold,
        max_duplicate_sentences=args.max_duplicates,
    )
    result = analyze_text(text, options)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_human(result))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

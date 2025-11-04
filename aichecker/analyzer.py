import re
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from typing import List, Dict, Any

from spellchecker import SpellChecker
import textstat


@dataclass
class CheckerOptions:
    lang: str = "en"
    long_sentence_threshold: int = 30
    max_duplicate_sentences: int = 1


def split_sentences(text: str) -> List[str]:
    # Naive sentence splitter; keeps punctuation with sentence
    sentences = re.split(r"(?<=[.!?])\s+", text.strip()) if text.strip() else []
    # Remove empty trailing segments
    return [s for s in sentences if s]


def tokenize(text: str) -> List[str]:
    # Keep words with apostrophes/hyphens as single tokens
    return re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)*", text)


def normalize_sentence(s: str) -> str:
    # Lowercase, remove extra spaces and terminal punctuation
    return re.sub(r"\s+", " ", re.sub(r"[\s\W_]+", " ", s.lower())).strip()


def analyze_readability(text: str) -> Dict[str, Any]:
    if not text.strip():
        return {
            "flesch_reading_ease": None,
            "flesch_kincaid_grade": None,
            "gunning_fog": None,
            "smog_index": None,
            "automated_readability_index": None,
            "coleman_liau_index": None,
            "dale_chall": None,
            "difficult_words": 0,
            "polysyllables": 0,
            "lexicon_count": 0,
            "sentence_count": 0,
        }
    try:
        return {
            "flesch_reading_ease": textstat.flesch_reading_ease(text),
            "flesch_kincaid_grade": textstat.flesch_kincaid_grade(text),
            "gunning_fog": textstat.gunning_fog(text),
            "smog_index": textstat.smog_index(text),
            "automated_readability_index": textstat.automated_readability_index(text),
            "coleman_liau_index": textstat.coleman_liau_index(text),
            "dale_chall": textstat.dale_chall_readability_score(text),
            "difficult_words": textstat.difficult_words(text),
            "polysyllables": textstat.polysyllabcount(text),
            "lexicon_count": textstat.lexicon_count(text, removepunct=True),
            "sentence_count": textstat.sentence_count(text),
        }
    except Exception:
        # In case textstat errors on certain inputs
        return {
            "flesch_reading_ease": None,
            "flesch_kincaid_grade": None,
            "gunning_fog": None,
            "smog_index": None,
            "automated_readability_index": None,
            "coleman_liau_index": None,
            "dale_chall": None,
            "difficult_words": None,
            "polysyllables": None,
            "lexicon_count": len(tokenize(text)),
            "sentence_count": len(split_sentences(text)),
        }


def analyze_spelling(text: str, lang: str) -> Dict[str, Any]:
    tokens = re.findall(r"\b\w+\b", text)
    # Exclude tokens containing uppercase letters (likely proper nouns/acronyms)
    lower_tokens = [t.lower() for t in tokens if t.isalpha() and not any(c.isupper() for c in t)]
    spell = SpellChecker(language=lang)
    unknown = spell.unknown(lower_tokens)
    issues = []
    for w in sorted(unknown):
        suggestion = spell.correction(w)
        issues.append({"word": w, "suggestion": suggestion})
    return {"total_unknown": len(issues), "issues": issues}


def analyze_style(text: str, long_sentence_threshold: int) -> Dict[str, Any]:
    sentences = split_sentences(text)
    long_sentences = []
    passive_hits = []
    adverbs = []

    # Long sentences
    for i, s in enumerate(sentences):
        wc = len(tokenize(s))
        if wc > long_sentence_threshold:
            long_sentences.append({"index": i, "word_count": wc, "text": s})

    # Passive voice (heuristic): be-verb + past participle (-ed word)
    be_verbs = r"am|is|are|was|were|be|been|being"
    passive_re = re.compile(rf"\b(?:{be_verbs})\b\s+\b(\w+ed)\b", re.IGNORECASE)
    for i, s in enumerate(sentences):
        for m in passive_re.finditer(s):
            passive_hits.append({"index": i, "match": m.group(0), "sentence": s})

    # Adverbs ending with -ly (simple heuristic)
    words = [w.lower() for w in tokenize(text)]
    adverb_counts = Counter([w for w in words if len(w) > 3 and w.endswith("ly")])
    # Filter some common false positives
    skip = {"family", "only", "supply", "reply", "apply", "imply"}
    for w, c in adverb_counts.items():
        if w not in skip:
            adverbs.append({"word": w, "count": c})
    adverbs.sort(key=lambda x: (-x["count"], x["word"]))

    return {
        "long_sentences": long_sentences,
        "passive_voice": passive_hits,
        "adverbs": adverbs,
    }


def analyze_repetition(text: str, max_duplicate_sentences: int) -> Dict[str, Any]:
    words = [w.lower() for w in tokenize(text)]
    duplicate_words_positions: Dict[str, List[int]] = defaultdict(list)

    prev = None
    for i, w in enumerate(words):
        if prev == w:
            duplicate_words_positions[w].append(i)
        prev = w

    dup_words = [
        {"word": w, "occurrences": pos}
        for w, pos in sorted(duplicate_words_positions.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        if pos
    ]

    sentences = split_sentences(text)
    normalized = [normalize_sentence(s) for s in sentences]
    counts = Counter([n for n in normalized if n])
    dup_sentences = [
        {"sentence": sentences[i], "count": counts[normalized[i]]}
        for i in range(len(sentences))
        if normalized[i] and counts[normalized[i]] > max_duplicate_sentences
    ]

    # Deduplicate entries while keeping original order
    seen = set()
    result_sentences = []
    for item in dup_sentences:
        key = (normalize_sentence(item["sentence"]))
        if key not in seen:
            seen.add(key)
            result_sentences.append(item)

    return {"duplicate_words": dup_words, "duplicate_sentences": result_sentences}


def analyze_text(text: str, options: CheckerOptions) -> Dict[str, Any]:
    readability = analyze_readability(text)
    spelling = analyze_spelling(text, options.lang)
    style = analyze_style(text, options.long_sentence_threshold)
    repetition = analyze_repetition(text, options.max_duplicate_sentences)

    summary = {
        "characters": len(text),
        "words": len(tokenize(text)),
        "sentences": len(split_sentences(text)),
    }

    return {
        "summary": summary,
        "readability": readability,
        "spelling": spelling,
        "style": style,
        "repetition": repetition,
        "options": asdict(options),
    }

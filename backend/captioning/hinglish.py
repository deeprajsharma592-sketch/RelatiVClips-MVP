"""Hinglish transliteration and English-loanword restoration for Hindi audio captions.

Converts Devanagari / Hindi speech transcripts into natural, creator-style Hinglish:
  - English loanwords written in standard English ("restaurant", "taste test", "action", "idea")
  - Conversational Hindi written in natural Roman script ("aaj hum karne wale hai", "ke khane ki", "vaise")
  - Complex / high-register Sanskrit/Hindi terms preserved in Devanagari if appropriate
  - Exact 1-to-1 word timestamp preservation for audio sync
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

log = logging.getLogger(__name__)

DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")

# Common English words frequently transcribed phonetically into Devanagari by Whisper
ENGLISH_LOANWORDS: dict[str, str] = {
    "रेस्टोरेंट": "restaurant",
    "रेस्टॉरेंट": "restaurant",
    "टेस्ट": "test",
    "आइडिया": "idea",
    "आइडियाज": "ideas",
    "एक्शन": "action",
    "ेक्शन": "action",
    "गाइस": "guys",
    "हेलो": "hello",
    "हाय": "hi",
    "चाइनीज": "Chinese",
    "चीनी": "Chinese",
    "वीडियो": "video",
    "विडियो": "video",
    "चैनल": "channel" ,
    "सब्सक्राइब": "subscribe",
    "लाइक": "like",
    "शेयर": "share",
    "कमेंट": "comment",
    "फोन": "phone",
    "लैपटॉप": "laptop",
    "इंटरव्यू": "interview",
    "पॉडकास्ट": "podcast",
    "ऑडियंस": "audience",
    "कंटेंट": "content",
    "प्रॉब्लम": "problem",
    "सॉल्यूशन": "solution",
    "कंपनी": "company",
    "बिजनेस": "business",
    "स्टार्टअप": "startup",
    "मनी": "money",
    "मार्केट": "market",
    "कस्टमर": "customer",
    "प्रोडक्ट": "product",
    "डिज़ाइन": "design",
    "कोडिंग": "coding",
    "कंप्यूटर": "computer",
    "गेम": "game",
    "गेमिंग": "gaming",
    "स्ट्रीम": "stream",
    "स्ट्रीमर": "streamer",
    "यू": "you",
    "गेवस": "gave us",
    "मॉर": "more",
    "व्हाट": "what",
    "व्हाय": "why",
    "बिकॉज": "because",
    "एक्चुअली": "actually",
    "बेसिकली": "basically",
    "लिटरली": "literally",
    "सीरियसली": "seriously",
    "ऑफिस": "office",
    "मीटिंग": "meeting",
    "प्रोजेक्ट": "project",
    "क्लिप": "clip",
    "क्लिप्स": "clips",
    "एडिट": "edit",
    "एडिटर": "editor",
    "कैमरा": "camera",
    "माइक": "mic",
    "स्टूडियो": "studio",
    "स्क्रीन": "screen",
    "सिस्टम": "system",
    "लेवल": "level",
    "नेक्स्ट": "next",
    "फर्स्ट": "first",
    "लास्ट": "last",
    "बेस्ट": "best",
    "सुपर": "super",
    "कूल": "cool",
    "अमेजिंग": "amazing",
    "क्रेजी": "crazy",
}

# High-register / Sanskritized Hindi words that should stay in Devanagari if present
HARD_HINDI_WORDS: set[str] = {
    "आत्मनिर्भरता",
    "धर्मसंकट",
    "षड्यंत्र",
    "विश्राम",
    "अखंड",
    "दृष्टिकोण",
    "कल्याणकारी",
    "स्वाभिमान",
    "तपस्या",
    "परंपरा",
    "संस्कृति",
    "अनुसंधान",
    "अधिनियम",
    "कर्तव्य",
}

# Devanagari phonetic transliteration tables
VOWELS: dict[str, str] = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
    "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "an", "अः": "ah",
}

MATRAS: dict[str, str] = {
    "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
    "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ं": "n", "ँ": "n", "ः": "h",
}

CONSONANTS: dict[str, str] = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "f", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
    "ड़": "d", "ढ़": "dh", "फ़": "f", "ज़": "z", "ख़": "kh", "ग़": "gh",
}

# Common conversational word overrides for natural modern Hinglish spelling
COMMON_HINGLISH: dict[str, str] = {
    "है": "hai",
    "हैं": "hain",
    "हो": "ho",
    "हूँ": "hoon",
    "हूं": "hoon",
    "था": "tha",
    "थी": "thi",
    "थे": "the",
    "का": "ka",
    "के": "ke",
    "की": "ki",
    "को": "ko",
    "में": "mein",
    "से": "se",
    "ने": "ne",
    "पर": "par",
    "और": "aur",
    "या": "ya",
    "तो": "toh",
    "भी": "bhi",
    "ही": "hi",
    "ना": "na",
    "नहीं": "nahi",
    "नही": "nahi",
    "यह": "yeh",
    "ये": "ye",
    "वह": "woh",
    "वो": "wo",
    "हम": "hum",
    "तुम": "tum",
    "आप": "aap",
    "मैं": "main",
    "मेरा": "mera",
    "मेरी": "meri",
    "मेरे": "mere",
    "हमारा": "hamara",
    "तुम्हारा": "tumhara",
    "आपका": "aapka",
    "क्या": "kya",
    "क्यों": "kyun",
    "कब": "kab",
    "कहाँ": "kahan",
    "कहा": "kaha",
    "कैसे": "kaise",
    "कौन": "kaun",
    "कुछ": "kuch",
    "बहुत": "bahut",
    "ज्यादा": "zyada",
    "कम": "kam",
    "आज": "aaj",
    "कल": "kal",
    "अब": "ab",
    "तब": "tab",
    "जब": "jab",
    "कर": "kar",
    "करना": "karna",
    "करते": "karte",
    "करता": "karta",
    "करती": "karti",
    "करेंगे": "karenge",
    "करने": "karne",
    "वाले": "wale",
    "वाला": "wala",
    "वाली": "wali",
    "जा": "jaa",
    "जाना": "jaana",
    "जाता": "jaata",
    "जाती": "jaati",
    "जाते": "jaate",
    "गया": "gaya",
    "गई": "gayi",
    "गए": "gaye",
    "रहा": "raha",
    "रही": "rahi",
    "रहे": "rahe",
    "देख": "dekh",
    "देखो": "dekho",
    "देखा": "dekha",
    "बात": "baat",
    "बोल": "bol",
    "बोला": "bola",
    "खाना": "khana",
    "खाने": "khane",
    "पीना": "peena",
    "पानी": "paani",
    "घर": "ghar",
    "लोग": "log",
    "दोस्त": "dost",
    "दोस्तों": "doston",
    "भाई": "bhai",
    "समय": "samay",
    "टाइम": "time",
    "अच्छा": "accha",
    "अच्छी": "acchi",
    "अच्छे": "acche",
    "बुरा": "bura",
    "सही": "sahi",
    "गलत": "galat",
    "पसंद": "pasand",
    "लास्ट": "last",
    "पहले": "pehle",
    "बाद": "baad",
    "साथ": "saath",
    "पास": "paas",
    "दूर": "door",
    "ऊपर": "upar",
    "नीचे": "neeche",
    "अंदर": "andar",
    "बाहर": "bahar",
    "वैसे": "vaise",
    "उसी": "usi",
    "इसी": "isi",
}


def has_devanagari(text: str) -> bool:
    """Return True if text contains any Devanagari character."""
    return bool(DEVANAGARI_PATTERN.search(text))


def transliterate_devanagari_word(word: str) -> str:
    """Fast rule-based transliterator converting a single Devanagari word to Hinglish."""
    # Strip leading/trailing punctuation
    prefix = ""
    suffix = ""
    match_lead = re.match(r"^([^\u0900-\u097F]+)", word)
    if match_lead:
        prefix = match_lead.group(1)
        word = word[len(prefix):]
    match_trail = re.search(r"([^\u0900-\u097F]+)$", word)
    if match_trail:
        suffix = match_trail.group(1)
        word = word[:-len(suffix)]

    if not word:
        return prefix + suffix

    # Check hard Hindi words (leave in Devanagari if matches)
    if word in HARD_HINDI_WORDS:
        return prefix + word + suffix

    # Check loanwords
    if word in ENGLISH_LOANWORDS:
        return prefix + ENGLISH_LOANWORDS[word] + suffix

    # Check common conversational words
    if word in COMMON_HINGLISH:
        return prefix + COMMON_HINGLISH[word] + suffix

    # Phonetic character-by-character transliteration
    result = []
    chars = list(word)
    i = 0
    n = len(chars)

    while i < n:
        c = chars[i]

        # Check virama / halant
        if c == "्":
            i += 1
            continue

        # Check nukta combinations (e.g. ड़, फ़, ज़)
        if i + 1 < n and chars[i + 1] == "़":
            combo = c + "़"
            cons = CONSONANTS.get(combo, CONSONANTS.get(c, c))
            i += 2
        elif c in CONSONANTS:
            cons = CONSONANTS[c]
            i += 1
        elif c in VOWELS:
            result.append(VOWELS[c])
            i += 1
            continue
        elif c in MATRAS:
            result.append(MATRAS[c])
            i += 1
            continue
        else:
            result.append(c)
            i += 1
            continue

        # Consonant handling: check what follows
        if i < n:
            next_c = chars[i]
            if next_c in MATRAS:
                result.append(cons + MATRAS[next_c])
                i += 1
            elif next_c == "्":
                # Halant: no inherent vowel
                result.append(cons)
                i += 1
            elif next_c in CONSONANTS:
                # Inherent 'a' between consonants
                result.append(cons + "a")
            else:
                result.append(cons + "a")
        else:
            # Word-final consonant (in Hindi, schwa is usually dropped)
            result.append(cons)

    roman = "".join(result)
    return prefix + roman + suffix


def _llm_hinglish_batch(words: list[str]) -> Optional[list[str]]:
    """Optional LLM pass: converts a list of words to natural Hinglish with loanword recovery.

    Uses Groq (fastest) or configured LLM if an API key is set.
    """
    joined = " ".join(words)
    if not has_devanagari(joined):
        return None

    api_key = os.getenv("GROQ_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None

    prompt = (
        "You are an expert Indian video editor creating viral Hinglish subtitles (like Tanmay Bhat, BeerBiceps).\n"
        "Convert the following transcribed Hindi words into natural conversational Hinglish (Latin alphabet).\n"
        "RULES:\n"
        "1. Write English words in proper English spelling (e.g. 'restaurant', 'taste test', 'action', 'you gave us more idea', 'chinese').\n"
        "2. Write conversational Hindi in common Romanized Hinglish (e.g. 'aaj hum karne wale hai', 'ke khane ki', 'vaise', 'jaata hai', 'usi mein').\n"
        "3. Only preserve rare, classical Sanskritized words in Devanagari.\n"
        "4. Return EXACTLY the same number of space-separated words so timestamps match 1-to-1.\n"
        "5. Output ONLY the space-separated words, nothing else.\n\n"
        f"Input: {joined}\nOutput:"
    )

    try:
        from ..llm.groq_client import generate as groq_gen, is_groq_available
        if is_groq_available():
            reply = groq_gen(prompt, model="llama-3.1-8b-instant", max_tokens=len(words) * 6)
            out_words = reply.strip().split()
            if len(out_words) == len(words):
                return out_words
    except Exception as exc:
        log.debug("Groq Hinglish batch failed (%s), falling back to rule-based", exc)

    return None


def convert_words_to_hinglish(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert a list of word dictionaries to Hinglish while preserving timestamps and emphasis.

    Input shape: [{"w": "...", "start": 0.2, "end": 0.5, "emph": 0}, ...]
    Returns: new list with converted text in "w" or "word" keys.
    """
    if not words:
        return []

    # Check if any word contains Devanagari
    needs_conversion = any(
        has_devanagari(str(w.get("w") or w.get("word") or "")) for w in words
    )
    if not needs_conversion:
        return words

    raw_tokens = [str(w.get("w") or w.get("word") or "") for w in words]

    # Try LLM pass for natural loanword/grammar recovery
    llm_tokens = _llm_hinglish_batch(raw_tokens)

    output = []
    for idx, item in enumerate(words):
        copy_item = dict(item)
        token = raw_tokens[idx]

        if llm_tokens and idx < len(llm_tokens):
            converted = llm_tokens[idx]
        elif has_devanagari(token):
            converted = transliterate_devanagari_word(token)
        else:
            converted = token

        if "w" in copy_item:
            copy_item["w"] = converted
        if "word" in copy_item:
            copy_item["word"] = converted

        output.append(copy_item)

    return output

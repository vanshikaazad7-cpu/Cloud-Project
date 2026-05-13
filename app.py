"""
AI Communication Coach - Flask Backend
Uses Azure Language Service for sentiment analysis and key phrase extraction.
"""

import os
import re
import math

from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential

# Load .env automatically if present
load_dotenv()

# ─────────────────────────────────────────────
#  Azure credentials – set via environment vars
#  or replace the empty strings with your values
# ─────────────────────────────────────────────
AZURE_LANGUAGE_ENDPOINT = os.environ.get(
    "AZURE_LANGUAGE_ENDPOINT", "YOUR_AZURE_LANGUAGE_ENDPOINT"
)
AZURE_LANGUAGE_KEY = os.environ.get(
    "AZURE_LANGUAGE_KEY", "YOUR_AZURE_LANGUAGE_KEY"
)

# Get the absolute path to the directory containing this file
base_dir = os.path.abspath(os.path.dirname(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(base_dir, "templates"),
    static_folder=os.path.join(base_dir, "static"),
)


def get_text_analytics_client() -> TextAnalyticsClient:
    """Initialise and return an Azure TextAnalytics client."""
    credential = AzureKeyCredential(AZURE_LANGUAGE_KEY)
    return TextAnalyticsClient(
        endpoint=AZURE_LANGUAGE_ENDPOINT, credential=credential
    )


# ─────────────────────────────────────────────
#  Custom scoring helpers
# ─────────────────────────────────────────────
def calculate_confidence_score(
    sentiment_scores: dict, text: str, sentiment_label: str
) -> float:
    """
    Confidence score (0–100) based on:
      • Azure sentiment confidence        → 40 pts
      • Text length / richness            → 30 pts
      • Vocabulary diversity (type-token) → 30 pts
    """
    # 1. Sentiment confidence (max 40)
    top_score = max(sentiment_scores.values()) if sentiment_scores else 0.5
    sentiment_component = top_score * 40

    # 2. Length score (max 30) – sweet-spot around 100 words
    words = text.split()
    word_count = len(words)
    if word_count == 0:
        length_score = 0
    else:
        length_score = min(30, (word_count / 100) * 30)

    # 3. Vocabulary diversity (max 30)
    if word_count == 0:
        diversity_score = 0
    else:
        unique_words = len(set(w.lower() for w in words))
        diversity_ratio = unique_words / word_count
        diversity_score = diversity_ratio * 30

    total = sentiment_component + length_score + diversity_score
    return round(min(100, total), 1)


def calculate_speaking_speed(text: str, duration_seconds: float = 60.0) -> int:
    """
    Calculate words per minute.
    If no real duration is supplied we assume average speaking pace
    (we use the word count against 60 s as a normalised WPM).
    """
    word_count = len(text.split())
    if word_count == 0:
        return 0
    wpm = (word_count / duration_seconds) * 60
    return round(wpm)


def generate_suggestions(
    sentiment: str, key_phrases: list, text: str
) -> list:
    """
    Rule-based suggestion engine.
    """
    suggestions = []
    words = text.split()
    word_count = len(words)

    # Sentiment-based suggestions
    if sentiment == "negative":
        suggestions.append(
            "🎯 Try to frame your points more positively — "
            "replace negative words with constructive alternatives."
        )
        suggestions.append(
            "💡 Consider starting with a strength before addressing challenges."
        )
    elif sentiment == "neutral":
        suggestions.append(
            "✨ Add more enthusiasm and vivid language to engage your audience."
        )
        suggestions.append(
            "📈 Use concrete examples or anecdotes to make neutral points memorable."
        )
    else:  # positive
        suggestions.append(
            "👍 Great positive tone! Ensure your confidence comes across clearly."
        )

    # Length-based suggestions
    if word_count < 30:
        suggestions.append(
            "📝 Your response is quite short — aim for at least 3–5 complete sentences."
        )
    elif word_count > 300:
        suggestions.append(
            "✂️ Your response is long — practice conciseness by cutting filler words."
        )
    else:
        suggestions.append(
            "📏 Good response length — keep this balance in real conversations."
        )

    # Key-phrase density
    if len(key_phrases) < 2:
        suggestions.append(
            "🔑 Introduce more specific key concepts to make your message clearer."
        )

    # Filler-word detection
    fillers = ["um", "uh", "like", "you know", "basically", "literally"]
    found_fillers = [f for f in fillers if f in text.lower()]
    if found_fillers:
        suggestions.append(
            f"🚫 Detected filler words: {', '.join(found_fillers)}. "
            "Practice pausing instead of using fillers."
        )

    return suggestions


# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────
@app.route("/")
def index():
    """Serve the main application page."""
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    POST /analyze
    Body (JSON): { "text": "...", "duration": <seconds> }
    Returns:     { sentiment, confidence_score, key_phrases,
                   suggestions, words_per_minute, sentiment_scores }
    """
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    duration = float(data.get("duration", 60))

    if not text:
        return jsonify({"error": "No text provided"}), 400

    try:
        client = get_text_analytics_client()
        documents = [{"id": "1", "language": "en", "text": text}]

        # ── Sentiment Analysis ──────────────────────────────────────
        sentiment_result = client.analyze_sentiment(
            documents=documents, show_opinion_mining=True
        )
        sentiment_doc = sentiment_result[0]

        if sentiment_doc.is_error:
            raise ValueError(f"Sentiment error: {sentiment_doc.error}")

        sentiment_label = sentiment_doc.sentiment
        raw_scores = sentiment_doc.confidence_scores
        sentiment_scores = {
            "positive": round(raw_scores.positive, 3),
            "neutral": round(raw_scores.neutral, 3),
            "negative": round(raw_scores.negative, 3),
        }

        # ── Key Phrase Extraction ───────────────────────────────────
        kp_result = client.extract_key_phrases(documents=documents)
        kp_doc = kp_result[0]
        key_phrases = [] if kp_doc.is_error else list(kp_doc.key_phrases)

        # ── Custom Metrics ──────────────────────────────────────────
        confidence_score = calculate_confidence_score(
            sentiment_scores, text, sentiment_label
        )
        wpm = calculate_speaking_speed(text, duration)
        suggestions = generate_suggestions(sentiment_label, key_phrases, text)

        return jsonify(
            {
                "sentiment": sentiment_label,
                "confidence_score": confidence_score,
                "sentiment_scores": sentiment_scores,
                "key_phrases": key_phrases[:10],  # cap at 10
                "suggestions": suggestions,
                "words_per_minute": wpm,
                "word_count": len(text.split()),
            }
        )

    except Exception as exc:  # noqa: BLE001
        app.logger.error("Analysis failed: %s", exc)
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)

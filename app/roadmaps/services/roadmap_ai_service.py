from typing import TypeVar

import anthropic
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.core.config import settings
from app.roadmaps.dto.roadmap_dto import RoadmapAnswer, RoadmapSuggestion, RoadmapSuggestQuestionsResponse

T = TypeVar("T", bound=BaseModel)

_ROADMAP_SYSTEM_PROMPT = (
    "You design personal learning roadmaps for a study-together app. Given the "
    "learner's goal (and any answers they gave to clarifying questions), respond with "
    "a concise title, a one-sentence goal restatement, and 4 to 8 sequential phases "
    "ordered from beginner to advanced. Write every field in Vietnamese, matching the "
    "language the learner used."
)

_QUESTIONS_SYSTEM_PROMPT = (
    "You help personalize a learning roadmap for a study-together app. Given the "
    "learner's goal, ask 3 to 4 short multiple-choice questions whose answers would "
    "change how the roadmap should be structured -- e.g. current skill level, hours "
    "available per week, how firm the deadline is, preferred learning style. Each "
    "question needs 2 to 4 concise answer options. Write every field in Vietnamese, "
    "matching the language the learner used."
)

# Plain JSON Schemas (not RoadmapSuggestion.model_json_schema()) -- Gemini's schema
# transformer does not reliably resolve the $defs/$ref pairs Pydantic emits for a model
# with nested models like RoadmapPhaseSuggestion/RoadmapQuestion. Kept as dicts so they
# never depend on that transformer; the response is validated against the matching
# Pydantic model after the call instead.
_GEMINI_ROADMAP_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "goal": {"type": "string"},
        "phases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
    },
    "required": ["title", "goal", "phases"],
}

_GEMINI_QUESTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"label": {"type": "string"}},
                            "required": ["label"],
                        },
                    },
                },
                "required": ["question", "options"],
            },
        },
    },
    "required": ["questions"],
}


def _build_roadmap_prompt(description: str, answers: list[RoadmapAnswer]) -> str:
    if not answers:
        return description
    qa = "\n".join(f"- {answer.question} {answer.answer}" for answer in answers)
    return f"{description}\n\nCâu trả lời của người học cho các câu hỏi làm rõ:\n{qa}"


class RoadmapAiServiceNotConfigured(Exception):
    """Raised when settings.ai_provider names a provider whose API key is unset, or an
    unknown provider -- see Settings.ai_provider."""


class RoadmapAiError(Exception):
    """Raised when the configured AI provider is unreachable or returns an unusable response."""


class RoadmapAiService:
    async def suggest_questions(self, description: str) -> RoadmapSuggestQuestionsResponse:
        return await self._generate(
            content=description,
            system=_QUESTIONS_SYSTEM_PROMPT,
            output_model=RoadmapSuggestQuestionsResponse,
            gemini_schema=_GEMINI_QUESTIONS_SCHEMA,
        )

    async def suggest(self, description: str, answers: list[RoadmapAnswer]) -> RoadmapSuggestion:
        return await self._generate(
            content=_build_roadmap_prompt(description, answers),
            system=_ROADMAP_SYSTEM_PROMPT,
            output_model=RoadmapSuggestion,
            gemini_schema=_GEMINI_ROADMAP_SCHEMA,
        )

    async def _generate(self, *, content: str, system: str, output_model: type[T], gemini_schema: dict) -> T:
        if settings.ai_provider == "gemini":
            return await self._generate_with_gemini(content, system, output_model, gemini_schema)
        if settings.ai_provider == "anthropic":
            return await self._generate_with_anthropic(content, system, output_model)
        raise RoadmapAiServiceNotConfigured(f"Unknown AI_PROVIDER: {settings.ai_provider!r}")

    async def _generate_with_anthropic(self, content: str, system: str, output_model: type[T]) -> T:
        if not settings.anthropic_api_key:
            raise RoadmapAiServiceNotConfigured("ANTHROPIC_API_KEY is not configured")

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        try:
            response = await client.messages.parse(
                model="claude-opus-5",
                max_tokens=4096,
                system=system,
                messages=[{"role": "user", "content": content}],
                output_format=output_model,
            )
        except anthropic.APIError as exc:
            raise RoadmapAiError(f"Anthropic request failed: {exc}") from exc

        return response.parsed_output

    async def _generate_with_gemini(self, content: str, system: str, output_model: type[T], gemini_schema: dict) -> T:
        if not settings.gemini_api_key:
            raise RoadmapAiServiceNotConfigured("GEMINI_API_KEY is not configured")

        client = genai.Client(api_key=settings.gemini_api_key)
        try:
            response = await client.aio.models.generate_content(
                model="gemini-3.6-flash",
                contents=content,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=gemini_schema,
                ),
            )
        except genai.errors.APIError as exc:
            raise RoadmapAiError(f"Gemini request failed: {exc}") from exc

        return output_model.model_validate_json(response.text)

import anthropic
from google import genai
from google.genai import types

from app.core.config import settings
from app.roadmaps.dto.roadmap_dto import RoadmapSuggestion

_SYSTEM_PROMPT = (
    "You design personal learning roadmaps for a study-together app. Given the "
    "learner's goal, respond with a concise title, a one-sentence goal restatement, "
    "and 4 to 8 sequential phases ordered from beginner to advanced. Write every "
    "field in Vietnamese, matching the language the learner used."
)

# Plain JSON Schema (not RoadmapSuggestion.model_json_schema()) -- Gemini's schema
# transformer does not reliably resolve the $defs/$ref pairs Pydantic emits for a
# schema with a nested model like RoadmapPhaseSuggestion. Kept as a dict so it never
# depends on that transformer; the response is validated against RoadmapSuggestion
# after the call instead.
_GEMINI_RESPONSE_SCHEMA = {
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


class RoadmapAiServiceNotConfigured(Exception):
    """Raised when settings.ai_provider names a provider whose API key is unset, or an
    unknown provider -- see Settings.ai_provider."""


class RoadmapAiError(Exception):
    """Raised when the configured AI provider is unreachable or returns an unusable response."""


class RoadmapAiService:
    async def suggest(self, description: str) -> RoadmapSuggestion:
        if settings.ai_provider == "gemini":
            return await self._suggest_with_gemini(description)
        if settings.ai_provider == "anthropic":
            return await self._suggest_with_anthropic(description)
        raise RoadmapAiServiceNotConfigured(f"Unknown AI_PROVIDER: {settings.ai_provider!r}")

    async def _suggest_with_anthropic(self, description: str) -> RoadmapSuggestion:
        if not settings.anthropic_api_key:
            raise RoadmapAiServiceNotConfigured("ANTHROPIC_API_KEY is not configured")

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        try:
            response = await client.messages.parse(
                model="claude-opus-5",
                max_tokens=4096,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": description}],
                output_format=RoadmapSuggestion,
            )
        except anthropic.APIError as exc:
            raise RoadmapAiError(f"Could not generate a roadmap suggestion: {exc}") from exc

        return response.parsed_output

    async def _suggest_with_gemini(self, description: str) -> RoadmapSuggestion:
        if not settings.gemini_api_key:
            raise RoadmapAiServiceNotConfigured("GEMINI_API_KEY is not configured")

        client = genai.Client(api_key=settings.gemini_api_key)
        try:
            response = await client.aio.models.generate_content(
                model="gemini-3.6-flash",
                contents=description,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=_GEMINI_RESPONSE_SCHEMA,
                ),
            )
        except genai.errors.APIError as exc:
            raise RoadmapAiError(f"Could not generate a roadmap suggestion: {exc}") from exc

        return RoadmapSuggestion.model_validate_json(response.text)

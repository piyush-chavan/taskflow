"""Free-text -> structured task parser powering POST /tasks/quick-add.

Every request builds a standard role-based prompt (system + user message),
whether it ends up answered by the deterministic keyless mock (the default,
and the required graded baseline) or, only when explicitly enabled, a real
LLM call. Any failure of the real-LLM path falls back to the mock.
"""

import re
from typing import List, Dict

from core.config import settings
from schemas.quick_add import ParsedTask

SYSTEM_PROMPT = (
    "You parse a single free-text task description into structured fields for "
    "a task tracker. Return exactly: title (the description with urgency/timing "
    "phrases removed), priority (one of 'low', 'medium', 'high'), and "
    "due_date_hint (the raw date phrase mentioned verbatim, lower-case, or null "
    "if none is mentioned)."
)

HIGH_PRIORITY_KEYWORDS = ["urgent", "asap"]
LOW_PRIORITY_KEYWORDS = ["whenever", "low priority"]

DATE_KEYWORDS_IN_ORDER = [
    "today",
    "tomorrow",
    "next week",
    "next monday",
    "next tuesday",
    "next wednesday",
    "next thursday",
    "next friday",
    "next saturday",
    "next sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


def build_quick_add_messages(description: str) -> List[Dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": description},
    ]


def _strip_keyword(text: str, keyword: str) -> str:
    return re.sub(re.escape(keyword), "", text, flags=re.IGNORECASE)


def mock_parse_task(description: str) -> ParsedTask:
    lowered = description.lower()

    if any(keyword in lowered for keyword in HIGH_PRIORITY_KEYWORDS):
        priority = "high"
    elif any(keyword in lowered for keyword in LOW_PRIORITY_KEYWORDS):
        priority = "low"
    else:
        priority = "medium"

    matched_priority_keywords = [
        keyword
        for keyword in HIGH_PRIORITY_KEYWORDS + LOW_PRIORITY_KEYWORDS
        if keyword in lowered
    ]

    due_date_hint = None
    for phrase in DATE_KEYWORDS_IN_ORDER:
        if phrase in lowered:
            due_date_hint = phrase
            break

    title = description
    for keyword in matched_priority_keywords:
        title = _strip_keyword(title, keyword)
    if due_date_hint:
        title = _strip_keyword(title, due_date_hint)

    title = title.strip()
    if not title:
        title = "Untitled task"

    return ParsedTask(title=title, priority=priority, due_date_hint=due_date_hint)


def _real_llm_available() -> bool:
    return settings.USE_REAL_LLM and bool(settings.OPENAI_API_KEY)


def call_real_llm(messages: List[Dict[str, str]]) -> ParsedTask:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI

    role_to_message = {"system": SystemMessage, "user": HumanMessage}
    lc_messages = [role_to_message[m["role"]](content=m["content"]) for m in messages]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=settings.OPENAI_API_KEY)
    structured_llm = llm.with_structured_output(ParsedTask)
    print("Calling real LLM for task parsing...")
    return structured_llm.invoke(lc_messages)


def parse_task_description(description: str) -> ParsedTask:
    messages = build_quick_add_messages(description)

    if _real_llm_available():
        try:
            return call_real_llm(messages)
        except Exception:
            pass

    return mock_parse_task(description)

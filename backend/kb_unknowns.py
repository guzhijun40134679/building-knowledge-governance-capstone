from __future__ import annotations

import re
from typing import Optional


UNKNOWN_MARKERS = {
    "",
    "-",
    "--",
    "---",
    "—",
    "n/a",
    "na",
    "null",
    "none",
    "undefined",
    "unknown",
    "tbd",
    "to be determined",
    "不知道",
    "未知",
    "不清楚",
    "暂不确定",
    "待确认",
    "无信息",
    "没写",
    "未提供",
    "未填写",
    "官网未明确",
    "官网未公开",
    "待补充",
    "待核实",
    "待确认中",
}

REQUIREMENT_FIELD_KEYS = {
    "insurance_required",
    "electricity_required",
    "internet_self_setup_required",
}

TRUE_MARKERS = {
    "1",
    "true",
    "yes",
    "y",
    "需要",
    "是",
    "需要开通",
    "需要办理",
    "需办理",
    "需自行办理",
    "需要自己开网",
    "需要自己开通",
    "自行办理",
    "自行开通",
    "自行选择",
    "住户自行开网",
}

FALSE_MARKERS = {
    "0",
    "false",
    "no",
    "n",
    "不需要",
    "否",
    "无需",
    "不用",
    "房租包含",
    "楼内已包含",
    "楼内自带",
    "大楼自带",
    "网络已包含",
    "包含网络",
    "已包含网络",
    "不需要自己开网",
}

BOOLEAN_HINTS_TRUE = {
    "需要保险",
    "insurance required",
    "需自行开电",
    "需要开电",
    "需要自己开网",
    "自行开网",
    "自行选择网络",
}

BOOLEAN_HINTS_FALSE = {
    "不需要保险",
    "不需要开电",
    "房租包含电",
    "楼内已含网络",
    "大楼自带网络",
    "大楼强制网络",
}

OPTIONAL_MARKERS = {
    "2",
    "optional",
    "可选",
    "不强制",
    "非必须",
}

OPTIONAL_HINTS = {
    "optional",
    "recommended but not required",
    "strongly recommended but not required",
    "not required but recommended",
    "可选",
    "不强制",
    "非必须",
}

PROVIDER_CANONICAL_MAP = {
    "honest networks": "Honest Networks",
    "honest": "Honest Networks",
    "verizon": "Verizon",
    "xfinity": "Xfinity",
    "xifinity": "Xfinity",
    "spectrum": "Spectrum",
    "astound": "Astound",
}


def _clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def canonical_text(value: object) -> str:
    text = _clean_text(value).lower()
    text = text.replace("：", ":").replace("，", ",").replace("。", ".")
    return re.sub(r"\s+", " ", text).strip()


def is_unknown_value(value: object) -> bool:
    text = canonical_text(value)
    return text in UNKNOWN_MARKERS


def normalize_unknown_value(value: object) -> Optional[str]:
    text = _clean_text(value)
    if not text:
        return None
    if is_unknown_value(text):
        return None
    return text


def normalize_booleanish(value: object) -> Optional[bool]:
    text = canonical_text(value)
    if not text or text in UNKNOWN_MARKERS:
        return None
    if text in TRUE_MARKERS:
        return True
    if text in FALSE_MARKERS:
        return False

    if any(hint in text for hint in BOOLEAN_HINTS_TRUE):
        return True
    if any(hint in text for hint in BOOLEAN_HINTS_FALSE):
        return False
    return None


def normalize_requirement_choice(value: object) -> Optional[str]:
    text = canonical_text(value)
    if not text or text in UNKNOWN_MARKERS:
        return None
    if text in OPTIONAL_MARKERS or any(hint in text for hint in OPTIONAL_HINTS):
        return "optional"
    if text in TRUE_MARKERS:
        return "true"
    if text in FALSE_MARKERS:
        return "false"
    if any(hint in text for hint in BOOLEAN_HINTS_TRUE):
        return "true"
    if any(hint in text for hint in BOOLEAN_HINTS_FALSE):
        return "false"
    return None


def normalize_provider_name(value: object) -> Optional[str]:
    text = normalize_unknown_value(value)
    if not text:
        return None

    providers = extract_provider_names(text)
    if providers:
        return providers[0]
    return text


def extract_provider_names(value: object) -> list[str]:
    text = normalize_unknown_value(value)
    if not text:
        return []

    lowered = canonical_text(text)
    matches: list[tuple[int, str]] = []
    seen: set[str] = set()
    for raw, canonical in PROVIDER_CANONICAL_MAP.items():
        index = lowered.find(raw)
        if index < 0 or canonical in seen:
            continue
        matches.append((index, canonical))
        seen.add(canonical)

    if re.search(r"[,;\n/]", text):
        for part in re.split(r"[,;\n/]+", text):
            cleaned = normalize_unknown_value(part)
            if not cleaned:
                continue
            part_lowered = canonical_text(cleaned)
            local_matches: list[tuple[int, str]] = []
            for raw, canonical in PROVIDER_CANONICAL_MAP.items():
                index = part_lowered.find(raw)
                if index < 0 or canonical in seen:
                    continue
                local_matches.append((index, canonical))
            if local_matches:
                for index, canonical in local_matches:
                    matches.append((index, canonical))
                    seen.add(canonical)
                continue
            if (
                cleaned not in seen
                and len(cleaned) <= 48
                and re.fullmatch(r"[A-Za-z0-9&+.'()\- ]+", cleaned)
            ):
                matches.append((len(matches), cleaned))
                seen.add(cleaned)

    matches.sort(key=lambda item: item[0])
    return [canonical for _, canonical in matches]


def normalize_provider_text(value: object) -> Optional[str]:
    text = normalize_unknown_value(value)
    if not text:
        return None

    providers = extract_provider_names(text)
    if providers:
        return ", ".join(providers)
    return text


def normalize_field_value(field_key: str, field_type: str, value: object) -> Optional[str]:
    text = normalize_unknown_value(value)
    if text is None:
        return None

    normalized_field = (field_key or "").strip().lower()
    normalized_type = (field_type or "text").strip().lower()

    if normalized_type == "boolean":
        if normalized_field in REQUIREMENT_FIELD_KEYS:
            requirement_choice = normalize_requirement_choice(text)
            if requirement_choice is not None:
                return requirement_choice
        bool_value = normalize_booleanish(text)
        if bool_value is None and normalized_field == "internet_self_setup_required":
            lowered = canonical_text(text)
            if any(marker in lowered for marker in ("自行", "self", "自己开网")):
                bool_value = True
            elif any(marker in lowered for marker in ("自带", "包含", "included")):
                bool_value = False
        if bool_value is None:
            return text
        return "true" if bool_value else "false"

    if normalized_field == "internet_provider":
        provider = normalize_provider_text(text)
        return provider

    return text


def display_value_or_unknown(value: object) -> str:
    normalized = normalize_unknown_value(value)
    return normalized if normalized is not None else "Unknown"

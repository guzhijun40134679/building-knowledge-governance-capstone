from __future__ import annotations

import os
import re
import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, Iterator, Sequence

from dotenv import load_dotenv

from kb_security import hash_password, utc_now_iso


BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env.local", override=True)
DATA_DIR = Path(os.getenv("WHITEPAPER_DATA_DIR", BACKEND_DIR / "data"))
UPLOAD_ROOT = Path(os.getenv("WHITEPAPER_UPLOAD_DIR", DATA_DIR / "uploads"))
DB_PATH = Path(os.getenv("WHITEPAPER_DB_PATH", DATA_DIR / "whitepaper.db"))


DEFAULT_USERS = [
    ("superadmin", "Super Admin", "super_admin", os.getenv("WHITEPAPER_SUPERADMIN_PASSWORD", "")),
    ("admin", "Admin", "admin", os.getenv("WHITEPAPER_ADMIN_PASSWORD", "")),
    ("employee", "Employee", "employee", os.getenv("WHITEPAPER_EMPLOYEE_PASSWORD", "")),
    ("viewer", "Viewer", "viewer", os.getenv("WHITEPAPER_VIEWER_PASSWORD", "")),
]

INITIAL_PASSWORD_PLACEHOLDERS = {
    "change_me",
    "changeme",
    "your_password_here",
    "replace_me",
    "replace_with_a_strong_password",
}


def validate_initial_password(username: str, password: str) -> str:
    value = (password or "").strip()
    if len(value) < 12 or value.lower() in INITIAL_PASSWORD_PLACEHOLDERS:
        env_name = f"WHITEPAPER_{username.upper()}_PASSWORD"
        raise RuntimeError(
            f"{env_name} must be set to a non-placeholder password of at least 12 characters "
            "before initializing a new database. Run install.command to configure it safely."
        )
    return value


CORE_FIELD_DEFINITIONS = [
    ("building_name", "Building Name", "text", 1, "Canonical building name", 1),
    ("address", "Address", "text", 0, "Building address", 1),
    ("building_management_contact", "Management Contact", "text", 0, "Property manager or management-office contact details", 0),
    ("building_front_desk_contact", "Front Desk / Concierge Contact", "text", 0, "Front desk or concierge contact details", 0),
    ("building_maintenance_contact", "Maintenance / Service Contact", "text", 0, "Maintenance or service-request contact details", 0),
    ("insurance_required", "Renters Insurance Required", "boolean", 0, "Whether the building requires renters insurance", 1),
    ("insurance_coverage_amount", "Insurance Coverage Amount", "text", 0, "Required renters-insurance coverage amount", 1),
    ("electricity_required", "Electricity Account Required", "boolean", 0, "Whether the resident must open an electricity account", 1),
    ("electricity_provider", "Electricity Provider", "text", 0, "Electric utility explicitly named by the source", 1),
    ("internet_self_setup_required", "Resident Internet Setup Required", "boolean", 0, "Whether the resident must arrange internet service", 1),
    ("internet_provider", "Additional Internet Providers", "text", 0, "Internet providers explicitly named by the source", 1),
    ("internet_notes", "Internet Notes", "text", 0, "Additional internet-service notes", 1),
    ("internet_verizon_plan_tiers", "Verizon Plan Tiers", "text", 0, "Manually verified Verizon plan tiers", 0),
    ("internet_verizon_notes", "Verizon Notes / Contact", "text", 0, "Verizon contact, URL, setup instructions, or special notes", 0),
    ("internet_xfinity_plan_tiers", "Xfinity Plan Tiers", "text", 0, "Manually verified Xfinity plan tiers", 0),
    ("internet_xfinity_notes", "Xfinity Notes / Contact", "text", 0, "Xfinity contact, URL, setup instructions, or special notes", 0),
    ("internet_spectrum_plan_tiers", "Spectrum Plan Tiers", "text", 0, "Manually verified Spectrum plan tiers", 0),
    ("internet_spectrum_notes", "Spectrum Notes / Contact", "text", 0, "Spectrum contact, URL, setup instructions, or special notes", 0),
    ("internet_astound_plan_tiers", "Astound Plan Tiers", "text", 0, "Manually verified Astound plan tiers", 0),
    ("internet_astound_notes", "Astound Notes / Contact", "text", 0, "Astound contact, URL, setup instructions, or special notes", 0),
    ("move_in_notes", "Move-In Notes", "text", 0, "Move-in process and requirements", 1),
    ("key_pickup_notes", "Key Pickup Instructions", "text", 0, "Key pickup method, location, timing, and prerequisites", 0),
    ("service_elevator_booking_notes", "Service Elevator Booking", "text", 0, "Booking method, time window, contact, or platform for a service elevator", 0),
    ("source_type", "Source Type", "text", 0, "Type of source material", 1),
    ("source_file", "Source File", "text", 0, "Original source filename", 1),
    ("source_date", "Source Date", "text", 0, "Date of the source material", 1),
    ("info_cutoff_date", "Information Cutoff Date", "text", 0, "Date through which the information is considered current", 1),
    ("internet_verizon_supported", "Verizon Supported", "boolean", 0, "Whether Verizon service is supported", 0),
    ("internet_xfinity_supported", "Xfinity Supported", "boolean", 0, "Whether Xfinity service is supported", 0),
    ("internet_spectrum_supported", "Spectrum Supported", "boolean", 0, "Whether Spectrum service is supported", 0),
    ("internet_astound_supported", "Astound Supported", "boolean", 0, "Whether Astound service is supported", 0),
    ("document_type", "Document Type", "text", 0, "Classification such as welcome letter, email, PDF, or OCR text", 0),
    ("insurance_renters_required", "Renters Insurance Requirement", "text", 0, "yes / no / optional / manual_review", 0),
    ("insurance_renters_minimum_coverage", "Renters Insurance Minimum Coverage", "text", 0, "Minimum renters-insurance or general coverage amount", 0),
    ("insurance_personal_property_required", "Personal Property Coverage Required", "text", 0, "Whether personal-property coverage is explicitly required", 0),
    ("insurance_personal_property_minimum", "Personal Property Coverage Minimum", "text", 0, "Minimum personal-property coverage", 0),
    ("insurance_personal_liability_required", "Personal Liability Required", "text", 0, "Whether personal-liability coverage is explicitly required", 0),
    ("insurance_personal_liability_per_occurrence", "Personal Liability per Occurrence", "text", 0, "Per-occurrence personal-liability limit", 0),
    ("insurance_personal_liability_aggregate", "Personal Liability Aggregate", "text", 0, "Aggregate personal-liability limit", 0),
    ("insurance_coi_required", "COI Required", "text", 0, "Whether a Certificate of Insurance is required", 0),
    ("insurance_coi_trigger", "COI Trigger", "text", 0, "For example movers, large deliveries, or use of a service elevator", 0),
    ("insurance_interested_party_required", "Interested Party / Additional Interest Required", "text", 0, "Whether the landlord or property must be listed as an interested party or additional interest", 0),
    ("insurance_additional_insured_required", "Additional Insured Required", "text", 0, "Whether additional insured is explicitly required", 0),
    ("insurance_certificate_holder_required", "Certificate Holder Required", "text", 0, "Whether a certificate holder is explicitly required", 0),
    ("insurance_submission_method", "Insurance Submission Method", "text", 0, "Email, portal, BuildingLink, Rello, The Guarantors, or another stated channel", 0),
    ("insurance_recipient", "Insurance Recipient", "text", 0, "Email address, property, or management-company recipient", 0),
    ("insurance_alternative_program_or_penalty", "Alternative Program or Penalty", "text", 0, "Alternative program, penalty, or verification method if insurance is not submitted", 0),
]

ENGLISH_FIELD_DISPLAY_NAMES = {
    field_key: display_name for field_key, display_name, *_ in CORE_FIELD_DEFINITIONS
}


FIELD_ALIASES = {
    "building_name": ["大楼名称"],
    "address": ["地址"],
    "building_management_contact": ["物业/管理方联系方式", "management office", "property manager", "property management"],
    "building_front_desk_contact": ["前台/Concierge 联系方式", "front desk", "concierge", "doorman"],
    "building_maintenance_contact": ["维修/服务联系方式", "maintenance", "service request", "repairs"],
    "insurance_required": ["是否需要保险"],
    "insurance_coverage_amount": ["保险保额"],
    "electricity_required": ["是否需要开电"],
    "electricity_provider": ["电力公司"],
    "internet_self_setup_required": ["是否需要自己开网"],
    "internet_provider": ["网络运营商", "额外网络运营商", "其他网络运营商"],
    "internet_notes": ["网络备注"],
    "internet_verizon_plan_tiers": ["Verizon套餐档位", "verizon plans", "verizon tiers", "verizon package tiers"],
    "internet_verizon_notes": ["Verizon备注/联系人", "verizon notes", "verizon contact", "verizon special notes"],
    "internet_xfinity_plan_tiers": ["Xfinity套餐档位", "xfinity plans", "xfinity tiers", "xfinity package tiers"],
    "internet_xfinity_notes": ["Xfinity备注/联系人", "xfinity notes", "xfinity contact", "xfinity special notes"],
    "internet_spectrum_plan_tiers": ["Spectrum套餐档位", "spectrum plans", "spectrum tiers", "spectrum package tiers"],
    "internet_spectrum_notes": ["Spectrum备注/联系人", "spectrum notes", "spectrum contact", "spectrum special notes"],
    "internet_astound_plan_tiers": ["Astound套餐档位", "astound plans", "astound tiers", "astound package tiers"],
    "internet_astound_notes": ["Astound备注/联系人", "astound notes", "astound contact", "astound special notes"],
    "move_in_notes": ["入住备注"],
    "key_pickup_notes": ["钥匙领取说明", "key pickup", "pick up keys", "collect keys", "key collection"],
    "service_elevator_booking_notes": [
        "货梯预约说明",
        "service elevator booking",
        "service elevator",
        "move-in appointment",
        "reserve elevator",
        "rello",
    ],
    "source_date": ["来源日期"],
    "info_cutoff_date": ["信息截止日期"],
    "source_type": ["来源类型"],
    "source_file": ["来源文件"],
    "internet_verizon_supported": ["Verizon是否支持"],
    "internet_xfinity_supported": ["Xfinity是否支持"],
    "internet_spectrum_supported": ["Spectrum是否支持"],
    "internet_astound_supported": ["Astound是否支持"],
    "document_type": ["文件类型", "document type"],
    "insurance_renters_required": ["是否需要 Renters Insurance", "renters insurance required", "renters insurance", "租客保险"],
    "insurance_renters_minimum_coverage": ["Renters Insurance 最低保额", "renters insurance minimum coverage", "renters minimum coverage"],
    "insurance_personal_property_required": ["是否需要 Personal Property Coverage", "personal property required", "property coverage required"],
    "insurance_personal_property_minimum": ["Personal Property Coverage 最低额度", "personal property minimum", "property coverage minimum"],
    "insurance_personal_liability_required": ["是否需要 Personal Liability", "liability required", "personal liability required"],
    "insurance_personal_liability_per_occurrence": ["Personal Liability per occurrence", "liability per occurrence", "per occurrence liability"],
    "insurance_personal_liability_aggregate": ["Personal Liability aggregate", "liability aggregate", "aggregate liability"],
    "insurance_coi_required": ["是否需要 COI", "coi required", "certificate of insurance required"],
    "insurance_coi_trigger": ["COI 触发条件", "coi trigger", "certificate of insurance trigger"],
    "insurance_interested_party_required": ["是否需要 Interested Party / Additional Interest", "interested party required", "additional interest required"],
    "insurance_additional_insured_required": ["是否要求 Additional Insured", "additional insured required"],
    "insurance_certificate_holder_required": ["是否要求 Certificate Holder", "certificate holder required"],
    "insurance_submission_method": ["保险提交方式", "insurance submission method", "submission method"],
    "insurance_recipient": ["保险接收方", "insurance recipient", "recipient"],
    "insurance_alternative_program_or_penalty": ["替代项目或罚金", "alternative program", "penalty", "protection program"],
}


STANDARD_FIELD_KEYS = {field_key for field_key, *_ in CORE_FIELD_DEFINITIONS}
STANDARD_FIELD_CATALOG_VERSION = "standard_headers_v2"

FIELD_GROUP_ORDER = {
    "basic": 0,
    "insurance": 10,
    "electricity": 20,
    "internet": 30,
    "move_in": 40,
    "contacts": 50,
    "custom": 90,
}

FIELD_METADATA_DEFAULTS = {
    "building_name": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 10,
        "excel_header_name": "大楼名称",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 0,
        "query_keywords_json": json.dumps(["大楼名称", "楼名", "building", "building name"], ensure_ascii=False),
        "answer_template": "",
    },
    "address": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 20,
        "excel_header_name": "地址",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["地址", "address", "location"], ensure_ascii=False),
        "answer_template": "{display_name}: {value}",
    },
    "building_management_contact": {
        "scope": "master_and_staging",
        "group_key": "contacts",
        "display_order": 10,
        "excel_header_name": "物业/管理方联系方式",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["物业", "管理方", "property manager", "management office"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "building_front_desk_contact": {
        "scope": "master_and_staging",
        "group_key": "contacts",
        "display_order": 20,
        "excel_header_name": "前台/Concierge 联系方式",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["前台", "礼宾", "front desk", "concierge", "doorman"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "building_maintenance_contact": {
        "scope": "master_and_staging",
        "group_key": "contacts",
        "display_order": 30,
        "excel_header_name": "维修/服务联系方式",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["维修", "maintenance", "service request", "repair"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 10,
        "excel_header_name": "是否需要保险",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["保险", "renters insurance", "保险要求"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_coverage_amount": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 20,
        "excel_header_name": "保险保额",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["保额", "coverage", "coverage amount"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_coi_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 30,
        "excel_header_name": "是否需要COI",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["coi", "certificate of insurance"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_coi_trigger": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 40,
        "excel_header_name": "COI触发条件",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["coi触发", "coi 条件"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_renters_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 50,
        "excel_header_name": "是否需要 Renters Insurance",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["renters insurance", "租客保险"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_renters_minimum_coverage": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 60,
        "excel_header_name": "Renters Insurance 最低保额",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["renters coverage", "renters 最低保额"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_personal_property_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 70,
        "excel_header_name": "是否需要 Personal Property Coverage",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["personal property", "property coverage"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_personal_property_minimum": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 80,
        "excel_header_name": "Personal Property Coverage 最低额度",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["property minimum", "personal property minimum"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_personal_liability_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 90,
        "excel_header_name": "是否需要 Personal Liability",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["liability", "personal liability"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_personal_liability_per_occurrence": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 100,
        "excel_header_name": "Personal Liability per occurrence",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["per occurrence", "liability per occurrence"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_personal_liability_aggregate": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 110,
        "excel_header_name": "Personal Liability aggregate",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["aggregate", "liability aggregate"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_interested_party_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 120,
        "excel_header_name": "是否需要 Interested Party / Additional Interest",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["interested party", "additional interest"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_additional_insured_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 130,
        "excel_header_name": "是否要求 Additional Insured",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["additional insured"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_certificate_holder_required": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 140,
        "excel_header_name": "是否要求 Certificate Holder",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["certificate holder"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_submission_method": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 150,
        "excel_header_name": "保险提交方式",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["提交方式", "submission method"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_recipient": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 160,
        "excel_header_name": "保险接收方",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["接收方", "recipient"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "insurance_alternative_program_or_penalty": {
        "scope": "master_and_staging",
        "group_key": "insurance",
        "display_order": 170,
        "excel_header_name": "替代项目或罚金",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["罚金", "penalty", "protection program"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "electricity_required": {
        "scope": "master_and_staging",
        "group_key": "electricity",
        "display_order": 10,
        "excel_header_name": "是否需要开电",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["开电", "electricity", "utility"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "electricity_provider": {
        "scope": "master_and_staging",
        "group_key": "electricity",
        "display_order": 20,
        "excel_header_name": "电力公司",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["电力公司", "pseg", "con edison"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_self_setup_required": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 10,
        "excel_header_name": "是否需要自己开网",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["开网", "internet", "wifi", "broadband"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_verizon_supported": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 20,
        "excel_header_name": "Verizon是否支持",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["verizon", "verizon support"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_verizon_plan_tiers": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 21,
        "excel_header_name": "Verizon套餐档位",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["verizon 套餐", "verizon plans"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_verizon_notes": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 22,
        "excel_header_name": "Verizon备注/联系人",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["verizon 备注", "verizon 联系人", "verizon contact"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_xfinity_supported": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 30,
        "excel_header_name": "Xfinity是否支持",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["xfinity"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_xfinity_plan_tiers": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 31,
        "excel_header_name": "Xfinity套餐档位",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["xfinity 套餐", "xfinity plans"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_xfinity_notes": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 32,
        "excel_header_name": "Xfinity备注/联系人",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["xfinity 备注", "xfinity 联系人", "xfinity contact"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_spectrum_supported": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 40,
        "excel_header_name": "Spectrum是否支持",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["spectrum"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_spectrum_plan_tiers": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 41,
        "excel_header_name": "Spectrum套餐档位",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["spectrum 套餐", "spectrum plans"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_spectrum_notes": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 42,
        "excel_header_name": "Spectrum备注/联系人",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["spectrum 备注", "spectrum 联系人", "spectrum contact"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_astound_supported": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 50,
        "excel_header_name": "Astound是否支持",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["astound"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_astound_plan_tiers": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 51,
        "excel_header_name": "Astound套餐档位",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["astound 套餐", "astound plans"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_astound_notes": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 52,
        "excel_header_name": "Astound备注/联系人",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["astound 备注", "astound 联系人", "astound contact"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_provider": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 60,
        "excel_header_name": "额外网络运营商",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["网络运营商", "额外网络运营商", "provider"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "internet_notes": {
        "scope": "master_and_staging",
        "group_key": "internet",
        "display_order": 70,
        "excel_header_name": "网络备注",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["网络备注", "网络说明"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "move_in_notes": {
        "scope": "master_and_staging",
        "group_key": "move_in",
        "display_order": 10,
        "excel_header_name": "入住备注",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["入住备注", "move in", "搬入"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "key_pickup_notes": {
        "scope": "master_and_staging",
        "group_key": "move_in",
        "display_order": 20,
        "excel_header_name": "钥匙领取说明",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["钥匙", "key pickup"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "service_elevator_booking_notes": {
        "scope": "master_and_staging",
        "group_key": "move_in",
        "display_order": 30,
        "excel_header_name": "货梯预约说明",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["货梯", "service elevator", "rello"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "source_type": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 80,
        "excel_header_name": "来源类型",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 0,
        "query_keywords_json": json.dumps([], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "source_file": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 90,
        "excel_header_name": "来源文件",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 0,
        "query_keywords_json": json.dumps([], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "source_date": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 100,
        "excel_header_name": "来源日期",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 0,
        "query_keywords_json": json.dumps([], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "info_cutoff_date": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 110,
        "excel_header_name": "信息截止日期",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1,
        "query_keywords_json": json.dumps(["信息截止日期", "updated date"], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
    "document_type": {
        "scope": "master_and_staging",
        "group_key": "basic",
        "display_order": 120,
        "excel_header_name": "文件类型",
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 0,
        "query_keywords_json": json.dumps([], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
    },
}

SCHEMA_COLUMN_MIGRATIONS = {
    "master_building_info": {
        "completeness_status": "TEXT NOT NULL DEFAULT 'verified_partial'",
        "completeness_score": "INTEGER NOT NULL DEFAULT 0",
        "verification_note": "TEXT NOT NULL DEFAULT ''",
    },
    "field_definitions": {
        "scope": "TEXT NOT NULL DEFAULT 'master_and_staging'",
        "group_key": "TEXT NOT NULL DEFAULT 'custom'",
        "display_order": "INTEGER NOT NULL DEFAULT 900",
        "excel_header_name": "TEXT NOT NULL DEFAULT ''",
        "visible_in_master_detail": "INTEGER NOT NULL DEFAULT 1",
        "visible_in_staging_detail": "INTEGER NOT NULL DEFAULT 1",
        "visible_in_query": "INTEGER NOT NULL DEFAULT 1",
        "query_keywords_json": "TEXT NOT NULL DEFAULT '[]'",
        "answer_template": "TEXT NOT NULL DEFAULT ''",
        "status": "TEXT NOT NULL DEFAULT 'active'",
    },
    "source_documents": {
        "extracted_pages_json": "TEXT NOT NULL DEFAULT '[]'",
        "parse_artifacts_json": "TEXT NOT NULL DEFAULT '{}'",
        "parse_status": "TEXT NOT NULL DEFAULT 'completed'",
        "parse_started_at": "TEXT NOT NULL DEFAULT ''",
        "parse_completed_at": "TEXT NOT NULL DEFAULT ''",
        "parse_error": "TEXT NOT NULL DEFAULT ''",
        "submission_group_id": "TEXT NOT NULL DEFAULT ''",
    },
    "staging_update_requests": {
        "evidence_json": "TEXT NOT NULL DEFAULT '[]'",
        "manual_review_reason": "TEXT NOT NULL DEFAULT ''",
        "review_flags_json": "TEXT NOT NULL DEFAULT '[]'",
        "approval_stage": "TEXT NOT NULL DEFAULT 'to_staging'",
        "target_staging_key": "TEXT NOT NULL DEFAULT ''",
    },
    "crm_cases": {
        "unit": "TEXT NOT NULL DEFAULT ''",
        "group_creator_contact": "TEXT NOT NULL DEFAULT ''",
        "deleted_at": "TEXT NOT NULL DEFAULT ''",
        "deleted_by": "TEXT NOT NULL DEFAULT ''",
        "delete_reason": "TEXT NOT NULL DEFAULT ''",
    },
    "crm_case_services": {
        "service_scope": "TEXT NOT NULL DEFAULT 'case_level'",
        "responsible_customer_id": "TEXT NOT NULL DEFAULT ''",
        "covered_customer_ids": "TEXT NOT NULL DEFAULT '[]'",
        "responsibility_status": "TEXT NOT NULL DEFAULT 'unassigned'",
        "active_flow_step_key": "TEXT NOT NULL DEFAULT ''",
        "staff_flow_status": "TEXT NOT NULL DEFAULT ''",
        "customer_flow_status": "TEXT NOT NULL DEFAULT ''",
        "service_status": "TEXT NOT NULL DEFAULT ''",
        "termination_reason": "TEXT NOT NULL DEFAULT ''",
        "flow_snapshot_json": "TEXT NOT NULL DEFAULT '{}'",
        "need_status": "TEXT NOT NULL DEFAULT 'unknown'",
        "submission_status": "TEXT NOT NULL DEFAULT 'not_started'",
        "completion_status": "TEXT NOT NULL DEFAULT 'not_started'",
        "intro_status": "TEXT NOT NULL DEFAULT 'not_introduced'",
        "follow_up_status": "TEXT NOT NULL DEFAULT 'not_started'",
        "agent_completion_status": "TEXT NOT NULL DEFAULT 'not_started'",
        "blocked_reason": "TEXT NOT NULL DEFAULT ''",
    },
    "crm_tasks": {
        "not_before_at": "TEXT NOT NULL DEFAULT ''",
        "assigned_to": "TEXT NOT NULL DEFAULT ''",
        "target_customer_id": "TEXT",
        "created_from_rule": "TEXT NOT NULL DEFAULT ''",
    },
}


def default_field_metadata(field_key: str, display_name: str, field_type: str, is_core: int) -> dict:
    defaults = {
        "scope": "master_and_staging",
        "group_key": "custom" if not is_core else "basic",
        "display_order": 900,
        "excel_header_name": display_name,
        "visible_in_master_detail": 1,
        "visible_in_staging_detail": 1,
        "visible_in_query": 1 if field_type != "meta" else 0,
        "query_keywords_json": json.dumps([display_name, field_key], ensure_ascii=False),
        "answer_template": "{display_name}：{value}",
        "status": "active",
    }
    defaults.update(FIELD_METADATA_DEFAULTS.get(field_key, {}))
    if field_key in ENGLISH_FIELD_DISPLAY_NAMES:
        defaults["excel_header_name"] = ENGLISH_FIELD_DISPLAY_NAMES[field_key]
    if defaults.get("answer_template") == "{display_name}：{value}":
        defaults["answer_template"] = "{display_name}: {value}"
    return defaults


def field_catalog_select_sql() -> str:
    return """
        SELECT
          id,
          field_key,
          display_name,
          field_type,
          required,
          description,
          is_core,
          active,
          scope,
          group_key,
          display_order,
          excel_header_name,
          visible_in_master_detail,
          visible_in_staging_detail,
          visible_in_query,
          query_keywords_json,
          answer_template,
          status,
          created_by,
          created_at,
          updated_at
        FROM field_definitions
    """


def load_field_catalog(
    conn: sqlite3.Connection,
    *,
    include_inactive: bool = False,
    statuses: Optional[Sequence[str]] = None,
) -> list[dict]:
    where_parts: list[str] = []
    params: list[object] = []
    if not include_inactive:
        where_parts.append("active = 1")
    if statuses:
        where_parts.append(f"status IN ({','.join('?' for _ in statuses)})")
        params.extend(statuses)
    sql = field_catalog_select_sql()
    if where_parts:
        sql += " WHERE " + " AND ".join(where_parts)
    sql += " ORDER BY display_order ASC, is_core DESC, display_name ASC"
    definitions = conn.execute(sql, tuple(params)).fetchall()
    alias_rows = conn.execute(
        "SELECT field_key, alias_name FROM field_aliases ORDER BY alias_name ASC"
    ).fetchall()
    alias_map: dict[str, list[str]] = {}
    for row in alias_rows:
        alias_map.setdefault(row["field_key"], []).append(row["alias_name"])
    result: list[dict] = []
    for row in definitions:
        item = dict(row)
        item["aliases"] = alias_map.get(item["field_key"], [])
        item["query_keywords"] = json.loads(item.get("query_keywords_json") or "[]")
        result.append(item)
    return result


def row_factory(cursor: sqlite3.Cursor, row: Sequence[object]) -> dict:
    return {column[0]: row[idx] for idx, column in enumerate(cursor.description)}


def ensure_runtime_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    (UPLOAD_ROOT / "imports").mkdir(parents=True, exist_ok=True)
    (UPLOAD_ROOT / "sources").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "master_excel").mkdir(parents=True, exist_ok=True)


def connect_db() -> sqlite3.Connection:
    ensure_runtime_dirs()
    connection = sqlite3.connect(DB_PATH, timeout=15, check_same_thread=False)
    connection.row_factory = row_factory
    connection.execute("PRAGMA busy_timeout = 15000")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def db_connection() -> Iterator[sqlite3.Connection]:
    conn = connect_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_many(conn: sqlite3.Connection, sql: str, rows: Iterable[Sequence[object]]) -> None:
    conn.executemany(sql, list(rows))


def ensure_table_columns(conn: sqlite3.Connection, table_name: str, columns: dict[str, str]) -> None:
    existing = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    for column_name, column_definition in columns.items():
        if column_name in existing:
            continue
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")


def init_db() -> None:
    ensure_runtime_dirs()
    with db_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS app_meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              last_used_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS field_definitions (
              id TEXT PRIMARY KEY,
              field_key TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              field_type TEXT NOT NULL,
              required INTEGER NOT NULL DEFAULT 0,
              description TEXT NOT NULL DEFAULT '',
              is_core INTEGER NOT NULL DEFAULT 0,
              active INTEGER NOT NULL DEFAULT 1,
              scope TEXT NOT NULL DEFAULT 'master_and_staging',
              group_key TEXT NOT NULL DEFAULT 'custom',
              display_order INTEGER NOT NULL DEFAULT 900,
              excel_header_name TEXT NOT NULL DEFAULT '',
              visible_in_master_detail INTEGER NOT NULL DEFAULT 1,
              visible_in_staging_detail INTEGER NOT NULL DEFAULT 1,
              visible_in_query INTEGER NOT NULL DEFAULT 1,
              query_keywords_json TEXT NOT NULL DEFAULT '[]',
              answer_template TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'active',
              created_by TEXT NOT NULL DEFAULT 'system',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS field_aliases (
              id TEXT PRIMARY KEY,
              field_key TEXT NOT NULL,
              alias_name TEXT NOT NULL,
              language TEXT NOT NULL DEFAULT 'mixed',
              confidence REAL NOT NULL DEFAULT 1.0,
              created_by TEXT NOT NULL DEFAULT 'system',
              created_at TEXT NOT NULL,
              UNIQUE(field_key, alias_name)
            );

            CREATE TABLE IF NOT EXISTS field_change_requests (
              id TEXT PRIMARY KEY,
              display_name TEXT NOT NULL,
              requirement_text TEXT NOT NULL DEFAULT '',
              draft_payload_json TEXT NOT NULL DEFAULT '{}',
              status TEXT NOT NULL DEFAULT 'pending',
              requested_by TEXT NOT NULL,
              reviewer TEXT,
              review_comment TEXT,
              applied_field_key TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              reviewed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS import_batches (
              id TEXT PRIMARY KEY,
              original_file_name TEXT NOT NULL,
              stored_path TEXT NOT NULL,
              file_hash TEXT NOT NULL,
              status TEXT NOT NULL,
              sheet_names TEXT NOT NULL DEFAULT '[]',
              uploaded_by TEXT NOT NULL,
              confirmed_by TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS import_header_mappings (
              id TEXT PRIMARY KEY,
              import_batch_id TEXT NOT NULL,
              sheet_name TEXT NOT NULL,
              original_header TEXT NOT NULL,
              mapped_field_key TEXT,
              match_method TEXT NOT NULL,
              confidence REAL NOT NULL DEFAULT 0,
              confirmed_by_admin TEXT,
              ignored INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
            );

            CREATE TABLE IF NOT EXISTS source_documents (
              id TEXT PRIMARY KEY,
              raw_input_type TEXT NOT NULL,
              parser_type TEXT NOT NULL,
              source_type TEXT NOT NULL,
              source_file TEXT NOT NULL,
              stored_path TEXT,
              source_content TEXT NOT NULL DEFAULT '',
              extracted_text TEXT NOT NULL DEFAULT '',
              extracted_pages_json TEXT NOT NULL DEFAULT '[]',
              parse_artifacts_json TEXT NOT NULL DEFAULT '{}',
              parse_status TEXT NOT NULL DEFAULT 'completed',
              parse_started_at TEXT NOT NULL DEFAULT '',
              parse_completed_at TEXT NOT NULL DEFAULT '',
              parse_error TEXT NOT NULL DEFAULT '',
              submission_group_id TEXT NOT NULL DEFAULT '',
              created_by TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ocr_jobs (
              id TEXT PRIMARY KEY,
              source_document_id TEXT NOT NULL,
              input_index INTEGER NOT NULL DEFAULT 1,
              provider TEXT NOT NULL,
              external_task_id TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'queued',
              attempt_count INTEGER NOT NULL DEFAULT 0,
              submitted_at TEXT NOT NULL DEFAULT '',
              next_poll_at TEXT NOT NULL DEFAULT '',
              completed_at TEXT NOT NULL DEFAULT '',
              duration_ms INTEGER NOT NULL DEFAULT 0,
              result_artifact_path TEXT NOT NULL DEFAULT '',
              error_code TEXT NOT NULL DEFAULT '',
              error_message TEXT NOT NULL DEFAULT '',
              metadata_json TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(source_document_id, input_index, provider),
              FOREIGN KEY(source_document_id) REFERENCES source_documents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ai_summary_cache (
              id TEXT PRIMARY KEY,
              cache_key TEXT NOT NULL UNIQUE,
              source_mode TEXT NOT NULL,
              record_id TEXT NOT NULL,
              snapshot_hash TEXT NOT NULL,
              prompt_version TEXT NOT NULL,
              fact_summary TEXT NOT NULL DEFAULT '',
              ai_summary TEXT NOT NULL DEFAULT '',
              model TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS llm_call_logs (
              id TEXT PRIMARY KEY,
              source_document_id TEXT,
              stage TEXT NOT NULL,
              model TEXT NOT NULL DEFAULT '',
              system_prompt TEXT NOT NULL DEFAULT '',
              user_payload_json TEXT NOT NULL DEFAULT '{}',
              raw_response TEXT NOT NULL DEFAULT '',
              parsed_response_json TEXT NOT NULL DEFAULT '{}',
              error TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              FOREIGN KEY(source_document_id) REFERENCES source_documents(id)
            );

            CREATE INDEX IF NOT EXISTS idx_ai_summary_cache_record
              ON ai_summary_cache(source_mode, record_id);

            CREATE TABLE IF NOT EXISTS master_building_info (
              id TEXT PRIMARY KEY,
              building_name TEXT NOT NULL,
              address TEXT,
              insurance_required INTEGER,
              insurance_coverage_amount TEXT,
              electricity_required INTEGER,
              electricity_provider TEXT,
              internet_self_setup_required INTEGER,
              internet_provider TEXT,
              internet_notes TEXT,
              move_in_notes TEXT,
              source_type TEXT,
              source_file TEXT,
              source_date TEXT,
              info_cutoff_date TEXT,
              last_verified_at TEXT,
              completeness_status TEXT NOT NULL DEFAULT 'verified_partial',
              completeness_score INTEGER NOT NULL DEFAULT 0,
              verification_note TEXT NOT NULL DEFAULT '',
              updated_by TEXT,
              version INTEGER NOT NULL DEFAULT 1,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS master_building_field_values (
              id TEXT PRIMARY KEY,
              building_id TEXT NOT NULL,
              field_key TEXT NOT NULL,
              value_text TEXT,
              value_json TEXT,
              source_type TEXT,
              source_file TEXT,
              source_date TEXT,
              info_cutoff_date TEXT,
              last_verified_at TEXT,
              updated_by TEXT,
              version INTEGER NOT NULL DEFAULT 1,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(building_id, field_key),
              FOREIGN KEY(building_id) REFERENCES master_building_info(id)
            );

            CREATE TABLE IF NOT EXISTS staging_building_info (
              id TEXT PRIMARY KEY,
              building_name TEXT NOT NULL,
              address TEXT,
              insurance_required INTEGER,
              insurance_coverage_amount TEXT,
              electricity_required INTEGER,
              electricity_provider TEXT,
              internet_self_setup_required INTEGER,
              internet_provider TEXT,
              internet_notes TEXT,
              move_in_notes TEXT,
              source_type TEXT,
              source_file TEXT,
              source_date TEXT,
              info_cutoff_date TEXT,
              updated_by TEXT,
              library_status TEXT NOT NULL DEFAULT '待补充',
              version INTEGER NOT NULL DEFAULT 1,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS staging_building_field_values (
              id TEXT PRIMARY KEY,
              building_id TEXT NOT NULL,
              field_key TEXT NOT NULL,
              value_text TEXT,
              value_json TEXT,
              source_type TEXT,
              source_file TEXT,
              source_date TEXT,
              info_cutoff_date TEXT,
              updated_by TEXT,
              version INTEGER NOT NULL DEFAULT 1,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(building_id, field_key),
              FOREIGN KEY(building_id) REFERENCES staging_building_info(id)
            );

            CREATE TABLE IF NOT EXISTS staging_update_requests (
              id TEXT PRIMARY KEY,
              record_id TEXT NOT NULL UNIQUE,
              submission_group_id TEXT NOT NULL,
              building_name TEXT NOT NULL,
              building_id TEXT,
              field_name TEXT NOT NULL,
              old_value TEXT,
              new_value TEXT,
              normalized_new_value TEXT,
              source_type TEXT NOT NULL,
              source_content TEXT NOT NULL DEFAULT '',
              source_file TEXT NOT NULL DEFAULT '',
              source_document_id TEXT,
              approval_stage TEXT NOT NULL DEFAULT 'to_staging',
              target_staging_key TEXT NOT NULL DEFAULT '',
              submitted_by TEXT NOT NULL,
              submitted_at TEXT NOT NULL,
              ai_confidence REAL,
              review_status TEXT NOT NULL,
              reviewer TEXT,
              reviewed_at TEXT,
              review_comment TEXT,
              conflict_with_long_term INTEGER NOT NULL DEFAULT 0,
              priority TEXT NOT NULL DEFAULT 'normal',
              import_batch_id TEXT,
              parser_type TEXT NOT NULL,
              raw_input_type TEXT NOT NULL,
              low_confidence INTEGER NOT NULL DEFAULT 0,
              missing_required_detail INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(building_id) REFERENCES master_building_info(id),
              FOREIGN KEY(import_batch_id) REFERENCES import_batches(id),
              FOREIGN KEY(source_document_id) REFERENCES source_documents(id)
            );

            CREATE TABLE IF NOT EXISTS crm_cases (
              id TEXT PRIMARY KEY,
              group_name TEXT NOT NULL,
              owner_user_id TEXT NOT NULL,
              unit TEXT NOT NULL DEFAULT '',
              group_creator_name TEXT NOT NULL DEFAULT '',
              group_creator_contact TEXT NOT NULL DEFAULT '',
              agent_team_t TEXT NOT NULL DEFAULT '',
              agent_team_m TEXT NOT NULL DEFAULT '',
              lease_start_date TEXT NOT NULL DEFAULT '',
              building_source TEXT NOT NULL DEFAULT '',
              building_id TEXT NOT NULL DEFAULT '',
              building_name TEXT NOT NULL DEFAULT '',
              building_address TEXT NOT NULL DEFAULT '',
              building_snapshot_json TEXT NOT NULL DEFAULT '{}',
              insurance_earliest_start_date TEXT NOT NULL DEFAULT '',
              network_earliest_start_note TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'active',
              notes TEXT NOT NULL DEFAULT '',
              deleted_at TEXT NOT NULL DEFAULT '',
              deleted_by TEXT NOT NULL DEFAULT '',
              delete_reason TEXT NOT NULL DEFAULT '',
              created_by TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(owner_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS crm_case_guests (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL,
              full_name TEXT NOT NULL DEFAULT '',
              phone TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL DEFAULT '',
              wechat TEXT NOT NULL DEFAULT '',
              notes TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(case_id) REFERENCES crm_cases(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS crm_service_templates (
              id TEXT PRIMARY KEY,
              service_key TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              category TEXT NOT NULL DEFAULT 'general',
              active INTEGER NOT NULL DEFAULT 1,
              display_order INTEGER NOT NULL DEFAULT 100,
              config_json TEXT NOT NULL DEFAULT '{}',
              created_by TEXT NOT NULL DEFAULT 'system',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS crm_service_steps (
              id TEXT PRIMARY KEY,
              template_id TEXT NOT NULL,
              step_key TEXT NOT NULL,
              title TEXT NOT NULL,
              scope TEXT NOT NULL DEFAULT 'group',
              field_schema_json TEXT NOT NULL DEFAULT '[]',
              display_order INTEGER NOT NULL DEFAULT 100,
              active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(template_id, step_key),
              FOREIGN KEY(template_id) REFERENCES crm_service_templates(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS crm_case_services (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL,
              template_id TEXT NOT NULL,
              service_key TEXT NOT NULL,
              service_name TEXT NOT NULL,
              service_scope TEXT NOT NULL DEFAULT 'case_level',
              responsible_customer_id TEXT NOT NULL DEFAULT '',
              covered_customer_ids TEXT NOT NULL DEFAULT '[]',
              responsibility_status TEXT NOT NULL DEFAULT 'unassigned',
              active_flow_step_key TEXT NOT NULL DEFAULT '',
              staff_flow_status TEXT NOT NULL DEFAULT '',
              customer_flow_status TEXT NOT NULL DEFAULT '',
              service_status TEXT NOT NULL DEFAULT '',
              termination_reason TEXT NOT NULL DEFAULT '',
              flow_snapshot_json TEXT NOT NULL DEFAULT '{}',
              applicability TEXT NOT NULL DEFAULT 'unknown',
              status TEXT NOT NULL DEFAULT 'pending',
              need_status TEXT NOT NULL DEFAULT 'unknown',
              submission_status TEXT NOT NULL DEFAULT 'not_started',
              completion_status TEXT NOT NULL DEFAULT 'not_started',
              intro_status TEXT NOT NULL DEFAULT 'not_introduced',
              follow_up_status TEXT NOT NULL DEFAULT 'not_started',
              agent_completion_status TEXT NOT NULL DEFAULT 'not_started',
              blocked_reason TEXT NOT NULL DEFAULT '',
              group_progress_json TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(case_id, service_key),
              FOREIGN KEY(case_id) REFERENCES crm_cases(id) ON DELETE CASCADE,
              FOREIGN KEY(template_id) REFERENCES crm_service_templates(id)
            );

            CREATE TABLE IF NOT EXISTS crm_case_service_progress (
              id TEXT PRIMARY KEY,
              case_service_id TEXT NOT NULL,
              step_key TEXT NOT NULL,
              scope TEXT NOT NULL DEFAULT 'group',
              value_json TEXT NOT NULL DEFAULT '{}',
              note TEXT NOT NULL DEFAULT '',
              updated_by TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(case_service_id, step_key, scope),
              FOREIGN KEY(case_service_id) REFERENCES crm_case_services(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS crm_guest_service_progress (
              id TEXT PRIMARY KEY,
              guest_id TEXT NOT NULL,
              case_service_id TEXT NOT NULL,
              step_key TEXT NOT NULL,
              value_json TEXT NOT NULL DEFAULT '{}',
              note TEXT NOT NULL DEFAULT '',
              sensitive_json TEXT NOT NULL DEFAULT '{}',
              updated_by TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(guest_id, case_service_id, step_key),
              FOREIGN KEY(guest_id) REFERENCES crm_case_guests(id) ON DELETE CASCADE,
              FOREIGN KEY(case_service_id) REFERENCES crm_case_services(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS crm_tasks (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL,
              case_service_id TEXT,
              customer_id TEXT,
              title TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              task_type TEXT NOT NULL DEFAULT 'manual',
              due_at TEXT NOT NULL,
              not_before_at TEXT NOT NULL DEFAULT '',
              priority TEXT NOT NULL DEFAULT 'normal',
              status TEXT NOT NULL DEFAULT 'open',
              assigned_user_id TEXT NOT NULL DEFAULT '',
              assigned_to TEXT NOT NULL DEFAULT '',
              target_customer_id TEXT,
              source TEXT NOT NULL DEFAULT 'system',
              created_from_rule TEXT NOT NULL DEFAULT '',
              dedupe_key TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              completed_at TEXT NOT NULL DEFAULT '',
              FOREIGN KEY(case_id) REFERENCES crm_cases(id) ON DELETE CASCADE,
              FOREIGN KEY(case_service_id) REFERENCES crm_case_services(id) ON DELETE CASCADE,
              FOREIGN KEY(customer_id) REFERENCES crm_case_guests(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS crm_communication_events (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL,
              case_service_id TEXT,
              customer_id TEXT,
              channel TEXT NOT NULL DEFAULT 'wechat_group',
              direction TEXT NOT NULL DEFAULT 'internal',
              summary TEXT NOT NULL,
              raw_ref_json TEXT NOT NULL DEFAULT '{}',
              created_by TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              FOREIGN KEY(case_id) REFERENCES crm_cases(id) ON DELETE CASCADE,
              FOREIGN KEY(case_service_id) REFERENCES crm_case_services(id) ON DELETE SET NULL,
              FOREIGN KEY(customer_id) REFERENCES crm_case_guests(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS crm_notifications (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL,
              task_id TEXT,
              case_service_id TEXT,
              channel TEXT NOT NULL DEFAULT 'wechat',
              recipient_type TEXT NOT NULL DEFAULT 'group',
              recipient_ref TEXT NOT NULL DEFAULT '',
              content TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'draft',
              generated_by TEXT NOT NULL DEFAULT 'system',
              sent_at TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(case_id) REFERENCES crm_cases(id) ON DELETE CASCADE,
              FOREIGN KEY(task_id) REFERENCES crm_tasks(id) ON DELETE SET NULL,
              FOREIGN KEY(case_service_id) REFERENCES crm_case_services(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              user_role TEXT NOT NULL,
              action_type TEXT NOT NULL,
              target_table TEXT NOT NULL,
              target_record_id TEXT,
              building_name TEXT,
              field_name TEXT,
              old_value TEXT,
              new_value TEXT,
              source TEXT,
              ip_address TEXT,
              user_agent TEXT,
              note TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS idempotency_keys (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              scope TEXT NOT NULL,
              idempotency_key TEXT NOT NULL,
              request_hash TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'in_progress',
              response_json TEXT NOT NULL DEFAULT '',
              status_code INTEGER NOT NULL DEFAULT 200,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(user_id, scope, idempotency_key)
            );

            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
            CREATE INDEX IF NOT EXISTS idx_fields_key ON field_definitions(field_key);
            CREATE INDEX IF NOT EXISTS idx_aliases_alias ON field_aliases(alias_name);
            CREATE INDEX IF NOT EXISTS idx_master_building_name ON master_building_info(building_name);
            CREATE INDEX IF NOT EXISTS idx_master_building_address ON master_building_info(address);
            CREATE INDEX IF NOT EXISTS idx_master_field_values_building ON master_building_field_values(building_id);
            CREATE INDEX IF NOT EXISTS idx_staging_building_info_name ON staging_building_info(building_name);
            CREATE INDEX IF NOT EXISTS idx_staging_building_info_address ON staging_building_info(address);
            CREATE INDEX IF NOT EXISTS idx_staging_building_field_values_building ON staging_building_field_values(building_id);
            CREATE INDEX IF NOT EXISTS idx_staging_group ON staging_update_requests(submission_group_id);
            CREATE INDEX IF NOT EXISTS idx_staging_status ON staging_update_requests(review_status);
            CREATE INDEX IF NOT EXISTS idx_staging_building ON staging_update_requests(building_name);
            CREATE INDEX IF NOT EXISTS idx_llm_call_logs_source ON llm_call_logs(source_document_id);
            CREATE INDEX IF NOT EXISTS idx_ocr_jobs_source ON ocr_jobs(source_document_id);
            CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status, next_poll_at);
            CREATE INDEX IF NOT EXISTS idx_crm_cases_owner ON crm_cases(owner_user_id);
            CREATE INDEX IF NOT EXISTS idx_crm_cases_status ON crm_cases(status);
            CREATE INDEX IF NOT EXISTS idx_crm_cases_building ON crm_cases(building_source, building_id);
            CREATE INDEX IF NOT EXISTS idx_crm_guests_case ON crm_case_guests(case_id);
            CREATE INDEX IF NOT EXISTS idx_crm_services_case ON crm_case_services(case_id);
            CREATE INDEX IF NOT EXISTS idx_crm_group_progress_service ON crm_case_service_progress(case_service_id);
            CREATE INDEX IF NOT EXISTS idx_crm_guest_progress_guest ON crm_guest_service_progress(guest_id);
            CREATE INDEX IF NOT EXISTS idx_crm_tasks_case ON crm_tasks(case_id);
            CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON crm_tasks(due_at);
            CREATE INDEX IF NOT EXISTS idx_crm_communication_case ON crm_communication_events(case_id);
            CREATE INDEX IF NOT EXISTS idx_crm_notifications_case ON crm_notifications(case_id);
            CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(user_id, scope, idempotency_key);
            """
        )
        for table_name, columns in SCHEMA_COLUMN_MIGRATIONS.items():
            ensure_table_columns(conn, table_name, columns)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_crm_cases_deleted ON crm_cases(deleted_at)")
        seed_default_users(conn)
        seed_core_fields(conn)
        conn.execute(
            "INSERT OR REPLACE INTO app_meta(key, value) VALUES('schema_version', '1')"
        )


def slugify_field_key(value: str) -> str:
    text = (value or "").strip().lower()
    ascii_slug = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    if ascii_slug:
        return ascii_slug[:60]
    safe_hash = abs(hash(value or "")) % 10_000_000_000
    return f"legacy_{safe_hash}"


def seed_default_users(conn: sqlite3.Connection) -> None:
    existing = conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()
    if existing and existing["total"] > 0:
        return

    now = utc_now_iso()
    rows = []
    for username, display_name, role, password in DEFAULT_USERS:
        password = validate_initial_password(username, password)
        user_id = f"user_{username}"
        rows.append(
            (
                user_id,
                username,
                display_name,
                hash_password(password),
                role,
                1,
                now,
                now,
            )
        )
    execute_many(
        conn,
        """
        INSERT INTO users(id, username, display_name, password_hash, role, is_active, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def seed_core_fields(conn: sqlite3.Connection) -> None:
    current = conn.execute(
        "SELECT value FROM app_meta WHERE key = 'standard_field_catalog_version'"
    ).fetchone()
    if not current or current["value"] != STANDARD_FIELD_CATALOG_VERSION:
        reset_standard_field_catalog(conn)
        return
    ensure_standard_field_catalog(conn)


def ensure_standard_field_catalog(conn: sqlite3.Connection) -> None:
    now = utc_now_iso()
    for field_key, display_name, field_type, required, description, is_core in CORE_FIELD_DEFINITIONS:
        metadata = default_field_metadata(field_key, display_name, field_type, is_core)
        conn.execute(
            """
            INSERT INTO field_definitions(
              id, field_key, display_name, field_type, required, description, is_core, active,
              scope, group_key, display_order, excel_header_name, visible_in_master_detail,
              visible_in_staging_detail, visible_in_query, query_keywords_json, answer_template,
              status, created_by, created_at, updated_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
            ON CONFLICT(field_key) DO UPDATE SET
              display_name = excluded.display_name,
              field_type = excluded.field_type,
              required = excluded.required,
              description = excluded.description,
              is_core = excluded.is_core,
              scope = excluded.scope,
              group_key = excluded.group_key,
              display_order = excluded.display_order,
              excel_header_name = excluded.excel_header_name,
              visible_in_master_detail = excluded.visible_in_master_detail,
              visible_in_staging_detail = excluded.visible_in_staging_detail,
              visible_in_query = excluded.visible_in_query,
              query_keywords_json = excluded.query_keywords_json,
              answer_template = excluded.answer_template,
              status = excluded.status,
              active = 1,
              updated_at = excluded.updated_at
            """,
            (
                f"field_{field_key}",
                field_key,
                display_name,
                field_type,
                required,
                description,
                is_core,
                metadata["scope"],
                metadata["group_key"],
                metadata["display_order"],
                metadata["excel_header_name"],
                metadata["visible_in_master_detail"],
                metadata["visible_in_staging_detail"],
                metadata["visible_in_query"],
                metadata["query_keywords_json"],
                metadata["answer_template"],
                metadata["status"],
                now,
                now,
            ),
        )
        for alias in FIELD_ALIASES.get(field_key, []):
            existing = conn.execute(
                "SELECT id FROM field_aliases WHERE field_key = ? AND alias_name = ?",
                (field_key, alias),
            ).fetchone()
            if existing:
                continue
            conn.execute(
                """
                INSERT INTO field_aliases(id, field_key, alias_name, language, confidence, created_by, created_at)
                VALUES(?, ?, ?, 'mixed', 1.0, 'system', ?)
                """,
                (f"alias_{field_key}_{abs(hash(alias)) % 10_000_000}", field_key, alias, now),
            )
    conn.execute(
        "INSERT OR REPLACE INTO app_meta(key, value) VALUES('standard_field_catalog_version', ?)",
        (STANDARD_FIELD_CATALOG_VERSION,),
    )


def reset_standard_field_catalog(conn: sqlite3.Connection) -> dict:
    now = utc_now_iso()
    deleted_staging = conn.execute(
        f"""
        DELETE FROM staging_update_requests
        WHERE field_name NOT IN ({",".join("?" for _ in STANDARD_FIELD_KEYS)})
        """,
        tuple(sorted(STANDARD_FIELD_KEYS)),
    ).rowcount
    deleted_field_values = conn.execute(
        f"""
        DELETE FROM master_building_field_values
        WHERE field_key NOT IN ({",".join("?" for _ in STANDARD_FIELD_KEYS)})
        """,
        tuple(sorted(STANDARD_FIELD_KEYS)),
    ).rowcount
    deleted_staging_field_values = conn.execute(
        f"""
        DELETE FROM staging_building_field_values
        WHERE field_key NOT IN ({",".join("?" for _ in STANDARD_FIELD_KEYS)})
        """,
        tuple(sorted(STANDARD_FIELD_KEYS)),
    ).rowcount
    conn.execute("DELETE FROM import_header_mappings")
    conn.execute("DELETE FROM field_aliases")
    conn.execute("DELETE FROM field_definitions")
    conn.execute("DELETE FROM field_change_requests")

    for field_key, display_name, field_type, required, description, is_core in CORE_FIELD_DEFINITIONS:
        metadata = default_field_metadata(field_key, display_name, field_type, is_core)
        conn.execute(
            """
            INSERT OR IGNORE INTO field_definitions(
              id, field_key, display_name, field_type, required, description, is_core, active,
              scope, group_key, display_order, excel_header_name, visible_in_master_detail,
              visible_in_staging_detail, visible_in_query, query_keywords_json, answer_template,
              status, created_by, created_at, updated_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
            """,
            (
                f"field_{field_key}",
                field_key,
                display_name,
                field_type,
                required,
                description,
                is_core,
                metadata["scope"],
                metadata["group_key"],
                metadata["display_order"],
                metadata["excel_header_name"],
                metadata["visible_in_master_detail"],
                metadata["visible_in_staging_detail"],
                metadata["visible_in_query"],
                metadata["query_keywords_json"],
                metadata["answer_template"],
                metadata["status"],
                now,
                now,
            ),
        )
        for alias in FIELD_ALIASES.get(field_key, []):
            conn.execute(
                """
                INSERT OR IGNORE INTO field_aliases(id, field_key, alias_name, language, confidence, created_by, created_at)
                VALUES(?, ?, ?, 'mixed', 1.0, 'system', ?)
                """,
                (f"alias_{field_key}_{abs(hash(alias)) % 10_000_000}", field_key, alias, now),
            )
    conn.execute(
        "INSERT OR REPLACE INTO app_meta(key, value) VALUES('standard_field_catalog_refreshed_at', ?)",
        (now,),
    )
    conn.execute(
        "INSERT OR REPLACE INTO app_meta(key, value) VALUES('standard_field_catalog_version', ?)",
        (STANDARD_FIELD_CATALOG_VERSION,),
    )
    return {
        "field_definitions": len(CORE_FIELD_DEFINITIONS),
        "field_aliases": sum(len(items) for items in FIELD_ALIASES.values()),
        "deleted_staging_records": deleted_staging,
        "deleted_field_values": deleted_field_values,
        "deleted_staging_field_values": deleted_staging_field_values,
    }


def register_legacy_headers(conn: sqlite3.Connection, headers: Iterable[str], created_by: str = "system") -> None:
    now = utc_now_iso()
    known = {
        row["alias_name"].strip().lower(): row["field_key"]
        for row in conn.execute("SELECT field_key, alias_name FROM field_aliases").fetchall()
    }
    definitions = {
        row["display_name"].strip().lower(): row["field_key"]
        for row in conn.execute("SELECT field_key, display_name FROM field_definitions").fetchall()
    }

    for header in headers:
        raw = (header or "").strip()
        if not raw:
            continue
        lowered = raw.lower()
        if lowered in known or lowered in definitions:
            continue

        field_key = slugify_field_key(raw)
        field_type = "boolean" if any(token in raw for token in ("是否", "能否", "有/没有", "支持", "需要吗")) else "text"
        metadata = default_field_metadata(field_key, raw, field_type, 0)
        conn.execute(
            """
            INSERT OR IGNORE INTO field_definitions(
              id, field_key, display_name, field_type, required, description, is_core, active,
              scope, group_key, display_order, excel_header_name, visible_in_master_detail,
              visible_in_staging_detail, visible_in_query, query_keywords_json, answer_template,
              status, created_by, created_at, updated_at
            ) VALUES(?, ?, ?, ?, 0, 'Legacy spreadsheet header', 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"field_{field_key}",
                field_key,
                raw,
                field_type,
                metadata["scope"],
                metadata["group_key"],
                metadata["display_order"],
                metadata["excel_header_name"],
                metadata["visible_in_master_detail"],
                metadata["visible_in_staging_detail"],
                metadata["visible_in_query"],
                metadata["query_keywords_json"],
                metadata["answer_template"],
                "active",
                created_by,
                now,
                now,
            ),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO field_aliases(id, field_key, alias_name, language, confidence, created_by, created_at)
            VALUES(?, ?, ?, 'mixed', 0.95, ?, ?)
            """,
            (f"alias_{field_key}_{abs(hash(raw)) % 10_000_000}", field_key, raw, created_by, now),
        )

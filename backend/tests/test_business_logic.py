import json
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from app_main import (
    build_intake_source_metadata,
    calculate_master_completeness,
    ensure_staging_workbook_from_sources,
    filter_chat_building_payloads,
    parse_intake_source_metadata,
)


class BusinessLogicTests(unittest.TestCase):
    def test_partial_record_can_score_without_becoming_complete(self):
        result = calculate_master_completeness(
            {
                "building_name": "Example Building",
                "address": "1 Main St",
                "insurance_required": 1,
                "insurance_coverage_amount": "$100,000",
                "electricity_required": None,
                "internet_self_setup_required": None,
                "extensions": {},
            }
        )
        self.assertEqual(result["completeness_status"], "verified_partial")
        self.assertGreater(result["completeness_score"], 20)

    def test_complete_record_requires_identity_and_three_decisions(self):
        result = calculate_master_completeness(
            {
                "building_name": "Example Building",
                "address": "1 Main St",
                "insurance_required": 0,
                "electricity_required": 0,
                "internet_self_setup_required": 0,
                "move_in_notes": "Keys at front desk",
                "extensions": {},
            }
        )
        self.assertEqual(result["completeness_status"], "verified_complete")
        self.assertGreaterEqual(result["completeness_score"], 80)

    def test_chat_filter_drops_private_and_unscoped_contact_data(self):
        result = filter_chat_building_payloads(
            {
                "electricity_provider": {
                    "value": "PSEG",
                    "evidence": "Please open the building electricity account with PSEG",
                },
                "building_management_contact": {
                    "value": "555-0100",
                    "evidence": "Call Amy at 555-0100",
                },
                "move_in_notes": {
                    "value": "验证码 123456",
                    "evidence": "验证码 123456",
                },
                "building_name": {"value": "guessed building"},
            }
        )
        self.assertEqual(set(result), {"electricity_provider"})
        self.assertIn("chat_source", result["electricity_provider"]["review_flags"])

    def test_missing_staging_workbook_is_rebuilt_from_staging_rows(self):
        staging_rows = [{"building_name": "Existing Staging", "address": "1 Main St"}]
        with patch("app_main.resolve_staging_excel_path", return_value=Path("/missing/staging.xlsx")), patch(
            "app_main.load_staging_building_snapshots", return_value=staging_rows
        ), patch("app_main.ensure_staging_workbook", return_value=Path("/tmp/staging.xlsx")) as ensure_workbook, patch(
            "app_main.load_master_workbook_rows"
        ) as load_master_rows:
            result = ensure_staging_workbook_from_sources(Mock())
        ensure_workbook.assert_called_once_with(staging_rows)
        load_master_rows.assert_not_called()
        self.assertEqual(result, Path("/tmp/staging.xlsx"))

    def test_chat_binding_metadata_round_trips(self):
        metadata = build_intake_source_metadata(
            intake_mode="supplement",
            supplement_scope="all",
            target_staging_key="staging-1",
            source_kind="chat_crm",
            case_id="case-1",
            communication_event_id="event-1",
            captured_at="2026-08-01T00:00:00Z",
        )
        parsed = parse_intake_source_metadata(json.dumps(metadata))
        self.assertEqual(parsed, metadata)


if __name__ == "__main__":
    unittest.main()

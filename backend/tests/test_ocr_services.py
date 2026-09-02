import tempfile
import unittest
from pathlib import Path

from ocr_services import (
    BaiduUnlimitedOcrProvider,
    OcrResult,
    OcrRouter,
    UnlimitedOcrLocalHttpProvider,
    clean_unlimited_ocr_markdown,
    markdown_to_plain_text,
)


class FakeProvider:
    def __init__(self, name, result):
        self.name = name
        self.result = result
        self.calls = 0

    def configured(self):
        return True

    async def extract(self, path, **kwargs):
        self.calls += 1
        return self.result


class FakeBaiduProvider(BaiduUnlimitedOcrProvider):
    async def _token(self):
        return "secret-token"

    async def _post_form(self, path, token, values, *, timeout):
        if path == self.submit_path:
            return {"result": {"task_id": "task-1"}}
        return {"result": {"status": "success", "markdown_url": "https://signed.invalid/result"}}

    @staticmethod
    def _download_text(url, timeout):
        return "# Building\n\nElectricity: PSEG"


class ExpiredTokenBaiduProvider(FakeBaiduProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.token_calls = 0
        self.form_calls = 0

    async def _token(self):
        self.token_calls += 1
        return f"token-{self.token_calls}"

    async def _post_form(self, path, token, values, *, timeout):
        self.form_calls += 1
        if self.form_calls == 1:
            return {"error_code": 110, "error_msg": "Access token invalid or no longer valid"}
        return await super()._post_form(path, token, values, timeout=timeout)


class FakeUnlimitedOcrLocalHttpProvider(UnlimitedOcrLocalHttpProvider):
    last_url = ""
    last_payload = {}
    last_api_key = ""

    @staticmethod
    def _post_json(url, payload, *, api_key, timeout):
        FakeUnlimitedOcrLocalHttpProvider.last_url = url
        FakeUnlimitedOcrLocalHttpProvider.last_payload = payload
        FakeUnlimitedOcrLocalHttpProvider.last_api_key = api_key
        return {
            "choices": [
                {
                    "message": {
                        "content": (
                            "<|ref|># Building<|/ref|>\n"
                            "<|det|>text [10, 20, 30, 40]<|/det|>Electricity: PSEG"
                        )
                    }
                }
            ]
        }


class OcrServicesTests(unittest.IsolatedAsyncioTestCase):
    def test_markdown_is_converted_without_links_or_markup(self):
        text = markdown_to_plain_text("# Title\n[Portal](https://example.com) | Value")
        self.assertIn("Title", text)
        self.assertIn("Portal", text)
        self.assertNotIn("https://", text)

    def test_unlimited_ocr_grounding_tokens_are_removed(self):
        markdown = clean_unlimited_ocr_markdown(
            "<|ref|># Title<|/ref|>\n<|det|>text [1, 2, 3, 4]<|/det|>Value<|im_end|>"
        )
        self.assertEqual(markdown, "# Title\nValue")

    async def test_router_falls_back_when_primary_fails(self):
        primary = FakeProvider("baidu_unlimited", OcrResult(provider="baidu_unlimited", status="failed"))
        fallback = FakeProvider(
            "local",
            OcrResult(provider="local", status="success", document_text="local text"),
        )
        router = OcrRouter(
            providers={"baidu_unlimited": primary, "local": fallback},
            primary="baidu_unlimited",
            fallback="local",
        )
        result = await router.extract(Path("unused.png"), source_file="unused.png")
        self.assertTrue(result.ok)
        self.assertTrue(result.fallback_used)
        self.assertEqual(primary.calls, 1)
        self.assertEqual(fallback.calls, 1)

    async def test_baidu_async_result_saves_markdown_artifact(self):
        provider = FakeBaiduProvider(api_key="key", secret_key="secret", poll_interval_seconds=5)
        events = []
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "sample.png"
            source.write_bytes(b"fake-image")
            artifact_dir = Path(temp_dir) / "artifacts"
            result = await provider.extract(
                source,
                source_file=source.name,
                artifact_dir=artifact_dir,
                status_hook=events.append,
            )
            self.assertTrue(result.ok)
            self.assertEqual(result.external_task_ids, ["task-1"])
            self.assertTrue(Path(result.raw_artifact_path).is_file())
            self.assertTrue(any(item.get("status") == "completed" for item in events))

    async def test_baidu_refreshes_an_expired_access_token_once(self):
        provider = ExpiredTokenBaiduProvider(api_key="key", secret_key="secret", poll_interval_seconds=5)
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "sample.png"
            source.write_bytes(b"fake-image")
            result = await provider.extract(source, source_file=source.name)
        self.assertTrue(result.ok)
        self.assertGreaterEqual(provider.token_calls, 2)

    async def test_local_unlimited_ocr_uses_vllm_request_recipe(self):
        provider = FakeUnlimitedOcrLocalHttpProvider(
            base_url="http://gpu.internal:8000/v1",
            model="baidu/Unlimited-OCR",
            api_key="private-key",
        )
        events = []
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "sample.png"
            source.write_bytes(b"fake-image")
            result = await provider.extract(
                source,
                source_file=source.name,
                artifact_dir=Path(temp_dir) / "artifacts",
                status_hook=events.append,
            )

        self.assertTrue(result.ok)
        self.assertEqual(result.provider, "unlimited_ocr_local_http")
        self.assertEqual(result.document_text, "Building\nElectricity: PSEG")
        self.assertEqual(
            FakeUnlimitedOcrLocalHttpProvider.last_url,
            "http://gpu.internal:8000/v1/chat/completions",
        )
        request_payload = FakeUnlimitedOcrLocalHttpProvider.last_payload
        self.assertEqual(request_payload["messages"][0]["content"][0]["text"], "<image>document parsing.")
        self.assertFalse(request_payload["skip_special_tokens"])
        self.assertEqual(request_payload["vllm_xargs"], {"ngram_size": 35, "window_size": 128})
        self.assertTrue(any(item.get("status") == "completed" for item in events))

    async def test_local_unlimited_ocr_renders_pdf_as_multi_page_request(self):
        rendered_max_pages = []

        def render_pdf(_path, *, max_pages, output_dir):
            rendered_max_pages.append(max_pages)
            images = []
            for page_number in (1, 2):
                image_path = output_dir / f"page-{page_number}.png"
                image_path.write_bytes(f"page-{page_number}".encode("utf-8"))
                images.append((page_number, image_path))
            return images

        provider = FakeUnlimitedOcrLocalHttpProvider(
            base_url="http://gpu.internal:8000",
            max_pdf_pages=12,
            pdf_renderer=render_pdf,
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "sample.pdf"
            source.write_bytes(b"fake-pdf")
            result = await provider.extract(source, source_file=source.name)

        self.assertTrue(result.ok)
        self.assertEqual(rendered_max_pages, [12])
        request_payload = FakeUnlimitedOcrLocalHttpProvider.last_payload
        content = request_payload["messages"][0]["content"]
        self.assertEqual(content[0]["text"], "<image>Multi page parsing.")
        self.assertEqual(len(content), 3)
        self.assertEqual(request_payload["vllm_xargs"]["window_size"], 1024)
        self.assertIn("unlimited_ocr_local_markdown_without_page_coordinates", result.warnings)


if __name__ == "__main__":
    unittest.main()

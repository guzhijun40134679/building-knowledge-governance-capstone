from __future__ import annotations

import asyncio
import base64
import hashlib
import html
import json
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional, Protocol, Sequence, Union


@dataclass
class OcrPage:
    page_number: int
    text: str
    blocks: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class OcrResult:
    provider: str
    status: str
    document_text: str = ""
    markdown: str = ""
    pages: list[OcrPage] = field(default_factory=list)
    external_task_ids: list[str] = field(default_factory=list)
    duration_ms: int = 0
    warnings: list[str] = field(default_factory=list)
    fallback_used: bool = False
    raw_artifact_path: str = ""
    error_code: str = ""
    error_message: str = ""

    @property
    def ok(self) -> bool:
        return self.status == "success" and bool(self.document_text.strip())

    def public_metadata(self) -> dict[str, Any]:
        payload = asdict(self)
        payload.pop("document_text", None)
        payload.pop("markdown", None)
        payload.pop("pages", None)
        return payload


OcrStatusHook = Callable[[dict[str, Any]], Union[Awaitable[None], None]]


class OcrProvider(Protocol):
    name: str

    def configured(self) -> bool: ...

    async def extract(
        self,
        path: Path,
        *,
        source_file: str,
        page_number: int = 1,
        artifact_dir: Optional[Path] = None,
        status_hook: Optional[OcrStatusHook] = None,
        resume_task_id: str = "",
    ) -> OcrResult: ...


class VisionFieldExtractor(Protocol):
    name: str

    async def extract_fields(
        self,
        path: Path,
        source_file: str,
        *,
        page_number: Optional[int] = None,
    ) -> dict[str, dict]: ...


class CallableVisionFieldExtractor:
    def __init__(
        self,
        name: str,
        extractor: Callable[..., Awaitable[dict[str, dict]]],
    ) -> None:
        self.name = name
        self._extractor = extractor

    async def extract_fields(
        self,
        path: Path,
        source_file: str,
        *,
        page_number: Optional[int] = None,
    ) -> dict[str, dict]:
        return await self._extractor(path, source_file, page_number=page_number)


class LocalOcrProvider:
    name = "local"

    def __init__(
        self,
        *,
        image_extractor: Callable[[Path], str],
        pdf_extractor: Callable[[Path], list[dict]],
    ) -> None:
        self._image_extractor = image_extractor
        self._pdf_extractor = pdf_extractor

    def configured(self) -> bool:
        return True

    async def extract(
        self,
        path: Path,
        *,
        source_file: str,
        page_number: int = 1,
        artifact_dir: Optional[Path] = None,
        status_hook: Optional[OcrStatusHook] = None,
        resume_task_id: str = "",
    ) -> OcrResult:
        started = time.monotonic()
        if path.suffix.lower() == ".pdf":
            raw_pages = await asyncio.to_thread(self._pdf_extractor, path)
            pages = [
                OcrPage(page_number=int(item.get("page") or index), text=str(item.get("text") or "").strip())
                for index, item in enumerate(raw_pages, start=1)
                if str(item.get("text") or "").strip()
            ]
        else:
            text = (await asyncio.to_thread(self._image_extractor, path)).strip()
            pages = [OcrPage(page_number=page_number, text=text)] if text else []
        document_text = "\n\n".join(page.text for page in pages if page.text)
        return OcrResult(
            provider=self.name,
            status="success" if document_text else "empty",
            document_text=document_text,
            pages=pages,
            duration_ms=int((time.monotonic() - started) * 1000),
            warnings=[] if document_text else ["local_ocr_empty"],
        )


def clean_unlimited_ocr_markdown(raw_text: str) -> str:
    """Remove Unlimited-OCR grounding/control tokens while preserving Markdown text."""
    text = raw_text or ""
    text = re.sub(r"<\|ref\|>(.*?)<\|/ref\|>", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"<\|det\|>.*?<\|/det\|>", "", text, flags=re.DOTALL)
    text = re.sub(r"<\|(?:im_start|im_end|endoftext)\|>", "", text)
    return text.strip()


def markdown_to_plain_text(markdown: str) -> str:
    text = html.unescape(clean_unlimited_ocr_markdown(markdown))
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(?:p|div|tr|table|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^[#>*_`~\-]+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[|]", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class BaiduUnlimitedCloudOcrProvider:
    name = "baidu_unlimited_cloud"
    submit_path = "/rest/2.0/brain/online/v2/unlimited-ocr-parser/task"
    query_path = "/rest/2.0/brain/online/v2/unlimited-ocr-parser/task/query"

    def __init__(
        self,
        *,
        api_key: str,
        secret_key: str,
        base_url: str = "https://aip.baidubce.com",
        poll_interval_seconds: int = 5,
        timeout_seconds: int = 300,
    ) -> None:
        self.api_key = api_key.strip()
        self.secret_key = secret_key.strip()
        self.base_url = base_url.rstrip("/")
        self.poll_interval_seconds = max(5, int(poll_interval_seconds))
        self.timeout_seconds = max(30, int(timeout_seconds))
        self._access_token = ""
        self._access_token_expires_at = 0.0

    def configured(self) -> bool:
        return bool(self.api_key and self.secret_key)

    async def _emit(self, hook: Optional[OcrStatusHook], payload: dict[str, Any]) -> None:
        if not hook:
            return
        result = hook(payload)
        if asyncio.iscoroutine(result):
            await result

    @staticmethod
    def _json_request(
        url: str,
        *,
        data: Optional[bytes] = None,
        headers: Optional[dict[str, str]] = None,
        timeout: int = 60,
    ) -> dict[str, Any]:
        request = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data is not None else "GET")
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    async def _token(self) -> str:
        if self._access_token and time.time() < self._access_token_expires_at:
            return self._access_token
        query = urllib.parse.urlencode(
            {
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key,
            }
        )
        payload = await asyncio.to_thread(
            self._json_request,
            f"{self.base_url}/oauth/2.0/token?{query}",
            timeout=30,
        )
        token = str(payload.get("access_token") or "").strip()
        if not token:
            raise RuntimeError(f"baidu_token_error:{payload.get('error') or payload.get('error_description') or 'missing_token'}")
        expires_in = int(payload.get("expires_in") or 2592000)
        self._access_token = token
        self._access_token_expires_at = time.time() + max(60, expires_in - 300)
        return token

    async def _post_form(self, path: str, token: str, values: dict[str, str], *, timeout: int) -> dict[str, Any]:
        body = urllib.parse.urlencode(values).encode("utf-8")
        url = f"{self.base_url}{path}?access_token={urllib.parse.quote(token)}"
        return await asyncio.to_thread(
            self._json_request,
            url,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=timeout,
        )

    async def _post_form_with_token_refresh(
        self,
        path: str,
        token: str,
        values: dict[str, str],
        *,
        timeout: int,
    ) -> tuple[dict[str, Any], str]:
        payload = await self._post_form(path, token, values, timeout=timeout)
        if int(payload.get("error_code") or 0) not in {110, 111}:
            return payload, token
        self._access_token = ""
        self._access_token_expires_at = 0.0
        refreshed_token = await self._token()
        payload = await self._post_form(path, refreshed_token, values, timeout=timeout)
        return payload, refreshed_token

    @staticmethod
    def _download_text(url: str, timeout: int) -> str:
        request = urllib.request.Request(url, headers={"User-Agent": "whitepaper-ocr/1.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="replace")

    async def extract(
        self,
        path: Path,
        *,
        source_file: str,
        page_number: int = 1,
        artifact_dir: Optional[Path] = None,
        status_hook: Optional[OcrStatusHook] = None,
        resume_task_id: str = "",
    ) -> OcrResult:
        started = time.monotonic()
        if not self.configured():
            return OcrResult(provider=self.name, status="unconfigured", warnings=["baidu_ocr_unconfigured"])
        if not path.is_file():
            return OcrResult(provider=self.name, status="failed", error_code="file_missing", error_message="The OCR input file does not exist.")
        try:
            task_id = resume_task_id.strip()
            if not task_id:
                await self._emit(status_hook, {"status": "queued", "attempt_increment": 1})
            token = await self._token()
            if not task_id:
                file_data = base64.b64encode(path.read_bytes()).decode("ascii")
                submitted, token = await self._post_form_with_token_refresh(
                    self.submit_path,
                    token,
                    {"file_data": file_data, "file_name": path.name},
                    timeout=min(120, self.timeout_seconds),
                )
                if int(submitted.get("error_code") or 0) != 0:
                    raise RuntimeError(f"baidu_submit_error:{submitted.get('error_code')}:{submitted.get('error_msg') or ''}")
                task_id = str((submitted.get("result") or {}).get("task_id") or "").strip()
                if not task_id:
                    raise RuntimeError("baidu_submit_error:missing_task_id")
                await self._emit(status_hook, {"status": "processing", "external_task_id": task_id})

            deadline = time.monotonic() + self.timeout_seconds
            result_payload: dict[str, Any] = {}
            while time.monotonic() < deadline:
                queried, token = await self._post_form_with_token_refresh(
                    self.query_path,
                    token,
                    {"task_id": task_id},
                    timeout=60,
                )
                if int(queried.get("error_code") or 0) != 0:
                    raise RuntimeError(f"baidu_query_error:{queried.get('error_code')}:{queried.get('error_msg') or ''}")
                result_payload = queried.get("result") or {}
                status = str(result_payload.get("status") or "").strip().lower()
                if status == "success":
                    break
                if status == "failed":
                    raise RuntimeError(f"baidu_task_failed:{result_payload.get('task_error') or 'unknown'}")
                persisted_status = "pending" if status == "pending" else "processing"
                await self._emit(
                    status_hook,
                    {"status": persisted_status, "external_task_id": task_id},
                )
                await asyncio.sleep(self.poll_interval_seconds)
            else:
                raise TimeoutError("baidu_ocr_timeout")

            markdown_url = str(result_payload.get("markdown_url") or "").strip()
            if not markdown_url:
                raise RuntimeError("baidu_result_error:missing_markdown_url")
            markdown = await asyncio.to_thread(self._download_text, markdown_url, 60)
            document_text = markdown_to_plain_text(markdown)
            if not document_text:
                raise RuntimeError("baidu_result_error:empty_markdown")
            raw_artifact_path = ""
            if artifact_dir:
                artifact_dir.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest()[:16]
                artifact_path = artifact_dir / f"baidu-unlimited-{page_number}-{digest}.md"
                artifact_path.write_text(markdown, encoding="utf-8")
                raw_artifact_path = str(artifact_path)
            duration_ms = int((time.monotonic() - started) * 1000)
            await self._emit(
                status_hook,
                {
                    "status": "completed",
                    "external_task_id": task_id,
                    "duration_ms": duration_ms,
                    "result_artifact_path": raw_artifact_path,
                },
            )
            return OcrResult(
                provider=self.name,
                status="success",
                document_text=document_text,
                markdown=markdown,
                pages=[OcrPage(page_number=page_number, text=document_text)],
                external_task_ids=[task_id],
                duration_ms=duration_ms,
                warnings=["baidu_markdown_without_page_coordinates"] if path.suffix.lower() == ".pdf" else [],
                raw_artifact_path=raw_artifact_path,
            )
        except (urllib.error.URLError, TimeoutError, RuntimeError, ValueError, OSError) as exc:
            duration_ms = int((time.monotonic() - started) * 1000)
            safe_message = re.sub(
                r"((?:access_token|client_id|client_secret|api_key|secret_key)=)[^&\s]+",
                r"\1[redacted]",
                str(exc),
                flags=re.IGNORECASE,
            )[:1000]
            await self._emit(
                status_hook,
                {
                    "status": "failed",
                    "duration_ms": duration_ms,
                    "error_code": type(exc).__name__,
                    "error_message": safe_message,
                },
            )
            return OcrResult(
                provider=self.name,
                status="failed",
                duration_ms=duration_ms,
                warnings=["baidu_ocr_failed"],
                error_code=type(exc).__name__,
                error_message=safe_message,
            )


# Backwards-compatible import name used by the first cloud adapter implementation.
BaiduUnlimitedOcrProvider = BaiduUnlimitedCloudOcrProvider


class UnlimitedOcrLocalHttpProvider:
    """Call a separately hosted Unlimited-OCR vLLM OpenAI-compatible endpoint."""

    name = "unlimited_ocr_local_http"

    def __init__(
        self,
        *,
        base_url: str,
        model: str = "baidu/Unlimited-OCR",
        api_key: str = "",
        timeout_seconds: int = 1200,
        max_tokens: int = 8192,
        max_pdf_pages: int = 30,
        pdf_renderer: Optional[Callable[..., Sequence[tuple[int, Path]]]] = None,
    ) -> None:
        self.base_url = base_url.strip().rstrip("/")
        self.model = model.strip() or "baidu/Unlimited-OCR"
        self.api_key = api_key.strip()
        self.timeout_seconds = max(30, int(timeout_seconds))
        self.max_tokens = min(32768, max(512, int(max_tokens)))
        self.max_pdf_pages = max(1, int(max_pdf_pages))
        self._pdf_renderer = pdf_renderer

    def configured(self) -> bool:
        return bool(self.base_url)

    @property
    def endpoint(self) -> str:
        if self.base_url.endswith("/chat/completions"):
            return self.base_url
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/chat/completions"
        return f"{self.base_url}/v1/chat/completions"

    async def _emit(self, hook: Optional[OcrStatusHook], payload: dict[str, Any]) -> None:
        if not hook:
            return
        result = hook(payload)
        if asyncio.iscoroutine(result):
            await result

    @staticmethod
    def _post_json(url: str, payload: dict[str, Any], *, api_key: str, timeout: int) -> dict[str, Any]:
        headers = {"Content-Type": "application/json", "User-Agent": "whitepaper-ocr/1.0"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def _image_content(path: Path) -> dict[str, Any]:
        mime_by_suffix = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".tif": "image/tiff",
            ".tiff": "image/tiff",
        }
        mime_type = mime_by_suffix.get(path.suffix.lower(), "application/octet-stream")
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
        }

    def _input_images(self, path: Path, temp_dir: Path) -> list[tuple[int, Path]]:
        if path.suffix.lower() != ".pdf":
            return [(1, path)]
        if self._pdf_renderer is None:
            raise RuntimeError("unlimited_ocr_local_pdf_renderer_unavailable")
        rendered = self._pdf_renderer(
            path,
            max_pages=self.max_pdf_pages,
            output_dir=temp_dir,
        )
        images = [(int(page_number), Path(image_path)) for page_number, image_path in rendered]
        if not images:
            raise RuntimeError("unlimited_ocr_local_pdf_render_empty")
        return images

    @staticmethod
    def _response_text(payload: dict[str, Any]) -> str:
        choices = payload.get("choices") or []
        if not choices or not isinstance(choices[0], dict):
            return ""
        content = (choices[0].get("message") or {}).get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                str(item.get("text") or "")
                for item in content
                if isinstance(item, dict) and item.get("type") in {"text", "output_text"}
            )
        return ""

    async def extract(
        self,
        path: Path,
        *,
        source_file: str,
        page_number: int = 1,
        artifact_dir: Optional[Path] = None,
        status_hook: Optional[OcrStatusHook] = None,
        resume_task_id: str = "",
    ) -> OcrResult:
        started = time.monotonic()
        if not self.configured():
            return OcrResult(provider=self.name, status="unconfigured", warnings=["unlimited_ocr_local_unconfigured"])
        if not path.is_file():
            return OcrResult(
                provider=self.name,
                status="failed",
                error_code="file_missing",
                error_message="The OCR input file does not exist.",
            )

        try:
            await self._emit(status_hook, {"status": "queued", "attempt_increment": 1})
            await self._emit(status_hook, {"status": "processing"})
            with tempfile.TemporaryDirectory(prefix="whitepaper_unlimited_ocr_") as temp_dir_name:
                images = self._input_images(path, Path(temp_dir_name))
                is_multi_page = len(images) > 1 or path.suffix.lower() == ".pdf"
                prompt = "<image>Multi page parsing." if is_multi_page else "<image>document parsing."
                content = [{"type": "text", "text": prompt}]
                content.extend(self._image_content(image_path) for _, image_path in images)
                request_payload = {
                    "model": self.model,
                    "messages": [{"role": "user", "content": content}],
                    "max_tokens": self.max_tokens,
                    "temperature": 0.0,
                    "skip_special_tokens": False,
                    "vllm_xargs": {
                        "ngram_size": 35,
                        "window_size": 1024 if is_multi_page else 128,
                    },
                }
                response_payload = await asyncio.to_thread(
                    self._post_json,
                    self.endpoint,
                    request_payload,
                    api_key=self.api_key,
                    timeout=self.timeout_seconds,
                )

            raw_markdown = self._response_text(response_payload)
            markdown = clean_unlimited_ocr_markdown(raw_markdown)
            document_text = markdown_to_plain_text(markdown)
            if not document_text:
                raise RuntimeError("unlimited_ocr_local_empty_output")

            raw_artifact_path = ""
            if artifact_dir:
                artifact_dir.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256(raw_markdown.encode("utf-8")).hexdigest()[:16]
                artifact_path = artifact_dir / f"unlimited-ocr-local-{page_number}-{digest}.md"
                artifact_path.write_text(raw_markdown, encoding="utf-8")
                raw_artifact_path = str(artifact_path)

            duration_ms = int((time.monotonic() - started) * 1000)
            warnings = []
            if path.suffix.lower() == ".pdf":
                warnings.append("unlimited_ocr_local_markdown_without_page_coordinates")
            await self._emit(
                status_hook,
                {
                    "status": "completed",
                    "duration_ms": duration_ms,
                    "result_artifact_path": raw_artifact_path,
                    "warnings": warnings,
                },
            )
            return OcrResult(
                provider=self.name,
                status="success",
                document_text=document_text,
                markdown=markdown,
                pages=[OcrPage(page_number=page_number, text=document_text)],
                duration_ms=duration_ms,
                warnings=warnings,
                raw_artifact_path=raw_artifact_path,
            )
        except (urllib.error.URLError, TimeoutError, RuntimeError, ValueError, OSError, json.JSONDecodeError) as exc:
            duration_ms = int((time.monotonic() - started) * 1000)
            safe_message = re.sub(
                r"((?:authorization|api_key|token)=?)[^&\s]+",
                r"\1[redacted]",
                str(exc),
                flags=re.IGNORECASE,
            )[:1000]
            await self._emit(
                status_hook,
                {
                    "status": "failed",
                    "duration_ms": duration_ms,
                    "error_code": type(exc).__name__,
                    "error_message": safe_message,
                },
            )
            return OcrResult(
                provider=self.name,
                status="failed",
                duration_ms=duration_ms,
                warnings=["unlimited_ocr_local_failed"],
                error_code=type(exc).__name__,
                error_message=safe_message,
            )


class OcrRouter:
    def __init__(self, *, providers: dict[str, OcrProvider], primary: str, fallback: str = "local") -> None:
        self.providers = providers
        self.primary = primary if primary in providers else "local"
        self.fallback = fallback if fallback in providers else "local"

    async def extract(self, path: Path, **kwargs: Any) -> OcrResult:
        primary = self.providers[self.primary]
        result = await primary.extract(path, **kwargs)
        if result.ok or self.fallback == self.primary:
            return result
        fallback = self.providers[self.fallback]
        fallback_result = await fallback.extract(path, **{**kwargs, "resume_task_id": ""})
        fallback_result.fallback_used = True
        fallback_result.warnings = list(dict.fromkeys([*result.warnings, *fallback_result.warnings]))
        if result.error_message:
            fallback_result.warnings.append(f"primary_error:{result.error_code or result.status}")
        return fallback_result

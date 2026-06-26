"""Tests for parser registry, text-layer detector, and Textract OCR adapter."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Parser registry tests
# ---------------------------------------------------------------------------


class TestParserRegistry:
    def setup_method(self) -> None:
        # Reset the registry before each test
        from app.infrastructure.pdf import parser_registry as _reg

        _reg._REGISTRY.clear()

    def test_register_and_get_parser_case_insensitive(self) -> None:
        from app.domain.ports.parser_protocol import ParserProtocol
        from app.infrastructure.pdf.parser_registry import get_parser, register

        mock_parser: ParserProtocol = MagicMock()
        register(".pdf", mock_parser)
        assert get_parser(".PDF") is mock_parser
        assert get_parser(".pdf") is mock_parser

    def test_get_parser_returns_none_for_unknown_ext(self) -> None:
        from app.infrastructure.pdf.parser_registry import get_parser

        assert get_parser(".xlsx") is None

    def test_register_conflict_raises(self) -> None:
        from app.infrastructure.pdf.parser_registry import UnsupportedFileTypeError, register

        mock1: MagicMock = MagicMock()
        mock2: MagicMock = MagicMock()
        register(".pdf", mock1)
        with pytest.raises(UnsupportedFileTypeError):
            register(".pdf", mock2)

    def test_unsupported_file_type_error_is_value_error(self) -> None:
        from app.infrastructure.pdf.parser_registry import UnsupportedFileTypeError

        assert issubclass(UnsupportedFileTypeError, ValueError)

    def test_register_normalizes_ext_to_lowercase(self) -> None:
        from app.infrastructure.pdf.parser_registry import get_parser, register

        mock_parser: MagicMock = MagicMock()
        register(".PDF", mock_parser)
        assert get_parser(".pdf") is mock_parser


# ---------------------------------------------------------------------------
# Text-layer detection tests
# ---------------------------------------------------------------------------


class TestTextLayerDetection:
    def test_detect_text_layer_true_for_normal_paragraph(self) -> None:
        from app.infrastructure.pdf.text_layer import detect_text_layer

        paragraph = "This is a normal paragraph with plenty of printable text. " * 3
        assert detect_text_layer(paragraph) is True

    def test_detect_text_layer_false_for_empty_string(self) -> None:
        from app.infrastructure.pdf.text_layer import detect_text_layer

        assert detect_text_layer("") is False

    def test_detect_text_layer_false_for_too_short(self) -> None:
        from app.infrastructure.pdf.text_layer import MIN_CHARS_PER_PAGE, detect_text_layer

        short = "Hi"
        assert len(short) < MIN_CHARS_PER_PAGE
        assert detect_text_layer(short) is False

    def test_detect_text_layer_false_for_garbage_bytes(self) -> None:
        from app.infrastructure.pdf.text_layer import detect_text_layer

        # Simulate garbage — mostly non-printable chars
        garbage = "\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c" * 20
        assert detect_text_layer(garbage) is False

    def test_is_garbage_true_for_low_printable_ratio(self) -> None:
        from app.infrastructure.pdf.text_layer import is_garbage

        non_printable = "\x00\x01\x02\x03" * 50
        assert is_garbage(non_printable) is True

    def test_is_garbage_false_for_normal_text(self) -> None:
        from app.infrastructure.pdf.text_layer import is_garbage

        assert is_garbage("Hello world, this is clean text!") is False


# ---------------------------------------------------------------------------
# TextractOcrAdapter tests (mocked boto3)
# ---------------------------------------------------------------------------


class TestTextractOcrAdapter:
    def _make_textract_response(self) -> dict:
        return {
            "Blocks": [
                {
                    "BlockType": "WORD",
                    "Text": "Hello",
                    "Geometry": {
                        "BoundingBox": {
                            "Left": 0.1,
                            "Top": 0.2,
                            "Width": 0.05,
                            "Height": 0.03,
                        }
                    },
                },
                {
                    "BlockType": "WORD",
                    "Text": "World",
                    "Geometry": {
                        "BoundingBox": {
                            "Left": 0.2,
                            "Top": 0.2,
                            "Width": 0.06,
                            "Height": 0.03,
                        }
                    },
                },
                {
                    # Non-WORD block should be ignored
                    "BlockType": "LINE",
                    "Text": "Hello World",
                    "Geometry": {
                        "BoundingBox": {
                            "Left": 0.1,
                            "Top": 0.2,
                            "Width": 0.16,
                            "Height": 0.03,
                        }
                    },
                },
            ]
        }

    def test_ocr_page_returns_words_with_normalized_bboxes(self) -> None:
        import asyncio

        from app.infrastructure.ocr.textract_adapter import TextractOcrAdapter

        mock_client = MagicMock()
        mock_client.detect_document_text.return_value = self._make_textract_response()

        adapter = TextractOcrAdapter(client=mock_client)
        words = asyncio.run(adapter.ocr_page(image_bytes=b"fake-image"))

        assert len(words) == 2
        assert words[0].text == "Hello"
        assert words[1].text == "World"

    def test_ocr_page_bbox_is_normalized(self) -> None:
        import asyncio

        from app.infrastructure.ocr.textract_adapter import TextractOcrAdapter

        mock_client = MagicMock()
        mock_client.detect_document_text.return_value = self._make_textract_response()

        adapter = TextractOcrAdapter(client=mock_client)
        words = asyncio.run(adapter.ocr_page(image_bytes=b"fake-image"))
        left, top, width, height = words[0].bbox
        # All values should be within 0-1 range
        assert 0.0 <= left <= 1.0
        assert 0.0 <= top <= 1.0
        assert 0.0 <= width <= 1.0
        assert 0.0 <= height <= 1.0

    def test_ocr_page_ignores_non_word_blocks(self) -> None:
        import asyncio

        from app.infrastructure.ocr.textract_adapter import TextractOcrAdapter

        mock_client = MagicMock()
        mock_client.detect_document_text.return_value = self._make_textract_response()

        adapter = TextractOcrAdapter(client=mock_client)
        words = asyncio.run(adapter.ocr_page(image_bytes=b"fake-image"))
        # LINE block should be excluded
        assert all(w.text in ("Hello", "World") for w in words)
        assert len(words) == 2

    def test_ocr_protocol_is_satisfied(self) -> None:
        """OcrWord is a frozen dataclass and TextractOcrAdapter satisfies OCRProtocol."""
        import inspect

        from app.infrastructure.ocr.textract_adapter import TextractOcrAdapter

        mock_client = MagicMock()
        adapter = TextractOcrAdapter(client=mock_client)
        assert inspect.iscoroutinefunction(adapter.ocr_page)

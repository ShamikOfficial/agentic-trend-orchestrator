from backend.app.llm.core import _is_transient_http_code, _is_transient_server_error


def test_transient_http_codes() -> None:
    assert _is_transient_http_code(500)
    assert _is_transient_http_code(503)
    assert not _is_transient_http_code(404)


def test_transient_error_message() -> None:
    msg = 'Gemini model gemma-4-31b-it HTTP error 500: {"error":{"status":"INTERNAL"}}'
    assert _is_transient_server_error(msg)
    assert not _is_transient_server_error("Gemini model x HTTP error 404: NOT_FOUND")

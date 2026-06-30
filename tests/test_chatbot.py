"""Tests for the AI Chatbot endpoints."""

import json
import pytest
from fastapi.testclient import TestClient

try:
    from project.backend.main import app
    client = TestClient(app)
    API_OK = True
except ImportError:
    try:
        from backend.main import app
        client = TestClient(app)
        API_OK = True
    except Exception:
        API_OK = False


@pytest.mark.skipif(not API_OK, reason="FastAPI app not importable in test environment")
class TestChatbotEndpoint:
    """Validate chatbot query parsing and SSE streaming."""

    def test_chatbot_default_response(self):
        """Assert chatbot returns default welcome message when query is unrecognized."""
        payload = {"message": "hello there"}
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        # Parse SSE stream
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                events.append(json.loads(data_str))

        assert len(events) > 0
        # Should have thoughts
        thoughts = [e for e in events if e["type"] == "THOUGHT"]
        assert len(thoughts) > 0
        
        # Should have final response containing welcome text
        final_text = "".join([e["content"] for e in events if e["type"] == "FINAL_RESPONSE"])
        assert "PRAGATI AI Assistant" in final_text

    def test_chatbot_crop_no_context(self):
        """Assert chatbot asks for field selection when no context is provided."""
        payload = {"message": "What crop is detected in my field?"}
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                events.append(json.loads(data_str))

        final_text = "".join([e["content"] for e in events if e["type"] == "FINAL_RESPONSE"])
        assert "select a field" in final_text.lower()

    def test_chatbot_crop_with_context(self):
        """Assert chatbot identifies the crop when context is provided."""
        payload = {
            "message": "What crop is detected in my field?",
            "field_id": "KAR-F999",
            "crop": "Sugarcane",
            "vci": 85.5,
            "stage": "Flowering",
            "rainfall_mm": 12.0
        }
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                events.append(json.loads(data_str))

        final_text = "".join([e["content"] for e in events if e["type"] == "FINAL_RESPONSE"])
        assert "KAR-F999" in final_text
        assert "Sugarcane" in final_text

    def test_chatbot_irrigate_with_context(self):
        """Assert chatbot calculates irrigation needs based on context."""
        payload = {
            "message": "Should I irrigate today?",
            "field_id": "KAR-F999",
            "crop": "Rice",
            "vci": 10.0,  # critical stress
            "stage": "Vegetative",
            "rainfall_mm": 0.0
        }
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                events.append(json.loads(data_str))

        final_text = "".join([e["content"] for e in events if e["type"] == "FINAL_RESPONSE"])
        assert "yes" in final_text.lower()
        assert "deficit" in final_text.lower()
        assert "mm" in final_text.lower()

    def test_chatbot_general_purpose_offline(self):
        """Assert chatbot returns offline fallback message when a general question is asked without an API key."""
        payload = {"message": "How do I grow tomatoes?"}
        import os
        orig_key = os.environ.get("GEMINI_API_KEY")
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        
        try:
            response = client.post("/api/chat", json=payload)
            assert response.status_code == 200
            events = []
            for line in response.iter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    events.append(json.loads(data_str))
            
            final_text = "".join([e["content"] for e in events if e["type"] == "FINAL_RESPONSE"])
            assert "offline mode" in final_text.lower()
            assert "gemini_api_key" in final_text.lower()
        finally:
            if orig_key is not None:
                os.environ["GEMINI_API_KEY"] = orig_key

    def test_chatbot_general_purpose_online_mock(self, monkeypatch):
        """Assert chatbot calls Gemini API and returns streamed response when key is present."""
        import os
        monkeypatch.setenv("GEMINI_API_KEY", "mock_key")
        
        async def mock_stream_gemini(contents, system_instruction, api_key):
            yield "This is a mocked "
            yield "Gemini response."
            
        import sys
        for module_name in ["project.backend.api.chatbot", "backend.api.chatbot"]:
            if module_name in sys.modules:
                monkeypatch.setattr(f"{module_name}.stream_gemini", mock_stream_gemini)
        
        payload = {"message": "Explain quantum physics."}
        response = client.post("/api/chat", json=payload)
        assert response.status_code == 200
        
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                events.append(json.loads(data_str))
                
        final_text = "".join([e["content"] for e in events if e["type"] == "FINAL_RESPONSE"])
        assert "mocked gemini response" in final_text.lower()


import uuid
import pytest
from app.forum.services.forum_service import ForumService


def test_parse_hashtags_empty():
    assert ForumService.parse_hashtags("") == []
    assert ForumService.parse_hashtags(None) == []


def test_parse_hashtags_english_and_vietnamese():
    content = "Hôm nay mình học #Toán12 thấy phần #GiảiTích rất hay. Thêm bài #python và #toán12 nữa."
    tags = ForumService.parse_hashtags(content)
    # Deduplicated, lowercase, without leading #
    assert tags == ["toán12", "giảitích", "python"]


def test_parse_hashtags_deduplication():
    content = "#ReactJS #reactjs #REACTJS #NodeJS"
    tags = ForumService.parse_hashtags(content)
    assert tags == ["reactjs", "nodejs"]

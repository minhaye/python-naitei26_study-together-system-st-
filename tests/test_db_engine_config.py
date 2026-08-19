from sqlalchemy.pool import NullPool

from app.db.engine_config import build_engine_kwargs, is_transaction_pooler_url

TRANSACTION_POOLER_URL = "postgresql+psycopg://postgres.abcdefgh:s3cret@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
SESSION_POOLER_URL = "postgresql+psycopg://postgres.abcdefgh:s3cret@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
DIRECT_URL = "postgresql+psycopg://postgres:s3cret@db.rncoptajwdtueqvtbgkw.supabase.co:5432/postgres"
GENERIC_LOCAL_URL = "postgresql+psycopg://user:pass@localhost:5432/mydb"


# --- is_transaction_pooler_url ---


def test_detects_supavisor_transaction_pooler_url():
    assert is_transaction_pooler_url(TRANSACTION_POOLER_URL) is True


def test_supavisor_session_pooler_url_same_host_different_port_is_not_transaction_mode():
    """Session pooler (:5432) uses the exact same *.pooler.supabase.com hostname as
    transaction pooler (:6543) -- only the port distinguishes them."""
    assert is_transaction_pooler_url(SESSION_POOLER_URL) is False


def test_direct_connection_url_is_not_transaction_pooler():
    assert is_transaction_pooler_url(DIRECT_URL) is False


def test_generic_non_supabase_postgres_url_is_not_transaction_pooler():
    assert is_transaction_pooler_url(GENERIC_LOCAL_URL) is False


def test_detection_does_not_depend_on_username_or_password():
    """Same host/port, completely different (and even absent) credentials -- detection must
    be identical either way, proving it never inspects the user/password portion of the URL."""
    with_creds = "postgresql+psycopg://someone:anything@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    without_creds = "postgresql+psycopg://aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    assert is_transaction_pooler_url(with_creds) is True
    assert is_transaction_pooler_url(without_creds) is True


def test_port_6543_on_a_non_pooler_host_is_not_treated_as_transaction_pooler():
    """The port alone must not be sufficient -- only the combination of the pooler hostname
    suffix AND port 6543 counts."""
    assert is_transaction_pooler_url("postgresql+psycopg://user:pass@localhost:6543/mydb") is False


# --- build_engine_kwargs ---


def test_transaction_pooler_url_disables_prepared_statements_and_uses_nullpool():
    kwargs = build_engine_kwargs(TRANSACTION_POOLER_URL)
    assert kwargs["poolclass"] is NullPool
    assert kwargs["connect_args"] == {"prepare_threshold": None}


def test_session_pooler_url_gets_no_special_kwargs():
    assert build_engine_kwargs(SESSION_POOLER_URL) == {}


def test_direct_connection_url_gets_no_special_kwargs():
    assert build_engine_kwargs(DIRECT_URL) == {}


def test_generic_postgres_url_gets_no_special_kwargs():
    assert build_engine_kwargs(GENERIC_LOCAL_URL) == {}


def test_engine_kwargs_never_contain_the_url_or_a_credential():
    """The returned kwargs are static, credential-free config objects -- confirms nothing in
    build_engine_kwargs's output could leak the password even indirectly."""
    kwargs = build_engine_kwargs(TRANSACTION_POOLER_URL)
    serialized = repr(kwargs)
    assert "s3cret" not in serialized
    assert TRANSACTION_POOLER_URL not in serialized

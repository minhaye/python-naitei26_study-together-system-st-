"""Engine configuration for Supabase's Supavisor pooler modes.

Supavisor exposes the same Postgres database through two distinct pooling modes on two
different ports, both reachable via `*.pooler.supabase.com`:
  - Transaction pooler (`:6543`): a pooled connection is only borrowed for the duration of a
    single transaction, and can be handed to a *different* backend Postgres connection between
    transactions. Server-side prepared statements -- which psycopg3 creates automatically after
    a few executions of the same query (see `prepare_threshold`) -- do not survive that
    handoff: a later transaction can land on a backend connection that already has a
    same-named prepared statement left over from a different client, raising
    `psycopg.errors.DuplicatePreparedStatement`. SQLAlchemy's own default connection pool makes
    this worse by holding pooled DBAPI connections open across requests on top of Supavisor's
    own pooling -- two pools stacked on top of each other, neither aware of the other.
  - Session pooler / direct connection (`:5432`): the (pooled or direct) connection is held for
    the client's whole session, so server-side prepared statements behave normally and
    SQLAlchemy's default pool is the right choice.

This module's only job is deciding, from `DATABASE_URL` alone, which of those two regimes
applies, and only ever reads the hostname/port to do so -- never the username or password, so
it never touches or logs a credential.
"""

from urllib.parse import urlsplit

from sqlalchemy.pool import NullPool

_POOLER_HOST_SUFFIX = "pooler.supabase.com"
_TRANSACTION_POOLER_PORT = 6543


def is_transaction_pooler_url(database_url: str) -> bool:
    """True only for Supavisor's TRANSACTION pooling mode (`*.pooler.supabase.com:6543`).
    A Supavisor SESSION-pooler URL (same hostname, port 5432) or a direct connection
    (`db.<ref>.supabase.co:5432`) correctly returns False -- distinguishing session from
    transaction mode requires the port, since Supavisor uses the same hostname for both."""
    parsed = urlsplit(database_url)
    return parsed.hostname is not None and parsed.hostname.endswith(_POOLER_HOST_SUFFIX) and parsed.port == _TRANSACTION_POOLER_PORT


def build_engine_kwargs(database_url: str) -> dict:
    """Extra `create_async_engine()` kwargs for `database_url`. Empty for every normal
    connection (direct, or Supavisor session pooler) -- SQLAlchemy's default pool and
    psycopg's default `prepare_threshold` are both correct there, so this function does not
    touch them. For a Supavisor transaction-pooler URL, returns:
      - `poolclass=NullPool`: SQLAlchemy does not hold its own persistent DBAPI connections on
        top of Supavisor's pooling -- every checkout opens (and every checkin closes) a real
        connection to Supavisor, which is itself already a connection pool.
      - `connect_args={"prepare_threshold": None}`: disables psycopg3's automatic server-side
        prepared statements. This is what actually prevents `DuplicatePreparedStatement` --
        `NullPool` alone is not sufficient, since a single request can still execute the same
        query more than once within one transaction/connection, crossing `prepare_threshold`
        before that connection is even returned to the pool."""
    if not is_transaction_pooler_url(database_url):
        return {}
    return {"poolclass": NullPool, "connect_args": {"prepare_threshold": None}}

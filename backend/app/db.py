from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

settings = get_settings()
engine = create_engine(
    f"sqlite:///{settings.data_dir / 'jobsaver.db'}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    from . import models  # noqa: F401  (register tables)

    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Tiny migration: create_all() doesn't add new columns to existing SQLite tables."""
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            existing = {r[1] for r in conn.exec_driver_sql(f'PRAGMA table_info("{table.name}")')}
            for col in table.columns:
                if col.name in existing:
                    continue
                ddl_type = col.type.compile(dialect=engine.dialect)
                default = ""
                if col.default is not None and not callable(getattr(col.default, "arg", None)):
                    arg = col.default.arg
                    default = f" DEFAULT {int(arg) if isinstance(arg, bool) else repr(arg)}"
                elif not col.nullable:
                    default = " DEFAULT ''" if "CHAR" in ddl_type.upper() else " DEFAULT 0"
                conn.exec_driver_sql(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl_type}{default}')


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session

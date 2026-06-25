# Project PRAGATI - ML Module

try:
    from project.ml import crop  # noqa: F401
except Exception as _crop_import_err:  # pragma: no cover
    import warnings
    warnings.warn(
        f"[PRAGATI] project.ml.crop could not be imported: {_crop_import_err}",
        ImportWarning,
        stacklevel=2,
    )

import logging
import os
import tempfile

logger = logging.getLogger(__name__)


def compress_pdf(path: str) -> bool:
    """Compress a PDF file in-place using PyMuPDF.

    Applies stream deflation, image/font compression, and garbage collection
    to reduce file size. Overwrites the original file only if the compressed
    version is smaller. Returns True on success, False on failure.

    Args:
        path: Absolute path to the PDF file to compress.

    Returns:
        True if compression was attempted successfully, False on error or
        if PyMuPDF is not available.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF non disponibile, compressione PDF saltata")
        return False

    try:
        original_size = os.path.getsize(path)
        doc = fitz.open(path)

        # Write to a temp file next to the original to avoid partial writes
        dir_ = os.path.dirname(path)
        fd, tmp_path = tempfile.mkstemp(suffix='.pdf', dir=dir_)
        os.close(fd)

        try:
            doc.save(
                tmp_path,
                garbage=4,
                deflate=True,
                deflate_images=True,
                deflate_fonts=True,
                clean=True,
            )
        finally:
            doc.close()

        compressed_size = os.path.getsize(tmp_path)

        if compressed_size < original_size:
            os.replace(tmp_path, path)
            logger.info(
                "PDF compresso: %s  %.1f MB → %.1f MB",
                os.path.basename(path),
                original_size / 1024 / 1024,
                compressed_size / 1024 / 1024,
            )
        else:
            os.remove(tmp_path)
            logger.debug(
                "PDF non compresso (già ottimizzato): %s", os.path.basename(path)
            )

        return True

    except Exception:
        logger.exception("Errore durante la compressione di %s", path)
        try:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        return False

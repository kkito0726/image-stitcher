class DomainError(Exception):
    """domain 層のエラーの基底。"""


class ImageDecodeError(DomainError):
    """画像バイト列をデコードできない場合に送出される。"""

class DomainError(Exception):
    """domain 層のエラーの基底。"""


class ImageDecodeError(DomainError):
    """画像バイト列をデコードできない場合に送出される。"""


class ImageTooLargeError(ImageDecodeError):
    """デコード後の画像サイズが上限を超える場合に送出される。"""

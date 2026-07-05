from src.infra.cache.in_memory_result_cache import InMemoryResultCache


class FakeImage:
    def __init__(self, name: str) -> None:
        self.name = name

    @property
    def width(self) -> int:
        return 1

    @property
    def height(self) -> int:
        return 1


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def _cache(clock: FakeClock, ttl: float = 600, max_entries: int = 4) -> InMemoryResultCache:
    return InMemoryResultCache(ttl_seconds=ttl, max_entries=max_entries, clock=clock)


class TestInMemoryResultCache:
    def test_格納した画像を取り出せる(self) -> None:
        clock = FakeClock()
        cache = _cache(clock)
        image = FakeImage("a")

        result_id = cache.put(image)

        assert cache.get(result_id) is image

    def test_発行されるidは一意(self) -> None:
        cache = _cache(FakeClock())
        id1 = cache.put(FakeImage("a"))
        id2 = cache.put(FakeImage("b"))

        assert id1 != id2

    def test_存在しないidはNone(self) -> None:
        assert _cache(FakeClock()).get("nope") is None

    def test_ttl経過後はNoneを返す(self) -> None:
        clock = FakeClock()
        cache = _cache(clock, ttl=600)
        result_id = cache.put(FakeImage("a"))

        clock.now = 599
        assert cache.get(result_id) is not None
        clock.now = 600
        assert cache.get(result_id) is None

    def test_保持件数上限を超えると古いものから追い出す(self) -> None:
        clock = FakeClock()
        cache = _cache(clock, max_entries=2)
        id1 = cache.put(FakeImage("a"))
        id2 = cache.put(FakeImage("b"))
        id3 = cache.put(FakeImage("c"))

        assert cache.get(id1) is None  # 追い出された
        assert cache.get(id2) is not None
        assert cache.get(id3) is not None

    def test_期限切れエントリはput時に掃除される(self) -> None:
        clock = FakeClock()
        cache = _cache(clock, ttl=600, max_entries=2)
        old_id = cache.put(FakeImage("old"))

        clock.now = 600  # old を期限切れにする
        # 期限切れが掃除されるので、max_entries=2 でも新規2件が両方残る
        id_b = cache.put(FakeImage("b"))
        id_c = cache.put(FakeImage("c"))

        assert cache.get(old_id) is None
        assert cache.get(id_b) is not None
        assert cache.get(id_c) is not None

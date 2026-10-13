const FLOW_STEPS = [
  { step: "01", title: "アップロード", body: "重なりのある写真を複数枚" },
  { step: "02", title: "合成", body: "特徴点を合わせて自動で接合" },
  { step: "03", title: "トリミング", body: "回転・切り取りで仕上げ" },
];

/** 画像未選択時にステージ（右側の作業面）へ表示するイントロ */
export const StageHero = () => (
  <div className="relative flex h-full flex-col items-center justify-center gap-10 px-8 py-12 text-center">
    {/* 横に連なるフレームでパノラマ合成を表現 */}
    <div className="relative flex items-center" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 w-32 rounded-md border border-[var(--accent-border)] bg-[var(--accent-glow)] backdrop-blur-sm scale-in xl:h-28 xl:w-40"
          style={{
            marginLeft: i === 0 ? 0 : "-2.25rem",
            marginTop: `${(i - 1) * 16}px`,
            opacity: 0.55 + i * 0.2,
            animationDelay: `${0.1 + i * 0.08}s`,
          }}
        />
      ))}
    </div>

    <div className="fade-in" style={{ animationDelay: "0.15s" }}>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)] xl:text-4xl">
        Panorama Image <span className="text-[var(--accent-primary)]">Stitcher</span>
      </h1>
      <p className="mx-auto max-w-md text-[var(--text-secondary)]">
        複数の画像を自動で合成し、美しいパノラマ写真を作成します
      </p>
    </div>

    <ol className="grid w-full max-w-2xl grid-cols-3 gap-3 fade-in" style={{ animationDelay: "0.25s" }}>
      {FLOW_STEPS.map((item) => (
        <li key={item.step} className="glass-card px-4 py-3 text-left">
          <span className="font-mono text-xs text-[var(--accent-primary)]">{item.step}</span>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
          <p className="text-xs text-[var(--text-muted)]">{item.body}</p>
        </li>
      ))}
    </ol>

    <p className="text-xs text-[var(--text-muted)]">← 左のパネルから画像を追加してください</p>
  </div>
);

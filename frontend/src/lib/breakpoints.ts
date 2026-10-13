/** globals.css の `desk` バリアントと同じ条件。1画面に収めるワークスペース表示かどうかを JS 側で判定する */
export const DESK_MEDIA_QUERY = "(min-width: 64rem) and (min-height: 40rem)";

export const isDeskLayout = () =>
  typeof window !== "undefined" && window.matchMedia(DESK_MEDIA_QUERY).matches;

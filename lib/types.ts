export type VideoItem = {
  kind: 'video' | 'short' | 'channel' | 'playlist';
  id: string;
  title: string;
  thumb?: string;
  duration?: string;
  views?: string;
  published?: string;
  author?: string;
  authorId?: string;
  avatar?: string;
  live?: boolean;
  subs?: string;
  count?: string;
  desc?: string;
};

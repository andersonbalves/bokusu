export interface Song {
  id: string
  title: string
  artist?: string
  thumbnailUrl?: string
  singerName?: string
  position: number
}

export interface SearchResult {
  id: string
  title: string
  artist?: string
  thumbnailUrl?: string
}

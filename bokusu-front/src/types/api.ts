export interface QueueItem {
  user: string
  file: string
  title: string
  semitones: number
}

export interface NowPlaying {
  now_playing: string | null
  now_playing_user: string | null
  now_playing_duration: number | null
  now_playing_transpose: number
  now_playing_url: string | null
  now_playing_subtitle_url: string | null
  now_playing_position: number | null
  is_paused: boolean
  up_next: string | null
  next_user: string | null
  volume: number
}

export interface SearchResult {
  title: string
  url: string
  id: string
}

export interface AuthStatus {
  isAdmin: boolean
}

export interface Preferences {
  splash_display_mode: 'integration' | 'cinematic'
  volume: number
  splash_delay: number
  screensaver_timeout: number
  bg_music_volume: number
  disable_bg_music: boolean
  disable_bg_video: boolean
  disable_score: boolean
  hide_url: boolean
  hide_notifications: boolean
  hide_overlay: boolean
  show_splash_clock: boolean
  normalize_audio: boolean
  high_quality: boolean
  complete_transcode_before_play: boolean
  buffer_size: number
  limit_user_songs_by: number
  enable_fair_queue: boolean
  cdg_pixel_scaling: boolean
  avsync: number
  browse_results_per_page: number
  enable_title_tidy: boolean
  low_score_phrases: string
  mid_score_phrases: string
  high_score_phrases: string
}

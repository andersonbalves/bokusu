declare module 'libass-wasm' {
  interface SubtitlesOctopusOptions {
    video: HTMLVideoElement
    subUrl: string
    fonts?: string[]
    workerUrl: string
  }

  export default class SubtitlesOctopus {
    constructor(options: SubtitlesOctopusOptions)
    dispose(): void
  }
}

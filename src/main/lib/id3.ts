import NodeID3 from 'node-id3'

// All tags optional — empty fields are simply not written to the frame.
type Id3Tags = {
  title?: string
  artist?: string
  album?: string
  albumArt?: {
    buffer: Buffer
    mime: string
  }
}

export function writeTags(mp3Path: string, tags: Id3Tags): void {
  const payload: NodeID3.Tags = {}
  if (tags.title) payload.title = tags.title
  if (tags.artist) payload.artist = tags.artist
  if (tags.album) payload.album = tags.album
  if (tags.albumArt) {
    payload.image = {
      mime: tags.albumArt.mime,
      type: { id: 3, name: 'front cover' },
      description: '',
      imageBuffer: tags.albumArt.buffer
    }
  }

  const result = NodeID3.write(payload, mp3Path)
  if (result !== true) {
    throw new Error('Failed to write ID3 tags')
  }
}

'use client'

import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAsset, uploadAsset } from '@/lib/api'
import type { EditorAsset } from '@/lib/types'

interface Props {
  kind: EditorAsset['kind']
  assets: EditorAsset[]
  value: string
  disabled?: boolean
  onChange: (name: string) => void
  onAssetsChange: (assets: EditorAsset[]) => void
}

const ACCEPT = { image: '.png,.jpg,.jpeg,.webp', audio: '.mp3,.m4a,.aac,.wav,.ogg' }
const NOUN = { image: 'logo', audio: 'musik' }

/** Pilih logo/musik dari aset tersimpan, upload baru, atau hapus. */
export default function AssetPicker({ kind, assets, value, disabled, onChange, onAssetsChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const own = assets.filter(a => a.kind === kind)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const asset = await uploadAsset(file)
      onAssetsChange([asset, ...assets])
      onChange(asset.name)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Upload ${NOUN[kind]} gagal.`)
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async (asset: EditorAsset) => {
    try {
      await deleteAsset(asset.name)
      onAssetsChange(assets.filter(a => a.name !== asset.name))
      if (value === asset.name) onChange('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aset gagal dihapus.')
    }
  }

  return (
    <div className="space-y-2">
      {own.length > 0 && (
        <ul role="radiogroup" aria-label={`Pilih ${NOUN[kind]}`} className="space-y-1">
          {own.map(asset => {
            const selected = asset.name === value
            return (
              <li key={asset.name} className="flex items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onChange(asset.name)}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-md border px-2 h-10 text-left text-sm ${
                    selected ? 'border-signal bg-signal/10 text-ink' : 'border-transparent text-ink-muted hover:bg-raised hover:text-ink'
                  }`}
                >
                  {kind === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element -- aset dari backend dengan URL bertanda tangan
                    <img src={asset.url} alt="" className="size-7 shrink-0 rounded object-contain bg-black/30" />
                  )}
                  <span className="truncate">{asset.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-faint">{asset.size_mb >= 0.1 ? `${asset.size_mb} MB` : '< 0,1 MB'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(asset)}
                  disabled={disabled}
                  aria-label={`Hapus ${asset.label}`}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-raised hover:text-tally"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        tabIndex={-1}
        onChange={e => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button type="button" className="btn btn-sm btn-quiet" disabled={disabled || uploading} onClick={() => input.current?.click()}>
        {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
        Upload {NOUN[kind]}
      </button>
      <p className="text-xs text-ink-faint">
        {kind === 'image' ? 'PNG transparan paling rapi. Maks 5 MB.' : 'MP3, M4A, WAV, atau OGG. Maks 30 MB. Gunakan musik bebas royalti.'}
      </p>
    </div>
  )
}

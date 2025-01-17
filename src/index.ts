import { getResultAsync } from 'return-style'
import { parseAppleTouchIcons } from '@src/parse-apple-touch-icons'
import { parseFluidIcons } from '@src/parse-fluid-icons'
import { parseIcons } from '@src/parse-icons'
import { parseIEConfig } from '@src/parse-ie-config'
import { parseIE11Tiles } from '@src/parse-ie11-tiles'
import { parseManifest } from '@src/parse-manifest'
import { parseMaskIcons } from '@src/parse-mask-icons'
import { parseShortcutIcons } from '@src/parse-shortcut-icons'
import { parseWindows8Tiles } from '@src/parse-windows8-tiles'
import { parseImage } from '@src/parse-image'
import { Observable } from 'rxjs'
import { produce } from '@utils/immer'
import flatten from 'lodash/flatten'

import { Icon, TextFetcher, BufferFetcher, Image } from './types'
export { Icon, TextFetcher, BufferFetcher }

export function parseFavicon(url: string, textFetcher: TextFetcher, bufferFetcher?: BufferFetcher): Observable<Icon> {
  return new Observable(observer => {
    parse(icon => observer.next(icon))
      .then(() => observer.complete())
      .catch(err => observer.error(err))
  })

  async function parse(publish: (icon: Icon) => void) {
    const html = await textFetcher(url)

    const icons = [
      ...parseAppleTouchIcons(html)
    , ...parseFluidIcons(html)
    , ...parseIcons(html)
    , ...parseIE11Tiles(html)
    , ...parseMaskIcons(html)
    , ...parseShortcutIcons(html)
    , ...parseWindows8Tiles(html)
    ]

    if (bufferFetcher) {
      const imagePromisePool = new Map<string, Promise<Image | null>>()

      icons.forEach(async icon => publish(await tryUpdateIcon(bufferFetcher, imagePromisePool, icon)))

      const results = await Promise.all([
        parseIEConfig(html, textFetcher)
      , parseManifest(html, textFetcher)
      ])
      flatten(results)
        .forEach(async icon => {
          publish(await tryUpdateIcon(bufferFetcher, imagePromisePool, icon))
        })

      getDefaultIconUrls().forEach(async url => {
        if (!imagePromisePool.has(url)) {
          imagePromisePool.set(url, fetchImage(bufferFetcher, url))
        }
        const image = await imagePromisePool.get(url)
        if (image) {
          publish({
            url
          , reference: url
          , type: image.type
          , size: image.size
          })
        }
      })

      await Promise.all(imagePromisePool.values())
    } else {
      icons.forEach(publish)

      const results = await Promise.all([
        parseIEConfig(html, textFetcher)
      , parseManifest(html, textFetcher)
      ])
      flatten(results)
        .forEach(publish)
    }
  }

  async function tryUpdateIcon(bufferFetcher: BufferFetcher, imagePromisePool: Map<string, Promise<Image | null>>, icon: Icon): Promise<Icon> {
    if (!imagePromisePool.has(icon.url)) {
      imagePromisePool.set(icon.url, fetchImage(bufferFetcher, icon.url))
    }
    const image = await imagePromisePool.get(icon.url)
    if (image) {
      return updateIcon(icon, image)
    } else {
      return icon
    }
  }

  async function fetchImage(bufferFetcher: BufferFetcher, url: string): Promise<Image | null> {
    const arrayBuffer = await getResultAsync(() => bufferFetcher(url))
    if (!arrayBuffer) return null
    const buffer = Buffer.from(arrayBuffer)

    try {
      return await parseImage(buffer)
    } catch {
      return null
    }
  }

  function updateIcon(icon: Icon, image: Image): Icon {
    return produce(icon, icon => {
      icon.type = image.type
      icon.size = image.size
    })
  }
}

function getDefaultIconUrls() {
  return [
    '/favicon.ico'
  , '/apple-touch-icon-57x57-precomposed.png'
  , '/apple-touch-icon-57x57.png'
  , '/apple-touch-icon-72x72-precomposed.png'
  , '/apple-touch-icon-72x72.png'
  , '/apple-touch-icon-114x114-precomposed.png'
  , '/apple-touch-icon-114x114.png'
  , '/apple-touch-icon-120x120-precomposed.png'
  , '/apple-touch-icon-120x120.png'
  , '/apple-touch-icon-144x144-precomposed.png'
  , '/apple-touch-icon-144x144.png'
  , '/apple-touch-icon-152x152-precomposed.png'
  , '/apple-touch-icon-152x152.png'
  , '/apple-touch-icon-180x180-precomposed.png'
  , '/apple-touch-icon-180x180.png'
  , '/apple-touch-icon-precomposed.png'
  , '/apple-touch-icon.png'
  ]
}

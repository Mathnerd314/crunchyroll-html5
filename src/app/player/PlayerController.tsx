import { h, render } from 'preact';
import { Player, IPlayerConfig } from '../media/player/Player';
import { getMediaByUrl, Formats, getMedia } from 'crunchyroll-lib/media';
import { NextVideo } from '../media/nextvideo';
import { NextVideoEvent, PlaybackState } from '../media/player/IPlayerApi';
import parse = require('url-parse');
import { IMedia } from 'crunchyroll-lib/models/IMedia';
import { VideoTracker } from './Tracking';

export interface IPlayerControllerOptions {
  quality?: keyof Formats;
  mediaFormat?: string;
  mediaQuality?: string;

  startTime?: number;
  sizeEnabled?: boolean;
  autoPlay?: boolean;
  affiliateId?: string;
}

export class PlayerController {
  private _element: Element;
  private _url: string;
  private _mediaId: string;

  private _sizeEnabled: boolean = true;

  private _startTime?: number;
  private _autoPlay?: boolean;
  private _affiliateId?: string;
  private _quality: keyof Formats;
  private _mediaFormat?: string;
  private _mediaQuality?: string;

  private _player?: Player;
  private _changedMedia: boolean = false;

  private _tracking?: VideoTracker;

  constructor(element: Element, url: string, mediaId: string, options?: IPlayerControllerOptions) {
    this._element = element;
    this._url = url;
    this._mediaId = mediaId;

    if (options) {
      this._startTime = options.startTime;
      this._sizeEnabled = !!options.sizeEnabled;
      this._autoPlay = options.autoPlay;
      this._affiliateId = options.affiliateId;
      this._quality = options.quality ? options.quality : "360p";

      this._mediaFormat = options.mediaFormat;
      this._mediaQuality = options.mediaQuality;
    }
  }

  private _getThumbnailByMediaId(mediaId: string): string|undefined {
    const img = document.querySelector("a.link.block-link.block[href$=\"-" + mediaId + "\"] img.mug");
    if (!img) return undefined;

    const url = img.getAttribute("src");
    if (!url) return undefined;

    return url.replace(/_[a-zA-Z]+(\.[a-zA-Z]+)$/, "_full$1");
  }

  private _getDefaultConfig(): IPlayerConfig {
    const thumbnailUrl = this._getThumbnailByMediaId(this._mediaId);
    if (!thumbnailUrl) return {};

    return {
      thumbnailUrl: thumbnailUrl
    };
  }

  private _onFullscreenChange(): void {
    if (!this._player || this._player.getApi().isFullscreen()) return;

    // Don't do anything if the media hasn't changed
    if (!this._changedMedia) return;

    const api = this._player.getApi();

    // Redirect the page to the current media
    const url = parse(this._url, true);
    if (!url.query) {
      url.query = {};
    }
    url.query['t'] = Math.floor(api.getCurrentTime()).toString();

    location.href = url.toString();
  }

  private _loadMedia(media: IMedia): void {
    if (!this._player) return;
    if (this._tracking) {
      this._tracking.dispose();
      this._tracking = undefined;
    }

    const metadata = media.getMetadata();
    const stream = media.getStream();
    
    // Construct a title
    const title = metadata.getSeriesTitle() + " Episode " + metadata.getEpisodeNumber() + " – " + metadata.getEpisodeTitle();

    const videoConfig = {
      title: title,
      url: stream.getFile(),
      duration: stream.getDuration(),
      subtitles: media.getSubtitles(),
      startTime: this._startTime === undefined ? media.getStartTime() || 0 : this._startTime,
      autoplay: this._autoPlay === undefined ? media.isAutoPlay() : this._autoPlay,
      thumbnailUrl: metadata.getEpisodeImageUrl()
    } as IPlayerConfig;

    // Register the next video if there's one
    const nextVideoUrl = media.getNextVideoUrl();
    if (nextVideoUrl) {
      const nextVideo = NextVideo.fromUrlUsingDocument(nextVideoUrl);
      if (nextVideo) {
        videoConfig.nextVideo = {
          title: nextVideo.episodeNumber + ': ' + nextVideo.episodeTitle,
          duration: typeof nextVideo.duration === 'number' ? nextVideo.duration : NaN,
          url: nextVideo.url,
          thumbnailUrl: nextVideo.thumbnailUrl
        };
      }
    }

    this._tracking = new VideoTracker(media, this._player.getApi());

    if (videoConfig.autoplay) {
      this._player.loadVideoByConfig(videoConfig);
    } else {
      this._player.cueVideoByConfig(videoConfig);
    }
  }

  private async _onNextVideo(e: NextVideoEvent): Promise<void> {
    if (!this._player || !this._player.getApi().isFullscreen()) return;

    // Stop the player from navigating to the next video
    e.preventDefault();

    const detail = e.detail;

    this._url = detail.url;
    this._changedMedia = true;

    if (this._tracking) {
      this._tracking.dispose();
      this._tracking = undefined;
    }

    this._player.loadVideoByConfig({
      thumbnailUrl: detail.thumbnailUrl
    });

    let media: IMedia;
    if (this._mediaFormat && this._mediaQuality) {
      media = await getMediaByUrl(detail.url, this._mediaFormat, this._mediaQuality, {
        affiliateId: this._affiliateId,
        autoPlay: true
      });
    } else {
      media = await getMediaByUrl(detail.url, this._quality, {
        affiliateId: this._affiliateId,
        autoPlay: true
      });
    }

    this._loadMedia(media);
  }

  /**
   * Initial loading of player and the media to play.
   * @param player the player reference
   */
  private async _onPlayerReady(player: Player): Promise<void> {
    this._player = player;
    const api = player.getApi();
    api.listen('fullscreenchange', () => this._onFullscreenChange());
    api.listen('nextvideo', (e: NextVideoEvent) => this._onNextVideo(e));

    let media: IMedia;

    if (this._mediaFormat && this._mediaQuality) {
      media = await getMedia(this._mediaId, this._mediaFormat, this._mediaQuality, this._url, {
        affiliateId: this._affiliateId,
        autoPlay: this._autoPlay
      });
    } else {
      media = await getMedia(this._mediaId, this._quality, this._url, {
        affiliateId: this._affiliateId,
        autoPlay: this._autoPlay
      });
    }

    this._loadMedia(media);
  }

  private _onSizeChange(large: boolean): void {
    if (!this._player) return;
    const showmedia = document.querySelector("#showmedia");
    const showmediaVideo = document.querySelector("#showmedia_video");
    const mainMedia = document.querySelector("#main_content");
    if (!showmedia || !showmediaVideo || !mainMedia) return;

    const api = this._player.getApi();
    var playing = api.getPreferredPlaybackState() === PlaybackState.PLAYING;
    if (large) {
      this._element.setAttribute("id", "showmedia_video_box_wide");
      this._element.classList.remove("xsmall-margin-bottom");
      mainMedia.classList.remove("new_layout");
      showmedia.parentElement!.classList.add("new_layout");
      showmedia.parentElement!.classList.add("new_layout_wide")
      showmedia.parentNode!.insertBefore(showmediaVideo, showmedia);
    } else {
      this._element.setAttribute("id", "showmedia_video_box");
      this._element.classList.add("xsmall-margin-bottom");
      showmedia.parentElement!.classList.remove("new_layout");
      showmedia.parentElement!.classList.remove("new_layout_wide")
      mainMedia.classList.add("new_layout");
      if (mainMedia.childNodes.length === 0) {
        mainMedia.appendChild(showmediaVideo);
      } else {
        mainMedia.insertBefore(showmediaVideo, mainMedia.childNodes[0]);
      }
    }
    if (playing) {
      api.playVideo(true);
    }
  }

  get large(): boolean {
    return this._element.id === "showmedia_video_box_wide";
  }
  
  /**
   * Returns whether sizing is enabled.
   */
  isSizeEnabled(): boolean {
    // return /https?:\/\/(?:(www|m)\.)?(crunchyroll\.(?:com|fr)\/(?:media(?:-|\/\?id=)|[^/]*\/[^/?&]*?)([0-9]+))(?:[/?&]|$)/g.test(window.location.href);
    return this._sizeEnabled;
  }

  render(): void {
    const onSizeChange = (large: boolean) => this._onSizeChange(large);
    const onPlayerReady = (player: Player) => this._onPlayerReady(player);

    render((
      <Player
        ref={onPlayerReady}
        onSizeChange={onSizeChange}
        large={this.large}
        sizeEnabled={this.isSizeEnabled()}
        config={this._getDefaultConfig()}></Player>
    ), this._element);
  }
}
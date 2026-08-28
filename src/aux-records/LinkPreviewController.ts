/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { RateLimiter } from '@casual-simulation/rate-limit-redis';
import type { ServerError } from '@casual-simulation/aux-common/Errors';
import type { LinkPreviewData, LinkPreviewStore } from './LinkPreviewStore';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import axios from 'axios';
import * as net from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { parse as parseHtml } from 'node-html-parser';
import { z } from 'zod';

const TRACE_NAME = 'LinkPreviewController';

const USER_AGENT = 'CasualOS-LinkPreview/1.0 (+https://casualos.com)';

const YOUTUBE_OEMBED_URL = 'https://www.youtube.com/oembed';

const YOUTUBE_HOSTNAMES = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
    'www.youtu.be',
]);

/**
 * The schema for the response returned by YouTube's oEmbed endpoint.
 * See https://oembed.com/ and https://www.youtube.com/oembed for details.
 */
export const YOUTUBE_OEMBED_SCHEMA = z.object({
    title: z.string().optional(),
    author_name: z.string().optional(),
    author_url: z.string().optional(),
    provider_name: z.string().optional(),
    provider_url: z.string().optional(),
    thumbnail_url: z.string().optional(),
    thumbnail_width: z.number().optional(),
    thumbnail_height: z.number().optional(),
    html: z.string().optional(),
    type: z.string().optional(),
    version: z.string().optional(),
});

export type YouTubeOEmbedResponse = z.infer<typeof YOUTUBE_OEMBED_SCHEMA>;

/**
 * Determines if the given hostname belongs to YouTube.
 * @param hostname The hostname to check.
 */
export function isYouTubeHostname(hostname: string): boolean {
    return YOUTUBE_HOSTNAMES.has(hostname.toLowerCase());
}

export interface LinkPreviewControllerOptions {
    store: LinkPreviewStore;
    rateLimiter: RateLimiter;
    config: LinkPreviewConfig;
}

/**
 * Defines the configuration options for the link preview controller.
 */
export interface LinkPreviewConfig {
    /**
     * The rate limit that should be applied per-origin (i.e. per website) to prevent
     * hammering a single site with requests.
     */
    rateLimit: {
        maxHits: number;
        windowMs: number;
    };

    /**
     * The minimum number of seconds that a link preview should be cached for, regardless
     * of what the site's Cache-Control header says.
     */
    minCacheSeconds: number;

    /**
     * The number of miliseconds that a request for a page's HTML is allowed to take before
     * it is aborted.
     */
    requestTimeoutMs: number;

    /**
     * The maximum number of bytes that will be read from a page's response.
     */
    maxResponseBytes: number;
}

/**
 * Defines a controller that is able to generate link previews for URLs.
 */
export class LinkPreviewController {
    private _store: LinkPreviewStore;
    private _rateLimiter: RateLimiter;
    private _config: LinkPreviewConfig;

    constructor(options: LinkPreviewControllerOptions) {
        this._store = options.store;
        this._rateLimiter = options.rateLimiter;
        this._config = options.config;
        this._rateLimiter.init({
            windowMs: options.config.rateLimit.windowMs,
        });
    }

    /**
     * Gets a link preview for the given URL.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async getLinkPreview(
        request: GetLinkPreviewRequest
    ): Promise<GetLinkPreviewResult> {
        try {
            let target: URL;
            try {
                target = new URL(request.url);
            } catch {
                return invalidUrlResult();
            }

            if (target.protocol !== 'http:' && target.protocol !== 'https:') {
                return invalidUrlResult();
            }

            if (await this._isBlockedHost(target.hostname)) {
                return invalidUrlResult();
            }

            const normalizedUrl = normalizeUrl(target);
            const cacheKey = getCacheKey(normalizedUrl, request.locale);

            const cached = await this._store.getLinkPreview(cacheKey);
            if (cached) {
                return {
                    success: true,
                    ...cached.data,
                    cachedUntilMs: cached.expireTimeMs,
                };
            }

            const origin = new URL(normalizedUrl).origin;
            const hits = await this._rateLimiter.increment(origin);
            if (hits.totalHits > this._config.rateLimit.maxHits) {
                return {
                    success: false,
                    errorCode: 'site_rate_limited',
                    errorMessage:
                        'Too many requests have been made for this site. Please try again later.',
                };
            }

            const result = isYouTubeHostname(target.hostname)
                ? await this._getYouTubeOEmbedData(
                      normalizedUrl,
                      request.locale
                  )
                : await this._getGenericPreviewData(
                      normalizedUrl,
                      request.locale
                  );

            if (result.success === true) {
                const expireTimeMs = Date.now() + result.expireSeconds * 1000;

                await this._store.saveLinkPreview({
                    cacheKey,
                    data: result.data,
                    expireTimeMs,
                });

                return {
                    success: true,
                    ...result.data,
                    cachedUntilMs: expireTimeMs,
                };
            }

            return result;
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[LinkPreviewController] An error occurred while getting the link preview.`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Fetches the page's HTML and scrapes OpenGraph/meta tags out of it.
     */
    private async _getGenericPreviewData(
        normalizedUrl: string,
        locale: string | undefined
    ): Promise<PreviewDataResult> {
        const response = await axios.get(normalizedUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                ...(locale ? { 'Accept-Language': locale } : {}),
            },
            responseType: 'text',
            timeout: this._config.requestTimeoutMs,
            maxRedirects: 5,
            maxContentLength: this._config.maxResponseBytes,
            maxBodyLength: this._config.maxResponseBytes,
            validateStatus: () => true,
        });

        const contentType = (
            (response.headers?.['content-type'] as string) ?? ''
        ).toLowerCase();
        if (
            !contentType.includes('text/html') &&
            !contentType.includes('application/xhtml+xml')
        ) {
            return {
                success: false,
                errorCode: 'url_not_html',
                errorMessage: 'The given URL does not point to an HTML page.',
            };
        }

        const finalUrl: string =
            response.request?.res?.responseUrl ?? normalizedUrl;
        const data = extractLinkPreviewData(response.data, finalUrl);
        const expireSeconds = Math.max(
            this._config.minCacheSeconds,
            getCacheControlMaxAgeSeconds(
                response.headers?.['cache-control'] as string
            ) ?? 0
        );

        return {
            success: true,
            data,
            expireSeconds,
        };
    }

    /**
     * Fetches preview data for a YouTube URL using YouTube's oEmbed endpoint.
     */
    private async _getYouTubeOEmbedData(
        normalizedUrl: string,
        locale: string | undefined
    ): Promise<PreviewDataResult> {
        const response = await axios.get(YOUTUBE_OEMBED_URL, {
            params: {
                url: normalizedUrl,
                format: 'json',
            },
            headers: {
                'User-Agent': USER_AGENT,
                ...(locale ? { 'Accept-Language': locale } : {}),
            },
            timeout: this._config.requestTimeoutMs,
            validateStatus: () => true,
        });

        const parsed =
            response.status === 200
                ? YOUTUBE_OEMBED_SCHEMA.safeParse(response.data)
                : null;

        if (!parsed || !parsed.success) {
            return {
                success: false,
                errorCode: 'unacceptable_url',
                errorMessage: 'The given URL is not able to be previewed.',
            };
        }

        const expireSeconds = Math.max(
            this._config.minCacheSeconds,
            getCacheControlMaxAgeSeconds(
                response.headers?.['cache-control'] as string
            ) ?? 0
        );

        return {
            success: true,
            data: extractYouTubeOEmbedData(parsed.data, normalizedUrl),
            expireSeconds,
        };
    }

    private async _isBlockedHost(hostname: string): Promise<boolean> {
        if (hostname === 'localhost') {
            return true;
        }

        if (net.isIP(hostname)) {
            return isPrivateOrReservedAddress(hostname);
        }

        try {
            const addresses = await dnsLookup(hostname, { all: true });
            return addresses.some((a) => isPrivateOrReservedAddress(a.address));
        } catch {
            return true;
        }
    }
}

function invalidUrlResult(): GetLinkPreviewFailure {
    return {
        success: false,
        errorCode: 'unacceptable_url',
        errorMessage: 'The given URL is not able to be previewed.',
    };
}

/**
 * Normalizes the given URL by stripping the hash and sorting the query parameters
 * alphabetically by name.
 * @param url The URL to normalize.
 */
export function normalizeUrl(url: URL): string {
    const sortedParams = Array.from(url.searchParams.entries()).sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
    );
    const search = new URLSearchParams();
    for (const [key, value] of sortedParams) {
        search.append(key, value);
    }
    const query = search.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Gets the cache key that should be used for the given normalized URL and locale.
 */
export function getCacheKey(normalizedUrl: string, locale?: string): string {
    return JSON.stringify([normalizedUrl, locale ?? null]);
}

function getCacheControlMaxAgeSeconds(
    cacheControl: string | undefined
): number | undefined {
    if (!cacheControl) {
        return undefined;
    }
    const match = /max-age=(\d+)/i.exec(cacheControl);
    if (!match) {
        return undefined;
    }
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? seconds : undefined;
}

function toNumber(value: string | undefined): number | undefined {
    if (!value) {
        return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function resolveUrl(
    value: string | undefined,
    baseUrl: string
): string | undefined {
    if (!value) {
        return undefined;
    }
    try {
        return new URL(value, baseUrl).href;
    } catch {
        return undefined;
    }
}

/**
 * Extracts link preview data from the given HTML document.
 * @param html The HTML that should be parsed.
 * @param baseUrl The URL that the HTML was retrieved from. Used to resolve relative URLs.
 */
export function extractLinkPreviewData(
    html: string,
    baseUrl: string
): LinkPreviewData {
    const root = parseHtml(html);
    const meta: { [key: string]: string } = {};

    for (const tag of root.querySelectorAll('meta')) {
        const key = tag.getAttribute('property') || tag.getAttribute('name');
        const content = tag.getAttribute('content');
        if (key && content !== undefined && !(key in meta)) {
            meta[key] = content;
        }
    }

    let iconHref: string | undefined;
    let canonicalHref: string | undefined;
    for (const link of root.querySelectorAll('link')) {
        const rel = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
        const href = link.getAttribute('href');
        if (!href) {
            continue;
        }
        if (!iconHref && rel.includes('icon')) {
            iconHref = href;
        }
        if (!canonicalHref && rel.includes('canonical')) {
            canonicalHref = href;
        }
    }

    const titleTag = root.querySelector('title')?.text?.trim();

    return {
        title: meta['og:title'] || titleTag || undefined,
        description: meta['og:description'] || meta['description'] || undefined,
        imageUrl:
            resolveUrl(meta['og:image'], baseUrl) ??
            resolveUrl(iconHref, baseUrl),
        imageHeight: toNumber(meta['og:image:height']),
        imageWidth: toNumber(meta['og:image:width']),
        imageAlt: meta['og:image:alt'] || undefined,
        type: meta['og:type'] || undefined,
        canonicalUrl:
            resolveUrl(meta['og:url'], baseUrl) ??
            resolveUrl(canonicalHref, baseUrl),
        siteName: meta['og:site_name'] || undefined,
        locale: meta['og:locale'] || undefined,
        meta,
    };
}

/**
 * Maps a validated YouTube oEmbed response onto link preview data.
 * @param oembed The validated oEmbed response.
 * @param canonicalUrl The normalized URL that the oEmbed data was retrieved for.
 */
export function extractYouTubeOEmbedData(
    oembed: YouTubeOEmbedResponse,
    canonicalUrl: string
): LinkPreviewData {
    const meta: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(oembed)) {
        if (value !== undefined && value !== null) {
            meta[key] = String(value);
        }
    }

    return {
        title: oembed.title,
        description: undefined,
        imageUrl: oembed.thumbnail_url,
        imageHeight: oembed.thumbnail_height,
        imageWidth: oembed.thumbnail_width,
        imageAlt: oembed.title,
        type: 'video',
        canonicalUrl,
        siteName: oembed.provider_name ?? 'YouTube',
        locale: undefined,
        meta,
    };
}

/**
 * Determines if the given IP address is a private, loopback, link-local, or otherwise
 * reserved address that should not be reachable from a public link preview request.
 * @param ip The IP address to check.
 */
export function isPrivateOrReservedAddress(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map((p) => Number(p));
        const [a, b, c] = parts;
        if (a === 0) return true; // "this" network
        if (a === 10) return true; // RFC1918
        if (a === 127) return true; // loopback
        if (a === 169 && b === 254) return true; // link-local
        if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
        if (a === 192 && b === 168) return true; // RFC1918
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
        if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
        if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
        if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
        if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
        if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
        if (a >= 224) return true; // multicast (224-239) & reserved (240-255)
        return false;
    }

    if (net.isIPv6(ip)) {
        const normalized = ip.toLowerCase();
        if (normalized === '::1' || normalized === '::') return true;

        const mappedV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
        if (mappedV4) {
            return isPrivateOrReservedAddress(mappedV4[1]);
        }

        const firstGroup = parseInt(normalized.split(':')[0] || '0', 16) || 0;
        if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) return true; // link-local fe80::/10
        if (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) return true; // unique local fc00::/7
        if (firstGroup >= 0xff00 && firstGroup <= 0xffff) return true; // multicast ff00::/8
        return false;
    }

    return true;
}

export interface GetLinkPreviewRequest {
    /**
     * The URL that a preview should be generated for.
     */
    url: string;

    /**
     * The locale that should be used when requesting the URL.
     */
    locale?: string;
}

export type GetLinkPreviewResult =
    | GetLinkPreviewSuccess
    | GetLinkPreviewFailure;

export interface GetLinkPreviewSuccess extends LinkPreviewData {
    success: true;

    /**
     * The unix time in miliseconds that the results should be considered cached until.
     */
    cachedUntilMs: number;
}

export interface GetLinkPreviewFailure {
    success: false;
    errorCode:
        | ServerError
        | 'unacceptable_url'
        | 'url_not_html'
        | 'site_rate_limited';
    errorMessage: string;
}

/**
 * The result of fetching link preview data from a source (either the generic
 * HTML scraper or a site-specific integration like YouTube's oEmbed endpoint).
 */
type PreviewDataResult =
    | {
          success: true;
          data: LinkPreviewData;
          expireSeconds: number;
      }
    | GetLinkPreviewFailure;

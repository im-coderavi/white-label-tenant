import sanitizeHtml from 'sanitize-html';

/** Used for reseller-supplied custom landing-page HTML; strips scripts/handlers to prevent stored XSS against storefront visitors. */
export function sanitizeStorefrontHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'h1',
      'h2',
      'video',
      'source',
      'iframe',
      'style',
      'section',
      'span',
      'div',
    ]),
    allowedAttributes: {
      '*': ['class', 'id', 'style'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      video: ['src', 'controls', 'width', 'height', 'poster', 'autoplay', 'muted', 'loop'],
      source: ['src', 'type'],
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    disallowedTagsMode: 'discard',
    allowVulnerableTags: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}

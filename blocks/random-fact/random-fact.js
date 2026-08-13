import { createOptimizedPicture } from '../../scripts/aem.js';

const API_URL = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';
const ERROR_MESSAGE = 'Unable to load a new discovery right now. Please try again.';
const FALLBACK_TITLE = 'Random Discovery';
const FALLBACK_DESCRIPTION = 'Explore a curated fact while a new discovery is loading.';
const IMAGE_BREAKPOINTS = [{ media: '(min-width: 900px)', width: '900' }, { width: '720' }];

const createIcon = (paths) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  paths.forEach((definition) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    Object.entries(definition).forEach(([attribute, value]) => {
      path.setAttribute(attribute, value);
    });
    svg.append(path);
  });

  return svg;
};

const createShuffleIcon = () => createIcon([
  {
    d: 'M17 3h4v4',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
  },
  {
    d: 'M3 21l6.5-6.5',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
  },
  {
    d: 'M13 7l8 8',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
  },
  {
    d: 'M21 13v4h-4',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
  },
  {
    d: 'M3 3l6.5 6.5',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
  },
]);

const createBookmarkIcon = () => createIcon([
  {
    d: 'M8 5.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5.5V20l-4-2.8L8 20Z',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '1.8',
  },
]);

const createElement = (tagName, className, textContent) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (typeof textContent === 'string') element.textContent = textContent;
  return element;
};

const isOptimizableImage = (src) => {
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
};

const createFactPicture = (src, alt) => {
  if (isOptimizableImage(src)) {
    return createOptimizedPicture(src, alt, false, IMAGE_BREAKPOINTS);
  }

  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = alt;
  img.src = src;
  picture.append(img);
  return picture;
};

const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() || '';

const normalizeCategories = (value) => value
  .split(',')
  .map((item) => normalizeText(item))
  .filter(Boolean);

const parseAuthoredState = (block) => {
  const authored = {
    title: '',
    description: '',
    categories: [],
    imageSrc: '',
    imageAlt: '',
    articleUrl: '',
    readTime: '',
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;

    const label = normalizeText(cells[0].textContent).toLowerCase();
    const valueCell = cells[1];

    if (label === 'image') {
      const image = valueCell.querySelector('img');
      if (image) {
        authored.imageSrc = image.getAttribute('src') || image.src || '';
        authored.imageAlt = normalizeText(image.getAttribute('alt'));
      }
      return;
    }

    const value = normalizeText(valueCell.textContent);

    if (label === 'title') authored.title = value;
    if (label === 'description') authored.description = value;
    if (label === 'categories') authored.categories = normalizeCategories(value);
    if (label === 'read time') authored.readTime = value;
  });

  return authored;
};

const normalizeApiData = (payload) => ({
  title: normalizeText(payload?.title),
  description: normalizeText(payload?.extract),
  categories: normalizeCategories(normalizeText(payload?.description)),
  imageSrc: payload?.originalimage?.source || payload?.thumbnail?.source || '',
  imageAlt: normalizeText(
    payload?.originalimage?.alt_text
      || payload?.thumbnail?.alt_text
      || payload?.title,
  ),
  articleUrl: payload?.content_urls?.desktop?.page
    || payload?.content_urls?.mobile?.page
    || '',
  readTime: '',
});

const computeReadMetrics = (description, fallbackReadTime = '') => {
  const words = normalizeText(description).split(/\s+/).filter(Boolean).length;
  const minutes = words > 0 ? Math.max(1, Math.ceil(words / 90)) : 0;
  const label = minutes > 0 ? `${minutes} min read` : fallbackReadTime || '1 min read';
  const progress = Math.max(18, Math.min(72, Math.round(15 + (words / 6))));

  return { label, progress };
};

const mergeState = (authoredState, liveState) => {
  const mergedTitle = liveState?.title || authoredState.title || FALLBACK_TITLE;
  const mergedDescription = liveState?.description
    || authoredState.description
    || FALLBACK_DESCRIPTION;
  const mergedCategories = liveState?.categories?.length
    ? liveState.categories
    : authoredState.categories;
  const imageSrc = liveState?.imageSrc || authoredState.imageSrc || '';
  const imageAlt = liveState?.imageAlt || authoredState.imageAlt || mergedTitle;
  const articleUrl = liveState?.articleUrl || authoredState.articleUrl || '';
  const metrics = computeReadMetrics(
    mergedDescription,
    authoredState.readTime || liveState?.readTime,
  );

  return {
    title: mergedTitle,
    description: mergedDescription,
    categories: mergedCategories,
    imageSrc,
    imageAlt,
    articleUrl,
    readTime: metrics.label,
    progress: metrics.progress,
  };
};

const updateLink = (link, href, label, disabledClassName) => {
  if (href) {
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', label);
    link.classList.remove(disabledClassName);
  } else {
    link.removeAttribute('href');
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.removeAttribute('aria-label');
    link.classList.add(disabledClassName);
  }
};

const renderTags = (elements, categories) => {
  elements.tags.replaceChildren();

  if (!categories.length) {
    elements.tags.hidden = true;
    return;
  }

  categories.forEach((category) => {
    const item = createElement('li', 'random-fact-tag', category);
    elements.tags.append(item);
  });

  elements.tags.hidden = false;
};

const renderMedia = (elements, state) => {
  elements.mediaLink.replaceChildren();

  if (state.imageSrc) {
    const picture = createFactPicture(state.imageSrc, state.imageAlt || state.title);
    picture.classList.add('random-fact-picture');
    elements.mediaLink.append(picture);
    elements.media.classList.remove('is-placeholder');
    return;
  }

  const placeholder = createElement('div', 'random-fact-placeholder');
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.append(
    createElement('span', 'random-fact-placeholder-kicker', 'Curated Discovery'),
  );

  elements.mediaLink.append(placeholder);
  elements.media.classList.add('is-placeholder');
};

const renderState = (elements, state, uiState) => {
  const { loading, errorMessage } = uiState;

  elements.card.setAttribute('aria-busy', loading ? 'true' : 'false');
  elements.root.classList.toggle('is-loading', loading);

  elements.titleLink.textContent = state.title;
  updateLink(
    elements.titleLink,
    state.articleUrl,
    `Read more about ${state.title} on Wikipedia`,
    'is-disabled',
  );

  updateLink(
    elements.mediaLink,
    state.articleUrl,
    `Open ${state.title} on Wikipedia`,
    'is-disabled',
  );

  elements.description.textContent = state.description;
  elements.readTime.textContent = state.readTime;
  elements.progressFill.style.width = `${state.progress}%`;

  renderTags(elements, state.categories);
  renderMedia(elements, state);

  elements.ctaButton.disabled = loading;
  elements.retryButton.disabled = loading;
  elements.ctaButton.setAttribute('aria-label', loading ? 'Loading discovery' : 'Discover another random entry');
  elements.ctaButton.classList.toggle('is-loading', loading);
  elements.loadingLabel.hidden = !loading;
  elements.desktopLabel.hidden = loading;
  elements.mobileLabel.hidden = loading;

  if (errorMessage) {
    elements.error.hidden = false;
    elements.errorText.textContent = errorMessage;
  } else {
    elements.error.hidden = true;
    elements.errorText.textContent = '';
  }
};

const fetchRandomFact = async () => {
  const response = await fetch(API_URL, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Random fact request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return normalizeApiData(payload);
};

const buildBlock = () => {
  const root = createElement('div', 'random-fact-shell');
  const card = createElement('article', 'random-fact-card');
  const content = createElement('div', 'random-fact-content');
  const media = createElement('div', 'random-fact-media');
  const mediaLink = createElement('a', 'random-fact-media-link is-disabled');
  const bookmark = createElement('span', 'random-fact-bookmark');
  const bookmarkIcon = createBookmarkIcon();
  const status = createElement('div', 'random-fact-status');
  const statusDot = createElement('span', 'random-fact-status-dot');
  const statusLabel = createElement('span', 'random-fact-status-label', 'Discovery Awaits');
  const tags = createElement('ul', 'random-fact-tags');
  const title = createElement('h2', 'random-fact-title');
  const titleLink = createElement('a', 'random-fact-title-link is-disabled');
  const description = createElement('p', 'random-fact-description');
  const progress = createElement('div', 'random-fact-progress');
  const progressTrack = createElement('div', 'random-fact-progress-track');
  const progressFill = createElement('span', 'random-fact-progress-fill');
  const readTime = createElement('span', 'random-fact-read-time');
  const error = createElement('div', 'random-fact-error');
  const errorText = createElement('p', 'random-fact-error-text');
  const retryButton = createElement('button', 'button random-fact-retry');
  const actions = createElement('div', 'random-fact-actions');
  const ctaButton = createElement('button', 'button random-fact-cta');
  const shuffleIcon = createShuffleIcon();
  const desktopLabel = createElement('span', 'random-fact-cta-label random-fact-cta-label-desktop', 'Explore Next');
  const mobileLabel = createElement('span', 'random-fact-cta-label random-fact-cta-label-mobile', 'Discover Random Entry');
  const loadingLabel = createElement('span', 'random-fact-cta-label random-fact-cta-label-loading', 'Loading discovery...');

  bookmark.setAttribute('aria-hidden', 'true');
  bookmark.append(bookmarkIcon);

  status.append(statusDot, statusLabel);
  title.append(titleLink);

  progressTrack.append(progressFill);
  progress.append(progressTrack, readTime);

  error.setAttribute('aria-live', 'polite');
  error.setAttribute('role', 'status');
  error.hidden = true;

  retryButton.type = 'button';
  retryButton.textContent = 'Retry';
  error.append(errorText, retryButton);

  ctaButton.type = 'button';
  ctaButton.append(shuffleIcon, desktopLabel, mobileLabel, loadingLabel);

  loadingLabel.hidden = true;
  media.append(mediaLink, bookmark);
  content.append(status, tags, title, description, progress, error);
  card.append(content, media);
  actions.append(ctaButton);
  root.append(card, actions);

  return {
    root,
    card,
    content,
    media,
    mediaLink,
    titleLink,
    tags,
    description,
    progressFill,
    readTime,
    error,
    errorText,
    retryButton,
    ctaButton,
    desktopLabel,
    mobileLabel,
    loadingLabel,
  };
};

export default function decorate(block) {
  const authoredState = parseAuthoredState(block);
  const elements = buildBlock();
  let activeRequest = 0;
  let visibleState = mergeState(authoredState, null);

  const loadFact = async () => {
    activeRequest += 1;
    const requestId = activeRequest;

    renderState(elements, visibleState, { loading: true, errorMessage: '' });

    try {
      const liveState = await fetchRandomFact();
      if (requestId !== activeRequest) return;

      visibleState = mergeState(authoredState, liveState);
      renderState(elements, visibleState, { loading: false, errorMessage: '' });
    } catch (error) {
      if (requestId !== activeRequest) return;
      renderState(elements, visibleState, { loading: false, errorMessage: ERROR_MESSAGE });
    }
  };

  block.replaceChildren(elements.root);
  renderState(elements, visibleState, { loading: false, errorMessage: '' });

  elements.ctaButton.addEventListener('click', loadFact);
  elements.retryButton.addEventListener('click', loadFact);

  loadFact();
}

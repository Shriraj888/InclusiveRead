/*
 * Readability.js - Simplified content extraction library
 * Based on Mozilla's Readability algorithm concepts
 * Extracts main readable content from web pages
 */

var Readability = function(doc, options) {
  this._doc = doc;
  this._options = options || {};
  this._charThreshold = this._options.charThreshold || 500;
};

Readability.prototype = {
  // Scores for various elements
  ELEMENT_SCORES: {
    'article': 30,
    'section': 15,
    'main': 25,
    'div': 5,
    'p': 10,
    'pre': 3,
    'blockquote': 3,
    'td': 3
  },

  // Elements to remove
  UNLIKELY_CANDIDATES: /combx|comment|community|disqus|extra|foot|header|menu|related|remark|rss|shoutbox|sidebar|sponsor|ad-break|agegate|pagination|pager|popup|tweet|twitter|social|share|nav|navigation|breadcrumb/i,

  // Elements that might be content
  LIKELY_CANDIDATES: /article|body|content|entry|hentry|main|page|pagination|post|text|blog|story/i,

  // Positive indicators
  POSITIVE_PATTERNS: /article|body|content|entry|hentry|main|page|post|text|blog|story|reading/i,

  // Negative indicators
  NEGATIVE_PATTERNS: /hidden|banner|combx|comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget|nav|menu|advertisement/i,

  /**
   * Parse the document and return article content
   */
  parse: function() {
    var doc = this._doc;
    var title = this._getArticleTitle();
    var content = this._grabArticle();

    if (!content) {
      return null;
    }

    var textContent = this._getTextContent(content);

    // Check if we have enough content
    if (textContent.length < this._charThreshold) {
      return null;
    }

    return {
      title: title,
      content: content.innerHTML,
      textContent: textContent,
      excerpt: textContent.substring(0, 200) + '...',
      byline: this._getArticleByline(doc),
      siteName: this._getSiteName(doc),
      length: textContent.length
    };
  },

  /**
   * Get the article title
   */
  _getArticleTitle: function() {
    var doc = this._doc;
    var title = '';

    // Try different sources for the title
    var sources = [
      function() { return doc.querySelector('meta[property="og:title"]'); },
      function() { return doc.querySelector('h1'); },
      function() { return doc.querySelector('.entry-title'); },
      function() { return doc.querySelector('.post-title'); },
      function() { return doc.querySelector('article h1'); }
    ];

    for (var i = 0; i < sources.length; i++) {
      var el = sources[i]();
      if (el) {
        title = el.getAttribute ? el.getAttribute('content') : el.textContent;
        if (title && title.trim()) {
          return title.trim();
        }
      }
    }

    // Fallback to document title
    return doc.title || '';
  },

  /**
   * Get article byline/author
   */
  _getArticleByline: function(doc) {
    var selectors = [
      'meta[name="author"]',
      '.author',
      '.byline',
      '[rel="author"]',
      '.entry-author'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = doc.querySelector(selectors[i]);
      if (el) {
        return el.getAttribute('content') || el.textContent.trim();
      }
    }

    return null;
  },

  /**
   * Get site name
   */
  _getSiteName: function(doc) {
    var meta = doc.querySelector('meta[property="og:site_name"]');
    if (meta) {
      return meta.getAttribute('content');
    }
    return null;
  },

  /**
   * Main algorithm to grab article content
   */
  _grabArticle: function() {
    var doc = this._doc;

    // Try to find article element first
    var articleSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content-body',
      '#article-body',
      '.story-body'
    ];

    for (var i = 0; i < articleSelectors.length; i++) {
      var article = doc.querySelector(articleSelectors[i]);
      if (article && this._getTextContent(article).length > this._charThreshold) {
        return this._cleanArticle(article.cloneNode(true));
      }
    }

    // Fall back to scoring algorithm
    return this._scoreParagraphs();
  },

  /**
   * Score paragraphs to find main content
   */
  _scoreParagraphs: function() {
    var doc = this._doc;
    var candidates = [];
    var paragraphs = doc.getElementsByTagName('p');

    // Score each paragraph and its parent
    for (var i = 0; i < paragraphs.length; i++) {
      var p = paragraphs[i];
      var parent = p.parentNode;
      var grandParent = parent ? parent.parentNode : null;

      var text = p.textContent.trim();
      if (text.length < 25) continue;

      // Initialize parent score
      if (!parent._contentScore) {
        parent._contentScore = this._initializeScore(parent);
        candidates.push(parent);
      }

      // Score based on text length and commas
      var score = 1;
      score += text.split(',').length;
      score += Math.min(Math.floor(text.length / 100), 3);

      parent._contentScore += score;

      if (grandParent && !grandParent._contentScore) {
        grandParent._contentScore = this._initializeScore(grandParent);
        candidates.push(grandParent);
      }
      if (grandParent) {
        grandParent._contentScore += score / 2;
      }
    }

    // Find the top candidate
    var topCandidate = null;
    for (var j = 0; j < candidates.length; j++) {
      var candidate = candidates[j];
      
      // Scale score by link density
      candidate._contentScore = candidate._contentScore * (1 - this._getLinkDensity(candidate));

      if (!topCandidate || candidate._contentScore > topCandidate._contentScore) {
        topCandidate = candidate;
      }
    }

    if (topCandidate) {
      return this._cleanArticle(topCandidate.cloneNode(true));
    }

    // Last resort: use body
    return this._cleanArticle(doc.body.cloneNode(true));
  },

  /**
   * Initialize score for an element
   */
  _initializeScore: function(el) {
    var score = 0;
    var tagName = el.tagName.toLowerCase();

    if (this.ELEMENT_SCORES[tagName]) {
      score = this.ELEMENT_SCORES[tagName];
    }

    // Adjust score based on class/id
    var className = el.className + ' ' + el.id;
    
    if (this.POSITIVE_PATTERNS.test(className)) {
      score += 25;
    }
    if (this.NEGATIVE_PATTERNS.test(className)) {
      score -= 25;
    }

    return score;
  },

  /**
   * Calculate link density
   */
  _getLinkDensity: function(el) {
    var textLength = this._getTextContent(el).length;
    if (textLength === 0) return 0;

    var links = el.getElementsByTagName('a');
    var linkLength = 0;

    for (var i = 0; i < links.length; i++) {
      linkLength += this._getTextContent(links[i]).length;
    }

    return linkLength / textLength;
  },

  /**
   * Clean article by removing unwanted elements
   */
  _cleanArticle: function(article) {
    // Remove scripts, styles, etc.
    var removeElements = [
      'script', 'style', 'noscript', 'iframe', 'form',
      'nav', 'aside', 'footer', 'header',
      '.sidebar', '.nav', '.navigation', '.menu',
      '.advertisement', '.ad', '.ads', '.social',
      '.comments', '.comment', '.related',
      '[role="navigation"]', '[role="banner"]'
    ];

    for (var i = 0; i < removeElements.length; i++) {
      var els = article.querySelectorAll(removeElements[i]);
      for (var j = 0; j < els.length; j++) {
        if (els[j].parentNode) {
          els[j].parentNode.removeChild(els[j]);
        }
      }
    }

    // Remove unlikely candidates
    this._removeUnlikely(article);

    return article;
  },

  /**
   * Remove unlikely content candidates
   */
  _removeUnlikely: function(el) {
    var children = el.children;
    for (var i = children.length - 1; i >= 0; i--) {
      var child = children[i];
      var classAndId = child.className + ' ' + child.id;

      if (this.UNLIKELY_CANDIDATES.test(classAndId) && 
          !this.LIKELY_CANDIDATES.test(classAndId)) {
        child.parentNode.removeChild(child);
      } else {
        this._removeUnlikely(child);
      }
    }
  },

  /**
   * Get text content from element
   */
  _getTextContent: function(el) {
    return el.textContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
};

// Make it available globally
if (typeof window !== 'undefined') {
  window.Readability = Readability;
}

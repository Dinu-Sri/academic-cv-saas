<?php
/**
 * BlogService — Reads markdown blog posts from content/blog/ directory
 * 
 * Post format: YAML frontmatter + Markdown body
 * ---
 * title: "Post Title"
 * slug: "post-slug"
 * date: "2026-01-15"
 * description: "SEO description"
 * author: "CVScholar Team"
 * category: "Academic CV Guide"
 * tags: ["academic cv", "publications"]
 * featured_image: "post-image.jpg"
 * schema_type: "Article"
 * ---
 * 
 * Markdown body here...
 */
class BlogService
{
    private static ?array $postsCache = null;

    /**
     * Get all published posts sorted by date (newest first)
     */
    public static function getAllPosts(): array
    {
        if (self::$postsCache !== null) {
            return self::$postsCache;
        }

        $posts = [];
        $blogDir = BLOG_PATH;
        if (!is_dir($blogDir)) {
            return [];
        }

        $files = glob($blogDir . '/*.md');
        foreach ($files as $file) {
            $post = self::parseFile($file);
            if ($post && !empty($post['title']) && !empty($post['slug'])) {
                // Only show published posts (date <= today)
                if (!empty($post['date']) && $post['date'] <= date('Y-m-d')) {
                    $posts[] = $post;
                }
            }
        }

        // Sort by date descending
        usort($posts, fn($a, $b) => strcmp($b['date'], $a['date']));
        self::$postsCache = $posts;
        return $posts;
    }

    /**
     * Get a single post by slug
     */
    public static function getBySlug(string $slug): ?array
    {
        // Sanitize slug
        $slug = preg_replace('/[^a-z0-9\-]/', '', strtolower($slug));
        
        $posts = self::getAllPosts();
        foreach ($posts as $post) {
            if ($post['slug'] === $slug) {
                return $post;
            }
        }
        return null;
    }

    /**
     * Get posts by category
     */
    public static function getByCategory(string $category): array
    {
        $category = strtolower(trim($category));
        return array_filter(self::getAllPosts(), function ($post) use ($category) {
            return strtolower($post['category'] ?? '') === $category;
        });
    }

    /**
     * Get posts by tag
     */
    public static function getByTag(string $tag): array
    {
        $tag = strtolower(trim($tag));
        return array_filter(self::getAllPosts(), function ($post) use ($tag) {
            $tags = array_map('strtolower', $post['tags'] ?? []);
            return in_array($tag, $tags);
        });
    }

    /**
     * Search posts by query string
     */
    public static function search(string $query): array
    {
        $q = strtolower(trim($query));
        if (!$q) return self::getAllPosts();

        return array_filter(self::getAllPosts(), function ($post) use ($q) {
            return str_contains(strtolower($post['title']), $q)
                || str_contains(strtolower($post['description'] ?? ''), $q)
                || str_contains(strtolower($post['body_raw'] ?? ''), $q);
        });
    }

    /**
     * Get all unique categories
     */
    public static function getCategories(): array
    {
        $cats = [];
        foreach (self::getAllPosts() as $post) {
            $cat = $post['category'] ?? '';
            if ($cat) $cats[$cat] = ($cats[$cat] ?? 0) + 1;
        }
        ksort($cats);
        return $cats;
    }

    /**
     * Get all unique tags
     */
    public static function getTags(): array
    {
        $tags = [];
        foreach (self::getAllPosts() as $post) {
            foreach ($post['tags'] ?? [] as $tag) {
                $tags[$tag] = ($tags[$tag] ?? 0) + 1;
            }
        }
        ksort($tags);
        return $tags;
    }

    /**
     * Paginate an array of posts
     */
    public static function paginate(array $posts, int $page = 1, int $perPage = 0): array
    {
        if ($perPage <= 0) $perPage = defined('BLOG_POSTS_PER_PAGE') ? BLOG_POSTS_PER_PAGE : 12;
        $posts = array_values($posts); // re-index
        $total = count($posts);
        $totalPages = max(1, (int)ceil($total / $perPage));
        $page = max(1, min($page, $totalPages));
        $offset = ($page - 1) * $perPage;

        return [
            'posts' => array_slice($posts, $offset, $perPage),
            'page' => $page,
            'perPage' => $perPage,
            'total' => $total,
            'totalPages' => $totalPages,
        ];
    }

    /**
     * Get related posts (same category, excluding current)
     */
    public static function getRelated(array $currentPost, int $limit = 3): array
    {
        $related = [];
        $cat = $currentPost['category'] ?? '';
        $currentSlug = $currentPost['slug'];

        // First: same category
        if ($cat) {
            foreach (self::getByCategory($cat) as $p) {
                if ($p['slug'] !== $currentSlug) {
                    $related[] = $p;
                }
                if (count($related) >= $limit) return $related;
            }
        }

        // Fill with other recent posts
        foreach (self::getAllPosts() as $p) {
            if ($p['slug'] !== $currentSlug && !in_array($p, $related, true)) {
                $related[] = $p;
            }
            if (count($related) >= $limit) break;
        }

        return $related;
    }

    /**
     * Parse a markdown file with YAML frontmatter
     */
    private static function parseFile(string $filepath): ?array
    {
        $raw = file_get_contents($filepath);
        if ($raw === false) return null;

        // Split frontmatter and body
        if (!preg_match('/^---\s*\n(.*?)\n---\s*\n(.*)$/s', $raw, $m)) {
            return null;
        }

        $frontmatter = self::parseYaml($m[1]);
        $bodyRaw = trim($m[2]);

        // Parse markdown to HTML
        if (!class_exists('Parsedown')) {
            require_once APP_PATH . '/lib/Parsedown.php';
        }
        $parsedown = new Parsedown();
        $parsedown->setSafeMode(true);
        $bodyHtml = $parsedown->text($bodyRaw);

        // Extract headings for TOC
        $toc = self::extractToc($bodyHtml);

        // Add IDs to headings in body HTML
        $bodyHtml = self::addHeadingIds($bodyHtml);

        return array_merge($frontmatter, [
            'body_html' => $bodyHtml,
            'body_raw' => $bodyRaw,
            'toc' => $toc,
            'file' => basename($filepath),
            'reading_time' => max(1, (int)round(str_word_count($bodyRaw) / 200)),
        ]);
    }

    /**
     * Simple YAML frontmatter parser (no library needed for simple key:value)
     */
    private static function parseYaml(string $yaml): array
    {
        $data = [];
        $lines = explode("\n", $yaml);
        $currentKey = null;
        $currentList = null;

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if (!$trimmed || $trimmed[0] === '#') continue;

            // Multi-line list item:   - value
            if ($currentKey !== null && preg_match('/^\s+-\s+(.+)$/', $line, $lm)) {
                if ($currentList === null) $currentList = [];
                $currentList[] = trim($lm[1], '"\'');
                continue;
            }

            // If we were collecting a list, save it
            if ($currentKey !== null && $currentList !== null) {
                $data[$currentKey] = $currentList;
                $currentKey = null;
                $currentList = null;
            }

            if (preg_match('/^(\w+)\s*:\s*(.*)$/', $trimmed, $m)) {
                $key = $m[1];
                $value = trim($m[2]);

                // Empty value — might be start of multi-line list
                if ($value === '') {
                    $currentKey = $key;
                    $currentList = null;
                    continue;
                }

                // Handle inline arrays: ["item1", "item2"]
                if (str_starts_with($value, '[') && str_ends_with($value, ']')) {
                    $inner = substr($value, 1, -1);
                    $items = preg_split('/\s*,\s*/', $inner);
                    $data[$key] = array_map(fn($s) => trim($s, '"\''), $items);
                }
                // Handle quoted strings
                elseif (preg_match('/^["\'](.*)["\']\s*$/', $value, $qm)) {
                    $data[$key] = $qm[1];
                }
                // Plain value
                else {
                    $data[$key] = $value;
                }
                $currentKey = null;
                $currentList = null;
            }
        }

        // Flush last pending list
        if ($currentKey !== null && $currentList !== null) {
            $data[$currentKey] = $currentList;
        }

        return $data;
    }

    /**
     * Extract table of contents from HTML headings
     */
    private static function extractToc(string $html): array
    {
        $toc = [];
        if (preg_match_all('/<h([23])[^>]*>(.*?)<\/h[23]>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $text = strip_tags($match[2]);
                $id = self::slugify($text);
                $toc[] = [
                    'level' => (int)$match[1],
                    'text' => $text,
                    'id' => $id,
                ];
            }
        }
        return $toc;
    }

    /**
     * Add IDs to H2/H3 headings for anchor links
     */
    private static function addHeadingIds(string $html): string
    {
        return preg_replace_callback('/<h([23])([^>]*)>(.*?)<\/h([23])>/i', function ($m) {
            $text = strip_tags($m[3]);
            $id = self::slugify($text);
            return '<h' . $m[1] . $m[2] . ' id="' . htmlspecialchars($id) . '">' . $m[3] . '</h' . $m[4] . '>';
        }, $html);
    }

    /**
     * Convert text to URL-safe slug
     */
    private static function slugify(string $text): string
    {
        $text = strtolower(trim($text));
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}

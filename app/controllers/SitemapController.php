<?php

/**
 * SitemapController — Generates XML sitemap and robots.txt
 */
class SitemapController
{
    public function sitemap(): void
    {
        header('Content-Type: application/xml; charset=UTF-8');

        $base = rtrim(APP_URL, '/');

        // Static pages
        $pages = [
            ['loc' => '/',        'priority' => '1.0', 'changefreq' => 'weekly'],
            ['loc' => '/pricing',  'priority' => '0.9', 'changefreq' => 'monthly'],
            ['loc' => '/contact',  'priority' => '0.6', 'changefreq' => 'monthly'],
            ['loc' => '/blog',     'priority' => '0.8', 'changefreq' => 'daily'],
            ['loc' => '/privacy',  'priority' => '0.3', 'changefreq' => 'yearly'],
            ['loc' => '/terms',    'priority' => '0.3', 'changefreq' => 'yearly'],
        ];

        // Blog posts
        require_once APP_PATH . '/services/BlogService.php';
        $blog = new BlogService();
        $posts = $blog->getAllPosts();

        // Blog category pages
        $categories = $blog->getCategories();

        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ($pages as $p) {
            echo '  <url>' . "\n";
            echo '    <loc>' . htmlspecialchars($base . $p['loc']) . '</loc>' . "\n";
            echo '    <changefreq>' . $p['changefreq'] . '</changefreq>' . "\n";
            echo '    <priority>' . $p['priority'] . '</priority>' . "\n";
            echo '  </url>' . "\n";
        }

        foreach ($posts as $post) {
            echo '  <url>' . "\n";
            echo '    <loc>' . htmlspecialchars($base . '/blog/' . $post['slug']) . '</loc>' . "\n";
            echo '    <lastmod>' . date('Y-m-d', strtotime($post['date'])) . '</lastmod>' . "\n";
            echo '    <changefreq>monthly</changefreq>' . "\n";
            echo '    <priority>0.7</priority>' . "\n";
            echo '  </url>' . "\n";
        }

        foreach (array_keys($categories) as $cat) {
            echo '  <url>' . "\n";
            echo '    <loc>' . htmlspecialchars($base . '/blog/category/' . urlencode(strtolower($cat))) . '</loc>' . "\n";
            echo '    <changefreq>weekly</changefreq>' . "\n";
            echo '    <priority>0.5</priority>' . "\n";
            echo '  </url>' . "\n";
        }

        echo '</urlset>' . "\n";
        exit;
    }

    public function robots(): void
    {
        header('Content-Type: text/plain');
        $base = rtrim(APP_URL, '/');
        echo "User-agent: *\n";
        echo "Allow: /\n";
        echo "\n";
        echo "# Private areas\n";
        echo "Disallow: /dashboard\n";
        echo "Disallow: /cv/\n";
        echo "Disallow: /settings\n";
        echo "Disallow: /admin\n";
        echo "Disallow: /support\n";
        echo "Disallow: /profile/\n";
        echo "Disallow: /auth/\n";
        echo "\n";
        echo "Sitemap: {$base}/sitemap.xml\n";
        exit;
    }

    /**
     * /llms.txt — LLM-friendly overview following llmstxt.org spec
     */
    public function llmsTxt(): void
    {
        header('Content-Type: text/plain; charset=UTF-8');

        $base = rtrim(APP_URL, '/');

        // Build blog post links dynamically
        require_once APP_PATH . '/services/BlogService.php';
        $blog = new BlogService();
        $posts = $blog->getAllPosts();

        $blogSection = '';
        foreach ($posts as $post) {
            $title = $post['title'];
            $url = $base . '/blog/' . $post['slug'];
            $desc = !empty($post['description']) ? $post['description'] : '';
            $blogSection .= "- [{$title}]({$url})";
            if ($desc) {
                $blogSection .= ": {$desc}";
            }
            $blogSection .= "\n";
        }

        echo <<<LLMS
# CVScholar

> CVScholar is an online academic CV builder that helps researchers, professors, and PhD students create professionally formatted curriculum vitae. It provides LaTeX-style PDF output using Computer Modern Unicode fonts, one-click ORCID and Google Scholar publication import, DOI auto-fill, and field-specific templates — all with a free tier requiring no credit card.

CVScholar is built by Clossyan Technologies (Pvt) Ltd. The platform targets academic professionals who need a comprehensive curriculum vitae rather than an industry resume. An academic CV has no page limit and grows throughout a scholarly career, covering publications, teaching experience, grants, awards, and professional service.

Key features:

- 3 free templates (Classic, Modern, Detailed) designed for academic conventions
- 15+ CV sections including publications, grants, teaching, awards, and references
- ORCID and Google Scholar profile import to auto-populate publication lists
- DOI auto-fill — enter a DOI to automatically retrieve complete publication metadata
- LaTeX-quality PDF export without requiring LaTeX knowledge
- CV sharing via public links for applications and networking

## Product Pages

- [Home]({$base}/): Landing page explaining CVScholar features, career stage support, and how it works
- [Pricing]({$base}/pricing): Free and Pro plan comparison with feature matrix
- [Contact]({$base}/contact): Contact form and FAQ for support inquiries
- [Privacy Policy]({$base}/privacy): Data handling practices and GDPR information
- [Terms of Use]({$base}/terms): Service terms and acceptable use policy

## Blog Articles

{$blogSection}
## Optional

- [Sitemap]({$base}/sitemap.xml): XML sitemap listing all indexable pages
- [Blog Archive]({$base}/blog): Full blog index with search and category filtering
LLMS;

        exit;
    }
}

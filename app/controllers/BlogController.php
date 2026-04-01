<?php
/**
 * BlogController — Handles blog archive, single post, category, and tag pages
 */
class BlogController
{
    public function archive(): void
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $q = trim($_GET['q'] ?? '');

        $posts = $q ? BlogService::search($q) : BlogService::getAllPosts();
        $paginated = BlogService::paginate($posts, $page);
        $categories = BlogService::getCategories();
        $tags = BlogService::getTags();

        $metaTitle       = $q ? 'Search: ' . $q . ' — Blog' : 'Academic CV Blog — Tips, Guides & Resources';
        $metaDescription = 'Expert guides on academic CVs, publication formatting, tenure applications, and career advice for researchers, professors, and PhD students.';
        $canonicalUrl    = APP_URL . '/blog';
        $activeNav       = 'blog';

        $breadcrumbs = [
            ['name' => 'Home', 'url' => APP_URL],
            ['name' => 'Blog'],
        ];

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl, 'CollectionPage'),
            SchemaService::breadcrumbs($breadcrumbs),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/blog/archive.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function post(string $slug): void
    {
        $post = BlogService::getBySlug($slug);

        if (!$post) {
            http_response_code(404);
            include TEMPLATE_PATH . '/errors/404.php';
            return;
        }

        $related = BlogService::getRelated($post);

        $metaTitle       = $post['title'];
        $metaDescription = $post['description'] ?? '';
        $canonicalUrl    = APP_URL . '/blog/' . $post['slug'];
        $activeNav       = 'blog';
        $ogType          = 'article';

        if (!empty($post['featured_image'])) {
            $ogImage = APP_URL . '/assets/images/blog/' . $post['featured_image'];
        }

        $breadcrumbs = [
            ['name' => 'Home', 'url' => APP_URL],
            ['name' => 'Blog', 'url' => APP_URL . '/blog'],
        ];
        if (!empty($post['category'])) {
            $breadcrumbs[] = ['name' => $post['category'], 'url' => APP_URL . '/blog/category/' . urlencode(strtolower($post['category']))];
        }
        $breadcrumbs[] = ['name' => $post['title']];

        $structuredData = SchemaService::render([
            SchemaService::article($post),
            SchemaService::breadcrumbs($breadcrumbs),
        ]);

        ob_start();
        include TEMPLATE_PATH . '/blog/post.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function category(string $category): void
    {
        $category = urldecode($category);
        $page = max(1, (int)($_GET['page'] ?? 1));
        $posts = BlogService::getByCategory($category);
        $paginated = BlogService::paginate($posts, $page);
        $categories = BlogService::getCategories();
        $tags = BlogService::getTags();

        $displayCategory = ucwords($category);
        $metaTitle       = $displayCategory . ' — Academic CV Blog';
        $metaDescription = "Browse all articles about {$displayCategory}. Expert academic CV guides and resources for researchers.";
        $canonicalUrl    = APP_URL . '/blog/category/' . urlencode(strtolower($category));
        $activeNav       = 'blog';

        $breadcrumbs = [
            ['name' => 'Home', 'url' => APP_URL],
            ['name' => 'Blog', 'url' => APP_URL . '/blog'],
            ['name' => $displayCategory],
        ];

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl, 'CollectionPage'),
            SchemaService::breadcrumbs($breadcrumbs),
        ]);

        $filterLabel = $displayCategory;

        ob_start();
        include TEMPLATE_PATH . '/blog/archive.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }

    public function tag(string $tag): void
    {
        $tag = urldecode($tag);
        $page = max(1, (int)($_GET['page'] ?? 1));
        $posts = BlogService::getByTag($tag);
        $paginated = BlogService::paginate($posts, $page);
        $categories = BlogService::getCategories();
        $tags = BlogService::getTags();

        $displayTag = ucwords($tag);
        $metaTitle       = 'Tag: ' . $displayTag . ' — Academic CV Blog';
        $metaDescription = "Browse all articles tagged with '{$displayTag}'. Academic CV resources for researchers and professors.";
        $canonicalUrl    = APP_URL . '/blog/tag/' . urlencode(strtolower($tag));
        $activeNav       = 'blog';

        $breadcrumbs = [
            ['name' => 'Home', 'url' => APP_URL],
            ['name' => 'Blog', 'url' => APP_URL . '/blog'],
            ['name' => 'Tag: ' . $displayTag],
        ];

        $structuredData = SchemaService::render([
            SchemaService::webPage($metaTitle, $metaDescription, $canonicalUrl, 'CollectionPage'),
            SchemaService::breadcrumbs($breadcrumbs),
        ]);

        $filterLabel = 'Tag: ' . $displayTag;

        ob_start();
        include TEMPLATE_PATH . '/blog/archive.php';
        $content = ob_get_clean();
        include TEMPLATE_PATH . '/layouts/marketing.php';
    }
}

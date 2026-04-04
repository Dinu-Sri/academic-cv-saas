<?php
/**
 * SchemaService — Generates JSON-LD structured data for SEO
 */
class SchemaService
{
    private static string $orgName = 'Clossyan Technologies (Pvt) Ltd';
    private static string $email  = 'info@clossyan.com';

    /**
     * Render one or more schema objects as a <script> tag
     */
    public static function render(array $schemas): string
    {
        if (empty($schemas)) return '';
        $out = '';
        foreach ($schemas as $schema) {
            $json = json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            $out .= '<script type="application/ld+json">' . $json . '</script>' . "\n";
        }
        return $out;
    }

    /**
     * Organization schema — Clossyan Technologies
     */
    public static function organization(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'Organization',
            'name' => self::$orgName,
            'url' => APP_URL,
            'logo' => APP_URL . '/assets/images/logo-main.webp',
            'email' => self::$email,
            'contactPoint' => [
                '@type' => 'ContactPoint',
                'email' => self::$email,
                'contactType' => 'customer service',
            ],
            'sameAs' => array_values(array_filter([
                // Populated when social URLs are provided
            ])),
        ];
    }

    /**
     * WebSite schema with SearchAction for sitelinks
     */
    public static function webSite(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => APP_NAME,
            'url' => APP_URL,
            'description' => 'The academic CV builder for researchers, professors, and PhD students. Build professional LaTeX-style CVs with ORCID and Google Scholar integration.',
            'publisher' => [
                '@type' => 'Organization',
                'name' => self::$orgName,
            ],
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => APP_URL . '/blog?q={search_term_string}',
                'query-input' => 'required name=search_term_string',
            ],
        ];
    }

    /**
     * WebPage schema for marketing pages
     */
    public static function webPage(string $title, string $description, string $url, string $type = 'WebPage'): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => $type,
            'name' => $title,
            'description' => $description,
            'url' => $url,
            'isPartOf' => [
                '@type' => 'WebSite',
                'name' => APP_NAME,
                'url' => APP_URL,
            ],
            'publisher' => [
                '@type' => 'Organization',
                'name' => self::$orgName,
            ],
        ];
    }

    /**
     * SoftwareApplication schema for the CVScholar product
     */
    public static function softwareApplication(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'SoftwareApplication',
            'name' => APP_NAME,
            'applicationCategory' => 'BusinessApplication',
            'operatingSystem' => 'Web',
            'url' => APP_URL,
            'description' => 'Academic CV builder for researchers. Build professional CVs with LaTeX-style formatting, ORCID import, Google Scholar sync, and 18+ academic sections.',
            'offers' => [
                [
                    '@type' => 'Offer',
                    'name' => 'Free Plan',
                    'price' => '0',
                    'priceCurrency' => 'USD',
                    'description' => '2 CVs, 3 templates, all academic sections',
                ],
                [
                    '@type' => 'Offer',
                    'name' => 'Starter Plan',
                    'price' => '5.00',
                    'priceCurrency' => 'USD',
                    'description' => 'Unlimited CVs, all 6 templates, custom sections — $5 one-time for 30 days',
                ],
                [
                    '@type' => 'Offer',
                    'name' => 'Pro Plan',
                    'price' => '2.00',
                    'priceCurrency' => 'USD',
                    'priceValidUntil' => date('Y-12-31'),
                    'description' => 'Unlimited CVs, all 6 templates, custom sections, priority support — $2/month',
                ],
            ],
            'aggregateRating' => null, // Add when ratings are available
        ];
    }

    /**
     * FAQPage schema
     */
    public static function faqPage(array $faqs): array
    {
        $entities = [];
        foreach ($faqs as $faq) {
            $entities[] = [
                '@type' => 'Question',
                'name' => $faq['question'],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $faq['answer'],
                ],
            ];
        }
        return [
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => $entities,
        ];
    }

    /**
     * BlogPosting / Article schema
     */
    public static function article(array $post): array
    {
        $schema = [
            '@context' => 'https://schema.org',
            '@type' => ($post['schema_type'] ?? 'Article') === 'HowTo' ? 'HowTo' : 'Article',
            'headline' => $post['title'],
            'description' => $post['description'] ?? '',
            'url' => APP_URL . '/blog/' . $post['slug'],
            'datePublished' => $post['date'],
            'dateModified' => $post['updated'] ?? $post['date'],
            'author' => [
                '@type' => 'Organization',
                'name' => self::$orgName,
            ],
            'publisher' => [
                '@type' => 'Organization',
                'name' => self::$orgName,
                'logo' => [
                    '@type' => 'ImageObject',
                    'url' => APP_URL . '/assets/images/logo-main.webp',
                ],
            ],
            'mainEntityOfPage' => APP_URL . '/blog/' . $post['slug'],
        ];
        if (!empty($post['featured_image'])) {
            $schema['image'] = APP_URL . '/assets/images/blog/' . $post['featured_image'];
        }
        return $schema;
    }

    /**
     * BreadcrumbList schema
     */
    public static function breadcrumbs(array $items): array
    {
        $list = [];
        foreach ($items as $i => $item) {
            $entry = [
                '@type' => 'ListItem',
                'position' => $i + 1,
                'name' => $item['name'],
            ];
            if (!empty($item['url'])) {
                $entry['item'] = $item['url'];
            }
            $list[] = $entry;
        }
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => $list,
        ];
    }

    /**
     * ItemList schema (e.g. for pricing tiers)
     */
    public static function itemList(array $items, string $name = ''): array
    {
        $list = [];
        foreach ($items as $i => $item) {
            $list[] = [
                '@type' => 'ListItem',
                'position' => $i + 1,
                'name' => $item['name'],
                'description' => $item['description'] ?? '',
            ];
        }
        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'ItemList',
            'itemListElement' => $list,
        ];
        if ($name) $schema['name'] = $name;
        return $schema;
    }
}

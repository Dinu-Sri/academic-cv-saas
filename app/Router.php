<?php
/**
 * Simple Router
 */
class Router
{
    private array $routes = [];

    public function get(string $path, string $handler): void
    {
        $this->routes['GET'][$path] = $handler;
    }

    public function post(string $path, string $handler): void
    {
        $this->routes['POST'][$path] = $handler;
    }

    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = $this->getUri();

        // Try exact match first
        if (isset($this->routes[$method][$uri])) {
            $this->callAction($this->routes[$method][$uri]);
            return;
        }

        // Try pattern matching (for {id} params)
        if (isset($this->routes[$method])) {
            foreach ($this->routes[$method] as $route => $handler) {
                $pattern = preg_replace('/\{(\w+)\}/', '([\\w-]+)', $route);
                $pattern = '#^' . $pattern . '$#';

                if (preg_match($pattern, $uri, $matches)) {
                    array_shift($matches); // Remove full match
                    $this->callAction($handler, $matches);
                    return;
                }
            }
        }

        // 404
        http_response_code(404);
        include TEMPLATE_PATH . '/errors/404.php';
    }

    private function getUri(): string
    {
        $uri = $_SERVER['REQUEST_URI'];

        // Remove base path (for XAMPP subfolder access)
        $basePath = parse_url(APP_URL, PHP_URL_PATH);
        if ($basePath && str_starts_with($uri, $basePath)) {
            $uri = substr($uri, strlen($basePath));
        }

        // Remove query string
        $uri = strtok($uri, '?');

        // Ensure leading slash, remove trailing slash
        $uri = '/' . trim($uri, '/');

        return $uri === '' ? '/' : $uri;
    }

    private function callAction(string $handler, array $params = []): void
    {
        [$controllerName, $method] = explode('@', $handler);

        $controller = new $controllerName();

        if (!method_exists($controller, $method)) {
            http_response_code(500);
            die("Method {$method} not found in {$controllerName}");
        }

        call_user_func_array([$controller, $method], $params);
    }
}
